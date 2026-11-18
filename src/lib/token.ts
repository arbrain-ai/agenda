// Enlace firmado de «Tu llamada» (ver, cambiar o cancelar), sin cuentas ni contraseñas: `<id>.<firma>`.
// La firma es un HMAC con AGENDA_SECRETO; sin secreto no hay enlaces, nunca uno débil.
// Solo servidor (node:crypto).

import { createHmac, timingSafeEqual } from 'node:crypto';

const ID = /^[0-9a-f-]{36}$/i;

function firma(proposito: string, id: string, secreto: string) {
  return createHmac('sha256', secreto).update(`${proposito}:${id.toLowerCase()}`).digest('base64url').slice(0, 24);
}

export function firmarToken(id: string, secreto: string, proposito = 'llamada'): string | null {
  if (!secreto || !ID.test(id)) return null;
  return `${id.toLowerCase()}.${firma(proposito, id, secreto)}`;
}

/** El id si el token es auténtico; null en cualquier otro caso. */
export function leerToken(token: string | null | undefined, secreto: string, proposito = 'llamada'): string | null {
  if (!secreto || !token) return null;
  const [id, f, ...resto] = token.split('.');
  if (resto.length || !id || !f || !ID.test(id)) return null;
  const a = Buffer.from(f);
  const b = Buffer.from(firma(proposito, id, secreto));
  return a.length === b.length && timingSafeEqual(a, b) ? id.toLowerCase() : null;
}
