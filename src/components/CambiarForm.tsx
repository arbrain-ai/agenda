// «Cambiar mi hora» (el mismo selector de /aplicar) y «Cancelar mi llamada» con confirmación.
'use client';

import { useActionState, useState } from 'react';
import { cambiarHora, cancelarLlamada, type EstadoCambio } from '@/app/llamada/[token]/acciones';
import { TEXTO_ERROR_CAMBIO, type ErrorCambio } from '@/lib/reglas';
import { diaCorto, etiquetaHora } from '@/lib/tiempo';
import { SelectorHoras, useZonaVisitante, type HuecoVista } from './SelectorHoras';

export function CambiarForm({ token, huecos, restantes, zona: zonaAnfitrion, error, puedeMover, abrirCancelar = false }: {
  token: string; huecos: HuecoVista[]; restantes: number; zona: string; error?: string | null; puedeMover: boolean; abrirCancelar?: boolean;
}) {
  const [estado, accion, enviando] = useActionState<EstadoCambio, FormData>(cambiarHora, {});
  const [inicio, setInicio] = useState<string | null>(null);
  const [abierto, setAbierto] = useState(false);
  const [confirma, setConfirma] = useState(abrirCancelar);
  const zona = useZonaVisitante(zonaAnfitrion, huecos);
  const tz = zona ?? zonaAnfitrion;
  const elegido = huecos.find((h) => h.inicio === inicio) ?? null;
  const textoError = (e?: string | null) => (e ? TEXTO_ERROR_CAMBIO[e as ErrorCambio] ?? TEXTO_ERROR_CAMBIO['no-guardado'] : null);

  return (
    <>
      {puedeMover && restantes > 0 && (
        abierto ? (
          <form action={accion} noValidate>
            <input type="hidden" name="token" value={token} />
            <h3 className="pregunta">Elige tu nuevo horario.</h3>
            <p className="ayuda">{restantes === 1 ? 'Te queda 1 cambio.' : `Te quedan ${restantes} cambios.`}</p>
            {huecos.length === 0 ? <p className="ayuda">Ahora no hay otros horarios libres. Escríbenos y te buscamos uno.</p> : (
              <SelectorHoras huecos={huecos} value={inicio} onChange={setInicio} zonaAnfitrion={zonaAnfitrion} zona={zona} etiqueta="Nueva hora de tu llamada" />
            )}
            {huecos.length > 0 && (
              <div className="acciones">
                <button type="submit" className="primario" disabled={enviando || !elegido}>
                  {enviando ? 'Cambiando…' : elegido ? `Mover a ${diaCorto(elegido.inicio, tz)}, ${etiquetaHora(elegido.inicio, tz)}` : 'Elige una hora'}
                </button>
              </div>
            )}
            {textoError(estado.error) && <p className="error" role="alert">{textoError(estado.error)}</p>}
          </form>
        ) : (
          <button type="button" className="secundario" style={{ width: '100%' }} onClick={() => setAbierto(true)}>Cambiar mi hora</button>
        )
      )}
      {!estado.error && textoError(error) && <p className="error" role="alert">{textoError(error)}</p>}
      <form action={cancelarLlamada} style={{ marginTop: 14, textAlign: 'center' }}>
        <input type="hidden" name="token" value={token} />
        {confirma ? (
          <div className="acciones">
            <p className="ayuda" style={{ margin: 0 }}>¿Seguro? Se libera tu horario y se avisa.</p>
            <button type="submit" className="secundario">Sí, cancelar mi llamada</button>
            <button type="button" className="enlace" onClick={() => setConfirma(false)}>No, la conservo</button>
          </div>
        ) : (
          <button type="button" className="enlace" onClick={() => setConfirma(true)}>Cancelar mi llamada</button>
        )}
      </form>
    </>
  );
}
