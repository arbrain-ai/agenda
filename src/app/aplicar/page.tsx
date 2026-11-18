// /aplicar: la portada con tu marca a la izquierda y la tarjeta de aplicar (contador real + pasos) a la derecha.
import { config } from '@/lib/config';
import { estadoAgenda } from '@/lib/agenda';
import { deps } from '@/lib/servidor';
import { diaCorto } from '@/lib/tiempo';
import { Pagina } from '@/components/Pagina';
import { AplicarForm } from '@/components/AplicarForm';

export const dynamic = 'force-dynamic';

export default async function Aplicar() {
  const e = await estadoAgenda(deps());
  const tz = config.horario.zona;
  const orden = [...e.huecos].sort((a, b) => a.inicio.localeCompare(b.inicio));
  const rango = orden.length ? `${diaCorto(orden[0].inicio, tz)} → ${diaCorto(orden[orden.length - 1].inicio, tz)}` : null;
  const p = config.portada;
  return (
    <Pagina>
      <div className="rejilla">
        <div className="r-heroe">
          {p.ceja && <p className="ceja">{p.ceja}</p>}
          <h1 className="titular">
            {p.titular}
            {p.titularDestacado && <> <em>{p.titularDestacado}</em></>}
          </h1>
          {p.bajada && <p className="bajada">{p.bajada}</p>}
          {!!p.cifras?.length && (
            <div className="cifras">
              {p.cifras.slice(0, 3).map((c) => (
                <div key={c.etiqueta}><strong>{c.valor}{c.unidad && <small>{c.unidad}</small>}</strong><span>{c.etiqueta}</span></div>
              ))}
            </div>
          )}
        </div>
        <div className="r-tarjeta">
          {e.errorCalendario && <p className="aviso">No pudimos leer la agenda en este momento. Intenta de nuevo en unos minutos.</p>}
          {e.cerrada ? (
            <div className="tarjeta"><p className="ceja">Aplicaciones <b>cerradas</b></p><h2>Las aplicaciones ya cerraron.</h2><p className="ayuda">Gracias por tu interés. Pronto abriremos de nuevo.</p></div>
          ) : (
            <AplicarForm
              huecos={e.huecos}
              quedan={e.quedan}
              tope={e.tope}
              masPorAbrir={e.masPorAbrir}
              rango={rango}
              cierre={e.cierre}
              filtro={config.filtro}
              mini={config.miniAplicacion}
              minutos={config.llamada.minutos}
              anfitrion={config.anfitrion.nombre}
              zona={tz}
              noCalifica={config.noCalifica}
            />
          )}
        </div>
        {!!p.esParaTi?.length && (
          <div className="para-ti r-extra">
            <p className="ceja">Es para ti <b>si</b></p>
            <ul>{p.esParaTi.map((t) => <li key={t}>{t}</li>)}</ul>
          </div>
        )}
      </div>
    </Pagina>
  );
}
