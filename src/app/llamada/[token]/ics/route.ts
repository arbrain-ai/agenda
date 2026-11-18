// «Agregar a mi calendario»: el .ics de la llamada (con el enlace firmado como credencial).
import { config } from '@/lib/config';
import { deps } from '@/lib/servidor';
import { leerToken } from '@/lib/token';
import { adjuntoIcs } from '@/lib/plantillas';
import { urlLlamada } from '@/lib/agenda';

export async function GET(_req: Request, { params }: { params: Promise<{ token: string }> }) {
  const d = deps();
  const id = leerToken((await params).token, d.secreto);
  const r = id ? await d.alm.leer((t) => t.reserva(id)) : null;
  if (!r) return new Response('No encontramos esta llamada.', { status: 404 });
  const a = adjuntoIcs(config, r, urlLlamada(d, r.id), r.estado === 'cancelada');
  return new Response(a.contenido, { headers: { 'content-type': a.tipo, 'content-disposition': 'attachment; filename="llamada.ics"', 'cache-control': 'no-store' } });
}
