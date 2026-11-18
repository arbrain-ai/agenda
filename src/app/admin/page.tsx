// Tu panel: el contador, las llamadas que vienen (con sus respuestas, WhatsApp listo, mover, cancelar y asistencia)
// y quién empezó la aplicación y no terminó (con su paso y un mensaje de seguimiento listo).
import { config } from '@/lib/config';
import { estadoAgenda, urlLlamada } from '@/lib/agenda';
import { deps } from '@/lib/servidor';
import { claveAdmin } from '@/lib/entorno';
import { modoCorreo } from '@/lib/correo';
import { enlaceWhatsapp, pasosDe, primerNombre, rellenar } from '@/lib/aplicacion';
import { etiquetaDia, etiquetaHora, nombreZona } from '@/lib/tiempo';
import { TEXTO_ERROR_CAMBIO, type ErrorCambio } from '@/lib/reglas';
import { Pagina } from '@/components/Pagina';
import { asistenciaAdmin, cancelarAdmin, entrar, esAdmin, moverAdmin, salir } from './acciones';

export const dynamic = 'force-dynamic';
export const metadata = { title: `Panel · ${config.marca.nombre}` };

function etiquetaPaso(paso: string) {
  if (paso === 'agendo') return 'Agendó';
  if (paso === 'no') return 'No calificó';
  if (paso === 'whatsapp') return 'WhatsApp';
  if (paso === 'datos') return 'Nombre y correo';
  if (paso === 'hora') return 'Eligiendo la hora';
  const f = config.filtro.find((x) => `f:${x.id}` === paso);
  if (f) return `Filtro: ${f.pregunta}`;
  const m = config.miniAplicacion.find((x) => `m:${x.id}` === paso);
  return m ? `Sobre ti: ${m.pregunta}` : paso;
}

const valor = (v: unknown) => (v === true ? 'Sí' : v === false ? 'No' : v === undefined || v === null || v === '' ? '—' : String(v));

export default async function Admin({ searchParams }: { searchParams: Promise<{ error?: string; movida?: string; error_mover?: string }> }) {
  const q = await searchParams;
  if (!claveAdmin()) {
    return <Pagina><div className="angosta tarjeta"><h2>Panel cerrado</h2><p className="ayuda">Para abrirlo, define <code>ADMIN_CLAVE</code> (6 caracteres o más) en tu archivo .env y reinicia.</p></div></Pagina>;
  }
  if (!(await esAdmin())) {
    return (
      <Pagina>
        <form action={entrar} className="angosta tarjeta">
          <h2>Tu panel</h2>
          <div className="campo"><label htmlFor="clave">Clave</label><input id="clave" name="clave" type="password" autoComplete="current-password" autoFocus /></div>
          {q.error && <p className="error">Esa no es la clave.</p>}
          <div className="acciones"><button className="primario" type="submit">Entrar</button></div>
        </form>
      </Pagina>
    );
  }

  const d = deps();
  const tz = config.horario.zona;
  const ahora = Date.now();
  const [e, libres, reservas, leads] = await Promise.all([
    estadoAgenda(d),
    estadoAgenda(d, { margenMin: 10, excluir: '__ninguna__' }).then((x) => x.todos),
    d.alm.leer((t) => t.reservas(new Date(ahora - 7 * 86_400_000))),
    d.alm.leer((t) => t.leads()),
  ]);
  const proximas = reservas.filter((r) => r.estado === 'agendada' && Date.parse(r.fin) >= ahora);
  const pasadas = reservas.filter((r) => r.estado === 'agendada' && Date.parse(r.fin) < ahora).reverse();
  const sinAgendar = leads.filter((l) => !l.reservaId);
  const pasos = pasosDe(config.filtro, config.miniAplicacion);

  return (
    <Pagina derecha={<form action={salir}><button className="enlace" type="submit">Salir</button></form>}>
      <div className="panel">
        <p className="ceja">Panel · {nombreZona(tz)}</p>
        <div className="tablero">
          <div><strong>{e.quedan}<small style={{ fontSize: 16, color: 'var(--suave)' }}> de {e.tope}</small></strong><span>llamadas libres (lo que ve la gente)</span></div>
          <div><strong>{proximas.length}</strong><span>llamadas por venir</span></div>
          <div><strong>{sinAgendar.length}</strong><span>empezaron y no agendaron</span></div>
          <div><strong style={{ fontSize: 16 }}>{d.alm.nombre === 'postgres' ? 'Postgres' : 'Archivo local'}</strong><span>Correos: {modoCorreo() === 'smtp' ? 'SMTP' : 'buzón local (.datos/buzon)'} · Google: {d.google ? 'conectado' : 'no'}</span></div>
        </div>
        {q.error_mover && <p className="error">{TEXTO_ERROR_CAMBIO[q.error_mover as ErrorCambio] ?? 'No se pudo mover.'}</p>}

        <h2 style={{ fontSize: 22 }}>Llamadas por venir</h2>
        {proximas.length === 0 ? <p className="ayuda">Todavía no hay llamadas agendadas.</p> : (
          <table>
            <thead><tr><th>Cuándo</th><th>Quién</th><th>Respuestas</th><th>Acciones</th></tr></thead>
            <tbody>
              {proximas.map((r) => {
                const enlace = urlLlamada(d, r.id);
                const msj = rellenar(config.whatsapp.confirmacion, { nombre: primerNombre(r.nombre), anfitrion: config.anfitrion.nombre, dia: etiquetaDia(r.inicio, r.zonaVisitante || tz).toLowerCase(), hora: etiquetaHora(r.inicio, r.zonaVisitante || tz), zona: nombreZona(r.zonaVisitante || tz), enlace, video: config.llamada.videoPrevio });
                const wa = enlaceWhatsapp(r.whatsapp, msj);
                return (
                  <tr key={r.id} id={`r-${r.id}`} data-prueba="reserva">
                    <td><b>{etiquetaDia(r.inicio, tz)}</b><br />{etiquetaHora(r.inicio, tz)}{r.movimientos > 0 && <><br /><span className="chip">movida {r.movimientos}×{r.cambioPor === 'persona' ? ' por la persona' : ''}</span></>}{q.movida === r.id && <><br /><span className="chip">movida ahora</span></>}</td>
                    <td><b>{r.nombre}</b><br /><a href={`mailto:${r.correo}`}>{r.correo}</a><br />{wa ? <a href={wa}>WhatsApp {r.whatsapp}</a> : r.whatsapp}{r.zonaVisitante && <><br /><span className="chip">{nombreZona(r.zonaVisitante)}</span></>}</td>
                    <td>
                      <details><summary>Ver respuestas</summary>
                        {config.filtro.map((f) => <p key={f.id} style={{ margin: '8px 0 0' }}><span style={{ color: 'var(--suave)' }}>{f.pregunta}</span><br />{valor(r.filtro[f.id])}</p>)}
                        {config.miniAplicacion.map((m) => <p key={m.id} style={{ margin: '8px 0 0' }}><span style={{ color: 'var(--suave)' }}>{m.pregunta}</span><br />{valor(r.mini[m.id])}</p>)}
                      </details>
                    </td>
                    <td>
                      <form action={moverAdmin} className="mini-form">
                        <input type="hidden" name="id" value={r.id} />
                        <select name="inicio" aria-label="Mover a">
                          {libres.filter((h) => h.inicio !== r.inicio).slice(0, 60).map((h) => <option key={h.inicio} value={h.inicio}>{etiquetaDia(h.inicio, tz)} {etiquetaHora(h.inicio, tz)}</option>)}
                        </select>
                        <button className="secundario" type="submit">Mover</button>
                      </form>
                      <form action={cancelarAdmin} className="mini-form"><input type="hidden" name="id" value={r.id} /><button className="secundario" type="submit">Cancelar</button></form>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        <h2 style={{ fontSize: 22, marginTop: 36 }}>Empezaron y no agendaron</h2>
        {sinAgendar.length === 0 ? <p className="ayuda">Nadie se ha quedado a medias.</p> : (
          <table>
            <thead><tr><th>Quién</th><th>Hasta dónde llegó</th><th>Cuándo</th><th></th></tr></thead>
            <tbody>
              {sinAgendar.map((l) => {
                const wa = enlaceWhatsapp(l.whatsapp, rellenar(config.whatsapp.seguimiento, { nombre: primerNombre(l.nombre), anfitrion: config.anfitrion.nombre }));
                return (
                  <tr key={l.whatsapp} data-prueba="lead">
                    <td><b>{l.nombre ?? 'Sin nombre'}</b><br />{l.whatsapp}{l.correo && <><br />{l.correo}</>}</td>
                    <td>{etiquetaPaso(l.ultimoPaso)}{l.ultimoPaso !== 'no' && <> <span className="chip">{l.pasoNum} de {pasos.length}</span></>}</td>
                    <td>{etiquetaDia(l.actualizado, tz)} {etiquetaHora(l.actualizado, tz)}</td>
                    <td>{wa && <a className="secundario" href={wa}>Escribirle</a>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {pasadas.length > 0 && (
          <>
            <h2 style={{ fontSize: 22, marginTop: 36 }}>Últimos 7 días</h2>
            <table>
              <thead><tr><th>Cuándo</th><th>Quién</th><th>Asistencia</th></tr></thead>
              <tbody>
                {pasadas.map((r) => (
                  <tr key={r.id} id={`r-${r.id}`}>
                    <td>{etiquetaDia(r.inicio, tz)} {etiquetaHora(r.inicio, tz)}</td>
                    <td>{r.nombre}</td>
                    <td>
                      <form action={asistenciaAdmin} className="mini-form">
                        <input type="hidden" name="id" value={r.id} />
                        <button className="secundario" name="asistencia" value="presente" type="submit" aria-pressed={r.asistencia === 'presente'}>{r.asistencia === 'presente' ? '✓ ' : ''}Se presentó</button>
                        <button className="secundario" name="asistencia" value="no-show" type="submit" aria-pressed={r.asistencia === 'no-show'}>{r.asistencia === 'no-show' ? '✓ ' : ''}No llegó</button>
                      </form>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </>
        )}
      </div>
    </Pagina>
  );
}
