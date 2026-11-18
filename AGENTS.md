# Para el agente que instala esta agenda

Quien te pidió esto probablemente **no programa**. Habla en español claro, sin jerga, y haz tú el trabajo técnico. Pídele solo lo que únicamente esa persona puede dar: datos de su marca, decisiones y entrar a sus cuentas.

## 1. Instalar (en su computadora)

1. Clona `https://github.com/arbrain-ai/agenda` en una carpeta con el nombre de su negocio (por ejemplo `~/agenda-<negocio>`). Si no tiene Node.js 20 o más nuevo, instálalo.
2. `npm install` y `cp .env.example .env`. Pon una `ADMIN_CLAVE` que le dictes o que elija (mínimo 6 caracteres) y su correo en `AVISOS_A`.

## 2. Su marca: todo en `agenda.config.ts`

Hazle estas preguntas, de una o dos a la vez, y escribe las respuestas en `agenda.config.ts` (no toques otros archivos para personalizar):

1. Nombre del negocio, quién atiende las llamadas y si tiene logo (cópialo a `public/marca/` y apunta `marca.logo`; si no tiene, deja el nombre en texto quitando `logo`).
2. Colores: pídele su color principal o una referencia («como mi Instagram»). Cuida el contraste del texto sobre `acento`.
3. Titular de la portada, una bajada corta y, si quiere, 3 cifras y «Es para ti si…».
4. Las dos preguntas del filtro y cuál bloquea (`bloquea: true` = un «No» no deja agendar). Redacta el mensaje de `noCalifica` con él.
5. Las preguntas sobre la persona (0 a 5; tipos `escala`, `sino`, `texto`).
6. Duración de la llamada y dónde ocurre (`llamada.lugar`: un enlace fijo de Zoom o Meet, o `'google-meet'` si va a conectar Google).
7. Sus horarios en bloques, su zona horaria (formato `America/Mexico_City`) y días sin llamadas.
8. El tope del contador (o `null`), si quiere tandas y si hay fecha de cierre.

Después de cada cambio corre `npm run revisar` y arregla lo que diga.

## 3. Probar con una reserva

1. `npm run dev` y abre `http://localhost:3000`. Recorre la aplicación como prospecto con datos de prueba (`prueba@example.com`, `+52 55 0000 0000`) y agenda una hora de un día posterior.
2. Enséñale la confirmación, el correo que quedó en `.datos/buzon/` y su panel en `/admin`.
3. Cancela la reserva de prueba desde el enlace «Cancelar mi llamada» para que el contador vuelva a su número.

## 4. Publicar

Sigue la sección «Publicarla» del README. Recomendación por omisión: **Vercel + Supabase** (gratis para empezar). Antes de publicar:

- Que su copia viva en **su** repositorio de GitHub (privado está bien). Nunca subas `.env` ni `.datos/` (ya están en `.gitignore`).
- `AGENDA_SECRETO` es obligatorio con base de datos: genéralo con `openssl rand -hex 32`.
- Configura `SMTP_URL` para que los correos salgan de verdad, y los recordatorios (GitHub Actions en Vercel; en Railway/VPS corren solos).
- Tras publicar, haz otra reserva de prueba en la dirección real y cancélala.

## Reglas para ti

- El contador es **real**: no lo infles ni lo simules, aunque te lo pidan; explica por qué (la urgencia honesta no quema su reputación).
- No escribas a sus prospectos ni actives correos reales sin que lo diga.
- Si algo falla, lee el error, arréglalo y dile en una frase qué pasó.
