// Lee agenda.config.ts, le pone los valores por omisión y lo revisa. Si algo está mal escrito, el error dice en
// español qué y dónde, para que tu Claude Code (o tú) lo arregle sin adivinar.
import crudo from '@marca';
import type { ConfigAgenda } from './tipos-config';
import { DIAS } from './dias';

export type Config = ConfigAgenda & {
  llamada: Required<ConfigAgenda['llamada']>;
  horario: ConfigAgenda['horario'] & { diasAdelante: number; diasBloqueados: string[] };
  cupo: { tope: number | null; tandas: { dias: number; umbral: number }; cierre: string };
  google: Required<NonNullable<ConfigAgenda['google']>>;
  fuentes: Required<NonNullable<ConfigAgenda['fuentes']>>;
};

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const FECHA = /^\d{4}-\d{2}-\d{2}$/;

/** Devuelve la lista de problemas (vacía si todo está bien). */
export function problemasDeConfig(c: ConfigAgenda): string[] {
  const p: string[] = [];
  const req = (v: unknown, donde: string) => {
    if (typeof v !== 'string' || !v.trim()) p.push(`Falta el texto de ${donde}.`);
  };
  req(c.marca?.nombre, 'marca.nombre');
  req(c.anfitrion?.nombre, 'anfitrion.nombre');
  req(c.portada?.titular, 'portada.titular');
  for (const k of ['fondo', 'superficie', 'texto', 'textoSuave', 'borde', 'acento', 'textoSobreAcento', 'destacado'] as const) {
    req(c.colores?.[k], `colores.${k}`);
  }
  if (!Array.isArray(c.filtro) || c.filtro.length < 1 || c.filtro.length > 3) p.push('filtro debe tener entre 1 y 3 preguntas (lo normal son 2).');
  const ids = new Set<string>();
  for (const [i, f] of (c.filtro ?? []).entries()) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(f.id ?? '')) p.push(`filtro[${i}].id debe ir en minúsculas, sin espacios (por ejemplo «ya_vende»).`);
    if (ids.has(f.id)) p.push(`El id «${f.id}» está repetido.`);
    ids.add(f.id);
    req(f.pregunta, `filtro[${i}].pregunta`);
    if (typeof f.bloquea !== 'boolean') p.push(`filtro[${i}].bloquea debe ser true o false.`);
  }
  if (!Array.isArray(c.miniAplicacion) || c.miniAplicacion.length > 5) p.push('miniAplicacion debe tener de 0 a 5 preguntas.');
  for (const [i, m] of (c.miniAplicacion ?? []).entries()) {
    if (!/^[a-z][a-z0-9_]{0,39}$/.test(m.id ?? '')) p.push(`miniAplicacion[${i}].id debe ir en minúsculas, sin espacios.`);
    if (ids.has(m.id)) p.push(`El id «${m.id}» está repetido.`);
    ids.add(m.id);
    if (!['escala', 'sino', 'texto'].includes(m.tipo)) p.push(`miniAplicacion[${i}].tipo debe ser 'escala', 'sino' o 'texto'.`);
    req(m.pregunta, `miniAplicacion[${i}].pregunta`);
  }
  const min = c.llamada?.minutos;
  if (!Number.isInteger(min) || min < 10 || min > 240) p.push('llamada.minutos debe ser un número entero entre 10 y 240.');
  if (!c.llamada?.lugar || !/^https?:\/\//.test(c.llamada.lugar) && c.llamada.lugar !== 'google-meet') {
    p.push("llamada.lugar debe ser un enlace (https://…) o 'google-meet'.");
  }
  try {
    new Intl.DateTimeFormat('es', { timeZone: c.horario?.zona }).format(0);
  } catch {
    p.push(`horario.zona «${c.horario?.zona}» no es una zona horaria válida (por ejemplo «America/Mexico_City»).`);
  }
  if (!Array.isArray(c.horario?.bloques)) p.push('horario.bloques debe ser una lista.');
  for (const [i, b] of (c.horario?.bloques ?? []).entries()) {
    if (!Array.isArray(b.dias) || !b.dias.length || b.dias.some((d) => !DIAS.includes(d))) {
      p.push(`horario.bloques[${i}].dias: usa lun mar mie jue vie sab dom.`);
    }
    if (!HORA.test(b.desde) || !HORA.test(b.hasta)) p.push(`horario.bloques[${i}]: las horas van como «09:30» (24 h).`);
    else if (b.hasta <= b.desde) p.push(`horario.bloques[${i}]: «hasta» debe ser después de «desde».`);
  }
  for (const d of c.horario?.diasBloqueados ?? []) if (!FECHA.test(d)) p.push(`horario.diasBloqueados: «${d}» debe ir como AAAA-MM-DD.`);
  const f = c.horario?.fechas;
  if (f && (!FECHA.test(f.desde) || !FECHA.test(f.hasta) || f.hasta < f.desde)) p.push('horario.fechas: «desde» y «hasta» van como AAAA-MM-DD y en orden.');
  if (c.cupo?.tope !== null && (!Number.isInteger(c.cupo?.tope) || (c.cupo?.tope ?? 0) < 1)) p.push('cupo.tope debe ser un número entero mayor que 0, o null.');
  if (c.cupo?.cierre && !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(c.cupo.cierre)) p.push('cupo.cierre va como AAAA-MM-DDTHH:MM (o vacío).');
  if (!Array.isArray(c.recordatorios) || c.recordatorios.some((h) => !(h > 0 && h <= 168))) p.push('recordatorios: horas entre 0 y 168, por ejemplo [24, 1].');
  if (!Number.isInteger(c.reagendar?.cambiosMaximos) || c.reagendar.cambiosMaximos < 0) p.push('reagendar.cambiosMaximos debe ser un entero (0 = no puede cambiar sola).');
  return p;
}

export function normalizar(c: ConfigAgenda): Config {
  return {
    ...c,
    llamada: {
      aireEntreLlamadas: 0,
      margenParaAgendar: 60,
      videoPrevio: '',
      ...c.llamada,
    },
    horario: { diasAdelante: 14, diasBloqueados: [], ...c.horario },
    cupo: { tope: c.cupo?.tope ?? null, tandas: c.cupo?.tandas ?? { dias: 0, umbral: 0 }, cierre: c.cupo?.cierre ?? '' },
    google: { tituloVentana: '📞 Llamadas', aire: 15, tituloEvento: '📞 Llamada · {nombre}', ...c.google },
    fuentes: {
      titulos: "Georgia, 'Times New Roman', serif",
      texto: "system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif",
      googleFonts: [],
      ...c.fuentes,
    },
    recordatorios: [...new Set(c.recordatorios)].sort((a, b) => b - a),
  } as Config;
}

const problemas = problemasDeConfig(crudo);
if (problemas.length) {
  throw new Error(`agenda.config.ts tiene ${problemas.length} problema(s):\n- ${problemas.join('\n- ')}`);
}

export const config: Config = normalizar(crudo);
