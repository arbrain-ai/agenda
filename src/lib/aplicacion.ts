// Reglas puras de la aplicación: WhatsApp, filtro, mini-aplicación y el lead parcial (quien deja su WhatsApp y no
// termina). Las preguntas salen de agenda.config.ts; aquí no hay textos de ninguna marca.

import type { PreguntaFiltro, PreguntaMini } from './tipos-config';

export type Respuestas = Record<string, string | number | boolean>;

export type Aplicacion = {
  nombre: string;
  correo: string;
  whatsapp: string;
  filtro: Record<string, boolean>;
  mini: Respuestas;
  inicio: string;
  zonaVisitante: string | null;
};

export const RE_CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * WhatsApp en formato internacional: con código de país (+52…, 0052… o 11+ dígitos sin «+»).
 * Devuelve «+<dígitos>» o null. Un número de 10 dígitos sin «+» no dice su país: se rechaza.
 */
export function normalizarWhatsapp(v: string): string | null {
  const t = (v ?? '').trim();
  if (!t || /[^\d\s()+.\-]/.test(t)) return null;
  let d = t.replace(/[^\d]/g, '');
  const conMas = t.startsWith('+');
  if (!conMas && d.startsWith('00')) d = d.slice(2);
  else if (!conMas && d.length < 11) return null;
  if (!/^[1-9]\d{7,14}$/.test(d)) return null;
  return `+${d}`;
}

/** ¿Pasa el filtro? Solo bloquean las preguntas con `bloquea: true` respondidas con «no». */
export function califica(filtro: PreguntaFiltro[], respuestas: Record<string, boolean | null | undefined>) {
  return filtro.every((f) => !f.bloquea || respuestas[f.id] === true);
}

/** Pasos del formulario, en orden. «no» = cayó en «hoy no es tu momento». */
export function pasosDe(filtro: PreguntaFiltro[], mini: PreguntaMini[]) {
  return ['whatsapp', ...filtro.map((f) => `f:${f.id}`), 'datos', ...mini.map((m) => `m:${m.id}`), 'hora'];
}

const texto = (v: FormDataEntryValue | null, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');

/** Lee y valida el formulario completo. El servidor SIEMPRE vuelve a revisar el filtro: el navegador no es garantía. */
export function leerAplicacion(form: FormData, filtro: PreguntaFiltro[], mini: PreguntaMini[]): { ok: true; data: Aplicacion } | { ok: false; error: string; paso?: string } {
  const whatsapp = normalizarWhatsapp(texto(form.get('whatsapp'), 40));
  if (!whatsapp) return { ok: false, error: 'whatsapp-invalido', paso: 'whatsapp' };
  const rf: Record<string, boolean> = {};
  for (const f of filtro) {
    const v = texto(form.get(`f_${f.id}`), 3);
    if (v !== 'si' && v !== 'no') return { ok: false, error: 'falta-filtro', paso: `f:${f.id}` };
    rf[f.id] = v === 'si';
  }
  if (!califica(filtro, rf)) return { ok: false, error: 'no-califica', paso: 'no' };
  const nombre = texto(form.get('nombre'), 120);
  const correo = texto(form.get('correo'), 200).toLowerCase();
  if (!nombre) return { ok: false, error: 'falta-nombre', paso: 'datos' };
  if (!RE_CORREO.test(correo)) return { ok: false, error: 'correo-invalido', paso: 'datos' };
  const rm: Respuestas = {};
  for (const m of mini) {
    const v = texto(form.get(`m_${m.id}`), 2000);
    if (m.tipo === 'escala') {
      const n = Number(v);
      if (!Number.isInteger(n) || n < 1 || n > 10) return { ok: false, error: 'falta-respuesta', paso: `m:${m.id}` };
      rm[m.id] = n;
    } else if (m.tipo === 'sino') {
      if (v !== 'si' && v !== 'no') return { ok: false, error: 'falta-respuesta', paso: `m:${m.id}` };
      rm[m.id] = v === 'si';
    } else {
      if (!v) return { ok: false, error: 'falta-respuesta', paso: `m:${m.id}` };
      rm[m.id] = v;
    }
  }
  const inicio = texto(form.get('inicio'), 40);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(inicio)) return { ok: false, error: 'falta-hueco', paso: 'hora' };
  const zona = texto(form.get('zona'), 60);
  return { ok: true, data: { nombre, correo, whatsapp, filtro: rf, mini: rm, inicio, zonaVisitante: /^[A-Za-z_]+(\/[A-Za-z0-9_+\-]+)*$/.test(zona) ? zona : null } };
}

// ── Lead parcial ──────────────────────────────────────────────────────────────────────────────
export type Lead = {
  whatsapp: string;
  ultimoPaso: string;
  pasoNum: number;
  filtro: Record<string, boolean>;
  nombre: string | null;
  correo: string | null;
  reservaId: string | null;
  actualizado: string;
};

/** Valida lo que manda el navegador al avanzar. null si no hay WhatsApp válido o el paso no existe. */
export function leerLead(raw: Record<string, unknown>, pasos: string[]): Omit<Lead, 'reservaId' | 'actualizado'> | null {
  const txt = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
  const whatsapp = normalizarWhatsapp(txt(raw.whatsapp, 40));
  const paso = txt(raw.paso, 60);
  if (!whatsapp || !(paso === 'no' || pasos.includes(paso))) return null;
  const filtro: Record<string, boolean> = {};
  const rf = (raw.filtro ?? {}) as Record<string, unknown>;
  for (const [k, v] of Object.entries(rf)) if (/^[a-z][a-z0-9_]{0,39}$/.test(k) && (v === 'si' || v === 'no')) filtro[k] = v === 'si';
  const correo = txt(raw.correo, 200).toLowerCase();
  return {
    whatsapp,
    ultimoPaso: paso,
    pasoNum: paso === 'no' ? pasos.length + 1 : pasos.indexOf(paso) + 1,
    filtro,
    nombre: txt(raw.nombre, 120) || null,
    correo: RE_CORREO.test(correo) ? correo : null,
  };
}

/** Mezcla lo nuevo con lo guardado: el paso nunca retrocede, las respuestas se corrigen y nombre/correo no se pierden. */
export function mezclarLead(nuevo: Omit<Lead, 'reservaId' | 'actualizado'>, previo: Lead | null, ahora = new Date()): Lead {
  const adelante = !!previo && previo.ultimoPaso !== 'no' && nuevo.ultimoPaso !== 'no' && previo.pasoNum > nuevo.pasoNum;
  return {
    whatsapp: nuevo.whatsapp,
    ultimoPaso: adelante ? previo!.ultimoPaso : nuevo.ultimoPaso,
    pasoNum: adelante ? previo!.pasoNum : nuevo.pasoNum,
    filtro: { ...(previo?.filtro ?? {}), ...nuevo.filtro },
    nombre: nuevo.nombre ?? previo?.nombre ?? null,
    correo: nuevo.correo ?? previo?.correo ?? null,
    reservaId: previo?.reservaId ?? null,
    actualizado: ahora.toISOString(),
  };
}

/** Plantilla simple: «Hola {nombre}» → «Hola Lía». Las variables que falten quedan vacías. */
export function rellenar(plantilla: string, vars: Record<string, string | null | undefined>) {
  return plantilla.replace(/\{(\w+)\}/g, (_, k: string) => vars[k] ?? '').replace(/\s+([.,])/g, '$1').trim();
}

/** wa.me con el mensaje, o null sin número. */
export function enlaceWhatsapp(whatsapp: string | null | undefined, texto: string) {
  const d = (whatsapp ?? '').replace(/[^\d]/g, '');
  return d ? `https://wa.me/${d}?text=${encodeURIComponent(texto)}` : null;
}

export const primerNombre = (n: string | null | undefined) => (n ?? '').trim().split(/\s+/)[0] || '';
