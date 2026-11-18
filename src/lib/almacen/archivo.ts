// Almacén en un archivo JSON (.datos/agenda.json). Es el de omisión: cero cuentas, cero llaves.
// Sirve en tu computadora y en un servidor con disco propio (VPS, Railway o Render con volumen), con UN solo proceso.
// En Vercel no sirve (su disco se borra): ahí usa Postgres (DATABASE_URL).
// Escritura atómica: se escribe a un temporal y se renombra; un candado en memoria pone las escrituras en fila.

import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Lead } from '../aplicacion';
import type { Almacen, Reserva, Tx } from './tipos';

type Datos = { version: 1; reservas: Reserva[]; leads: Lead[] };

export function almacenArchivo(dir: string): Almacen {
  const ruta = path.join(dir, 'agenda.json');
  let fila: Promise<unknown> = Promise.resolve();

  async function cargar(): Promise<Datos> {
    try {
      const d = JSON.parse(await readFile(ruta, 'utf8')) as Datos;
      return { version: 1, reservas: d.reservas ?? [], leads: d.leads ?? [] };
    } catch (e) {
      if ((e as NodeJS.ErrnoException).code === 'ENOENT') return { version: 1, reservas: [], leads: [] };
      throw e;
    }
  }

  async function guardar(d: Datos) {
    await mkdir(dir, { recursive: true });
    const tmp = `${ruta}.${process.pid}.${Date.now()}.tmp`;
    await writeFile(tmp, JSON.stringify(d, null, 2), { mode: 0o600 });
    await rename(tmp, ruta);
  }

  function txSobre(d: Datos, sucio: { v: boolean }): Tx {
    const copia = <T>(x: T): T => structuredClone(x);
    return {
      async reservas(desde) {
        const t = desde?.getTime() ?? -Infinity;
        return d.reservas.filter((r) => Date.parse(r.inicio) >= t).sort((a, b) => a.inicio.localeCompare(b.inicio)).map(copia);
      },
      async reserva(id) {
        const r = d.reservas.find((x) => x.id === id);
        return r ? copia(r) : null;
      },
      async guardar(r) {
        const i = d.reservas.findIndex((x) => x.id === r.id);
        if (i >= 0) d.reservas[i] = copia(r);
        else d.reservas.push(copia(r));
        sucio.v = true;
      },
      async lead(wa) {
        const l = d.leads.find((x) => x.whatsapp === wa);
        return l ? copia(l) : null;
      },
      async guardarLead(l) {
        const i = d.leads.findIndex((x) => x.whatsapp === l.whatsapp);
        if (i >= 0) d.leads[i] = copia(l);
        else d.leads.push(copia(l));
        sucio.v = true;
      },
      async leads() {
        return [...d.leads].sort((a, b) => b.actualizado.localeCompare(a.actualizado)).map(copia);
      },
    };
  }

  return {
    nombre: 'archivo',
    tx<T>(fn: (t: Tx) => Promise<T>) {
      const corrida = fila.then(async () => {
        const d = await cargar();
        const sucio = { v: false };
        const r = await fn(txSobre(d, sucio));
        if (sucio.v) await guardar(d);
        return r;
      });
      fila = corrida.catch(() => undefined);
      return corrida;
    },
    async leer<T>(fn: (t: Tx) => Promise<T>) {
      const d = await cargar();
      return fn(txSobre(d, { v: false }));
    },
  };
}
