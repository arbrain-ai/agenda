// Correos: por SMTP si configuras SMTP_URL (Gmail con contraseña de aplicación, Resend, Brevo…). Sin SMTP, cada correo
// se guarda en .datos/buzon/ como un .html que puedes abrir: así pruebas todo en tu computadora sin mandar nada.
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { carpetaDatos } from './almacen';

export type Correo = { para: string; asunto: string; texto: string; html: string; adjuntos?: { nombre: string; contenido: string; tipo: string }[] };

export function modoCorreo(): 'smtp' | 'buzon' {
  return process.env.SMTP_URL?.trim() ? 'smtp' : 'buzon';
}

let transporte: import('nodemailer').Transporter | null = null;

export async function enviarCorreo(c: Correo): Promise<void> {
  if (modoCorreo() === 'smtp') {
    if (!transporte) {
      const nodemailer = await import('nodemailer');
      transporte = nodemailer.createTransport(process.env.SMTP_URL!.trim());
    }
    await transporte.sendMail({
      from: process.env.CORREO_REMITENTE?.trim() || undefined,
      to: c.para,
      subject: c.asunto,
      text: c.texto,
      html: c.html,
      attachments: c.adjuntos?.map((a) => ({ filename: a.nombre, content: a.contenido, contentType: a.tipo })),
    });
    return;
  }
  if (process.env.VERCEL) {
    console.info(`[agenda] correo (sin SMTP, no se mandó) → ${c.para}: ${c.asunto}`);
    return;
  }
  const dir = path.join(carpetaDatos(), 'buzon');
  await mkdir(dir, { recursive: true });
  const base = `${new Date().toISOString().replace(/[:.]/g, '-')}-${c.asunto.toLowerCase().normalize('NFD').replace(/[^a-z0-9]+/g, '-').slice(0, 40)}`;
  const cabecera = `<div style="font:13px system-ui;background:#f2f2f2;padding:10px 14px;border-bottom:1px solid #ddd">
<b>Para:</b> ${esc(c.para)}<br><b>Asunto:</b> ${esc(c.asunto)}${c.adjuntos?.length ? `<br><b>Adjuntos:</b> ${c.adjuntos.map((a) => esc(a.nombre)).join(', ')}` : ''}
<br><i>Buzón local: este correo NO se mandó (configura SMTP_URL para mandarlos de verdad).</i></div>`;
  await writeFile(path.join(dir, `${base}.html`), `<!doctype html><meta charset="utf-8">${cabecera}${c.html}`);
  for (const a of c.adjuntos ?? []) await writeFile(path.join(dir, `${base}-${a.nombre}`), a.contenido);
  console.info(`[agenda] correo guardado en .datos/buzon → ${c.para}: ${c.asunto}`);
}

export function esc(t: string) {
  return t.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
