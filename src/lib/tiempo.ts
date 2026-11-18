// Horas en la zona del anfitrión sin librerías: Intl hace la conversión, aquí solo se resuelve el desfase.
// Puro: sin Next ni disco. Lo usan el servidor, el navegador y las pruebas.

const cacheFmt = new Map<string, Intl.DateTimeFormat>();
function fmtPartes(tz: string) {
  let f = cacheFmt.get(tz);
  if (!f) {
    f = new Intl.DateTimeFormat('en-US', {
      timeZone: tz, hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
    });
    cacheFmt.set(tz, f);
  }
  return f;
}

/** Minutos que la zona va adelante de UTC en ese instante (México centro: -360). */
export function desfaseMin(tz: string, instante: number): number {
  const p = Object.fromEntries(fmtPartes(tz).formatToParts(new Date(instante)).map((x) => [x.type, x.value]));
  const comoUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour % 24, +p.minute, +p.second);
  return Math.round((comoUtc - Math.floor(instante / 1000) * 1000) / 60000);
}

/** El instante (ms) de «AAAA-MM-DD HH:MM» en la zona dada. */
export function enZona(fecha: string, hora: string, tz: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  const [h, mi] = hora.split(':').map(Number);
  const supuesto = Date.UTC(y, m - 1, d, h, mi);
  const d1 = desfaseMin(tz, supuesto);
  let t = supuesto - d1 * 60000;
  const d2 = desfaseMin(tz, t);
  if (d2 !== d1) t = supuesto - d2 * 60000;
  return t;
}

/** «AAAA-MM-DD» del instante en la zona. */
export function claveDia(instante: number | string, tz: string): string {
  const t = typeof instante === 'string' ? Date.parse(instante) : instante;
  const p = Object.fromEntries(fmtPartes(tz).formatToParts(new Date(t)).map((x) => [x.type, x.value]));
  return `${p.year}-${p.month}-${p.day}`;
}

/** Día de la semana (0 = domingo) de una fecha de calendario. */
export function diaSemana(fecha: string): number {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).getUTCDay();
}

export function sumarDias(fecha: string, n: number): string {
  const [y, m, d] = fecha.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, d + n, 12)).toISOString().slice(0, 10);
}

const cacheEt = new Map<string, Intl.DateTimeFormat>();
function fmt(tz: string, op: Intl.DateTimeFormatOptions) {
  const k = tz + JSON.stringify(op);
  let f = cacheEt.get(k);
  if (!f) {
    f = new Intl.DateTimeFormat('es-MX', { timeZone: tz, ...op });
    cacheEt.set(k, f);
  }
  return f;
}

const capital = (t: string) => t.charAt(0).toUpperCase() + t.slice(1);

/** «Sábado 21 de noviembre». */
export function etiquetaDia(iso: string, tz: string) {
  return capital(fmt(tz, { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(iso)));
}

/** «sáb 21». */
export function diaCorto(iso: string, tz: string) {
  return fmt(tz, { weekday: 'short', day: 'numeric' }).format(new Date(iso)).replace('.', '');
}

/** «14:45». */
export function etiquetaHora(iso: string, tz: string) {
  return fmt(tz, { hour: '2-digit', minute: '2-digit', hour12: false }).format(new Date(iso));
}

/** Nombre de la zona para los textos: «hora de Ciudad de México», «hora de Colombia». */
export function nombreZona(tz: string) {
  try {
    const n = new Intl.DateTimeFormat('es-MX', { timeZone: tz, timeZoneName: 'shortGeneric' })
      .formatToParts(new Date())
      .find((x) => x.type === 'timeZoneName')?.value;
    if (n && !/GMT|UTC|[+-]\d/.test(n)) return n;
  } catch { /* sin datos de zonas: se usa la ciudad */ }
  return `hora de ${tz.split('/').pop()?.replace(/_/g, ' ') ?? tz}`;
}
