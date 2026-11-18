// npm run revisar — revisa agenda.config.ts y tu .env, y te dice en español qué falta o qué está mal.
import { existsSync, readFileSync } from 'node:fs';
import crudo from '../agenda.config';
import { normalizar, problemasDeConfig } from '../src/lib/config';
import { fechasDeAgenda, generarHuecos, ventanasDeBloques } from '../src/lib/huecos';
import { claveDia, etiquetaDia, etiquetaHora } from '../src/lib/tiempo';

const problemas = problemasDeConfig(crudo);
if (problemas.length) {
  console.log(`✗ agenda.config.ts tiene ${problemas.length} problema(s):`);
  for (const p of problemas) console.log(`  - ${p}`);
  process.exit(1);
}
const c = normalizar(crudo);
console.log(`✓ agenda.config.ts está bien: «${c.marca.nombre}», llamadas de ${c.llamada.minutos} min con ${c.anfitrion.nombre}, zona ${c.horario.zona}.`);
if (c.marca.logo && !existsSync(`public${c.marca.logo}`)) console.log(`  ! No encuentro el logo en public${c.marca.logo}.`);

const ahora = Date.now();
const fechas = fechasDeAgenda(claveDia(ahora, c.horario.zona), c.horario);
const huecos = generarHuecos({ ventanas: ventanasDeBloques(fechas, c.horario.bloques, c.horario.zona, c.horario.diasBloqueados), ocupados: [], minutos: c.llamada.minutos, aireEntreLlamadas: c.llamada.aireEntreLlamadas, aireEventos: 0, ahora, margenMin: c.llamada.margenParaAgendar });
console.log(`✓ Con tus bloques salen ${huecos.length} horarios en los próximos días${c.cupo.tope ? ` (el contador mostrará como máximo ${c.cupo.tope})` : ''}.`);
for (const h of huecos.slice(0, 5)) console.log(`    ${etiquetaDia(h.inicio, c.horario.zona)} ${etiquetaHora(h.inicio, c.horario.zona)}`);
if (!huecos.length) console.log('  ! No sale ningún horario: revisa horario.bloques, horario.fechas y diasBloqueados.');

const env: Record<string, string> = {};
for (const f of ['.env', '.env.local']) {
  if (!existsSync(f)) continue;
  for (const l of readFileSync(f, 'utf8').split('\n')) {
    const m = l.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/);
    if (m && m[2]) env[m[1]] = m[2];
  }
}
const v = (k: string) => env[k] || process.env[k];
console.log('\nTu .env:');
console.log(v('ADMIN_CLAVE') ? '  ✓ ADMIN_CLAVE (panel /admin abierto con tu clave)' : '  · ADMIN_CLAVE vacío: el panel /admin queda cerrado');
console.log(v('AVISOS_A') ? `  ✓ Avisos de cada llamada a ${v('AVISOS_A')}` : '  · AVISOS_A vacío: no te llegará aviso por correo de cada llamada');
console.log(v('SMTP_URL') ? '  ✓ SMTP_URL: los correos salen de verdad' : '  · Sin SMTP_URL: los correos se guardan en .datos/buzon (no salen)');
console.log(v('DATABASE_URL') ? '  ✓ DATABASE_URL: las reservas se guardan en Postgres' : '  · Sin DATABASE_URL: las reservas se guardan en .datos/agenda.json (no sirve en Vercel)');
if (v('DATABASE_URL') && !v('AGENDA_SECRETO')) console.log('  ✗ Con DATABASE_URL hace falta AGENDA_SECRETO (openssl rand -hex 32)');
const g = ['GOOGLE_CLIENT_ID', 'GOOGLE_CLIENT_SECRET', 'GOOGLE_REFRESH_TOKEN'].filter((k) => v(k));
console.log(g.length === 3 ? '  ✓ Google Calendar conectado' : g.length ? '  ✗ Google a medias: faltan variables GOOGLE_* (corre npm run google:conectar)' : '  · Google Calendar no conectado (opcional)');
if (c.llamada.lugar === 'google-meet' && g.length !== 3) console.log("  ✗ llamada.lugar = 'google-meet' necesita Google conectado");
