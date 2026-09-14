// app/api/projects/[id]/thumbnail/route.ts
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const thumb = await prisma.projectThumbnail.findUnique({
    where: { projectId: id },
  });

  if (!thumb) return new NextResponse(null, { status: 404 });

  return new NextResponse(thumb.data, {
    headers: {
      'Content-Type': thumb.mimeType,
      'Cache-Control': 'public, max-age=60, must-revalidate',
      ETag: thumb.updatedAt.getTime().toString(),
    },
  });
}
