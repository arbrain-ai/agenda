// Contador público: lo que de verdad se puede agendar (lo relee la tarjeta cada 30 s). Nunca inventa un cero.
import { estadoAgenda } from '@/lib/agenda';
import { deps } from '@/lib/servidor';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const e = await estadoAgenda(deps());
    if (e.errorCalendario) return Response.json({ error: 'calendario' }, { status: 503 });
    return Response.json({ quedan: e.quedan, tope: e.tope, visibles: e.huecos.length }, { headers: { 'cache-control': 'no-store' } });
  } catch {
    return Response.json({ error: 'lectura' }, { status: 503 });
  }
}
