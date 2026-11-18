// Cambiar la hora o cancelar desde el enlace firmado. El token es la credencial: sin token válido no se toca nada.
'use server';

import { redirect } from 'next/navigation';
import { cancelar, mover } from '@/lib/agenda';
import { deps } from '@/lib/servidor';
import { leerToken } from '@/lib/token';

export type EstadoCambio = { error?: string; n?: number };

export async function cambiarHora(prev: EstadoCambio, form: FormData): Promise<EstadoCambio> {
  const n = (prev.n ?? 0) + 1;
  const d = deps();
  const token = String(form.get('token') || '');
  const id = leerToken(token, d.secreto);
  if (!id) return { error: 'no-vigente', n };
  const r = await mover(d, id, String(form.get('inicio') || ''), 'persona');
  if (!r.ok) return { error: r.error, n };
  redirect(`/llamada/${token}?listo=movida`);
}

export async function cancelarLlamada(form: FormData): Promise<void> {
  const d = deps();
  const token = String(form.get('token') || '');
  const id = leerToken(token, d.secreto);
  if (!id) redirect('/aplicar');
  const r = await cancelar(d, id, 'persona');
  redirect(`/llamada/${token}?${r.ok ? 'listo=cancelada' : `error=${r.error}`}`);
}
