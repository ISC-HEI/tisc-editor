import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/lib/auth';

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) return new NextResponse(null, { status: 401 });

  const { id } = await params;

  const assignment = await prisma.projectAssignment.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId: id } },
    select: { role: true },
  });
  if (!assignment) return new NextResponse(null, { status: 404 });

  const thumb = await prisma.projectThumbnail.findUnique({
    where: { projectId: id },
  });

  if (!thumb) return new NextResponse(null, { status: 404 });

  return new NextResponse(thumb.data, {
    headers: {
      'Content-Type': thumb.mimeType,
      'Cache-Control': 'private, max-age=60, must-revalidate',
      ETag: thumb.updatedAt.getTime().toString(),
    },
  });
}
