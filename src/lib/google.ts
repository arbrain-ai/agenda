// Google Calendar, OPCIONAL. Sin las tres variables GOOGLE_* la agenda funciona sola con tus bloques.
// Con ellas: tu calendario manda (ocupados bloquean, ventanas abren horarios) y cada reserva crea su evento con
// invitación (y su propio Google Meet si llamada.lugar = 'google-meet'); mover y cancelar actualizan el MISMO evento.
// Llama a la API REST con fetch (sin SDK). El refresh token se saca una vez con `npm run google:conectar`.

import type { EventoCal } from './huecos';

export type ConfigGoogle = { clientId: string; clientSecret: string; refreshToken: string; calendarId: string };

export function googleDeEntorno(env: Record<string, string | undefined> = process.env): ConfigGoogle | null {
  const clientId = env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = env.GOOGLE_CLIENT_SECRET?.trim();
  const refreshToken = env.GOOGLE_REFRESH_TOKEN?.trim();
  if (!clientId || !clientSecret || !refreshToken) return null;
  return { clientId, clientSecret, refreshToken, calendarId: env.GOOGLE_CALENDAR_ID?.trim() || 'primary' };
}

type Fetch = typeof fetch;
const API = 'https://www.googleapis.com/calendar/v3';

let tokenCache: { valor: string; vence: number; de: string } | null = null;

async function accessToken(g: ConfigGoogle, f: Fetch): Promise<string> {
  if (tokenCache && tokenCache.de === g.refreshToken && tokenCache.vence > Date.now() + 60_000) return tokenCache.valor;
  const r = await f('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ client_id: g.clientId, client_secret: g.clientSecret, refresh_token: g.refreshToken, grant_type: 'refresh_token' }),
  });
  if (!r.ok) throw new Error(`Google no dio acceso (${r.status}). Vuelve a correr npm run google:conectar.`);
  const j = (await r.json()) as { access_token: string; expires_in: number };
  tokenCache = { valor: j.access_token, vence: Date.now() + j.expires_in * 1000, de: g.refreshToken };
  return j.access_token;
}

async function llamar(g: ConfigGoogle, f: Fetch, ruta: string, init: RequestInit = {}) {
  const t = await accessToken(g, f);
  const r = await f(`${API}${ruta}`, { ...init, headers: { authorization: `Bearer ${t}`, 'content-type': 'application/json', ...(init.headers ?? {}) } });
  if (!r.ok && !(init.method === 'DELETE' && (r.status === 404 || r.status === 410))) {
    throw new Error(`Google Calendar respondió ${r.status} en ${init.method ?? 'GET'} ${ruta.split('?')[0]}`);
  }
  return r.status === 204 || init.method === 'DELETE' ? null : r.json();
}

type EventoApi = {
  id: string;
  summary?: string;
  status?: string;
  transparency?: string;
  start?: { dateTime?: string; date?: string };
  end?: { dateTime?: string; date?: string };
  attendees?: { self?: boolean; responseStatus?: string }[];
  extendedProperties?: { private?: Record<string, string> };
  hangoutLink?: string;
};

/** Eventos con hora entre desde y hasta. Libres («transparentes»), cancelados y rechazados no ocupan. */
export function aEventos(items: EventoApi[]): EventoCal[] {
  const out: EventoCal[] = [];
  for (const e of items) {
    if (e.status === 'cancelled' || !e.start?.dateTime || !e.end?.dateTime) continue;
    if (e.transparency === 'transparent') continue;
    if (e.attendees?.some((a) => a.self && a.responseStatus === 'declined')) continue;
    out.push({
      ini: Date.parse(e.start.dateTime),
      fin: Date.parse(e.end.dateTime),
      titulo: e.summary ?? '',
      propio: e.extendedProperties?.private?.agenda === 'si',
    });
  }
  return out;
}

const cacheEventos = new Map<string, { t: number; v: EventoCal[] }>();

export async function eventosEntre(g: ConfigGoogle, desde: number, hasta: number, f: Fetch = fetch, cacheMs = 60_000): Promise<EventoCal[]> {
  const clave = `${g.calendarId}|${desde}|${hasta}`;
  const c = cacheEventos.get(clave);
  if (c && Date.now() - c.t < cacheMs) return c.v;
  const items: EventoApi[] = [];
  let pageToken = '';
  do {
    const q = new URLSearchParams({
      timeMin: new Date(desde).toISOString(),
      timeMax: new Date(hasta).toISOString(),
      singleEvents: 'true',
      orderBy: 'startTime',
      maxResults: '2500',
      ...(pageToken ? { pageToken } : {}),
    });
    const j = (await llamar(g, f, `/calendars/${encodeURIComponent(g.calendarId)}/events?${q}`)) as { items?: EventoApi[]; nextPageToken?: string };
    items.push(...(j.items ?? []));
    pageToken = j.nextPageToken ?? '';
  } while (pageToken);
  const v = aEventos(items);
  cacheEventos.set(clave, { t: Date.now(), v });
  return v;
}

export function olvidarCache() {
  cacheEventos.clear();
}

export async function crearEvento(
  g: ConfigGoogle,
  p: { reservaId: string; titulo: string; descripcion: string; inicio: string; fin: string; invitado: string; conMeet: boolean; lugar?: string },
  f: Fetch = fetch,
): Promise<{ id: string; meet: string | null }> {
  const cuerpo = {
    summary: p.titulo,
    description: p.descripcion,
    start: { dateTime: p.inicio },
    end: { dateTime: p.fin },
    attendees: [{ email: p.invitado }],
    location: p.conMeet ? undefined : p.lugar,
    extendedProperties: { private: { agenda: 'si', reserva: p.reservaId } },
    reminders: { useDefault: true },
    ...(p.conMeet ? { conferenceData: { createRequest: { requestId: p.reservaId, conferenceSolutionKey: { type: 'hangoutsMeet' } } } } : {}),
  };
  const j = (await llamar(g, f, `/calendars/${encodeURIComponent(g.calendarId)}/events?sendUpdates=all&conferenceDataVersion=1`, {
    method: 'POST',
    body: JSON.stringify(cuerpo),
  })) as EventoApi;
  olvidarCache();
  return { id: j.id, meet: j.hangoutLink ?? null };
}

export async function moverEvento(g: ConfigGoogle, id: string, inicio: string, fin: string, f: Fetch = fetch) {
  await llamar(g, f, `/calendars/${encodeURIComponent(g.calendarId)}/events/${encodeURIComponent(id)}?sendUpdates=all`, {
    method: 'PATCH',
    body: JSON.stringify({ start: { dateTime: inicio }, end: { dateTime: fin } }),
  });
  olvidarCache();
}

export async function borrarEvento(g: ConfigGoogle, id: string, f: Fetch = fetch) {
  await llamar(g, f, `/calendars/${encodeURIComponent(g.calendarId)}/events/${encodeURIComponent(id)}?sendUpdates=all`, { method: 'DELETE' });
  olvidarCache();
}
