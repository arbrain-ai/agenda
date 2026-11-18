// Acciones del servidor de /aplicar: guardar el lead parcial y reservar. El filtro se vuelve a revisar aquí.
'use server';

import { redirect } from 'next/navigation';
import { config } from '@/lib/config';
import { leerAplicacion } from '@/lib/aplicacion';
import { registrarLead, reservar } from '@/lib/agenda';
import { deps } from '@/lib/servidor';
import { firmarToken } from '@/lib/token';

export type EstadoEnvio = { error?: string; paso?: string; n?: number };

/** Lead parcial: desde que deja su WhatsApp, cada paso al que llega se guarda. Nunca rompe el formulario. */
export async function guardarLead(raw: Record<string, unknown>): Promise<void> {
  try {
    await registrarLead(deps(), raw);
  } catch (e) {
    console.error('[agenda] lead:', e instanceof Error ? e.message : e);
  }
}

export async function enviarAplicacion(prev: EstadoEnvio, form: FormData): Promise<EstadoEnvio> {
  const n = (prev.n ?? 0) + 1;
  const leida = leerAplicacion(form, config.filtro, config.miniAplicacion);
  if (!leida.ok) return { error: leida.error, paso: leida.paso, n };
  const d = deps();
  let destino: string;
  try {
    const r = await reservar(d, leida.data);
    if (!r.ok) return { error: r.error, paso: 'hora', n };
    destino = `/llamada/${firmarToken(r.reserva.id, d.secreto)}?${r.yaTenia ? 'ya=1' : 'nueva=1'}`;
  } catch (e) {
    console.error('[agenda] reservar:', e instanceof Error ? e.message : e);
    return { error: 'no-guardada', paso: 'hora', n };
  }
  redirect(destino);
}
