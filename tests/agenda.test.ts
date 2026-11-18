// El servidor de punta a punta, sin red: almacén de archivo en una carpeta temporal (y Postgres si hay
// AGENDA_PG_PRUEBA), Google Calendar simulado y correos a una lista en memoria.
import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import ejemplo from '@marca';
import { normalizar } from '@/lib/config';
import { cancelar, estadoAgenda, mover, registrarLead, reservar, urlLlamada, vuelta, type Deps } from '@/lib/agenda';
import { almacenArchivo } from '@/lib/almacen/archivo';
import { almacenPostgres } from '@/lib/almacen/postgres';
import type { Almacen } from '@/lib/almacen';
import type { Correo } from '@/lib/correo';
import type { Aplicacion } from '@/lib/aplicacion';
import { etiquetaHora } from '@/lib/tiempo';
import { olvidarCache } from '@/lib/google';

const MX = 'America/Mexico_City';
const H = 3_600_000;
const cfg = normalizar({
  ...ejemplo,
  llamada: { ...ejemplo.llamada, minutos: 45, margenParaAgendar: 45, lugar: 'https://example.com/sala' },
  horario: { zona: MX, fechas: { desde: '2026-11-21', hasta: '2026-11-23' }, diasAdelante: 0, diasBloqueados: [], bloques: [
    { dias: ['sab'], desde: '14:00', hasta: '15:30' },
    { dias: ['lun'], desde: '10:00', hasta: '12:15' },
  ] },
  cupo: { tope: 4, tandas: { dias: 0, umbral: 0 }, cierre: '' },
  recordatorios: [24, 1],
});

const tmp: string[] = [];
afterAll(() => tmp.forEach((d) => rmSync(d, { recursive: true, force: true })));

function app(correo: string, inicio: string): Aplicacion {
  return { nombre: 'Prueba Uno', correo, whatsapp: '+525500000000', filtro: { ya_vende: true, puede_invertir: true }, mini: { prioridad: 9, empieza_30_dias: true, miedo: 'el tiempo' }, inicio, zonaVisitante: null };
}

const almacenes: [string, () => Promise<Almacen>][] = [
  ['archivo', async () => {
    const d = mkdtempSync(path.join(tmpdir(), 'agenda-prueba-'));
    tmp.push(d);
    return almacenArchivo(d);
  }],
];
if (process.env.AGENDA_PG_PRUEBA) {
  almacenes.push(['postgres', async () => {
    const a = almacenPostgres(process.env.AGENDA_PG_PRUEBA!);
    // Limpia las tablas de prueba (base desechable).
    await a.tx(async () => undefined);
    const { default: postgres } = await import('postgres');
    const sql = postgres(process.env.AGENDA_PG_PRUEBA!, { onnotice: () => {} });
    await sql`truncate agenda_reservas, agenda_leads`;
    await sql.end();
    return a;
  }]);
}

describe.each(almacenes)('agenda con almacén %s', (_n, crear) => {
  let d: Deps;
  let correos: Correo[];
  let reloj: number;
  beforeEach(async () => {
    correos = [];
    reloj = Date.parse('2026-11-20T12:00:00.000Z');
    d = { cfg, alm: await crear(), google: null, enviar: async (c) => void correos.push(c), secreto: 'prueba', base: 'https://agenda.example.com', avisos: 'yo@example.com', ahora: () => reloj };
  });

  it('ofrece los huecos y el contador real', async () => {
    const e = await estadoAgenda(d);
    expect(e.todos.map((h) => etiquetaHora(h.inicio, MX))).toEqual(['14:00', '14:45', '10:00', '10:45', '11:30']);
    expect(e.quedan).toBe(4); // tope 4 aunque haya 5 huecos
    expect(e.tope).toBe(4);
  });

  it('reserva, confirma por correo y avisa al anfitrión; el hueco desaparece y el contador baja', async () => {
    const { todos } = await estadoAgenda(d);
    const r = await reservar(d, app('uno@example.com', todos[0].inicio));
    expect(r.ok).toBe(true);
    expect(correos.map((c) => c.para)).toEqual(['uno@example.com', 'yo@example.com']);
    expect(correos[0].adjuntos?.[0].nombre).toBe('llamada.ics');
    expect(correos[0].texto).toContain(urlLlamada(d, (r as { reserva: { id: string } }).reserva.id));
    const e = await estadoAgenda(d);
    expect(e.todos.map((h) => h.inicio)).not.toContain(todos[0].inicio);
    expect(e.quedan).toBe(3);
  });

  it('dos personas por la misma hora: gana una', async () => {
    const { todos } = await estadoAgenda(d);
    const [a, b] = await Promise.all([reservar(d, app('a@example.com', todos[1].inicio)), reservar(d, app('b@example.com', todos[1].inicio))]);
    expect([a.ok, b.ok].sort()).toEqual([false, true]);
    expect([a, b].find((x) => !x.ok)).toMatchObject({ error: 'hueco-tomado' });
  });

  it('una llamada viva por persona y el tope se respeta', async () => {
    const { todos } = await estadoAgenda(d);
    const r1 = await reservar(d, app('uno@example.com', todos[0].inicio));
    const r2 = await reservar(d, app('uno@example.com', todos[1].inicio));
    expect(r2).toMatchObject({ ok: true, yaTenia: true });
    expect(r2.ok && r1.ok && r2.reserva.id === r1.reserva.id).toBe(true);
    for (const [i, c] of ['b', 'c', 'e'].entries()) expect((await reservar(d, app(`${c}@example.com`, todos[i + 1].inicio))).ok).toBe(true);
    const lleno = await reservar(d, app('f@example.com', todos[4].inicio));
    expect(lleno).toMatchObject({ ok: false });
    expect((await estadoAgenda(d)).quedan).toBe(0);
  });

  it('la persona cambia su hora (gasta un cambio), luego ya no puede pasado el límite; cancelar libera', async () => {
    const { todos } = await estadoAgenda(d);
    const r = await reservar(d, app('uno@example.com', todos[0].inicio));
    if (!r.ok) throw new Error('no reservó');
    correos = [];
    const m1 = await mover(d, r.reserva.id, todos[2].inicio, 'persona');
    expect(m1).toMatchObject({ ok: true, reserva: { cambiosPersona: 1, horarioAnterior: todos[0].inicio, inicio: todos[2].inicio } });
    expect(correos.map((c) => c.asunto)[0]).toMatch(/cambió/);
    const m2 = await mover(d, r.reserva.id, todos[3].inicio, 'persona');
    expect(m2.ok).toBe(true);
    expect(await mover(d, r.reserva.id, todos[4].inicio, 'persona')).toMatchObject({ ok: false, error: 'sin-cambios' });
    expect(await mover(d, r.reserva.id, todos[4].inicio, 'admin')).toMatchObject({ ok: true, reserva: { cambiosPersona: 2 } });
    const c = await cancelar(d, r.reserva.id, 'persona');
    expect(c).toMatchObject({ ok: true, reserva: { estado: 'cancelada' } });
    expect((await estadoAgenda(d)).todos).toHaveLength(5);
  });

  it('recordatorios: 24 h y 1 h, una sola vez cada uno, aunque dos vueltas corran juntas', async () => {
    const { todos } = await estadoAgenda(d);
    const r = await reservar(d, app('uno@example.com', todos[2].inicio)); // lunes 10:00, agendado con > 24 h
    if (!r.ok) throw new Error('no reservó');
    correos = [];
    const t = Date.parse(r.reserva.inicio);
    reloj = t - 20 * H;
    const [a, b] = await Promise.all([vuelta(d), vuelta(d)]);
    expect(a.recordatorios + b.recordatorios).toBe(1);
    expect(correos[0].asunto).toMatch(/mañana/);
    reloj = t - 30 * 60_000;
    expect((await vuelta(d)).recordatorios).toBe(1);
    expect(correos[1].asunto).toMatch(/una hora/);
    expect((await vuelta(d)).recordatorios).toBe(0);
  });

  it('guarda el lead parcial desde el WhatsApp', async () => {
    await registrarLead(d, { whatsapp: '+52 55 0000 0000', paso: 'datos', nombre: 'Prueba' });
    const leads = await d.alm.leer((t) => t.leads());
    expect(leads[0]).toMatchObject({ whatsapp: '+525500000000', ultimoPaso: 'datos', nombre: 'Prueba' });
  });

  it('con Google: su calendario manda, crea el evento con Meet, lo mueve y lo borra', async () => {
    olvidarCache();
    const llamadas: { metodo: string; url: string; cuerpo?: unknown }[] = [];
    const lunes10 = Date.parse('2026-11-23T16:00:00.000Z');
    const falso: typeof fetch = async (u, init) => {
      const url = String(u);
      const metodo = init?.method ?? 'GET';
      llamadas.push({ metodo, url, cuerpo: init?.body && typeof init.body === 'string' ? JSON.parse(init.body) : undefined });
      if (url.includes('oauth2')) return Response.json({ access_token: 'falso', expires_in: 3600 });
      if (metodo === 'GET') {
        return Response.json({ items: [
          { id: 'v1', summary: '📞 Llamadas', start: { dateTime: new Date(lunes10).toISOString() }, end: { dateTime: new Date(lunes10 + 3 * H).toISOString() } },
          { id: 'o1', summary: 'Dentista', start: { dateTime: new Date(lunes10 + H).toISOString() }, end: { dateTime: new Date(lunes10 + 2 * H).toISOString() } },
        ] });
      }
      if (metodo === 'POST') return Response.json({ id: 'ev-1', hangoutLink: 'https://meet.example.com/abc' });
      return new Response(null, { status: 204 });
    };
    const dg: Deps = { ...d, cfg: { ...cfg, llamada: { ...cfg.llamada, lugar: 'google-meet' } }, google: { clientId: 'x', clientSecret: 'y', refreshToken: 'z', calendarId: 'primary' }, fetch: falso };
    const e = await estadoAgenda(dg);
    // Ventana 10:00–13:00 del lunes; el dentista de 11:00 a 12:00 (+15 min de aire) deja solo 10:00 y 12:15.
    expect(e.todos.map((h) => etiquetaHora(h.inicio, MX))).toEqual(['10:00', '12:15']);
    const r = await reservar(dg, app('uno@example.com', e.todos[0].inicio));
    if (!r.ok) throw new Error('no reservó');
    expect(r.reserva).toMatchObject({ googleEventoId: 'ev-1', sala: 'https://meet.example.com/abc', eventoPendiente: null });
    const post = llamadas.find((l) => l.metodo === 'POST' && l.url.includes('/events'))!;
    expect(post.url).toContain('sendUpdates=all');
    expect(post.cuerpo).toMatchObject({ attendees: [{ email: 'uno@example.com' }], conferenceData: { createRequest: { conferenceSolutionKey: { type: 'hangoutsMeet' } } } });
    olvidarCache();
    const m = await mover(dg, r.reserva.id, e.todos[1].inicio, 'admin');
    expect(m.ok).toBe(true);
    expect(llamadas.some((l) => l.metodo === 'PATCH' && l.url.includes('/events/ev-1'))).toBe(true);
    await cancelar(dg, r.reserva.id, 'admin');
    expect(llamadas.some((l) => l.metodo === 'DELETE' && l.url.includes('/events/ev-1'))).toBe(true);
  });

  it('si Google no responde, no se ofrece nada (falta de lectura no es «libre») y el evento se reintenta', async () => {
    olvidarCache();
    let cae = true;
    const falso: typeof fetch = async (u, init) => {
      if (String(u).includes('oauth2')) return Response.json({ access_token: 'falso', expires_in: 3600 });
      if (cae) return new Response('caído', { status: 503 });
      if ((init?.method ?? 'GET') === 'GET') return Response.json({ items: [] });
      return Response.json({ id: 'ev-9' });
    };
    const dg: Deps = { ...d, google: { clientId: 'x', clientSecret: 'y', refreshToken: 'z', calendarId: 'primary' }, fetch: falso };
    const e = await estadoAgenda(dg);
    expect(e).toMatchObject({ errorCalendario: true, quedan: 0, huecos: [] });
    cae = false;
    olvidarCache();
    const ok = await estadoAgenda(dg);
    cae = true; // la lectura pasó, pero crear el evento falla
    const r = await reservar(dg, app('uno@example.com', ok.todos[0].inicio));
    if (!r.ok) throw new Error('no reservó');
    expect(r.reserva.eventoPendiente).toBe('crear');
    cae = false;
    expect((await vuelta(dg)).google).toBe(1);
    expect((await dg.alm.leer((t) => t.reserva(r.reserva.id)))?.googleEventoId).toBe('ev-9');
  });
});
