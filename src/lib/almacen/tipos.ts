import type { Lead, Respuestas } from '../aplicacion';
import type { Quien } from '../reglas';

export type Reserva = {
  id: string;
  creada: string;
  actualizada: string;
  nombre: string;
  correo: string;
  whatsapp: string;
  filtro: Record<string, boolean>;
  mini: Respuestas;
  zonaVisitante: string | null;
  inicio: string;
  fin: string;
  estado: 'agendada' | 'cancelada';
  cambiosPersona: number;
  movimientos: number;
  horarioAnterior: string | null;
  cambioPor: Quien | null;
  /** «24h» → cuándo salió ese recordatorio. */
  recordatorios: Record<string, string>;
  googleEventoId: string | null;
  /** Enlace de la sala de esta llamada (Meet propio o el fijo de la config). */
  sala: string | null;
  /** Lo que falta hacer en Google Calendar si falló al momento (se reintenta en cada vuelta del reloj). */
  eventoPendiente: null | 'crear' | 'mover' | 'cancelar';
  asistencia: null | 'presente' | 'no-show';
};

/** Operaciones dentro de un candado: todo lo que pasa en una `tx` ocurre de una en una. */
export interface Tx {
  reservas(desde?: Date): Promise<Reserva[]>;
  reserva(id: string): Promise<Reserva | null>;
  guardar(r: Reserva): Promise<void>;
  lead(whatsapp: string): Promise<Lead | null>;
  guardarLead(l: Lead): Promise<void>;
  leads(): Promise<Lead[]>;
}

export interface Almacen {
  nombre: 'archivo' | 'postgres';
  /** Con candado (escrituras). */
  tx<T>(fn: (t: Tx) => Promise<T>): Promise<T>;
  /** Sin candado (lecturas de página). */
  leer<T>(fn: (t: Tx) => Promise<T>): Promise<T>;
}
