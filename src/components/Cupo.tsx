// El contador de urgencia: SIEMPRE real. Cada marca es una llamada; se relee cada 30 s y, si alguien agenda mientras
// miras, la marca que se va se enciende un momento. Si la relectura falla, «En vivo» se apaga solo (nunca inventa).
'use client';

import { useEffect, useRef, useState } from 'react';
import { CuentaRegresiva } from './CuentaRegresiva';

export function Cupo({ quedan: inicial, tope, minutos, anfitrion, rango, cierre, leer = true }: {
  quedan: number; tope: number; minutos: number; anfitrion: string; rango?: string | null; cierre?: string | null; leer?: boolean;
}) {
  const [quedan, setQuedan] = useState(inicial);
  const [vivo, setVivo] = useState(leer);
  const [recien, setRecien] = useState<number[]>([]);
  const previo = useRef(inicial);

  useEffect(() => {
    if (!leer) return;
    let vivoHasta = Date.now() + 90_000;
    let t: ReturnType<typeof setTimeout> | undefined;
    let cancelado = false;
    const tick = async () => {
      if (document.visibilityState === 'visible') {
        try {
          const r = await fetch('/api/cupo', { cache: 'no-store' });
          const j = r.ok ? await r.json() : null;
          if (!cancelado && j && typeof j.quedan === 'number') { setQuedan(j.quedan); vivoHasta = Date.now() + 90_000; }
        } catch { /* sin lectura: el número se queda y «En vivo» se apaga solo */ }
      }
      if (!cancelado) { setVivo(Date.now() < vivoHasta); t = setTimeout(tick, 30_000); }
    };
    t = setTimeout(tick, 30_000);
    return () => { cancelado = true; if (t) clearTimeout(t); };
  }, [leer]);

  useEffect(() => {
    const antes = previo.current;
    previo.current = quedan;
    if (quedan >= antes) return;
    setRecien(Array.from({ length: antes - quedan }, (_, k) => tope - antes + k));
    const t = setTimeout(() => setRecien([]), 1400);
    return () => clearTimeout(t);
  }, [quedan, tope]);

  const tomadas = Math.max(0, tope - quedan);
  const sinCupo = quedan <= 0;
  return (
    <div className="cupo" data-sin-cupo={sinCupo || undefined}>
      <div className="cupo-cabeza">
        <p className="cupo-cifra">
          {sinCupo ? <span><b>Sin horarios libres</b></span> : (
            <>
              <strong data-prueba="quedan">{quedan}</strong>
              <span><b>de {tope}</b>{quedan === 1 ? 'llamada libre' : 'llamadas libres'}</span>
            </>
          )}
        </p>
        {leer && <span className="en-vivo" data-vivo={vivo || undefined} title="Se actualiza solo cada 30 segundos"><i aria-hidden />{vivo ? 'En vivo' : 'Cupo'}</span>}
      </div>
      {tope <= 80 && (
        <div className="marcas" role="img" aria-label={sinCupo ? `Las ${tope} llamadas están tomadas` : `Quedan ${quedan} de ${tope} llamadas`}>
          {Array.from({ length: tope }, (_, k) => <span key={k} data-tomada={k < tomadas || undefined} data-recien={recien.includes(k) || undefined} />)}
        </div>
      )}
      <p className="cupo-pie">
        <span>Cada marca es una llamada de {minutos} min con {anfitrion}</span>
        {rango && <b>{rango}</b>}
      </p>
      {cierre && <CuentaRegresiva hasta={cierre} />}
    </div>
  );
}
