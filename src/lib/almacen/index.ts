// Elige dónde se guardan las reservas: Postgres si hay DATABASE_URL; si no, un archivo en .datos/.
import path from 'node:path';
import { almacenArchivo } from './archivo';
import { almacenPostgres } from './postgres';
import type { Almacen } from './tipos';

export type { Almacen, Reserva, Tx } from './tipos';

export function carpetaDatos() {
  return path.resolve(/*turbopackIgnore: true*/ process.env.DATOS_DIR || '.datos');
}

const g = globalThis as unknown as { __agendaAlmacen?: Almacen };

export function almacen(): Almacen {
  if (g.__agendaAlmacen) return g.__agendaAlmacen;
  const url = process.env.DATABASE_URL?.trim();
  if (!url && process.env.VERCEL) {
    throw new Error('En Vercel el disco se borra: configura DATABASE_URL (por ejemplo, la de tu proyecto de Supabase).');
  }
  g.__agendaAlmacen = url ? almacenPostgres(url) : almacenArchivo(carpetaDatos());
  return g.__agendaAlmacen;
}
