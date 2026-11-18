// Variables de entorno (.env): secreto de los enlaces, URL pública y clave de /admin. Solo servidor.
import { randomBytes } from 'node:crypto';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { carpetaDatos } from './almacen';

let secretoCache: string | null = null;

/**
 * Secreto con el que se firman los enlaces de «Tu llamada». AGENDA_SECRETO manda. Sin él, y SOLO con el almacén de
 * archivo (un disco que persiste), se genera uno una vez en .datos/secreto. Con Postgres es obligatorio: varios
 * servidores tienen que firmar igual.
 */
export function secreto(): string {
  if (secretoCache) return secretoCache;
  const env = process.env.AGENDA_SECRETO?.trim();
  if (env) return (secretoCache = env);
  if (process.env.DATABASE_URL) throw new Error('Falta AGENDA_SECRETO en tu .env (con base de datos es obligatorio). Genera uno con: openssl rand -hex 32');
  const ruta = path.join(carpetaDatos(), 'secreto');
  try {
    secretoCache = readFileSync(ruta, 'utf8').trim();
  } catch {
    mkdirSync(carpetaDatos(), { recursive: true });
    secretoCache = randomBytes(32).toString('hex');
    writeFileSync(ruta, secretoCache, { mode: 0o600 });
  }
  return secretoCache;
}

/** URL pública de tu agenda, para los enlaces de los correos. */
export function urlBase(): string {
  const u = process.env.URL_PUBLICA?.trim() || (process.env.VERCEL_PROJECT_PRODUCTION_URL ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}` : '');
  return (u || `http://localhost:${process.env.PORT || 3000}`).replace(/\/$/, '');
}

/** Clave de /admin. Sin ella /admin queda cerrado. */
export function claveAdmin(): string | null {
  const c = process.env.ADMIN_CLAVE?.trim();
  return c && c.length >= 6 ? c : null;
}

/** A quién avisar de cada reserva, cambio o cancelación (tu correo). */
export function correoAvisos(): string | null {
  return process.env.AVISOS_A?.trim() || null;
}
