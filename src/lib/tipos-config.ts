// Forma del archivo de marca (agenda.config.ts). Solo tipos: la revisión y los valores por omisión viven en config.ts.

export type Dia = 'lun' | 'mar' | 'mie' | 'jue' | 'vie' | 'sab' | 'dom';

export type PreguntaFiltro = { id: string; pregunta: string; ayuda?: string; bloquea: boolean };

export type PreguntaMini =
  | { id: string; tipo: 'escala'; pregunta: string; ayuda?: string; extremos?: [string, string] }
  | { id: string; tipo: 'sino'; pregunta: string; ayuda?: string; si?: string; no?: string }
  | { id: string; tipo: 'texto'; pregunta: string; ayuda?: string };

export type Bloque = { dias: Dia[]; desde: string; hasta: string };

export type ConfigAgenda = {
  marca: { nombre: string; logo?: string; tituloPestana?: string };
  anfitrion: { nombre: string; foto?: string };
  colores: {
    fondo: string;
    superficie: string;
    texto: string;
    textoSuave: string;
    borde: string;
    acento: string;
    textoSobreAcento: string;
    destacado: string;
  };
  fuentes?: { titulos?: string; texto?: string; googleFonts?: string[] };
  portada: {
    ceja?: string;
    titular: string;
    titularDestacado?: string;
    bajada?: string;
    cifras?: { valor: string; unidad?: string; etiqueta: string }[];
    esParaTi?: string[];
  };
  filtro: PreguntaFiltro[];
  noCalifica: { titulo: string; texto: string; boton?: { etiqueta: string; enlace: string } };
  miniAplicacion: PreguntaMini[];
  llamada: { minutos: number; aireEntreLlamadas?: number; margenParaAgendar?: number; lugar: string; videoPrevio?: string };
  horario: {
    zona: string;
    diasAdelante?: number;
    fechas?: { desde: string; hasta: string };
    bloques: Bloque[];
    diasBloqueados?: string[];
  };
  cupo: { tope: number | null; tandas?: { dias: number; umbral: number }; cierre?: string };
  reagendar: { cambiosMaximos: number; horasAntes: number };
  recordatorios: number[];
  whatsapp: { confirmacion: string; seguimiento: string };
  google?: { tituloVentana?: string; aire?: number; tituloEvento?: string };
};
