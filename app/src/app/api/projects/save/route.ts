import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { flattenTree } from '@/lib/filetree';
import { Prisma } from '@prisma/client';

export async function POST(req: Request) {
  const session = await auth();

  if (!session?.user?.id) {
    return new NextResponse('No session', { status: 401 });
  }
  const userId = session.user.id;

  try {
    const { id, fileTree } = await req.json();

    if (typeof id !== 'string' || !id || !fileTree) {
      return new NextResponse('Invalid payload', { status: 400 });
    }

    const files = flattenTree(fileTree).map((file) => {
      const content = Buffer.from(file.content, 'utf8');

      return {
        path: file.path,
        isMain: file.isMain,
        content,
        size: content.byteLength,
      };
    });

    const paths = files.map((file) => file.path);

    if (paths.some((path) => !path) || new Set(paths).size !== paths.length) {
      return new NextResponse('Invalid or duplicate file paths', { status: 400 });
    }

    const dataSize = files.reduce((sum, file) => sum + file.size, 0);

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        // Only owners and editors may save.
        const assignment = await tx.projectAssignment.findUnique({
          where: { userId_projectId: { userId, projectId: id } },
        });

        if (!assignment || assignment.role === 'viewer') {
          return { status: 'forbidden' as const };
        }

        // The quota that counts is the one of the project's owner.
        const ownerLink = await tx.projectAssignment.findFirst({
          where: { projectId: id, role: 'owner' },
          select: { userId: true, user: { select: { storageQuota: true } } },
        });

        if (!ownerLink) throw new Error('Project owner not found');

        const ownerId = ownerLink.userId;
        const limit = ownerLink.user.storageQuota;

        const [previous, others] = await Promise.all([
          tx.projectFile.aggregate({
            _sum: { size: true },
            where: { projectId: id },
          }),
          tx.projectFile.aggregate({
            _sum: { size: true },
            where: {
              projectId: { not: id },
              project: { userLinks: { some: { userId: ownerId, role: 'owner' } } },
            },
          }),
        ]);

        const previousSize = previous._sum.size ?? 0;
        const otherProjectsUsage = others._sum.size ?? 0;

        const totalAttempted = otherProjectsUsage + dataSize;
        const isGrowing = dataSize > previousSize;

        if (isGrowing && totalAttempted > limit) {
          return {
            status: 'quota' as const,
            usage: otherProjectsUsage + previousSize,
            limit,
          };
        }

        // Remove files that no longer exist in the tree.
        await tx.projectFile.deleteMany({
          where: { projectId: id, path: { notIn: paths } },
        });

        // Create or update the others.
        for (const file of files) {
          await tx.projectFile.upsert({
            where: { projectId_path: { projectId: id, path: file.path } },
            create: {
              projectId: id,
              path: file.path,
              isMain: file.isMain,
              content: file.content,
              size: file.size,
            },
            update: {
              isMain: file.isMain,
              content: file.content,
              size: file.size,
            },
          });
        }

        return { status: 'ok' as const };
      },
      { timeout: 20000 },
    );

    if (result.status === 'forbidden') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    if (result.status === 'quota') {
      return new NextResponse(
        `Quota exceeded (${(result.usage / 1024 / 1024).toFixed(2)}MB / ${(
          result.limit /
          1024 /
          1024
        ).toFixed(2)}MB)`,
        { status: 403 },
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde :', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
