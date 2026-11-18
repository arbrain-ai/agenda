// Textos de los correos (confirmación, recordatorio, cambio, cancelación y avisos para ti). Usan tu marca y colores
// de agenda.config.ts; no hay que tocar este archivo para personalizarlos.
import type { Config } from './config';
import type { Reserva } from './almacen';
import { esc, type Correo } from './correo';
import { etiquetaDia, etiquetaHora, nombreZona } from './tiempo';
import { ics } from './ics';
import { primerNombre } from './aplicacion';

type Ctx = { cfg: Config; urlLlamada: string; urlBase: string };

function cuando(r: Reserva, cfg: Config) {
  const tz = r.zonaVisitante || cfg.horario.zona;
  const dia = etiquetaDia(r.inicio, tz);
  const hora = etiquetaHora(r.inicio, tz);
  return { dia, hora, zona: nombreZona(tz), texto: `${dia} a las ${hora} (${nombreZona(tz)})` };
}

function marco(cfg: Config, cuerpo: string, base: string) {
  const c = cfg.colores;
  const logo = cfg.marca.logo && /^https:/.test(base) ? `<img src="${base}${cfg.marca.logo}" alt="" height="28" style="display:block;margin-bottom:18px">` : '';
  return `<div style="background:${c.fondo};padding:28px 12px;font-family:${esc(cfg.fuentes.texto)}">
<div style="max-width:520px;margin:0 auto;background:${c.superficie};border:1px solid ${c.borde};border-radius:14px;padding:28px;color:${c.texto};font-size:15px;line-height:1.55">
${logo}${cuerpo}
<p style="color:${c.textoSuave};font-size:12px;margin-top:28px">${esc(cfg.marca.nombre)}</p></div></div>`;
}

function boton(cfg: Config, href: string, etiqueta: string) {
  return `<p style="margin:22px 0"><a href="${esc(href)}" style="background:${cfg.colores.acento};color:${cfg.colores.textoSobreAcento};text-decoration:none;padding:12px 20px;border-radius:10px;font-weight:600;display:inline-block">${esc(etiqueta)}</a></p>`;
}

export function titulo(cfg: Config) {
  return `Llamada con ${cfg.anfitrion.nombre} · ${cfg.marca.nombre}`;
}

export function adjuntoIcs(cfg: Config, r: Reserva, urlLlamada: string, cancelado = false) {
  return {
    nombre: 'llamada.ics',
    tipo: 'text/calendar; charset=utf-8',
    contenido: ics({
      uid: `${r.id}@agenda`,
      titulo: titulo(cfg),
      descripcion: `Entra a la llamada: ${r.sala ?? cfg.llamada.lugar}\nCambiar o cancelar: ${urlLlamada}`,
      inicio: r.inicio,
      fin: r.fin,
      lugar: r.sala,
      secuencia: r.movimientos,
      cancelado,
    }),
  };
}

export function correoConfirmacion(r: Reserva, { cfg, urlLlamada, urlBase }: Ctx): Correo {
  const w = cuando(r, cfg);
  const video = cfg.llamada.videoPrevio;
  const asunto = `Tu llamada con ${cfg.anfitrion.nombre}: ${w.dia}, ${w.hora}`;
  const texto = [
    `¡Hola ${primerNombre(r.nombre)}!`,
    `Quedó agendada tu llamada de ${cfg.llamada.minutos} minutos con ${cfg.anfitrion.nombre}: ${w.texto}.`,
    `Para entrar: ${r.sala ?? cfg.llamada.lugar}`,
    video ? `Antes de la llamada, mira este video: ${video}` : '',
    `Si necesitas cambiar la hora o cancelar: ${urlLlamada}`,
  ].filter(Boolean).join('\n\n');
  const html = marco(cfg, `<p>¡Hola ${esc(primerNombre(r.nombre))}!</p>
<p>Quedó agendada tu llamada de <b>${cfg.llamada.minutos} minutos</b> con ${esc(cfg.anfitrion.nombre)}:</p>
<p style="font-size:18px;font-weight:600;margin:6px 0 0">${esc(w.dia)}, ${esc(w.hora)}</p><p style="color:${cfg.colores.textoSuave};margin:2px 0 0">${esc(w.zona)}</p>
${boton(cfg, r.sala ?? cfg.llamada.lugar, 'Enlace de la llamada')}
${video ? `<p>Antes de vernos, mira este video: <a href="${esc(video)}">${esc(video)}</a></p>` : ''}
<p style="color:${cfg.colores.textoSuave}">¿Necesitas cambiar la hora o cancelar? <a href="${esc(urlLlamada)}">Hazlo aquí</a>. Te adjuntamos el evento para tu calendario.</p>`, urlBase);
  return { para: r.correo, asunto, texto, html, adjuntos: [adjuntoIcs(cfg, r, urlLlamada)] };
}

export function correoRecordatorio(r: Reserva, horas: number, { cfg, urlLlamada, urlBase }: Ctx): Correo {
  const w = cuando(r, cfg);
  const falta = horas >= 24 ? (horas === 24 ? 'mañana' : `en ${Math.round(horas / 24)} días`) : horas === 1 ? 'en una hora' : `en ${horas} horas`;
  const asunto = `Recordatorio: tu llamada con ${cfg.anfitrion.nombre} es ${falta}`;
  const texto = `¡Hola ${primerNombre(r.nombre)}! Tu llamada con ${cfg.anfitrion.nombre} es ${falta}: ${w.texto}.\n\nPara entrar: ${r.sala ?? cfg.llamada.lugar}\n\n¿No puedes? Cambia la hora o cancela aquí: ${urlLlamada}`;
  const html = marco(cfg, `<p>¡Hola ${esc(primerNombre(r.nombre))}!</p><p>Tu llamada con ${esc(cfg.anfitrion.nombre)} es <b>${esc(falta)}</b>: ${esc(w.texto)}.</p>
${boton(cfg, r.sala ?? cfg.llamada.lugar, 'Entrar a la llamada')}
${cfg.llamada.videoPrevio ? `<p>Si todavía no lo ves, este video es importante antes de vernos: <a href="${esc(cfg.llamada.videoPrevio)}">${esc(cfg.llamada.videoPrevio)}</a></p>` : ''}
<p style="color:${cfg.colores.textoSuave}">¿No puedes? <a href="${esc(urlLlamada)}">Cambia la hora o cancela aquí</a>. Es mejor avisar que dejar la silla vacía.</p>`, urlBase);
  return { para: r.correo, asunto, texto, html };
}

export function correoCambio(r: Reserva, { cfg, urlLlamada, urlBase }: Ctx): Correo {
  const w = cuando(r, cfg);
  const asunto = `Tu llamada cambió: ${w.dia}, ${w.hora}`;
  const texto = `¡Hola ${primerNombre(r.nombre)}! Tu llamada con ${cfg.anfitrion.nombre} quedó para el ${w.texto}.\n\nPara entrar: ${r.sala ?? cfg.llamada.lugar}\n\nSi no te queda: ${urlLlamada}`;
  const html = marco(cfg, `<p>¡Hola ${esc(primerNombre(r.nombre))}!</p><p>Tu llamada con ${esc(cfg.anfitrion.nombre)} quedó para el <b>${esc(w.texto)}</b>.</p>
${boton(cfg, r.sala ?? cfg.llamada.lugar, 'Enlace de la llamada')}<p style="color:${cfg.colores.textoSuave}">¿No te queda? <a href="${esc(urlLlamada)}">Elige otra hora</a>.</p>`, urlBase);
  return { para: r.correo, asunto, texto, html, adjuntos: [adjuntoIcs(cfg, r, urlLlamada)] };
}

export function correoCancelacion(r: Reserva, { cfg, urlBase }: Ctx): Correo {
  const w = cuando(r, cfg);
  const asunto = `Cancelamos tu llamada del ${w.dia}`;
  const texto = `¡Hola ${primerNombre(r.nombre)}! Tu llamada del ${w.texto} quedó cancelada. Si quieres otra, vuelve a agendar en ${urlBase}/aplicar`;
  const html = marco(cfg, `<p>¡Hola ${esc(primerNombre(r.nombre))}!</p><p>Tu llamada del ${esc(w.texto)} quedó cancelada.</p>${boton(cfg, `${urlBase}/aplicar`, 'Agendar otra')}`, urlBase);
  return { para: r.correo, asunto, texto, html, adjuntos: [adjuntoIcs(cfg, r, `${urlBase}/aplicar`, true)] };
}

/** Aviso para ti (AVISOS_A): nueva reserva, cambio o cancelación, con las respuestas de la persona. */
export function correoAviso(r: Reserva, que: 'nueva' | 'movida' | 'cancelada', { cfg, urlBase }: Ctx): (para: string) => Correo {
  const w = cuando({ ...r, zonaVisitante: null }, cfg);
  const titulo = { nueva: 'Nueva llamada', movida: 'Llamada movida', cancelada: 'Llamada cancelada' }[que];
  const filas = [
    ...cfg.filtro.map((f) => [f.pregunta, r.filtro[f.id] === undefined ? '—' : r.filtro[f.id] ? 'Sí' : 'No']),
    ...cfg.miniAplicacion.map((m) => [m.pregunta, String(r.mini[m.id] === true ? 'Sí' : r.mini[m.id] === false ? 'No' : r.mini[m.id] ?? '—')]),
  ];
  const asunto = `${titulo}: ${r.nombre} · ${w.dia}, ${w.hora}`;
  const texto = `${titulo}: ${r.nombre} (${r.correo}, ${r.whatsapp}) · ${w.texto}\n\n${filas.map(([p, v]) => `${p}\n→ ${v}`).join('\n\n')}\n\nPanel: ${urlBase}/admin`;
  const html = marco(cfg, `<p style="font-size:18px;font-weight:600;margin:0">${esc(titulo)}: ${esc(r.nombre)}</p>
<p style="margin:4px 0 16px;color:${cfg.colores.textoSuave}">${esc(w.texto)} · ${esc(r.correo)} · ${esc(r.whatsapp)}</p>
${filas.map(([p, v]) => `<p style="margin:10px 0 0;color:${cfg.colores.textoSuave};font-size:13px">${esc(p)}</p><p style="margin:2px 0 0">${esc(v)}</p>`).join('')}
${boton(cfg, `${urlBase}/admin`, 'Abrir el panel')}`, urlBase);
  return (para) => ({ para, asunto, texto, html });
}
