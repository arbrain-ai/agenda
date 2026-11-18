// Almacén en Postgres (Supabase, Neon, Railway o el tuyo). Se activa con DATABASE_URL.
// Las tablas se crean solas la primera vez. Cada escritura corre en una transacción con candado (advisory lock) y un
// índice único impide dos llamadas vivas a la misma hora aunque dos servidores corran a la vez.

import postgres from 'postgres';
import type { Lead } from '../aplicacion';
import type { Almacen, Reserva, Tx } from './tipos';

type Sql = postgres.Sql<Record<string, never>>;

const ESQUEMA = `
create table if not exists agenda_reservas (
  id text primary key,
  inicio timestamptz not null,
  estado text not null,
  correo text not null,
  datos jsonb not null,
  actualizada timestamptz not null default now()
);
create unique index if not exists agenda_reservas_una_viva_por_hora on agenda_reservas (inicio) where estado = 'agendada';
create index if not exists agenda_reservas_correo on agenda_reservas (correo);
create table if not exists agenda_leads (
  whatsapp text primary key,
  datos jsonb not null,
  actualizado timestamptz not null default now()
);
`;

function local(url: string) {
  try {
    const h = new URL(url).hostname;
    return h === 'localhost' || h === '127.0.0.1' || h === '::1';
  } catch {
    return false;
  }
}

export function almacenPostgres(url: string): Almacen {
  const ssl = process.env.DATABASE_SSL === 'false' || local(url) ? false : 'require';
  // prepare: false → compatible con el pooler de Supabase (modo transacción, puerto 6543).
  const sql: Sql = postgres(url, { ssl, prepare: false, max: 3, idle_timeout: 20, onnotice: () => {} });
  let listo: Promise<void> | null = null;
  const preparar = () => (listo ??= sql.unsafe(ESQUEMA).then(() => undefined).catch((e) => { listo = null; throw e; }));

  function txSobre(q: Sql | postgres.TransactionSql<Record<string, never>>): Tx {
    return {
      async reservas(desde) {
        const filas = desde
          ? await q`select datos from agenda_reservas where inicio >= ${desde} order by inicio`
          : await q`select datos from agenda_reservas order by inicio`;
        return filas.map((f) => f.datos as Reserva);
      },
      async reserva(id) {
        const [f] = await q`select datos from agenda_reservas where id = ${id}`;
        return f ? (f.datos as Reserva) : null;
      },
      async guardar(r) {
        await q`
          insert into agenda_reservas (id, inicio, estado, correo, datos, actualizada)
          values (${r.id}, ${r.inicio}, ${r.estado}, ${r.correo}, ${q.json(r as never)}, now())
          on conflict (id) do update set inicio = excluded.inicio, estado = excluded.estado, correo = excluded.correo,
            datos = excluded.datos, actualizada = now()`;
      },
      async lead(wa) {
        const [f] = await q`select datos from agenda_leads where whatsapp = ${wa}`;
        return f ? (f.datos as Lead) : null;
      },
      async guardarLead(l) {
        await q`
          insert into agenda_leads (whatsapp, datos, actualizado) values (${l.whatsapp}, ${q.json(l as never)}, now())
          on conflict (whatsapp) do update set datos = excluded.datos, actualizado = now()`;
      },
      async leads() {
        const filas = await q`select datos from agenda_leads order by actualizado desc limit 500`;
        return filas.map((f) => f.datos as Lead);
      },
    };
  }

  return {
    nombre: 'postgres',
    async tx<T>(fn: (t: Tx) => Promise<T>) {
      await preparar();
      return (await sql.begin(async (t) => {
        await t`select pg_advisory_xact_lock(hashtext('agenda-abierta'))`;
        return fn(txSobre(t));
      })) as T;
    },
    async leer<T>(fn: (t: Tx) => Promise<T>) {
      await preparar();
      return fn(txSobre(sql));
    },
  };
}
