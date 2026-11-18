// ─────────────────────────────────────────────────────────────────────────────────────────────
//  TU MARCA. Este es el único archivo que necesitas editar.
//
//  Aquí van tus textos, colores, logo, las preguntas del filtro, tus horarios y tu zona horaria.
//  Las llaves y contraseñas NO van aquí: van en el archivo .env (ver .env.example).
//
//  Después de cambiar algo, corre `npm run revisar`: te dice en español si algo quedó mal escrito.
//  El ejemplo de abajo es una marca inventada, «Consultoría Ejemplo». Reemplázala por la tuya.
// ─────────────────────────────────────────────────────────────────────────────────────────────
import type { ConfigAgenda } from './src/lib/tipos-config';

const config: ConfigAgenda = {
  // ── Quién eres ─────────────────────────────────────────────────────────────────────────────
  marca: {
    nombre: 'Consultoría Ejemplo',
    // Tu logo va en la carpeta public/marca/. SVG o PNG. Se ve a 32 px de alto.
    logo: '/marca/logo.svg',
    // Título de la pestaña del navegador.
    tituloPestana: 'Aplica a tu llamada · Consultoría Ejemplo',
  },

  // La persona que atiende las llamadas (aparece en los textos y en los correos).
  anfitrion: {
    nombre: 'Noa',
    // Foto opcional (public/marca/...). Déjalo vacío si no quieres foto.
    foto: '',
  },

  // ── Colores ────────────────────────────────────────────────────────────────────────────────
  // Cualquier color CSS: #hex, rgb(), hsl(). «acento» es el color de los botones y el contador.
  colores: {
    fondo: '#f6f3ee',
    superficie: '#ffffff',
    texto: '#1d2321',
    textoSuave: '#5c6662',
    borde: '#e3ded5',
    acento: '#0f6b5c',
    textoSobreAcento: '#ffffff',
    destacado: '#c9781e',
  },

  // Tipografías. Por defecto, las del sistema (cero descargas). Si quieres una de Google Fonts, escribe su
  // nombre en googleFonts (por ejemplo 'Fraunces') y úsala en titulos.
  fuentes: {
    titulos: "Georgia, 'Times New Roman', serif",
    texto: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
    googleFonts: [],
  },

  // ── La portada ─────────────────────────────────────────────────────────────────────────────
  portada: {
    ceja: 'Programa de acompañamiento',
    titular: 'Ordena tu negocio en 90 días,',
    titularDestacado: 'con un plan que sí se cumple.',
    bajada:
      'Trabajamos juntos tu oferta, tus números y tu semana. Antes de entrar platicamos 45 minutos para ver si encaja contigo.',
    // Hasta 3 cifras grandes debajo del titular. Déjalo [] si no quieres ninguna.
    cifras: [
      { valor: '90', unidad: 'días', etiqueta: 'de acompañamiento' },
      { valor: '12', unidad: '', etiqueta: 'sesiones en grupo' },
      { valor: '8', unidad: '', etiqueta: 'lugares por grupo' },
    ],
    // «Es para ti si…». Déjalo [] para ocultarlo.
    esParaTi: [
      'Ya vendes algo y quieres que tu negocio deje de depender de tu memoria.',
      'Quieres una semana con foco, no más pendientes.',
      'Puedes invertir este mes y empezar en los próximos 30 días.',
    ],
  },

  // ── El filtro: dos preguntas de sí o no ────────────────────────────────────────────────────
  // «bloquea: true» = si responden «No», no pueden agendar y ven el mensaje de abajo.
  // «bloquea: false» = se pregunta (te llega en la ficha de la llamada) pero deja pasar.
  filtro: [
    {
      id: 'ya_vende',
      pregunta: '¿Ya le vendiste algo a alguien o tienes un negocio que factura?',
      ayuda: 'Cuenta cualquier venta: un servicio, un producto o tu propio negocio. Si todavía no, también puedes aplicar.',
      bloquea: false,
    },
    {
      id: 'puede_invertir',
      pregunta: '¿Tienes 500 USD para invertir este mes?',
      ayuda: 'Es la inversión mínima para entrar al programa.',
      bloquea: true,
    },
  ],
  // Lo que ve quien responde «No» a una pregunta que bloquea. Cálido, sin cerrar la puerta.
  noCalifica: {
    titulo: 'Hoy no es tu momento, y está bien.',
    texto:
      'Este programa pide invertir al menos 500 USD este mes. Cuando puedas dar ese paso, aquí vamos a estar.',
    boton: { etiqueta: 'Ver contenido gratuito', enlace: 'https://example.com' },
  },

  // ── La mini-aplicación (preguntas sobre la persona) ────────────────────────────────────────
  // Tipos: 'escala' (1 a 10), 'sino' (sí o no) y 'texto' (respuesta libre). Puedes poner de 0 a 5.
  miniAplicacion: [
    {
      id: 'prioridad',
      tipo: 'escala',
      pregunta: 'Del 1 al 10, ¿qué tan prioritario es para ti ordenar tu negocio este trimestre?',
      extremos: ['Algún día', 'Lo más importante'],
    },
    {
      id: 'empieza_30_dias',
      tipo: 'sino',
      pregunta: 'Si el programa encaja contigo, ¿empezarías en los próximos 30 días?',
      si: 'Sí, en los próximos 30 días',
      no: 'No, más adelante',
    },
    {
      id: 'miedo',
      tipo: 'texto',
      pregunta: '¿Qué te daría más miedo de dar el paso?',
      ayuda: 'Con honestidad. Lo vemos juntos en la llamada.',
    },
  ],

  // ── La llamada ─────────────────────────────────────────────────────────────────────────────
  llamada: {
    minutos: 45,
    // Minutos de aire entre una llamada y la siguiente dentro de un bloque (0 = seguidas).
    aireEntreLlamadas: 0,
    // Nadie puede agendar con menos de este margen (minutos) antes de la llamada.
    margenParaAgendar: 45,
    // Dónde ocurre la llamada:
    //  - 'google-meet': cada reserva crea su propio Meet (requiere conectar Google, ver README).
    //  - un enlace fijo, por ejemplo 'https://zoom.us/j/...' o tu sala de Meet de siempre.
    lugar: 'https://example.com/tu-sala',
    // Video para ver antes de la llamada (aparece en la confirmación y en los correos). Vacío = no hay.
    videoPrevio: '',
  },

  // ── Horarios ───────────────────────────────────────────────────────────────────────────────
  horario: {
    // Tu zona horaria (lista: https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).
    zona: 'America/Mexico_City',
    // Cuántos días hacia adelante se pueden agendar.
    diasAdelante: 14,
    // Opcional: fechas fijas para un lanzamiento (AAAA-MM-DD). Si las pones, mandan sobre diasAdelante.
    // fechas: { desde: '2026-12-05', hasta: '2026-12-08' },
    // Bloques: dentro de cada bloque salen llamadas seguidas de «minutos». Días: lun mar mie jue vie sab dom.
    bloques: [
      { dias: ['lun', 'mar', 'mie', 'jue'], desde: '10:00', hasta: '13:00' },
      { dias: ['lun', 'mie'], desde: '16:00', hasta: '17:30' },
      { dias: ['sab'], desde: '10:00', hasta: '11:30' },
    ],
    // Días sin llamadas (vacaciones, festivos).
    diasBloqueados: ['2026-12-25', '2027-01-01'],
  },

  // ── Contador de urgencia (siempre real) ────────────────────────────────────────────────────
  cupo: {
    // Tope de llamadas que se pueden agendar en la ventana de fechas. null = sin tope (el contador cuenta huecos).
    tope: 20,
    // Tandas: al principio solo se ven los primeros N días con horarios; cuando ahí quedan ≤ umbral, se abre el
    // siguiente día. El número del contador NO cambia con esto: siempre es lo que de verdad queda.
    tandas: { dias: 2, umbral: 5 },
    // Cierre opcional de aplicaciones (fecha y hora en tu zona, AAAA-MM-DDTHH:MM). Muestra la cuenta regresiva
    // y al llegar la hora el formulario se cierra de verdad. Vacío = sin cierre.
    cierre: '',
  },

  // ── Reagendar ──────────────────────────────────────────────────────────────────────────────
  reagendar: {
    // Cuántas veces puede la persona cambiar su hora por su cuenta (tú puedes moverla siempre desde /admin).
    cambiosMaximos: 2,
    // Hasta cuántas horas antes de la llamada puede cambiarla sola.
    horasAntes: 2,
  },

  // ── Recordatorios por correo ───────────────────────────────────────────────────────────────
  // Horas antes de la llamada. El más lejano solo se manda si agendaron con más anticipación que eso.
  recordatorios: [24, 1],

  // ── WhatsApp ───────────────────────────────────────────────────────────────────────────────
  // El mensaje que te deja listo /admin para mandar desde tu teléfono. Variables: {nombre} {dia} {hora} {zona}
  // {anfitrion} {enlace} (para cambiar la hora) {video}.
  whatsapp: {
    confirmacion:
      '¡Hola {nombre}! Soy {anfitrion}. Ya tengo tu llamada del {dia} a las {hora} ({zona}). Si necesitas cambiar la hora: {enlace}. ¡Nos vemos!',
    seguimiento:
      '¡Hola {nombre}! Soy {anfitrion}. Vi que empezaste tu aplicación y no alcanzaste a elegir hora. ¿Te ayudo a agendar?',
  },

  // ── Google Calendar (opcional) ─────────────────────────────────────────────────────────────
  // Si conectas tu Google (ver README), tu calendario manda: tus eventos ocupados bloquean horarios y los eventos
  // cuyo título empiece con «tituloVentana» abren horarios (y reemplazan a los bloques de arriba).
  google: {
    tituloVentana: '📞 Llamadas',
    // Minutos de aire contra cualquier otro evento tuyo.
    aire: 15,
    // Título del evento que se crea en tu calendario. Variables: {nombre}.
    tituloEvento: '📞 Llamada · {nombre}',
  },
};

export default config;
