// Archivo .ics («Agregar a mi calendario») y enlace de Google Calendar para quien agenda. Puro.

const fechaIcs = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');

function escapar(t: string) {
  return t.replace(/\\/g, '\\\\').replace(/\n/g, '\\n').replace(/,/g, '\\,').replace(/;/g, '\\;');
}

/** Corta las líneas a 75 octetos como pide el estándar (RFC 5545). */
function plegar(linea: string) {
  const out: string[] = [];
  let resto = linea;
  while (Buffer.byteLength(resto) > 75) {
    let n = 75;
    while (Buffer.byteLength(resto.slice(0, n)) > 75) n--;
    out.push(resto.slice(0, n));
    resto = ' ' + resto.slice(n);
  }
  out.push(resto);
  return out.join('\r\n');
}

export function ics(p: { uid: string; titulo: string; descripcion: string; inicio: string; fin: string; lugar?: string | null; secuencia?: number; cancelado?: boolean }) {
  const lineas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//agenda-abierta//ES',
    'CALSCALE:GREGORIAN',
    `METHOD:${p.cancelado ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${p.uid}`,
    `SEQUENCE:${p.secuencia ?? 0}`,
    `DTSTAMP:${fechaIcs(new Date().toISOString())}`,
    `DTSTART:${fechaIcs(p.inicio)}`,
    `DTEND:${fechaIcs(p.fin)}`,
    `SUMMARY:${escapar(p.titulo)}`,
    `DESCRIPTION:${escapar(p.descripcion)}`,
    ...(p.lugar ? [`LOCATION:${escapar(p.lugar)}`, `URL:${p.lugar}`] : []),
    `STATUS:${p.cancelado ? 'CANCELLED' : 'CONFIRMED'}`,
    'BEGIN:VALARM',
    'TRIGGER:-PT15M',
    'ACTION:DISPLAY',
    `DESCRIPTION:${escapar(p.titulo)}`,
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lineas.map(plegar).join('\r\n') + '\r\n';
}

/** Enlace «Agregar a Google Calendar» (plantilla pública, no necesita llaves). */
export function enlaceGoogleCalendar(p: { titulo: string; descripcion: string; inicio: string; fin: string; lugar?: string | null }) {
  const q = new URLSearchParams({
    action: 'TEMPLATE',
    text: p.titulo,
    dates: `${fechaIcs(p.inicio)}/${fechaIcs(p.fin)}`,
    details: p.descripcion,
    ...(p.lugar ? { location: p.lugar } : {}),
  });
  return `https://calendar.google.com/calendar/render?${q}`;
}
