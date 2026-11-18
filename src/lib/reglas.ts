// Reglas puras de cambiar, cancelar y recordar una llamada. Sin base ni red.
// Los números (cambios, horas, recordatorios) salen de agenda.config.ts.

export type Quien = 'persona' | 'admin';
export type ErrorCambio = 'no-vigente' | 'muy-cerca' | 'sin-cambios' | 'hueco-tomado' | 'falta-hueco' | 'mismo-hueco' | 'no-guardado';

export const TEXTO_ERROR_CAMBIO: Record<ErrorCambio, string> = {
  'no-vigente': 'Esta llamada ya no se puede cambiar.',
  'muy-cerca': 'Tu llamada es muy pronto para cambiarla aquí. Escríbenos por WhatsApp y lo resolvemos.',
  'sin-cambios': 'Ya usaste tus cambios de horario. Escríbenos por WhatsApp y lo resolvemos.',
  'hueco-tomado': 'Alguien acaba de tomar ese horario. Elige otro.',
  'falta-hueco': 'Elige un horario nuevo.',
  'mismo-hueco': 'Ese ya es tu horario. Elige otro.',
  'no-guardado': 'No pudimos guardar el cambio. Intenta de nuevo en un momento.',
};

export type ReservaCambiable = { estado: string; inicio: string; cambiosPersona: number };

/** Tú (desde /admin) puedes mover una llamada hasta 72 h después de su hora: quien no llegó, o la que se alargó. */
export const GRACIA_ADMIN_MS = 72 * 3_600_000;

/**
 * ¿Se puede mover o cancelar esta reserva ahora?
 * - Persona: mover hasta `horasAntes` antes y con cambios disponibles; cancelar hasta que empiece (mejor un aviso
 *   tarde que una silla vacía) y no gasta cambios.
 * - Tú: sin tope de cambios.
 */
export function evaluarCambio(
  r: ReservaCambiable,
  ahora: number,
  quien: Quien,
  accion: 'mover' | 'cancelar',
  reglas: { cambiosMaximos: number; horasAntes: number },
): { ok: true } | { ok: false; error: ErrorCambio } {
  if (r.estado !== 'agendada') return { ok: false, error: 'no-vigente' };
  const falta = Date.parse(r.inicio) - ahora;
  if (quien === 'admin') return falta > -GRACIA_ADMIN_MS ? { ok: true } : { ok: false, error: 'no-vigente' };
  if (falta <= 0) return { ok: false, error: 'no-vigente' };
  if (accion === 'cancelar') return { ok: true };
  if (falta < reglas.horasAntes * 3_600_000) return { ok: false, error: 'muy-cerca' };
  if (r.cambiosPersona >= reglas.cambiosMaximos) return { ok: false, error: 'sin-cambios' };
  return { ok: true };
}

export function cambiosRestantes(usados: number, maximos: number) {
  return Math.max(0, maximos - usados);
}

export type ReservaRecordable = { estado: string; inicio: string; creada: string; recordatorios: Record<string, string> };

/**
 * Qué recordatorio toca ahora (o null). `horas` en orden de mayor a menor, p. ej. [24, 1].
 * - El de H horas sale cuando faltan ≤ H y más que el siguiente (si el cron se cayó, mejor solo el más cercano).
 * - Todos menos el último exigen que la persona haya agendado con más de H horas de anticipación (si agendó hoy para
 *   mañana temprano, el de 24 h no tiene sentido).
 * - El último (el más cercano) sale siempre que falte ≤ H y la llamada no haya empezado.
 */
export function recordatorioQueToca(r: ReservaRecordable, ahora: number, horas: number[]): number | null {
  if (r.estado !== 'agendada') return null;
  const H = 3_600_000;
  const falta = Date.parse(r.inicio) - ahora;
  if (falta <= 0) return null;
  const orden = [...horas].sort((a, b) => b - a);
  for (let i = 0; i < orden.length; i++) {
    const h = orden[i];
    const siguiente = orden[i + 1] ?? 0;
    const ultimo = i === orden.length - 1;
    if (falta > h * H || falta <= siguiente * H) continue;
    if (r.recordatorios[`${h}h`]) return null;
    if (!ultimo && Date.parse(r.inicio) - Date.parse(r.creada) <= h * H) return null;
    return h;
  }
  return null;
}
