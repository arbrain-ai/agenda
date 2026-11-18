// La vuelta del reloj (recordatorios y reintentos con Google) para servicios sin proceso fijo, como Vercel.
// Pide «Authorization: Bearer <CRON_SECRET>». Vercel Cron lo manda solo si defines CRON_SECRET.
import { vuelta } from '@/lib/agenda';
import { deps } from '@/lib/servidor';

export const dynamic = 'force-dynamic';

async function correr(req: Request) {
  const secreto = process.env.CRON_SECRET?.trim();
  if (!secreto || req.headers.get('authorization') !== `Bearer ${secreto}`) return Response.json({ error: 'sin permiso' }, { status: 401 });
  return Response.json(await vuelta(deps()));
}

export const GET = correr;
export const POST = correr;
