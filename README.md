# Agenda

La página donde tus prospectos **aplican y agendan una llamada contigo**, con tu marca.

Es la misma agenda con la que se llenaron las llamadas del programa fundador de [arbrain.ai](https://arbrain.ai), separada para que cualquiera la use con su propio negocio. Es de código abierto (Apache-2.0): es tuya, sin pagar mensualidad por cada llamada.

![La portada con la marca de ejemplo «Consultoría Ejemplo»](docs/capturas/portada.png)

## Qué hace

- **Filtra antes de agendar.** Dos preguntas de sí o no («¿ya vendes?», «¿puedes invertir este mes?»). Tú decides cuál deja pasar y cuál no. Quien no califica ve un mensaje amable, no un portazo.
- **Te dice quién es antes de la llamada.** Hasta cinco preguntas más (una escala del 1 al 10, un sí o no, una respuesta libre). Las ves en tu panel y en el correo que te llega con cada reserva.
- **Pide el WhatsApp primero.** Si alguien empieza y no termina, queda en tu panel con el paso donde se quedó y un mensaje de seguimiento listo para mandar.
- **Ofrece tus horarios por bloques.** Pones tus bloques (por ejemplo «lunes a jueves de 10:00 a 13:00») y salen las llamadas seguidas, de la duración que digas. Quien vive en otro país ve los horarios en su propia hora.
- **Un contador de urgencia que es real.** «Quedan 12 de 20 llamadas», en vivo. Nunca es inventado: baja cuando alguien agenda y sube si alguien cancela. Puedes mostrar los horarios por tandas (los primeros días, y se abren más cuando se llenan) y poner una fecha de cierre con cuenta regresiva.
- **Reagendar y cancelar sin escribirte.** Cada persona recibe un enlace propio para cambiar su hora (las veces que tú digas) o cancelar. Tú mueves cualquier llamada desde tu panel.
- **Recordatorios por correo.** Confirmación con el evento para su calendario, y recordatorios (por omisión, un día antes y una hora antes).
- **Tu Google Calendar, si quieres.** Si lo conectas, tus eventos ocupados bloquean horarios, cada llamada aparece en tu calendario con invitación y, si quieres, con su propio Google Meet.

## Instalarla con tu Claude Code

No necesitas saber programar. Abre **Claude Code** (en la terminal o en la pestaña Code de la app de Claude), pega este prompt y dale Enter:

```text
Instala mi agenda siguiendo https://github.com/arbrain-ai/agenda#readme. Hazme las preguntas de mi marca (nombre, colores, logo, mis dos preguntas de filtro, mis horarios y mi zona horaria), déjala corriendo en mi computadora con una reserva de prueba y luego ayúdame a publicarla.
```

Tu Claude descarga el proyecto, te pregunta lo de tu marca, la deja funcionando en tu computadora y te ayuda a publicarla. Solo te va a pedir que aceptes permisos o que entres a alguna cuenta (por ejemplo Vercel o Supabase) cuando toque publicarla.

## Ponerle tu marca

Todo lo tuyo vive en **un solo archivo: `agenda.config.ts`**. Ahí están, con comentarios en español:

| Qué | Dónde en el archivo |
|---|---|
| Nombre de tu negocio y tu logo | `marca` (el logo va en la carpeta `public/marca/`) |
| Quién atiende las llamadas | `anfitrion` |
| Colores | `colores` (fondo, botones, el color del contador…) |
| Tipografías | `fuentes` |
| Titular, texto, cifras y «Es para ti si…» | `portada` |
| Las preguntas del filtro | `filtro` (con `bloquea: true` o `false`) |
| El mensaje para quien no califica | `noCalifica` |
| Las preguntas sobre la persona | `miniAplicacion` |
| Duración de la llamada y enlace de la sala | `llamada` |
| Tus horarios y tu zona horaria | `horario` |
| El contador, las tandas y el cierre | `cupo` |
| Cuántas veces pueden cambiar su hora | `reagendar` |
| Cuándo salen los recordatorios | `recordatorios` |
| El mensaje de WhatsApp que te deja listo el panel | `whatsapp` |

La forma más fácil: dile a tu Claude Code «cambia mis colores a azul marino y dorado» o «mis horarios son martes y jueves de 4 a 7 de la tarde». Después de cualquier cambio corre `npm run revisar`: te dice en español si algo quedó mal escrito y te enseña tus próximos horarios.

Lo que **no** va en ese archivo son las contraseñas y llaves: esas van en `.env` (copia `.env.example`). Ese archivo nunca se sube a GitHub.

## Probarla en tu computadora

```bash
npm install
cp .env.example .env      # pon una ADMIN_CLAVE para entrar a tu panel
npm run dev
```

Abre <http://localhost:3000>. Sin llenar nada más ya funciona: las reservas se guardan en `.datos/agenda.json` y los correos, en vez de mandarse, quedan en `.datos/buzon/` para que los abras y veas cómo se ven. Tu panel está en <http://localhost:3000/admin>.

## Publicarla

Tienes dos caminos. Tu Claude Code te puede llevar por cualquiera de los dos.

### Opción A · Vercel + Supabase (gratis para empezar)

1. Crea un proyecto en [Supabase](https://supabase.com). En **Connect** copia la cadena de conexión del **Transaction pooler** (puerto 6543). Esa es tu `DATABASE_URL`. Las tablas se crean solas la primera vez.
2. Sube tu copia a un repositorio tuyo de GitHub e impórtalo en [Vercel](https://vercel.com).
3. En Vercel → Settings → Environment Variables pon: `DATABASE_URL`, `AGENDA_SECRETO` (genera uno con `openssl rand -hex 32`), `ADMIN_CLAVE`, `AVISOS_A`, `URL_PUBLICA` (tu dirección, por ejemplo `https://agenda.tudominio.com`), `SMTP_URL` y `CORREO_REMITENTE` (ver «Correos»), y `CRON_SECRET`.
4. **Recordatorios:** Vercel no tiene un proceso siempre prendido. En tu repo de GitHub → Settings → Secrets and variables → Actions crea `AGENDA_URL` (tu dirección) y `CRON_SECRET` (el mismo de Vercel). El archivo `.github/workflows/recordatorios.yml` ya llama a tu agenda cada 10 minutos.

### Opción B · Railway, Render o tu propio servidor

Un solo servicio con `npm run build` y `npm start`. Si le das un disco (volumen) montado en `.datos`, ni siquiera necesitas base de datos. Los recordatorios corren solos dentro de la app cada 5 minutos.

### Correos

Sin `SMTP_URL` los correos no salen (se guardan en `.datos/buzon`). Para mandarlos de verdad:

- **Gmail:** activa la verificación en dos pasos, crea una [contraseña de aplicación](https://myaccount.google.com/apppasswords) y usa `smtps://tucorreo%40gmail.com:LA_CONTRASENA@smtp.gmail.com:465`.
- **Resend, Brevo u otro:** usa la dirección SMTP que te dan, por ejemplo `smtps://resend:TU_LLAVE@smtp.resend.com:465`.

### Google Calendar (opcional)

Corre `npm run google:conectar` y sigue los pasos que trae al inicio del archivo `scripts/google-conectar.mjs` (crear el permiso en Google Cloud toma unos 5 minutos, una sola vez). Te da tres líneas para tu `.env`. Desde ahí:

- tus eventos ocupados bloquean horarios (con 15 minutos de aire);
- si creas en tu calendario un evento que empiece con **«📞 Llamadas»**, ese rato se abre para llamadas y tus ventanas del calendario reemplazan a los bloques del archivo. Así abres más horarios sin tocar código;
- cada reserva crea su evento con invitación; si en `llamada.lugar` pones `'google-meet'`, cada llamada lleva su propio Meet. Mover o cancelar actualiza el mismo evento.

## Preguntas frecuentes

**¿El contador puede ser falso para presionar?** No, y es a propósito. El número es lo que de verdad queda. La urgencia honesta funciona mejor y no te quema la reputación.

**¿Cobra por cada llamada?** No. Solo pagas tu hosting si pasas de los planes gratuitos.

**¿Puedo tener varias agendas (por ejemplo, ventas y seguimiento)?** Hoy, una por instalación. Puedes instalar dos copias.

**¿Dónde quedan los datos de mis prospectos?** En tu base o en tu servidor. Este proyecto no manda nada a nadie más.

## Para quien programa

Next.js 16, React 19 y TypeScript. Sin base de datos obligatoria: archivo JSON con escritura atómica, o Postgres (`DATABASE_URL`) con transacción, candado e índice único para que dos personas nunca tomen la misma hora. Google Calendar por su API REST, sin SDK.

```bash
npm test          # pruebas de reglas y del servidor (Google simulado)
npm run typecheck
npm run e2e       # recorrido completo en un navegador real (ver tests/e2e/recorrido.ts)
```

Para correr las pruebas también contra Postgres: `AGENDA_PG_PRUEBA=postgres://… npm test` (usa una base desechable: borra sus tablas).

## Licencia

[Apache-2.0](LICENSE). Puedes usarla, cambiarla y venderla con tu marca. Mantén el aviso de [NOTICE](NOTICE).
