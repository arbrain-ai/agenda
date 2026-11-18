// Reglas puras de los horarios: de tus bloques (o de las ventanas de tu Google Calendar) salen los huecos de llamada,
// se apartan los que chocan con tus eventos, se muestran por tandas y se cuenta cuántos quedan DE VERDAD.
// Sin Next, sin base, sin red: se prueba solo (tests/huecos.test.ts).
//

import type { Bloque } from './tipos-config';
import { DIAS } from './dias';
import { claveDia, diaSemana, enZona, sumarDias } from './tiempo';

export type Intervalo = { ini: number; fin: number };
/** Un evento con hora de tu calendario. `propio` = lo creó esta agenda (una llamada ya reservada). */
export type EventoCal = Intervalo & { titulo: string; propio?: boolean };
export type Hueco = { inicio: string; fin: string };

const MIN = 60_000;

/** Fechas (AAAA-MM-DD) que cubre la agenda: fijas de lanzamiento o de hoy a `diasAdelante`. */
export function fechasDeAgenda(hoy: string, op: { diasAdelante: number; fechas?: { desde: string; hasta: string } }): string[] {
  const desde = op.fechas ? (op.fechas.desde > hoy ? op.fechas.desde : hoy) : hoy;
  const hasta = op.fechas ? op.fechas.hasta : sumarDias(hoy, op.diasAdelante);
  const out: string[] = [];
  for (let f = desde; f <= hasta; f = sumarDias(f, 1)) out.push(f);
  return out;
}

/** Ventanas de disponibilidad a partir de los bloques de agenda.config.ts. */
export function ventanasDeBloques(fechas: string[], bloques: Bloque[], tz: string, bloqueados: string[] = []): Intervalo[] {
  const out: Intervalo[] = [];
  for (const f of fechas) {
    if (bloqueados.includes(f)) continue;
    const dia = DIAS[diaSemana(f)];
    for (const b of bloques) {
      if (b.dias.includes(dia)) out.push({ ini: enZona(f, b.desde, tz), fin: enZona(f, b.hasta, tz) });
    }
  }
  return fundir(out);
}

/** Ordena y funde las ventanas que se enciman o se tocan. */
export function fundir(v: Intervalo[]): Intervalo[] {
  const out: Intervalo[] = [];
  for (const x of [...v].sort((a, b) => a.ini - b.ini)) {
    const u = out[out.length - 1];
    if (u && x.ini <= u.fin) u.fin = Math.max(u.fin, x.fin);
    else out.push({ ...x });
  }
  return out;
}

/** ¿Es una ventana de disponibilidad? (evento cuyo título empieza con el título de ventana, sin importar mayúsculas). */
export function esVentana(titulo: string, tituloVentana: string) {
  const limpio = (t: string) => t.replace(/️/g, '').trim().toLocaleLowerCase('es');
  return !!tituloVentana && limpio(titulo).startsWith(limpio(tituloVentana));
}

/**
 * ¿El hueco [ini, fin) choca con algún evento? (regla del original)
 * - Llamadas propias de la agenda: solo si se enciman, sin aire (las de un bloque van seguidas).
 * - Cualquier otro evento: con `aire` por los dos lados, SALVO el que toca exactamente el borde del bloque (lo
 *   pusiste pegado a propósito) o el que sigue en curso cuando el bloque abre (abriste la ventana a media cita).
 */
export function choca(ini: number, fin: number, otros: EventoCal[], aireMs: number, borde0?: number, borde1?: number): boolean {
  for (const e of otros) {
    if (e.propio) {
      if (e.ini < fin && e.fin > ini) return true;
      continue;
    }
    if ((borde0 !== undefined && e.ini < borde0 && borde0 <= e.fin) || (borde1 !== undefined && e.ini === borde1)) continue;
    if (e.ini < fin + aireMs && e.fin > ini - aireMs) return true;
  }
  return false;
}

/**
 * Huecos libres: dentro de cada ventana, desde su inicio, uno tras otro (llamada + aire), mientras la llamada termine
 * dentro; solo los que empiezan después de `ahora + margen` y no chocan.
 */
export function generarHuecos(p: {
  ventanas: Intervalo[];
  ocupados: EventoCal[];
  minutos: number;
  aireEntreLlamadas: number;
  aireEventos: number;
  ahora: number;
  margenMin: number;
}): Hueco[] {
  const dur = p.minutos * MIN;
  const paso = dur + p.aireEntreLlamadas * MIN;
  const piso = p.ahora + p.margenMin * MIN;
  const out: Hueco[] = [];
  for (const w of fundir(p.ventanas)) {
    for (let ini = w.ini; ini + dur <= w.fin; ini += paso) {
      const fin = ini + dur;
      if (ini > piso && !choca(ini, fin, p.ocupados, p.aireEventos * MIN, w.ini, w.fin)) {
        out.push({ inicio: new Date(ini).toISOString(), fin: new Date(fin).toISOString() });
      }
    }
  }
  return out;
}

/** Si tu calendario tiene ventanas, mandan ellas; si no, tus bloques. Separa ventanas de ocupados. */
export function ventanasYocupados(eventos: EventoCal[], tituloVentana: string, bloques: Intervalo[]) {
  const ventanas = fundir(eventos.filter((e) => !e.propio && esVentana(e.titulo, tituloVentana)).map(({ ini, fin }) => ({ ini, fin })));
  const ocupados = eventos.filter((e) => e.propio || !esVentana(e.titulo, tituloVentana));
  return { ventanas: ventanas.length ? ventanas : bloques, ocupados, delCalendario: ventanas.length > 0 };
}

/** Cuántas llamadas más se pueden agendar: nunca más que los huecos libres ni que lo que deja el tope. */
export function quedanLlamadas(libres: number, reservadas: number, tope: number | null) {
  if (tope === null) return libres;
  return Math.max(0, Math.min(libres, tope - reservadas));
}

/**
 * Tandas: se ven primero los huecos de los N primeros días con huecos; cuando en lo visible quedan ≤ umbral se abre el
 * siguiente día, y así. Sin estado: cada lectura recalcula. dias = 0 apaga las tandas.
 */
export function huecosEnTanda<H extends { inicio: string }>(libres: H[], tandas: { dias: number; umbral: number }, tz: string): H[] {
  const orden = [...libres].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const dias = [...new Set(orden.map((h) => claveDia(h.inicio, tz)))];
  if (tandas.dias <= 0 || dias.length <= tandas.dias) return orden;
  let abiertos = tandas.dias;
  const visibles = () => orden.filter((h) => dias.indexOf(claveDia(h.inicio, tz)) < abiertos);
  while (abiertos < dias.length && visibles().length <= tandas.umbral) abiertos++;
  return visibles();
}
