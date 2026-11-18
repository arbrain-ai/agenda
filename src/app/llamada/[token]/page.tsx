// «Tu llamada»: la confirmación al agendar y, con el mismo enlace firmado, cambiar la hora o cancelar.
import { notFound } from 'next/navigation';
import { config } from '@/lib/config';
import { estadoAgenda } from '@/lib/agenda';
import { deps } from '@/lib/servidor';
import { leerToken } from '@/lib/token';
import { evaluarCambio, cambiosRestantes } from '@/lib/reglas';
import { etiquetaDia, etiquetaHora, nombreZona } from '@/lib/tiempo';
import { enlaceGoogleCalendar } from '@/lib/ics';
import { titulo } from '@/lib/plantillas';
import { Pagina } from '@/components/Pagina';
import { CambiarForm } from '@/components/CambiarForm';

export const dynamic = 'force-dynamic';

export default async function TuLlamada({ params, searchParams }: { params: Promise<{ token: string }>; searchParams: Promise<{ nueva?: string; ya?: string; listo?: string; error?: string; cancelar?: string }> }) {
  const { token } = await params;
  const q = await searchParams;
  const d = deps();
  const id = leerToken(token, d.secreto);
  const r = id ? await d.alm.leer((t) => t.reserva(id)) : null;
  if (!r) notFound();

  const tz = r.zonaVisitante || config.horario.zona;
  const cancelada = r.estado === 'cancelada';
  const pasada = Date.parse(r.fin) < Date.now();
  const puedeMover = evaluarCambio(r, Date.now(), 'persona', 'mover', config.reagendar).ok;
  const huecos = puedeMover ? (await estadoAgenda(d, { excluir: r.id, margenMin: Math.max(config.llamada.margenParaAgendar, config.reagendar.horasAntes * 60) })).todos.filter((h) => h.inicio !== r.inicio) : [];
  const sala = r.sala ?? (config.llamada.lugar !== 'google-meet' ? config.llamada.lugar : null);
  const gcal = enlaceGoogleCalendar({ titulo: titulo(config), descripcion: `Enlace de la llamada: ${sala ?? 'te llega por correo'}`, inicio: r.inicio, fin: r.fin, lugar: sala });

  return (
    <Pagina>
      <div className="angosta">
        <div className="tarjeta" data-estado={r.estado}>
          {cancelada ? (
            <>
              <p className="ceja">Tu llamada</p>
              <h2>{q.listo === 'cancelada' ? 'Listo, cancelamos tu llamada.' : 'Esta llamada está cancelada.'}</h2>
              <p className="ayuda">Era el {etiquetaDia(r.inicio, tz).toLowerCase()} a las {etiquetaHora(r.inicio, tz)}. Si quieres otra, puedes volver a agendar.</p>
              <div className="acciones"><a className="primario" href="/aplicar">Agendar otra llamada</a></div>
            </>
          ) : (
            <>
              <p className="sello"><i aria-hidden>✓</i>{q.nueva ? '¡Listo! Tu llamada quedó agendada' : q.listo === 'movida' ? 'Listo, cambiamos tu hora' : q.ya ? 'Ya tenías esta llamada agendada' : 'Tu llamada'}</p>
              <p className="llamada-dia" data-prueba="dia">{etiquetaDia(r.inicio, tz)}</p>
              <p className="llamada-hora" data-prueba="hora">{etiquetaHora(r.inicio, tz)} · {config.llamada.minutos} min con {config.anfitrion.nombre} · {nombreZona(tz)}</p>
              {q.nueva && <p className="ayuda">Te mandamos la confirmación a <b>{r.correo}</b> con el evento para tu calendario. Te recordamos antes de la llamada.</p>}
              {config.llamada.videoPrevio && (
                <div className="aviso">Antes de vernos, mira este video: es importante para aprovechar la llamada. <a href={config.llamada.videoPrevio}>Ver el video</a></div>
              )}
              <div className="fila-botones">
                {sala ? <a className="primario" href={sala}>Enlace de la llamada</a> : <span className="secundario">El enlace te llega por correo</span>}
                <a className="secundario" href={`/llamada/${token}/ics`}>Agregar a mi calendario (.ics)</a>
              </div>
              <p style={{ textAlign: 'center', margin: '10px 0 0' }}><a className="enlace" href={gcal}>o agregar a Google Calendar</a></p>
              {!pasada && (
                <>
                  <hr className="separador" />
                  <CambiarForm token={token} huecos={huecos} restantes={cambiosRestantes(r.cambiosPersona, config.reagendar.cambiosMaximos)} zona={config.horario.zona}
                    error={q.error ?? (!puedeMover && Date.parse(r.inicio) > Date.now() ? (r.cambiosPersona >= config.reagendar.cambiosMaximos ? 'sin-cambios' : 'muy-cerca') : null)}
                    puedeMover={puedeMover} abrirCancelar={q.cancelar === '1'} />
                </>
              )}
            </>
          )}
        </div>
      </div>
    </Pagina>
  );
}
