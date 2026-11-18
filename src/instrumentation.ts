// En un servidor que se queda prendido (tu computadora, un VPS, Railway, Render), la vuelta del reloj corre sola cada
// 5 minutos: recordatorios por correo y reintentos con Google. En Vercel no (ahí se usa /api/vuelta con un cron).
// RELOJ=apagado lo desactiva.
export async function register() {
  if (process.env.NEXT_RUNTIME !== 'nodejs' || process.env.VERCEL || process.env.RELOJ === 'apagado') return;
  const { vuelta } = await import('./lib/agenda');
  const { deps } = await import('./lib/servidor');
  const g = globalThis as unknown as { __agendaReloj?: boolean };
  if (g.__agendaReloj) return;
  g.__agendaReloj = true;
  const minutos = Math.max(1, Number(process.env.RELOJ_MINUTOS) || 5);
  const correr = async () => {
    try {
      const r = await vuelta(deps());
      if (r.recordatorios || r.google) console.info(`[agenda] reloj: ${r.recordatorios} recordatorio(s), ${r.google} evento(s) de Google al día`);
    } catch (e) {
      console.error('[agenda] reloj:', e instanceof Error ? e.message : e);
    }
  };
  setTimeout(correr, 15_000);
  setInterval(correr, minutos * 60_000);
}
