// Elegir la hora: primero el día, luego la hora. Si quien agenda vive en otra zona, ve SU hora (y se dice).
// Cada opción es <input name="inicio" value="<ISO>">: el formulario manda el instante exacto, nunca una hora local.
'use client';

import { useEffect, useMemo, useState } from 'react';
import { claveDia, diaCorto, etiquetaHora, nombreZona } from '@/lib/tiempo';

export type HuecoVista = { inicio: string; fin: string };

/** La zona del navegador, solo si de verdad cambia la hora de algún hueco respecto a la del anfitrión. */
export function useZonaVisitante(zonaAnfitrion: string, huecos: HuecoVista[]) {
  const [zona, setZona] = useState<string | null>(null);
  useEffect(() => {
    try {
      const z = Intl.DateTimeFormat().resolvedOptions().timeZone;
      if (z && z !== zonaAnfitrion && huecos.some((h) => etiquetaHora(h.inicio, z) !== etiquetaHora(h.inicio, zonaAnfitrion))) setZona(z);
    } catch { /* sin zona: se queda la del anfitrión */ }
  }, [zonaAnfitrion, huecos]);
  return zona;
}

export function SelectorHoras({ huecos, value, onChange, zonaAnfitrion, zona, perdido, etiqueta = 'Hora de tu llamada' }: {
  huecos: HuecoVista[]; value: string | null; onChange: (inicio: string) => void; zonaAnfitrion: string; zona: string | null; perdido?: string | null; etiqueta?: string;
}) {
  const tz = zona ?? zonaAnfitrion;
  const dias = useMemo(() => {
    const m = new Map<string, HuecoVista[]>();
    for (const h of [...huecos].sort((a, b) => a.inicio.localeCompare(b.inicio))) {
      const k = claveDia(h.inicio, tz);
      m.set(k, [...(m.get(k) ?? []), h]);
    }
    return [...m.entries()];
  }, [huecos, tz]);
  const [dia, setDia] = useState<string | null>(null);
  const diaVisible = dia && dias.some(([k]) => k === dia) ? dia : value ? claveDia(value, tz) : dias[0]?.[0] ?? null;
  const delDia = dias.find(([k]) => k === diaVisible)?.[1] ?? [];

  return (
    <div>
      <div className="dias" role="group" aria-label="Día">
        {dias.map(([k, hs]) => (
          <button key={k} type="button" className="dia" aria-pressed={k === diaVisible} onClick={() => setDia(k)}>
            <small>{diaCorto(hs[0].inicio, tz).split(' ')[0]}</small>
            <b>{diaCorto(hs[0].inicio, tz).split(' ')[1]}</b>
          </button>
        ))}
      </div>
      <div className="horas" role="radiogroup" aria-label={etiqueta}>
        {delDia.map((h) => (
          <label key={h.inicio} className="hora" data-perdido={h.inicio === perdido || undefined}>
            <input type="radio" name="inicio" value={h.inicio} checked={value === h.inicio} disabled={h.inicio === perdido} onChange={() => onChange(h.inicio)} />
            <span>{etiquetaHora(h.inicio, tz)}</span>
          </label>
        ))}
      </div>
      <p className="zona-nota">
        {zona ? `Horarios en tu zona (${nombreZona(zona)}).` : `Horarios en ${nombreZona(zonaAnfitrion)}.`}
      </p>
    </div>
  );
}
