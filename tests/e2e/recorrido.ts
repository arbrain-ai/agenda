// Recorrido de punta a punta en un navegador real: aplica, agenda, revisa el correo, cambia la hora, entra al panel,
// prueba el «no califica» y cancela. Guarda una captura por paso.
//
//   1) En una terminal:  ADMIN_CLAVE=demo-ejemplo npm run build && ADMIN_CLAVE=demo-ejemplo npm start
//   2) En otra:          ADMIN_CLAVE=demo-ejemplo npm run e2e
//
// Variables: BASE_URL (http://localhost:3000), ADMIN_CLAVE, DATOS_DIR (.datos), CAPTURAS (tests/e2e/capturas),
// CHROMIUM (ruta a un Chrome/Chromium si Playwright no trae el suyo: npx playwright install chromium).
import { chromium, type Page } from 'playwright-core';
import { mkdirSync, readdirSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import config from '../../agenda.config';

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const CLAVE = process.env.ADMIN_CLAVE || '';
const DATOS = path.resolve(process.env.DATOS_DIR || '.datos');
const CAPTURAS = path.resolve(process.env.CAPTURAS || 'tests/e2e/capturas');
const PRUEBA = { whatsapp: '+52 55 0000 0000', nombre: 'Persona de Prueba', correo: 'prueba@example.com' };
mkdirSync(CAPTURAS, { recursive: true });

let n = 0;
const registro: string[] = [];
async function foto(p: Page, nombre: string, completa = false) {
  n++;
  const archivo = `${String(n).padStart(2, '0')}-${nombre}.png`;
  await p.waitForTimeout(450); // que terminen las transiciones
  await p.screenshot({ path: path.join(CAPTURAS, archivo), fullPage: completa });
  registro.push(archivo);
  console.log(`📸 ${archivo}`);
}
function ok(cond: unknown, que: string) {
  if (!cond) throw new Error(`Falló: ${que}`);
  console.log(`✓ ${que}`);
}
const buzon = () => {
  const d = path.join(DATOS, 'buzon');
  try {
    return readdirSync(d).filter((f) => f.endsWith('.html')).sort((a, b) => statSync(path.join(d, a)).mtimeMs - statSync(path.join(d, b)).mtimeMs);
  } catch {
    return [];
  }
};

async function contestarHasta(p: Page, hasta: 'datos' | 'hora', filtroNo = false, whatsapp = PRUEBA.whatsapp) {
  await p.getByRole('button', { name: /Empezar mi aplicación/ }).click();
  await p.locator('#ap-wa').fill(whatsapp);
  await p.getByRole('button', { name: 'Continuar' }).first().click();
  for (const f of config.filtro) {
    const grupo = p.locator(`fieldset:not([hidden]) [role=radiogroup]`);
    // Una pregunta que no bloquea se responde «No» (para mostrar que deja pasar); las que bloquean, «Sí».
    const resp = filtroNo && f.bloquea ? 'No' : f.bloquea ? 'Sí' : 'No';
    await grupo.locator('label', { hasText: new RegExp(`^${resp}$`) }).click();
    await p.waitForTimeout(500);
    if (filtroNo && f.bloquea) return;
  }
  if (hasta === 'datos') return;
  await p.locator('#ap-nombre').fill(PRUEBA.nombre);
  await p.locator('#ap-correo').fill(PRUEBA.correo);
  await p.locator('section:not([hidden])').getByRole('button', { name: 'Continuar' }).click();
  for (const m of config.miniAplicacion) {
    const visible = p.locator('fieldset:not([hidden])');
    if (m.tipo === 'escala') await visible.locator('.escala label').nth(7).click();
    else if (m.tipo === 'sino') await visible.locator('.opcion').first().click();
    else {
      await visible.locator('textarea').fill('Que no me alcance el tiempo para aplicar lo que aprenda.');
      if (m === config.miniAplicacion[config.miniAplicacion.length - 1]) await foto(p, 'mini-aplicacion');
      await visible.getByRole('button', { name: 'Continuar' }).click();
    }
    await p.waitForTimeout(500);
  }
}

async function main() {
  const navegador = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined });
  const escritorio = await navegador.newContext({ viewport: { width: 1440, height: 900 }, locale: 'es-MX', timezoneId: config.horario.zona, deviceScaleFactor: 1 });
  const p = await escritorio.newPage();
  const correosAntes = buzon().length;

  // 1. Portada y contador real
  await p.goto(`${BASE}/aplicar`);
  const quedanAntes = Number(await p.locator('[data-prueba=quedan]').textContent());
  ok(quedanAntes > 0, `la portada muestra el contador real (${quedanAntes} libres)`);
  ok((await p.locator('.marca img').getAttribute('alt')) === config.marca.nombre, `lleva la marca «${config.marca.nombre}»`);
  await foto(p, 'portada');

  // 2. Aplicación completa
  await p.getByRole('button', { name: /Empezar mi aplicación/ }).click();
  await p.locator('#ap-wa').fill(PRUEBA.whatsapp);
  await foto(p, 'whatsapp');
  await p.getByRole('button', { name: 'Continuar' }).first().click();
  await foto(p, 'filtro-1');
  await p.goto(`${BASE}/aplicar`);
  await contestarHasta(p, 'hora');
  ok(await p.locator('.horas .hora').count() > 0, 'hay horarios para elegir');
  // Un día de los últimos visibles, para poder cambiar la hora después (a menos de N horas ya no se puede).
  await p.locator('.dias .dia').last().click();
  await p.locator('.horas .hora').first().click();
  const textoBoton = (await p.getByRole('button', { name: /Agendar ·/ }).textContent())?.trim();
  await foto(p, 'elegir-hora');
  await p.getByRole('button', { name: /Agendar ·/ }).click();
  await p.waitForURL(/\/llamada\/.+\?nueva=1/);
  ok(await p.getByText('¡Listo! Tu llamada quedó agendada').isVisible(), `reserva confirmada (${textoBoton})`);
  const urlLlamada = p.url().split('?')[0];
  const diaAgendado = await p.locator('[data-prueba=dia]').textContent();
  const horaAgendada = await p.locator('[data-prueba=hora]').textContent();
  await foto(p, 'confirmacion');

  // 3. Correos (buzón local)
  await p.waitForTimeout(800);
  const nuevos = buzon().slice(correosAntes);
  const conf = nuevos.find((f) => readFileSync(path.join(DATOS, 'buzon', f), 'utf8').includes(`<b>Para:</b> ${PRUEBA.correo}`));
  ok(conf, 'llegó el correo de confirmación con el .ics');
  await p.goto(`file://${path.join(DATOS, 'buzon', conf!)}`);
  await foto(p, 'correo-confirmacion', true);
  const aviso = nuevos.find((f) => f.includes('nueva-llamada'));
  if (aviso) {
    await p.goto(`file://${path.join(DATOS, 'buzon', aviso)}`);
    await foto(p, 'correo-aviso-anfitrion', true);
  }

  // 4. El contador bajó
  await p.goto(`${BASE}/aplicar`);
  const quedanDespues = Number(await p.locator('[data-prueba=quedan]').textContent());
  ok(quedanDespues === quedanAntes - 1, `el contador bajó de ${quedanAntes} a ${quedanDespues}`);
  await foto(p, 'contador-despues');

  // 5. Cambiar la hora desde el enlace
  await p.goto(urlLlamada);
  await p.getByRole('button', { name: 'Cambiar mi hora' }).click();
  await p.locator('.horas .hora').nth(1).click();
  await foto(p, 'cambiar-hora');
  await p.getByRole('button', { name: /Mover a/ }).click();
  await p.waitForURL(/listo=movida/);
  const horaNueva = await p.locator('[data-prueba=hora]').textContent();
  const diaNuevo = await p.locator('[data-prueba=dia]').textContent();
  ok(horaNueva !== horaAgendada || diaNuevo !== diaAgendado, `hora cambiada: ${diaAgendado} ${horaAgendada?.split(' · ')[0]} → ${diaNuevo} ${horaNueva?.split(' · ')[0]}`);
  await foto(p, 'hora-cambiada');

  // 6. Alguien que se queda a medias (lead parcial) y alguien que no califica
  const otro = await escritorio.newPage();
  await otro.goto(`${BASE}/aplicar`);
  // Otra persona (otro WhatsApp) contesta el filtro y se va antes de dar sus datos.
  await contestarHasta(otro, 'datos', false, '+52 55 0000 0001');
  await otro.waitForTimeout(800);
  await otro.goto(`${BASE}/aplicar`);
  await contestarHasta(otro, 'datos', true, '+52 55 0000 0002');
  ok(await otro.getByText(config.noCalifica.titulo).isVisible(), 'quien responde «No» a la pregunta que bloquea ve el mensaje cálido');
  await foto(otro, 'no-califica');
  await otro.close();

  // 7. Tu panel
  if (CLAVE) {
    await p.goto(`${BASE}/admin`);
    await p.locator('#clave').fill(CLAVE);
    await p.getByRole('button', { name: 'Entrar' }).click();
    await p.waitForSelector('[data-prueba=reserva]');
    ok(await p.getByText(PRUEBA.nombre).first().isVisible(), 'la reserva aparece en el panel con sus respuestas');
    ok(await p.locator('[data-prueba=lead]').count() > 0, 'el lead que no terminó aparece con su paso');
    await p.locator('details summary').first().click();
    await foto(p, 'panel', true);
  }

  // 8. Teléfono (y la hora en la zona de quien agenda)
  const tel = await navegador.newContext({ viewport: { width: 390, height: 844 }, locale: 'es-CO', timezoneId: 'America/Bogota', deviceScaleFactor: 2, isMobile: true, hasTouch: true });
  const pt = await tel.newPage();
  await pt.goto(`${BASE}/aplicar`);
  await foto(pt, 'telefono-portada', true);
  await pt.goto(urlLlamada);
  await foto(pt, 'telefono-tu-llamada');

  // 9. Cancelar
  await p.goto(`${urlLlamada}?cancelar=1`);
  await p.getByRole('button', { name: 'Sí, cancelar mi llamada' }).click();
  await p.waitForURL(/listo=cancelada/);
  ok(await p.getByText('Listo, cancelamos tu llamada.').isVisible(), 'cancelada desde el enlace');
  await foto(p, 'cancelada');
  await p.goto(`${BASE}/aplicar`);
  ok(Number(await p.locator('[data-prueba=quedan]').textContent()) === quedanAntes, 'al cancelar, el hueco vuelve al contador');

  await navegador.close();
  console.log(`\nListo: ${registro.length} capturas en ${CAPTURAS}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
