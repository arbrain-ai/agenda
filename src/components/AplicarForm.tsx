// La tarjeta de /aplicar, una pregunta a la vez: inicio → WhatsApp → filtro → tus datos → mini-aplicación → hora.
// El WhatsApp va primero: es el canal del seguimiento (quien no termina queda en /admin con su paso).
// Todos los campos viven en un solo <form> (los pasos ocultos siguen montados) para que el servidor reciba todo.
// El filtro y cada campo se vuelven a revisar en el servidor: aquí solo se guía.
'use client';

import { useActionState, useEffect, useMemo, useRef, useState } from 'react';
import { enviarAplicacion, guardarLead, type EstadoEnvio } from '@/app/aplicar/acciones';
import { califica, normalizarWhatsapp, pasosDe, RE_CORREO } from '@/lib/aplicacion';
import type { PreguntaFiltro, PreguntaMini } from '@/lib/tipos-config';
import { diaCorto, etiquetaHora } from '@/lib/tiempo';
import { Cupo } from './Cupo';
import { SelectorHoras, useZonaVisitante, type HuecoVista } from './SelectorHoras';

export type PropsAplicar = {
  huecos: HuecoVista[];
  quedan: number;
  tope: number;
  masPorAbrir: boolean;
  rango: string | null;
  cierre: string | null;
  filtro: PreguntaFiltro[];
  mini: PreguntaMini[];
  minutos: number;
  anfitrion: string;
  zona: string;
  noCalifica: { titulo: string; texto: string; boton?: { etiqueta: string; enlace: string } };
};

type SiNo = 'si' | 'no' | null;

const ERRORES: Record<string, string> = {
  'whatsapp-invalido': 'Escribe tu WhatsApp con código de país, por ejemplo +52 55 1234 5678.',
  'falta-filtro': 'Responde esta pregunta para seguir.',
  'no-califica': 'Por ahora no podemos agendar tu llamada.',
  'falta-nombre': 'Escribe tu nombre.',
  'correo-invalido': 'Revisa tu correo.',
  'falta-respuesta': 'Responde esta pregunta para seguir.',
  'falta-hueco': 'Elige un horario para tu llamada.',
  'hueco-tomado': 'Alguien acaba de tomar ese horario. Elige otro.',
  'agenda-llena': 'Ya no quedan horarios libres.',
  cerrada: 'Las aplicaciones ya cerraron.',
  'error-calendario': 'No pudimos leer la agenda en este momento. Intenta de nuevo en unos minutos.',
  'no-guardada': 'No pudimos guardar tu aplicación. Intenta de nuevo en un momento.',
};

const AVANCE_MS = 300;

function Flecha() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}

function Opciones({ name, value, onChange, si = 'Sí', no = 'No', etiqueta }: { name: string; value: SiNo; onChange: (v: 'si' | 'no') => void; si?: string; no?: string; etiqueta: string }) {
  return (
    <div className="opciones" role="radiogroup" aria-label={etiqueta}>
      {(['si', 'no'] as const).map((v) => (
        <label key={v} className="opcion">
          <input type="radio" name={name} value={v} checked={value === v} onChange={() => onChange(v)} />
          <span className="caja" aria-hidden />
          {v === 'si' ? si : no}
        </label>
      ))}
    </div>
  );
}

export function AplicarForm(p: PropsAplicar) {
  const [estado, accion, enviando] = useActionState<EstadoEnvio, FormData>(enviarAplicacion, {});
  const pasos = useMemo(() => pasosDe(p.filtro, p.mini), [p.filtro, p.mini]);
  const [paso, setPaso] = useState<string>('inicio');
  const [whatsapp, setWhatsapp] = useState('');
  const [filtro, setFiltro] = useState<Record<string, SiNo>>({});
  const [datos, setDatos] = useState({ nombre: '', correo: '' });
  const [mini, setMini] = useState<Record<string, string>>({});
  const [asoma, setAsoma] = useState<number | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [perdido, setPerdido] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);
  const [ctaFuera, setCtaFuera] = useState(false);
  const tituloRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLButtonElement>(null);
  const zona = useZonaVisitante(p.zona, p.huecos);

  // Un error del servidor regresa al paso que lo arregla; el hueco perdido se apaga.
  useEffect(() => {
    if (!estado.error) return;
    setPaso(estado.paso ?? 'hora');
    setAviso(ERRORES[estado.error] ?? ERRORES['no-guardada']);
    if (estado.error === 'hueco-tomado') { setPerdido(inicio); setInicio(null); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [estado.n]);

  useEffect(() => { if (paso !== 'inicio') tituloRef.current?.focus({ preventScroll: true }); }, [paso]);

  // Lead parcial: cada paso al que llega, desde que dejó su WhatsApp (también el «no» del filtro).
  useEffect(() => {
    if (paso === 'inicio' || paso === 'whatsapp' || !normalizarWhatsapp(whatsapp)) return;
    void guardarLead({ whatsapp, paso, filtro, nombre: datos.nombre, correo: datos.correo });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [paso]);

  // Teléfono: mientras el botón de empezar no se ve, una barra fija lo ofrece.
  useEffect(() => {
    const el = ctaRef.current;
    if (paso !== 'inicio' || !el || typeof IntersectionObserver === 'undefined') { setCtaFuera(false); return; }
    const io = new IntersectionObserver(([e]) => setCtaFuera(!e.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  }, [paso]);

  const n = pasos.indexOf(paso);
  const ir = (x: string) => { setAviso(null); setPaso(x); };
  const siguiente = () => ir(pasos[Math.min(n + 1, pasos.length - 1)]);
  const atras = () => ir(n <= 0 ? 'inicio' : pasos[n - 1]);
  const despues = (fn: () => void) => window.setTimeout(fn, AVANCE_MS);

  function responderFiltro(f: PreguntaFiltro, v: 'si' | 'no') {
    const nuevo = { ...filtro, [f.id]: v };
    setFiltro(nuevo);
    despues(() => {
      if (f.bloquea && v === 'no') return ir('no');
      const i = pasos.indexOf(`f:${f.id}`);
      const sig = pasos[i + 1];
      if (sig === 'datos' && !califica(p.filtro, Object.fromEntries(Object.entries(nuevo).map(([k, x]) => [k, x === 'si'])))) return ir('no');
      ir(sig);
    });
  }

  function seguirWhatsapp() {
    if (!normalizarWhatsapp(whatsapp)) return setAviso(ERRORES['whatsapp-invalido']);
    siguiente();
  }
  function seguirDatos() {
    if (!datos.nombre.trim()) return setAviso(ERRORES['falta-nombre']);
    if (!RE_CORREO.test(datos.correo.trim())) return setAviso(ERRORES['correo-invalido']);
    siguiente();
  }

  const wa = normalizarWhatsapp(whatsapp);
  const tz = zona ?? p.zona;
  const elegido = p.huecos.find((h) => h.inicio === inicio) ?? null;

  if (paso === 'no') {
    return (
      <div className="tarjeta" data-paso="no">
        <p className="ceja">Gracias por tu <b>honestidad</b></p>
        <div ref={tituloRef} tabIndex={-1}><h2>{p.noCalifica.titulo}</h2></div>
        <p className="ayuda">{p.noCalifica.texto}</p>
        <div className="acciones">
          {p.noCalifica.boton && <a className="primario" href={p.noCalifica.boton.enlace}>{p.noCalifica.boton.etiqueta} <Flecha /></a>}
          <button type="button" className="enlace" onClick={() => { const bloq = p.filtro.filter((f) => f.bloquea).pop(); ir(bloq ? `f:${bloq.id}` : pasos[0]); }}>
            Me equivoqué en mi respuesta
          </button>
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="tarjeta" data-paso={paso}>
        <form action={accion} noValidate>
          {p.filtro.map((f) => <input key={f.id} type="hidden" name={`f_${f.id}`} value={filtro[f.id] ?? ''} />)}
          <input type="hidden" name="zona" value={zona ?? ''} />

          {paso !== 'inicio' && (
            <>
              <div className="progreso">
                <button type="button" className="atras" onClick={atras}>← Atrás</button>
                <span className="paso-num" aria-live="polite">Pregunta {n + 1} de {pasos.length}</span>
              </div>
              <div className="riel" aria-hidden><span style={{ width: `${((n + 1) / pasos.length) * 100}%` }} /></div>
            </>
          )}

          <div ref={tituloRef} tabIndex={-1} style={{ outline: 'none' }}>
            {/* Inicio */}
            <section hidden={paso !== 'inicio'}>
              <p className="ceja">Aplicaciones <b>{p.quedan > 0 ? 'abiertas' : 'llenas'}</b></p>
              <h2>Aplica y agenda tu llamada con {p.anfitrion}.</h2>
              <Cupo quedan={p.quedan} tope={p.tope} minutos={p.minutos} anfitrion={p.anfitrion} rango={p.rango} cierre={p.cierre} leer={paso === 'inicio'} />
              <ol className="pasos-como">
                <li><i>1</i><div><b>{p.filtro.length === 1 ? 'Una pregunta' : `${p.filtro.length === 2 ? 'Dos' : 'Tres'} preguntas`}</b><span>Para saber si es tu momento.</span></div><small>1 min</small></li>
                {p.mini.length > 0 && <li><i>2</i><div><b>{p.mini.length === 1 ? 'Una sobre ti' : `${['', '', 'Dos', 'Tres', 'Cuatro', 'Cinco'][p.mini.length]} sobre ti`}</b><span>Lo que quieres lograr y lo que te frena.</span></div><small>2 min</small></li>}
                <li><i>{p.mini.length > 0 ? 3 : 2}</i><div><b>Eliges tu hora</b><span>Una llamada de {p.minutos} minutos, uno a uno.</span></div><small>{p.minutos} min</small></li>
              </ol>
              <div className="acciones">
                <button ref={ctaRef} type="button" className="primario" disabled={p.quedan <= 0} onClick={() => ir(pasos[0])}>Empezar mi aplicación <Flecha /></button>
              </div>
            </section>

            {/* WhatsApp */}
            <section hidden={paso !== 'whatsapp'}>
              <h3 className="pregunta"><label htmlFor="ap-wa">¿Cuál es tu WhatsApp?</label></h3>
              <p className="ayuda">Con código de país. Lo usamos solo para darte seguimiento sobre tu aplicación.</p>
              <div className="campo">
                <input id="ap-wa" name="whatsapp" type="tel" inputMode="tel" autoComplete="tel" placeholder="+52 55 1234 5678" value={whatsapp}
                  onChange={(e) => setWhatsapp(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); seguirWhatsapp(); } }} />
              </div>
              <p className="lectura" data-valido={wa ? '' : undefined} aria-live="polite">
                {wa ? `Lo leo como ${wa}` : whatsapp.replace(/\D/g, '').length >= 8 && !whatsapp.trim().startsWith('+') ? 'Empieza con + y tu código de país (+52, +57, +34…).' : ' '}
              </p>
              <div className="acciones"><button type="button" className="primario" onClick={seguirWhatsapp}>Continuar <Flecha /></button></div>
            </section>

            {/* Filtro */}
            {p.filtro.map((f) => (
              <fieldset key={f.id} hidden={paso !== `f:${f.id}`}>
                <legend className="pregunta">{f.pregunta}</legend>
                {f.ayuda && <p className="ayuda">{f.ayuda}</p>}
                <Opciones name={`r_${f.id}`} value={filtro[f.id] ?? null} etiqueta={f.pregunta} onChange={(v) => responderFiltro(f, v)} />
              </fieldset>
            ))}

            {/* Datos */}
            <section hidden={paso !== 'datos'}>
              <h3 className="pregunta">¿A dónde te mandamos la invitación?</h3>
              <p className="ayuda">Solo para tu llamada y sus recordatorios.</p>
              <div className="campo">
                <label htmlFor="ap-nombre">Tu nombre</label>
                <input id="ap-nombre" name="nombre" autoComplete="name" value={datos.nombre} onChange={(e) => setDatos({ ...datos, nombre: e.target.value })} />
              </div>
              <div className="campo">
                <label htmlFor="ap-correo">Correo</label>
                <input id="ap-correo" name="correo" type="email" inputMode="email" autoComplete="email" placeholder="tu@correo.com" value={datos.correo}
                  onChange={(e) => setDatos({ ...datos, correo: e.target.value })} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); seguirDatos(); } }} />
              </div>
              <div className="acciones"><button type="button" className="primario" onClick={seguirDatos}>Continuar <Flecha /></button></div>
            </section>

            {/* Mini-aplicación */}
            {p.mini.map((m) => (
              <fieldset key={m.id} hidden={paso !== `m:${m.id}`}>
                <legend className="pregunta">{m.tipo === 'texto' ? <label htmlFor={`ap-${m.id}`}>{m.pregunta}</label> : m.pregunta}</legend>
                {m.ayuda && <p className="ayuda">{m.ayuda}</p>}
                {m.tipo === 'escala' && (
                  <>
                    <div className="escala" role="radiogroup" aria-label={m.pregunta} onMouseLeave={() => setAsoma(null)}>
                      {Array.from({ length: 10 }, (_, i) => i + 1).map((v) => {
                        const nivel = asoma ?? Number(mini[m.id] ?? 0);
                        return (
                          <label key={v} data-on={v <= nivel || undefined} data-tope={v === nivel || undefined} onMouseEnter={() => setAsoma(v)}>
                            <input type="radio" name={`m_${m.id}`} value={v} checked={mini[m.id] === String(v)} aria-label={`${v} de 10`}
                              onChange={() => { setMini({ ...mini, [m.id]: String(v) }); setAsoma(null); despues(siguiente); }} />
                            <span className="barra" style={{ height: `${30 + (70 * (v - 1)) / 9}%` }} />
                            <b>{v}</b>
                          </label>
                        );
                      })}
                    </div>
                    {m.extremos && <div className="extremos" aria-hidden><span>{m.extremos[0]}</span><span>{m.extremos[1]}</span></div>}
                  </>
                )}
                {m.tipo === 'sino' && (
                  <Opciones name={`m_${m.id}`} value={(mini[m.id] as SiNo) ?? null} si={m.si} no={m.no} etiqueta={m.pregunta}
                    onChange={(v) => { setMini({ ...mini, [m.id]: v }); despues(siguiente); }} />
                )}
                {m.tipo === 'texto' && (
                  <>
                    <div className="campo"><textarea id={`ap-${m.id}`} name={`m_${m.id}`} rows={4} placeholder="Una frase basta." value={mini[m.id] ?? ''} onChange={(e) => setMini({ ...mini, [m.id]: e.target.value })} /></div>
                    <div className="acciones"><button type="button" className="primario" onClick={() => ((mini[m.id] ?? '').trim() ? siguiente() : setAviso(ERRORES['falta-respuesta']))}>Continuar <Flecha /></button></div>
                  </>
                )}
              </fieldset>
            ))}

            {/* Hora */}
            <fieldset hidden={paso !== 'hora'}>
              <legend className="pregunta">Elige tu llamada de {p.minutos} minutos con {p.anfitrion}.</legend>
              {p.huecos.length === 0 ? (
                <p className="ayuda">Ya no quedan horarios libres. Escríbenos y te buscamos un espacio.</p>
              ) : (
                <>
                  <SelectorHoras huecos={p.huecos} value={inicio} onChange={(i) => { setAviso(null); setInicio(i); }} zonaAnfitrion={p.zona} zona={zona} perdido={perdido} />
                  {p.masPorAbrir && <p className="zona-nota">Abrimos más horarios conforme se llenan estos.</p>}
                  <div className="acciones">
                    <button type="submit" className="primario" disabled={enviando || !elegido}>
                      {enviando ? 'Agendando…' : elegido ? `Agendar · ${diaCorto(elegido.inicio, tz)}, ${etiquetaHora(elegido.inicio, tz)}` : 'Elige una hora'}
                      {!enviando && elegido && <Flecha />}
                    </button>
                  </div>
                </>
              )}
            </fieldset>
          </div>

          {aviso && <p className="error" role="alert">{aviso}</p>}
        </form>
      </div>

      {paso === 'inicio' && p.quedan > 0 && (
        <div className="barra-fija" data-visible={ctaFuera || undefined} aria-hidden={!ctaFuera}>
          <span><b>{p.quedan}</b> {p.quedan === 1 ? 'llamada libre' : 'llamadas libres'}</span>
          <button type="button" className="primario" tabIndex={ctaFuera ? 0 : -1} onClick={() => ir(pasos[0])}>Aplicar <Flecha /></button>
        </div>
      )}
    </>
  );
}
