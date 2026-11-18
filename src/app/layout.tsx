import type { Metadata, Viewport } from 'next';
import type { CSSProperties, ReactNode } from 'react';
import { config } from '@/lib/config';
import './globals.css';

export const metadata: Metadata = {
  title: config.marca.tituloPestana || config.marca.nombre,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = { themeColor: config.colores.fondo, width: 'device-width', initialScale: 1 };

// Tus colores y tipografías de agenda.config.ts se vuelven variables CSS: toda la interfaz las usa.
const c = config.colores;
const vars = {
  '--fondo': c.fondo,
  '--superficie': c.superficie,
  '--texto': c.texto,
  '--suave': c.textoSuave,
  '--borde': c.borde,
  '--acento': c.acento,
  '--sobre-acento': c.textoSobreAcento,
  '--destacado': c.destacado,
  '--f-titulos': config.fuentes.titulos,
  '--f-texto': config.fuentes.texto,
} as CSSProperties;

const fuentes = config.fuentes.googleFonts.length
  ? `https://fonts.googleapis.com/css2?${config.fuentes.googleFonts.map((f) => `family=${encodeURIComponent(f).replace(/%20/g, '+')}:wght@400;600;700`).join('&')}&display=swap`
  : null;

export default function Raiz({ children }: { children: ReactNode }) {
  return (
    <html lang="es" style={vars}>
      <head>{fuentes && <link rel="stylesheet" href={fuentes} />}</head>
      <body>{children}</body>
    </html>
  );
}
