// Cabecera con tu logo y nombre, y el ancho de la página.
import type { ReactNode } from 'react';
import { config } from '@/lib/config';

export function Pagina({ children, derecha }: { children: ReactNode; derecha?: ReactNode }) {
  return (
    <div className="pagina">
      <header className="cabeza">
        <a className="marca" href="/aplicar">
          {config.marca.logo ? <img src={config.marca.logo} alt={config.marca.nombre} /> : <span>{config.marca.nombre}</span>}
        </a>
        {derecha}
      </header>
      {children}
    </div>
  );
}
