import { describe, expect, it } from 'vitest';
import { claveDia, enZona, etiquetaHora } from '@/lib/tiempo';
import { choca, fechasDeAgenda, generarHuecos, huecosEnTanda, quedanLlamadas, ventanasDeBloques, ventanasYocupados } from '@/lib/huecos';
import { califica, leerAplicacion, leerLead, mezclarLead, normalizarWhatsapp, pasosDe, rellenar } from '@/lib/aplicacion';
import { evaluarCambio, recordatorioQueToca } from '@/lib/reglas';
import { firmarToken, leerToken } from '@/lib/token';
import { ics } from '@/lib/ics';
import { problemasDeConfig } from '@/lib/config';
import ejemplo from '@marca';

const MX = 'America/Mexico_City';
const H = 3_600_000;
const M = 60_000;

describe('tiempo', () => {
  it('convierte la hora local de México a UTC (sin horario de verano)', () => {
    expect(new Date(enZona('2026-11-21', '14:00', MX)).toISOString()).toBe('2026-11-21T20:00:00.000Z');
  });
  it('respeta el horario de verano de otras zonas', () => {
    expect(new Date(enZona('2026-07-01', '10:00', 'America/New_York')).toISOString()).toBe('2026-07-01T14:00:00.000Z');
    expect(new Date(enZona('2026-12-01', '10:00', 'America/New_York')).toISOString()).toBe('2026-12-01T15:00:00.000Z');
    expect(new Date(enZona('2026-07-01', '10:00', 'Europe/Madrid')).toISOString()).toBe('2026-07-01T08:00:00.000Z');
  });
  it('da el día y la hora en la zona', () => {
    expect(claveDia('2026-11-22T03:00:00.000Z', MX)).toBe('2026-11-21');
    expect(etiquetaHora('2026-11-21T20:45:00.000Z', MX)).toBe('14:45');
  });
});

describe('huecos', () => {
  const fechas = ['2026-11-21', '2026-11-22', '2026-11-23']; // sáb, dom, lun
  const bloques = [
    { dias: ['sab' as const], desde: '14:00', hasta: '15:30' },
    { dias: ['lun' as const], desde: '10:00', hasta: '11:30' },
  ];
  const ahora = Date.parse('2026-11-20T12:00:00.000Z');
  const base = { minutos: 45, aireEntreLlamadas: 0, aireEventos: 15, ahora, margenMin: 45 };

  it('saca llamadas seguidas dentro de cada bloque y respeta los días', () => {
    const v = ventanasDeBloques(fechas, bloques, MX);
    const h = generarHuecos({ ...base, ventanas: v, ocupados: [] });
    expect(h.map((x) => `${claveDia(x.inicio, MX)} ${etiquetaHora(x.inicio, MX)}`)).toEqual([
      '2026-11-21 14:00', '2026-11-21 14:45', '2026-11-23 10:00', '2026-11-23 10:45',
    ]);
  });
  it('salta los días bloqueados', () => {
    const v = ventanasDeBloques(fechas, bloques, MX, ['2026-11-21']);
    expect(generarHuecos({ ...base, ventanas: v, ocupados: [] })).toHaveLength(2);
  });
  it('el aire entre llamadas separa los inicios', () => {
    const v = ventanasDeBloques(['2026-11-21'], [{ dias: ['sab'], desde: '14:00', hasta: '16:00' }], MX);
    const h = generarHuecos({ ...base, aireEntreLlamadas: 15, ventanas: v, ocupados: [] });
    expect(h.map((x) => etiquetaHora(x.inicio, MX))).toEqual(['14:00', '15:00']);
  });
  it('no ofrece nada antes del margen para agendar', () => {
    const v = ventanasDeBloques(['2026-11-21'], [bloques[0]], MX);
    const justo = enZona('2026-11-21', '13:30', MX);
    const h = generarHuecos({ ...base, ahora: justo, ventanas: v, ocupados: [] });
    expect(h.map((x) => etiquetaHora(x.inicio, MX))).toEqual(['14:45']);
  });
  it('choca: aire contra eventos ajenos, sin aire contra llamadas propias, y los bordes pegados pasan', () => {
    const b0 = enZona('2026-11-21', '14:00', MX);
    const b1 = enZona('2026-11-21', '15:30', MX);
    const ajeno = { ini: b1 + 10 * M, fin: b1 + 60 * M, titulo: 'Cena' };
    expect(choca(b0 + 45 * M, b1, [ajeno], 15 * M, b0, b1)).toBe(true);
    const pegado = { ini: b1, fin: b1 + 60 * M, titulo: 'Cena' };
    expect(choca(b0 + 45 * M, b1, [pegado], 15 * M, b0, b1)).toBe(false);
    const enCurso = { ini: b0 - 2 * H, fin: b0 + 5 * M, titulo: 'Clase' };
    expect(choca(b0, b0 + 45 * M, [enCurso], 15 * M, b0, b1)).toBe(false);
    const propia = { ini: b0 + 45 * M, fin: b1, titulo: '', propio: true };
    expect(choca(b0, b0 + 45 * M, [propia], 15 * M, b0, b1)).toBe(false);
    expect(choca(b0 + 45 * M, b1, [propia], 15 * M, b0, b1)).toBe(true);
  });
  it('el calendario manda: si hay ventanas, reemplazan a los bloques', () => {
    const ini = enZona('2026-11-22', '09:00', MX);
    const eventos = [{ ini, fin: ini + 90 * M, titulo: '📞 Llamadas extra' }, { ini: ini + 3 * H, fin: ini + 4 * H, titulo: 'Gym' }];
    const r = ventanasYocupados(eventos, '📞 Llamadas', [{ ini: 1, fin: 2 }]);
    expect(r.delCalendario).toBe(true);
    expect(r.ventanas).toEqual([{ ini, fin: ini + 90 * M }]);
    expect(r.ocupados.map((e) => e.titulo)).toEqual(['Gym']);
    expect(ventanasYocupados([eventos[1]], '📞 Llamadas', [{ ini: 1, fin: 2 }]).ventanas).toEqual([{ ini: 1, fin: 2 }]);
  });
  it('tandas: dos días a la vista y se abre el siguiente cuando quedan pocos', () => {
    const mk = (f: string, n: number) => Array.from({ length: n }, (_, i) => ({ inicio: new Date(enZona(f, `1${i}:00`, MX)).toISOString() }));
    const libres = [...mk('2026-11-21', 3), ...mk('2026-11-22', 2), ...mk('2026-11-23', 4)];
    expect(huecosEnTanda(libres, { dias: 2, umbral: 5 }, MX)).toHaveLength(9);
    expect(huecosEnTanda(libres, { dias: 2, umbral: 4 }, MX)).toHaveLength(5);
    expect(huecosEnTanda(libres, { dias: 0, umbral: 0 }, MX)).toHaveLength(9);
  });
  it('contador real: nunca más que los huecos ni que el tope', () => {
    expect(quedanLlamadas(30, 15, 20)).toBe(5);
    expect(quedanLlamadas(3, 0, 20)).toBe(3);
    expect(quedanLlamadas(10, 25, 20)).toBe(0);
    expect(quedanLlamadas(10, 25, null)).toBe(10);
  });
  it('fechas de la agenda: rodantes o fijas de lanzamiento', () => {
    expect(fechasDeAgenda('2026-11-20', { diasAdelante: 2 })).toEqual(['2026-11-20', '2026-11-21', '2026-11-22']);
    expect(fechasDeAgenda('2026-11-20', { diasAdelante: 9, fechas: { desde: '2026-11-18', hasta: '2026-11-21' } })).toEqual(['2026-11-20', '2026-11-21']);
  });
});

describe('aplicación', () => {
  it('WhatsApp con código de país', () => {
    expect(normalizarWhatsapp('+52 55 1234 5678')).toBe('+525512345678');
    expect(normalizarWhatsapp('0052 55 1234 5678')).toBe('+525512345678');
    expect(normalizarWhatsapp('5512345678')).toBeNull();
    expect(normalizarWhatsapp('hola')).toBeNull();
  });
  const filtro = [
    { id: 'ya_vende', pregunta: '¿?', bloquea: false },
    { id: 'puede', pregunta: '¿?', bloquea: true },
  ];
  const mini = [
    { id: 'prioridad', tipo: 'escala' as const, pregunta: '¿?' },
    { id: 'pronto', tipo: 'sino' as const, pregunta: '¿?' },
    { id: 'miedo', tipo: 'texto' as const, pregunta: '¿?' },
  ];
  it('solo bloquea el «no» a una pregunta que bloquea', () => {
    expect(califica(filtro, { ya_vende: false, puede: true })).toBe(true);
    expect(califica(filtro, { ya_vende: true, puede: false })).toBe(false);
  });
  const form = (cambios: Record<string, string> = {}) => {
    const f = new FormData();
    const v = { whatsapp: '+52 55 1234 5678', f_ya_vende: 'no', f_puede: 'si', nombre: 'Prueba Uno', correo: 'Prueba@Example.com', m_prioridad: '8', m_pronto: 'si', m_miedo: 'el tiempo', inicio: '2026-11-21T20:00:00.000Z', zona: 'America/Bogota', ...cambios };
    for (const [k, x] of Object.entries(v)) f.set(k, x);
    return f;
  };
  it('lee y valida el formulario completo', () => {
    const r = leerAplicacion(form(), filtro, mini);
    expect(r.ok && r.data).toMatchObject({ correo: 'prueba@example.com', whatsapp: '+525512345678', filtro: { ya_vende: false, puede: true }, mini: { prioridad: 8, pronto: true, miedo: 'el tiempo' }, zonaVisitante: 'America/Bogota' });
  });
  it('el servidor vuelve a revisar el filtro y cada respuesta', () => {
    expect(leerAplicacion(form({ f_puede: 'no' }), filtro, mini)).toMatchObject({ ok: false, error: 'no-califica' });
    expect(leerAplicacion(form({ m_prioridad: '11' }), filtro, mini)).toMatchObject({ ok: false, error: 'falta-respuesta', paso: 'm:prioridad' });
    expect(leerAplicacion(form({ correo: 'x' }), filtro, mini)).toMatchObject({ ok: false, error: 'correo-invalido' });
    expect(leerAplicacion(form({ inicio: 'mañana' }), filtro, mini)).toMatchObject({ ok: false, error: 'falta-hueco' });
  });
  it('lead parcial: el paso nunca retrocede y no pierde datos', () => {
    const pasos = pasosDe(filtro, mini);
    const a = leerLead({ whatsapp: '+525512345678', paso: 'datos', nombre: 'Prueba', filtro: { puede: 'si' } }, pasos)!;
    const g = mezclarLead(a, null);
    const b = leerLead({ whatsapp: '+525512345678', paso: 'f:puede' }, pasos)!;
    const g2 = mezclarLead(b, g);
    expect(g2.ultimoPaso).toBe('datos');
    expect(g2.nombre).toBe('Prueba');
    expect(leerLead({ whatsapp: '+525512345678', paso: 'inventado' }, pasos)).toBeNull();
  });
  it('plantillas de mensaje', () => {
    expect(rellenar('¡Hola {nombre}! Video: {video}.', { nombre: 'Lía' })).toBe('¡Hola Lía! Video:.');
  });
});

describe('reglas de cambio y recordatorios', () => {
  const reglas = { cambiosMaximos: 2, horasAntes: 2 };
  const inicio = '2026-11-21T20:00:00.000Z';
  const t = Date.parse(inicio);
  it('la persona mueve hasta N horas antes y con cambios disponibles', () => {
    expect(evaluarCambio({ estado: 'agendada', inicio, cambiosPersona: 0 }, t - 3 * H, 'persona', 'mover', reglas)).toEqual({ ok: true });
    expect(evaluarCambio({ estado: 'agendada', inicio, cambiosPersona: 0 }, t - H, 'persona', 'mover', reglas)).toEqual({ ok: false, error: 'muy-cerca' });
    expect(evaluarCambio({ estado: 'agendada', inicio, cambiosPersona: 2 }, t - 3 * H, 'persona', 'mover', reglas)).toEqual({ ok: false, error: 'sin-cambios' });
    expect(evaluarCambio({ estado: 'agendada', inicio, cambiosPersona: 2 }, t - H, 'persona', 'cancelar', reglas)).toEqual({ ok: true });
    expect(evaluarCambio({ estado: 'agendada', inicio, cambiosPersona: 9 }, t + H, 'admin', 'mover', reglas)).toEqual({ ok: true });
    expect(evaluarCambio({ estado: 'cancelada', inicio, cambiosPersona: 0 }, t - 9 * H, 'persona', 'mover', reglas)).toEqual({ ok: false, error: 'no-vigente' });
  });
  it('24 h solo si agendó con más de 24 h; 1 h siempre; nunca dos veces', () => {
    const r = { estado: 'agendada', inicio, creada: new Date(t - 48 * H).toISOString(), recordatorios: {} as Record<string, string> };
    expect(recordatorioQueToca(r, t - 30 * H, [24, 1])).toBeNull();
    expect(recordatorioQueToca(r, t - 20 * H, [24, 1])).toBe(24);
    expect(recordatorioQueToca({ ...r, recordatorios: { '24h': 'x' } }, t - 20 * H, [24, 1])).toBeNull();
    expect(recordatorioQueToca(r, t - 50 * M, [24, 1])).toBe(1);
    expect(recordatorioQueToca({ ...r, creada: new Date(t - 5 * H).toISOString() }, t - 4 * H, [24, 1])).toBeNull();
    expect(recordatorioQueToca(r, t + M, [24, 1])).toBeNull();
  });
});

describe('enlaces firmados, .ics y config de ejemplo', () => {
  const id = '6f1c3a52-2f0b-4c1e-9a55-0d3f1b2c4e5a';
  it('el token solo vale con el mismo secreto', () => {
    const tk = firmarToken(id, 'secreto-uno')!;
    expect(leerToken(tk, 'secreto-uno')).toBe(id);
    expect(leerToken(tk, 'secreto-dos')).toBeNull();
    expect(leerToken(tk.replace(/.$/, (c) => (c === 'a' ? 'b' : 'a')), 'secreto-uno')).toBeNull();
    expect(firmarToken(id, '')).toBeNull();
  });
  it('.ics válido', () => {
    const t = ics({ uid: 'x@agenda', titulo: 'Llamada, prueba', descripcion: 'a\nb', inicio: '2026-11-21T20:00:00.000Z', fin: '2026-11-21T20:45:00.000Z', lugar: 'https://example.com/sala' });
    expect(t).toContain('DTSTART:20261121T200000Z');
    expect(t).toContain('SUMMARY:Llamada\\, prueba');
    expect(t.split('\r\n').every((l) => Buffer.byteLength(l) <= 75)).toBe(true);
  });
  it('la config de ejemplo pasa la revisión', () => {
    expect(problemasDeConfig(ejemplo)).toEqual([]);
  });
  it('la revisión explica en español lo que está mal', () => {
    const malo = { ...ejemplo, horario: { ...ejemplo.horario, zona: 'Marte/Base', bloques: [{ dias: ['lunes' as never], desde: '9:00', hasta: '08:00' }] } };
    const p = problemasDeConfig(malo);
    expect(p.join(' ')).toMatch(/zona horaria válida/);
    expect(p.join(' ')).toMatch(/lun mar mie/);
    expect(p.join(' ')).toMatch(/09:30/);
  });
});
