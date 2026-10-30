import { metrics } from '@/lib/metrics';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const token = process.env.METRICS_TOKEN;
  if (token && request.headers.get('authorization') !== `Bearer ${token}`) {
    return new Response('Unauthorized', { status: 401 });
  }

  const body = await metrics.registry.metrics();
  return new Response(body, {
    headers: { 'Content-Type': metrics.registry.contentType },
  });
}
