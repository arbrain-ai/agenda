#!/usr/bin/env node
// npm run google:conectar — conecta tu Google Calendar UNA vez y te da las 3 variables para tu .env.
//
// Antes (5 minutos, una sola vez):
//   1. Entra a https://console.cloud.google.com/ y crea un proyecto (cualquier nombre).
//   2. «APIs y servicios» → «Biblioteca» → busca «Google Calendar API» → Habilitar.
//   3. «Pantalla de consentimiento de OAuth» → Externo → llena nombre y tu correo → en «Usuarios de prueba» agrega tu
//      correo de Google.
//   4. «Credenciales» → «Crear credenciales» → «ID de cliente de OAuth» → tipo «App de escritorio».
//   5. Copia el ID de cliente y el secreto y corre:
//        GOOGLE_CLIENT_ID=... GOOGLE_CLIENT_SECRET=... npm run google:conectar
//
// Se abre tu navegador, aceptas, y este script imprime GOOGLE_REFRESH_TOKEN. Nada se guarda fuera de tu computadora.
// Permiso que pide: ver y editar los eventos de tus calendarios (para leer tus ocupados y crear la llamada).
import { createServer } from 'node:http';
import { createHash, randomBytes } from 'node:crypto';
import { exec } from 'node:child_process';

const id = process.env.GOOGLE_CLIENT_ID?.trim();
const secreto = process.env.GOOGLE_CLIENT_SECRET?.trim();
if (!id || !secreto) {
  console.log('Faltan GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET. Lee los pasos al inicio de scripts/google-conectar.mjs.');
  process.exit(1);
}
const verificador = randomBytes(32).toString('base64url');
const reto = createHash('sha256').update(verificador).digest('base64url');
const estado = randomBytes(12).toString('hex');

const servidor = createServer(async (req, res) => {
  const u = new URL(req.url ?? '/', 'http://127.0.0.1');
  if (u.pathname !== '/') { res.writeHead(404).end(); return; }
  if (u.searchParams.get('state') !== estado || !u.searchParams.get('code')) {
    res.writeHead(400, { 'content-type': 'text/plain; charset=utf-8' }).end('Algo no cuadró. Vuelve a correr npm run google:conectar.');
    return;
  }
  const r = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ code: u.searchParams.get('code'), client_id: id, client_secret: secreto, redirect_uri: redirect, grant_type: 'authorization_code', code_verifier: verificador }),
  });
  const j = await r.json();
  if (!j.refresh_token) {
    res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' }).end('Google no dio el permiso permanente. Vuelve a intentarlo.');
    console.log('✗ Google no devolvió refresh_token:', j.error_description || j.error || 'sin detalle');
    process.exit(1);
  }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }).end('<p style="font:18px system-ui;padding:40px">Listo. Ya puedes cerrar esta pestaña y volver a la terminal.</p>');
  console.log('\n✓ Conectado. Agrega estas líneas a tu .env (o a las variables de tu hosting):\n');
  console.log(`GOOGLE_CLIENT_ID=${id}`);
  console.log(`GOOGLE_CLIENT_SECRET=${secreto}`);
  console.log(`GOOGLE_REFRESH_TOKEN=${j.refresh_token}`);
  console.log('\nGOOGLE_CALENDAR_ID vacío = tu calendario principal.');
  servidor.close();
});

let redirect = '';
servidor.listen(0, '127.0.0.1', () => {
  redirect = `http://127.0.0.1:${servidor.address().port}`;
  const url = `https://accounts.google.com/o/oauth2/v2/auth?${new URLSearchParams({
    client_id: id, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent',
    scope: 'https://www.googleapis.com/auth/calendar.events', state: estado, code_challenge: reto, code_challenge_method: 'S256',
  })}`;
  console.log('Abre este enlace si el navegador no se abre solo:\n\n' + url + '\n');
  if (!process.argv.includes('--no-abrir')) {
    const abrir = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
    exec(`${abrir} "${url}"`);
  }
});
