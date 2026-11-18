// Acciones de tu panel (/admin): entrar con ADMIN_CLAVE, mover, cancelar y marcar asistencia.
'use server';

import { createHmac, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { cancelar, marcarAsistencia, mover } from '@/lib/agenda';
import { deps } from '@/lib/servidor';
import { claveAdmin, secreto } from '@/lib/entorno';

const COOKIE = 'agenda_admin';

function sello(clave: string) {
  return createHmac('sha256', secreto()).update(`admin:${clave}`).digest('base64url');
}

export async function esAdmin(): Promise<boolean> {
  const clave = claveAdmin();
  if (!clave) return false;
  const v = (await cookies()).get(COOKIE)?.value ?? '';
  const a = Buffer.from(v);
  const b = Buffer.from(sello(clave));
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function entrar(form: FormData) {
  const clave = claveAdmin();
  const dada = String(form.get('clave') || '');
  if (!clave || dada.length !== clave.length || !timingSafeEqual(Buffer.from(dada), Buffer.from(clave))) redirect('/admin?error=1');
  (await cookies()).set(COOKIE, sello(clave), { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production' && !/^http:\/\/localhost/.test(process.env.URL_PUBLICA ?? ''), path: '/', maxAge: 60 * 60 * 24 * 30 });
  redirect('/admin');
}

export async function salir() {
  (await cookies()).delete(COOKIE);
  redirect('/admin');
}

async function exigir() {
  if (!(await esAdmin())) redirect('/admin');
}

export async function moverAdmin(form: FormData) {
  await exigir();
  const id = String(form.get('id') || '');
  const r = await mover(deps(), id, String(form.get('inicio') || ''), 'admin');
  revalidatePath('/admin');
  redirect(r.ok ? `/admin?movida=${id}#r-${id}` : `/admin?error_mover=${r.error}#r-${id}`);
}

export async function cancelarAdmin(form: FormData) {
  await exigir();
  const id = String(form.get('id') || '');
  await cancelar(deps(), id, 'admin');
  revalidatePath('/admin');
  redirect('/admin');
}

export async function asistenciaAdmin(form: FormData) {
  await exigir();
  const id = String(form.get('id') || '');
  const v = String(form.get('asistencia') || '');
  await marcarAsistencia(deps(), id, v === 'presente' || v === 'no-show' ? v : null);
  revalidatePath('/admin');
  redirect(`/admin#r-${id}`);
}
