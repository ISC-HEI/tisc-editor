import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { getTemplateThumbnail } from '@/lib/typst-universe';

export async function GET(req: Request, { params }: { params: Promise<{ name: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const { name } = await params;

  try {
    const thumbnail = await getTemplateThumbnail(name);
    if (!thumbnail) return new NextResponse(null, { status: 404 });

    return new NextResponse(new Uint8Array(thumbnail), {
      headers: {
        'Content-Type': 'image/webp',
        'Cache-Control': 'private, max-age=3600',
      },
    });
  } catch (error) {
    console.error(`Failed to load thumbnail of template ${name}:`, error);
    return new NextResponse(null, { status: 502 });
  }
}
