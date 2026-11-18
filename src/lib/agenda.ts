// El corazón del servidor: qué horarios se ofrecen, reservar, mover, cancelar y la vuelta del reloj (recordatorios y
// reintentos con Google). Todo recibe sus dependencias (`Deps`) para poder probarse sin red ni base real.

import { randomUUID } from 'node:crypto';
import type { Config } from './config';
import type { Almacen, Reserva } from './almacen';
import type { Aplicacion, Lead } from './aplicacion';
import { leerLead, mezclarLead, pasosDe, rellenar } from './aplicacion';
import { fechasDeAgenda, generarHuecos, huecosEnTanda, quedanLlamadas, ventanasDeBloques, ventanasYocupados, type EventoCal, type Hueco } from './huecos';
import { claveDia, enZona, sumarDias } from './tiempo';
import { evaluarCambio, recordatorioQueToca, type ErrorCambio, type Quien } from './reglas';
import { borrarEvento, crearEvento, eventosEntre, moverEvento, type ConfigGoogle } from './google';
import { firmarToken } from './token';
import type { Correo } from './correo';
import { correoAviso, correoCambio, correoCancelacion, correoConfirmacion, correoRecordatorio } from './plantillas';

export type Deps = {
  cfg: Config;
  alm: Almacen;
  google: ConfigGoogle | null;
  enviar: (c: Correo) => Promise<void>;
  secreto: string;
  base: string;
  avisos: string | null;
  fetch?: typeof fetch;
  ahora?: () => number;
};

const ahoraDe = (d: Deps) => (d.ahora ? d.ahora() : Date.now());

export function urlLlamada(d: Deps, id: string) {
  return `${d.base}/llamada/${firmarToken(id, d.secreto)}`;
}

export type EstadoAgenda = {
  /** Los que se muestran (por tandas). */
  huecos: Hueco[];
  /** Todos los libres (reagendar y /admin los ven todos). */
  todos: Hueco[];
  quedan: number;
  tope: number;
  reservadas: number;
  masPorAbrir: boolean;
  cerrada: boolean;
  cierre: string | null;
  errorCalendario: boolean;
};

/** Rango de la agenda en instantes: del primer día al día siguiente del último. */
function rango(cfg: Config, ahora: number) {
  const tz = cfg.horario.zona;
  const fechas = fechasDeAgenda(claveDia(ahora, tz), cfg.horario);
  if (!fechas.length) return { fechas, desde: ahora, hasta: ahora };
  return { fechas, desde: enZona(fechas[0], '00:00', tz), hasta: enZona(sumarDias(fechas[fechas.length - 1], 1), '00:00', tz) };
}

export function instanteCierre(cfg: Config): number | null {
  if (!cfg.cupo.cierre) return null;
  const [f, h] = cfg.cupo.cierre.split('T');
  return enZona(f, h, cfg.horario.zona);
}

export async function estadoAgenda(d: Deps, op: { margenMin?: number; excluir?: string } = {}): Promise<EstadoAgenda> {
  const { cfg } = d;
  const ahora = ahoraDe(d);
  const tz = cfg.horario.zona;
  const { fechas, desde, hasta } = rango(cfg, ahora);
  const cierreMs = instanteCierre(cfg);
  const cerrada = cierreMs !== null && ahora >= cierreMs;
  const vacio = { huecos: [], todos: [], quedan: 0, tope: cfg.cupo.tope ?? 0, reservadas: 0, masPorAbrir: false, cerrada, cierre: cierreMs ? new Date(cierreMs).toISOString() : null };

  let eventos: EventoCal[] = [];
  if (d.google) {
    try {
      eventos = await eventosEntre(d.google, desde, hasta, d.fetch ?? fetch);
    } catch (e) {
      // Falta de lectura no es «libre»: sin tu calendario completo no se ofrece nada.
      console.error('[agenda] Google Calendar:', e instanceof Error ? e.message : e);
      return { ...vacio, errorCalendario: true };
    }
  }
  const activas = (await d.alm.leer((t) => t.reservas(new Date(desde - 86_400_000)))).filter((r) => r.estado === 'agendada' && r.id !== op.excluir);
  const propias: EventoCal[] = activas.map((r) => ({ ini: Date.parse(r.inicio), fin: Date.parse(r.fin), titulo: '', propio: true }));
  const bloques = ventanasDeBloques(fechas, cfg.horario.bloques, tz, cfg.horario.diasBloqueados);
  const { ventanas, ocupados } = ventanasYocupados(eventos, cfg.google.tituloVentana, bloques);
  const sinBloqueados = ventanas.filter((w) => !cfg.horario.diasBloqueados.includes(claveDia(w.ini, tz)));
  const todos = generarHuecos({
    ventanas: sinBloqueados,
    ocupados: [...ocupados, ...propias],
    minutos: cfg.llamada.minutos,
    aireEntreLlamadas: cfg.llamada.aireEntreLlamadas,
    aireEventos: cfg.google.aire,
    ahora,
    margenMin: op.margenMin ?? cfg.llamada.margenParaAgendar,
  }).filter((h) => Date.parse(h.inicio) < hasta);
  // Lo que cuenta contra el tope: con fechas fijas (lanzamiento), todas las de la ventana; si no, las que vienen.
  const piso = cfg.horario.fechas ? desde : ahora;
  const reservadas = activas.filter((r) => Date.parse(r.inicio) >= piso && Date.parse(r.inicio) < hasta).length;
  const quedan = cerrada ? 0 : quedanLlamadas(todos.length, reservadas, cfg.cupo.tope);
  const huecos = quedan > 0 ? huecosEnTanda(todos, cfg.cupo.tandas, tz) : [];
  return {
    huecos,
    todos: quedan > 0 || op.excluir ? todos : [],
    quedan,
    tope: cfg.cupo.tope ?? todos.length + reservadas,
    reservadas,
    masPorAbrir: huecos.length > 0 && huecos.length < todos.length,
    cerrada,
    cierre: vacio.cierre,
    errorCalendario: false,
  };
}

// ── Lead parcial ──────────────────────────────────────────────────────────────────────────────
export async function registrarLead(d: Deps, raw: Record<string, unknown>) {
  const nuevo = leerLead(raw, pasosDe(d.cfg.filtro, d.cfg.miniAplicacion));
  if (!nuevo) return;
  await d.alm.tx(async (t) => t.guardarLead(mezclarLead(nuevo, await t.lead(nuevo.whatsapp), new Date(ahoraDe(d)))));
}

// ── Reservar ──────────────────────────────────────────────────────────────────────────────────
export type ResultadoReserva = { ok: true; reserva: Reserva; yaTenia: boolean } | { ok: false; error: 'hueco-tomado' | 'agenda-llena' | 'cerrada' | 'error-calendario' };

export async function reservar(d: Deps, app: Aplicacion): Promise<ResultadoReserva> {
  const ahora = ahoraDe(d);
  // Una llamada viva por persona: si ya tiene una, se le recuerda la suya en vez de duplicar.
  const previa = (await d.alm.leer((t) => t.reservas(new Date(ahora)))).find((r) => r.estado === 'agendada' && r.correo === app.correo);
  if (previa) {
    await ligarLead(d, app.whatsapp, previa.id);
    return { ok: true, reserva: previa, yaTenia: true };
  }
  const estado = await estadoAgenda(d);
  if (estado.errorCalendario) return { ok: false, error: 'error-calendario' };
  if (estado.cerrada) return { ok: false, error: 'cerrada' };
  if (estado.quedan <= 0) return { ok: false, error: 'agenda-llena' };
  const hueco = estado.todos.find((h) => h.inicio === app.inicio);
  if (!hueco) return { ok: false, error: 'hueco-tomado' };

  const iso = new Date(ahora).toISOString();
  const r: Reserva = {
    id: randomUUID(),
    creada: iso,
    actualizada: iso,
    nombre: app.nombre,
    correo: app.correo,
    whatsapp: app.whatsapp,
    filtro: app.filtro,
    mini: app.mini,
    zonaVisitante: app.zonaVisitante && app.zonaVisitante !== d.cfg.horario.zona ? app.zonaVisitante : null,
    inicio: hueco.inicio,
    fin: hueco.fin,
    estado: 'agendada',
    cambiosPersona: 0,
    movimientos: 0,
    horarioAnterior: null,
    cambioPor: null,
    recordatorios: {},
    googleEventoId: null,
    sala: d.cfg.llamada.lugar === 'google-meet' ? null : d.cfg.llamada.lugar,
    eventoPendiente: d.google ? 'crear' : null,
    asistencia: null,
  };
  // Dentro del candado: nadie más tomó esa hora y el tope sigue sin llenarse.
  const res = await d.alm.tx(async (t) => {
    const vivas = (await t.reservas(new Date(ahora - 86_400_000))).filter((x) => x.estado === 'agendada');
    if (vivas.some((x) => Date.parse(x.inicio) < Date.parse(r.fin) && Date.parse(x.fin) > Date.parse(r.inicio))) return 'hueco-tomado' as const;
    const { desde, hasta } = rango(d.cfg, ahora);
    const piso = d.cfg.horario.fechas ? desde : ahora;
    const enVentana = vivas.filter((x) => Date.parse(x.inicio) >= piso && Date.parse(x.inicio) < hasta).length;
    if (d.cfg.cupo.tope !== null && enVentana >= d.cfg.cupo.tope) return 'agenda-llena' as const;
    try {
      await t.guardar(r);
    } catch (e) {
      // Índice único de Postgres: otro servidor ganó esa hora en el mismo instante.
      if (/agenda_reservas_una_viva_por_hora|duplicate key/i.test(String(e))) return 'hueco-tomado' as const;
      throw e;
    }
    return null;
  });
  if (res) return { ok: false, error: res };

  await ligarLead(d, app.whatsapp, r.id);
  const final = await sincronizarGoogle(d, r);
  await avisar(d, final, 'nueva');
  return { ok: true, reserva: final, yaTenia: false };
}

async function ligarLead(d: Deps, whatsapp: string, reservaId: string) {
  try {
    await d.alm.tx(async (t) => {
      const previo = await t.lead(whatsapp);
      const base: Lead = previo ?? { whatsapp, ultimoPaso: 'agendo', pasoNum: 99, filtro: {}, nombre: null, correo: null, reservaId: null, actualizado: '' };
      await t.guardarLead({ ...base, ultimoPaso: 'agendo', pasoNum: 99, reservaId, actualizado: new Date(ahoraDe(d)).toISOString() });
    });
  } catch (e) {
    console.error('[agenda] lead:', e instanceof Error ? e.message : e);
  }
}

// ── Google: crear, mover o borrar el MISMO evento ─────────────────────────────────────────────
async function sincronizarGoogle(d: Deps, r: Reserva): Promise<Reserva> {
  if (!d.google || !r.eventoPendiente) return r;
  const g = d.google;
  const f = d.fetch ?? fetch;
  let cambios: Partial<Reserva> = {};
  try {
    if (r.eventoPendiente === 'crear' && r.estado === 'agendada') {
      const ev = await crearEvento(g, {
        reservaId: r.id,
        titulo: rellenar(d.cfg.google.tituloEvento, { nombre: r.nombre }),
        descripcion: descripcionEvento(d, r),
        inicio: r.inicio,
        fin: r.fin,
        invitado: r.correo,
        conMeet: d.cfg.llamada.lugar === 'google-meet',
        lugar: d.cfg.llamada.lugar,
      }, f);
      cambios = { googleEventoId: ev.id, sala: ev.meet ?? r.sala, eventoPendiente: null };
    } else if (r.eventoPendiente === 'mover') {
      if (r.googleEventoId) await moverEvento(g, r.googleEventoId, r.inicio, r.fin, f);
      cambios = { eventoPendiente: r.googleEventoId ? null : 'crear' };
    } else if (r.eventoPendiente === 'cancelar') {
      if (r.googleEventoId) await borrarEvento(g, r.googleEventoId, f);
      cambios = { eventoPendiente: null };
    } else {
      cambios = { eventoPendiente: null };
    }
  } catch (e) {
    console.error('[agenda] Google Calendar (se reintenta en la siguiente vuelta):', e instanceof Error ? e.message : e);
    return r;
  }
  return d.alm.tx(async (t) => {
    const actual = await t.reserva(r.id);
    if (!actual) return r;
    // Si mientras tanto alguien la movió o canceló, se conserva su marca para la siguiente vuelta.
    const sigue = actual.eventoPendiente === r.eventoPendiente && actual.inicio === r.inicio && actual.estado === r.estado;
    const nueva = { ...actual, ...cambios, eventoPendiente: sigue ? cambios.eventoPendiente ?? null : actual.eventoPendiente };
    if (!sigue && cambios.googleEventoId) nueva.eventoPendiente = actual.estado === 'cancelada' ? 'cancelar' : 'mover';
    await t.guardar(nueva);
    return nueva;
  });
}

function descripcionEvento(d: Deps, r: Reserva) {
  const lineas = [
    `${r.nombre} · ${r.correo} · ${r.whatsapp}`,
    ...d.cfg.filtro.map((f) => `${f.pregunta} ${r.filtro[f.id] ? 'Sí' : 'No'}`),
    ...d.cfg.miniAplicacion.map((m) => `${m.pregunta} ${r.mini[m.id] === true ? 'Sí' : r.mini[m.id] === false ? 'No' : r.mini[m.id] ?? '—'}`),
    '',
    `Cambiar o cancelar: ${urlLlamada(d, r.id)}`,
  ];
  return lineas.join('\n');
}

// ── Correos ───────────────────────────────────────────────────────────────────────────────────
async function mandar(d: Deps, c: Correo) {
  try {
    await d.enviar(c);
    return true;
  } catch (e) {
    console.error('[agenda] correo:', e instanceof Error ? e.message : e);
    return false;
  }
}

async function avisar(d: Deps, r: Reserva, que: 'nueva' | 'movida' | 'cancelada', aPersona = true) {
  const ctx = { cfg: d.cfg, urlLlamada: urlLlamada(d, r.id), urlBase: d.base };
  if (aPersona) {
    if (que === 'nueva') await mandar(d, correoConfirmacion(r, ctx));
    else if (que === 'movida') await mandar(d, correoCambio(r, ctx));
    else await mandar(d, correoCancelacion(r, ctx));
  }
  if (d.avisos) await mandar(d, correoAviso(r, que, ctx)(d.avisos));
}

// ── Mover y cancelar ──────────────────────────────────────────────────────────────────────────
export type ResultadoCambio = { ok: true; reserva: Reserva } | { ok: false; error: ErrorCambio };

export async function mover(d: Deps, id: string, nuevoInicio: string, quien: Quien): Promise<ResultadoCambio> {
  const ahora = ahoraDe(d);
  const r = await d.alm.leer((t) => t.reserva(id));
  if (!r) return { ok: false, error: 'no-vigente' };
  const v = evaluarCambio(r, ahora, quien, 'mover', d.cfg.reagendar);
  if (!v.ok) return v;
  if (r.inicio === nuevoInicio) return { ok: false, error: 'mismo-hueco' };
  // La persona solo ve horarios con el margen normal; tú puedes mover hasta 10 min antes.
  const estado = await estadoAgenda(d, { margenMin: quien === 'admin' ? 10 : Math.max(d.cfg.llamada.margenParaAgendar, d.cfg.reagendar.horasAntes * 60), excluir: r.id });
  const hueco = estado.todos.find((h) => h.inicio === nuevoInicio);
  if (!hueco) return { ok: false, error: estado.todos.length ? 'hueco-tomado' : 'falta-hueco' };

  const res = await d.alm.tx(async (t) => {
    const actual = await t.reserva(id);
    if (!actual || actual.inicio !== r.inicio || actual.estado !== 'agendada') return { error: 'no-vigente' as const };
    const vivas = (await t.reservas(new Date(ahora - 86_400_000))).filter((x) => x.estado === 'agendada' && x.id !== id);
    if (vivas.some((x) => Date.parse(x.inicio) < Date.parse(hueco.fin) && Date.parse(x.fin) > Date.parse(hueco.inicio))) return { error: 'hueco-tomado' as const };
    const iso = new Date(ahora).toISOString();
    const nueva: Reserva = {
      ...actual,
      inicio: hueco.inicio,
      fin: hueco.fin,
      horarioAnterior: actual.inicio,
      cambioPor: quien,
      movimientos: actual.movimientos + 1,
      // Tú mueves sin gastar los cambios de la persona; tras un no-show tampoco se gastan.
      cambiosPersona: actual.cambiosPersona + (quien === 'persona' && actual.asistencia !== 'no-show' ? 1 : 0),
      // La hora nueva empieza de cero: recordatorios y asistencia.
      recordatorios: {},
      asistencia: null,
      eventoPendiente: d.google ? (actual.googleEventoId ? 'mover' : 'crear') : null,
      actualizada: iso,
    };
    try {
      await t.guardar(nueva);
    } catch (e) {
      if (/agenda_reservas_una_viva_por_hora|duplicate key/i.test(String(e))) return { error: 'hueco-tomado' as const };
      throw e;
    }
    return { reserva: nueva };
  });
  if (res.error || !res.reserva) return { ok: false, error: res.error ?? 'no-guardado' };
  const final = await sincronizarGoogle(d, res.reserva);
  await avisar(d, final, 'movida');
  return { ok: true, reserva: final };
}

export async function cancelar(d: Deps, id: string, quien: Quien): Promise<ResultadoCambio> {
  const ahora = ahoraDe(d);
  const res = await d.alm.tx(async (t) => {
    const r = await t.reserva(id);
    if (!r) return { error: 'no-vigente' as const };
    const v = evaluarCambio(r, ahora, quien, 'cancelar', d.cfg.reagendar);
    if (!v.ok) return { error: v.error };
    const nueva: Reserva = {
      ...r,
      estado: 'cancelada',
      cambioPor: quien,
      movimientos: r.movimientos + 1,
      eventoPendiente: d.google && r.googleEventoId ? 'cancelar' : null,
      actualizada: new Date(ahora).toISOString(),
    };
    await t.guardar(nueva);
    return { reserva: nueva };
  });
  if (res.error || !res.reserva) return { ok: false, error: res.error ?? 'no-guardado' };
  const final = await sincronizarGoogle(d, res.reserva);
  await avisar(d, final, 'cancelada');
  return { ok: true, reserva: final };
}

export async function marcarAsistencia(d: Deps, id: string, valor: 'presente' | 'no-show' | null) {
  await d.alm.tx(async (t) => {
    const r = await t.reserva(id);
    if (r) await t.guardar({ ...r, asistencia: valor, actualizada: new Date(ahoraDe(d)).toISOString() });
  });
}

// ── La vuelta del reloj: reintentos con Google y recordatorios ────────────────────────────────
export async function vuelta(d: Deps): Promise<{ recordatorios: number; google: number }> {
  const ahora = ahoraDe(d);
  const todas = await d.alm.leer((t) => t.reservas(new Date(ahora - 3 * 86_400_000)));
  let google = 0;
  for (const r of todas.filter((x) => x.eventoPendiente)) {
    const s = await sincronizarGoogle(d, r);
    if (!s.eventoPendiente) google++;
  }
  let enviados = 0;
  for (const r of todas) {
    const h = recordatorioQueToca(r, ahora, d.cfg.recordatorios);
    if (h === null) continue;
    const clave = `${h}h`;
    // Se aparta primero (dentro del candado) para que dos vueltas a la vez no lo manden doble.
    const apartado = await d.alm.tx(async (t) => {
      const actual = await t.reserva(r.id);
      if (!actual || actual.estado !== 'agendada' || actual.inicio !== r.inicio || actual.recordatorios[clave]) return null;
      const nueva = { ...actual, recordatorios: { ...actual.recordatorios, [clave]: new Date(ahora).toISOString() } };
      await t.guardar(nueva);
      return nueva;
    });
    if (!apartado) continue;
    const ok = await mandar(d, correoRecordatorio(apartado, h, { cfg: d.cfg, urlLlamada: urlLlamada(d, r.id), urlBase: d.base }));
    if (ok) enviados++;
    else {
      await d.alm.tx(async (t) => {
        const actual = await t.reserva(r.id);
        if (!actual) return;
        const { [clave]: _, ...resto } = actual.recordatorios;
        await t.guardar({ ...actual, recordatorios: resto });
      });
    }
  }
  return { recordatorios: enviados, google };
}
