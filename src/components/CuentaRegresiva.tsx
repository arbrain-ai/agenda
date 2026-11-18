// Cuenta regresiva al cierre de aplicaciones (cupo.cierre). Es real: al llegar a cero, el servidor también cierra.
'use client';

import { useEffect, useState } from 'react';

function partes(ms: number) {
  const s = Math.max(0, Math.floor(ms / 1000));
  return { d: Math.floor(s / 86400), h: Math.floor((s % 86400) / 3600), m: Math.floor((s % 3600) / 60), s: s % 60 };
}

export function CuentaRegresiva({ hasta }: { hasta: string }) {
  const [ahora, setAhora] = useState<number | null>(null);
  useEffect(() => {
    setAhora(Date.now());
    const t = setInterval(() => setAhora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  if (ahora === null) return null;
  const falta = Date.parse(hasta) - ahora;
  if (falta <= 0) return <p className="cierre">Las aplicaciones cerraron.</p>;
  const { d, h, m, s } = partes(falta);
  const dos = (n: number) => String(n).padStart(2, '0');
  return (
    <p className="cierre" aria-live="off">
      Cierran en <strong>{d > 0 ? `${d} d ` : ''}{dos(h)}:{dos(m)}:{dos(s)}</strong>
    </p>
  );
}
