// @ts-nocheck
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { NextResponse } from 'next/server';
import { flattenTree } from '@/lib/filetree';
import { deleteObjects } from '@/lib/storage';
import { prepareFiles, uploadFiles } from '@/lib/project-storage';

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

    const flat = flattenTree(fileTree);
    const paths = flat.map((file) => file.path);

    if (paths.some((path) => !path) || new Set(paths).size !== paths.length) {
      return new NextResponse('Invalid or duplicate file paths', { status: 400 });
    }

    // Only owners and editors may save.
    const assignment = await prisma.projectAssignment.findUnique({
      where: { userId_projectId: { userId, projectId: id } },
    });

    if (!assignment || assignment.role === 'viewer') {
      return new NextResponse('Forbidden', { status: 403 });
    }

    // The quota that counts is the one of the project's owner.
    const ownerLink = await prisma.projectAssignment.findFirst({
      where: { projectId: id, role: 'owner' },
      select: { userId: true, user: { select: { storageQuota: true } } },
    });

    if (!ownerLink) throw new Error('Project owner not found');

    const ownerId = ownerLink.userId;
    const limit = ownerLink.user.storageQuota;

    const existing = await prisma.projectFile.findMany({
      where: { projectId: id },
      select: { id: true, path: true, isMain: true, size: true, sha256: true, storageKey: true },
    });

    const existingByPath = new Map(existing.map((file) => [file.path, file]));

    const files = prepareFiles(id, flat, new Map(existing.map((file) => [file.path, file.id])));

    const dataSize = files.reduce((sum, file) => sum + file.size, 0);
    const previousSize = existing.reduce((sum, file) => sum + file.size, 0);

    const others = await prisma.projectFile.aggregate({
      _sum: { size: true },
      where: {
        projectId: { not: id },
        project: { userLinks: { some: { userId: ownerId, role: 'owner' } } },
      },
    });

    const otherProjectsUsage = others._sum.size ?? 0;
    const isGrowing = dataSize > previousSize;

    if (isGrowing && otherProjectsUsage + dataSize > limit) {
      const usage = otherProjectsUsage + previousSize;

      return new NextResponse(
        `Quota exceeded (${(usage / 1024 / 1024).toFixed(2)}MB / ${(limit / 1024 / 1024).toFixed(
          2,
        )}MB)`,
        { status: 403 },
      );
    }

    // The whole tree is sent on every save: only upload what actually changed.
    const toUpload = files.filter((file) => {
      const previous = existingByPath.get(file.path);
      return (
        !previous || previous.sha256 !== file.sha256 || previous.storageKey !== file.storageKey
      );
    });

    const uploadedPaths = new Set(toUpload.map((file) => file.path));

    const toWrite = files.filter((file) => {
      const previous = existingByPath.get(file.path);
      return uploadedPaths.has(file.path) || previous?.isMain !== file.isMain;
    });

    // Objects first: a failure afterwards only leaves harmless orphans.
    await uploadFiles(toUpload);

    await prisma.$transaction(
      async (tx) => {
        // Remove files that no longer exist in the tree.
        await tx.projectFile.deleteMany({
          where: { projectId: id, path: { notIn: paths } },
        });

        for (const file of toWrite) {
          await tx.projectFile.upsert({
            where: { projectId_path: { projectId: id, path: file.path } },
            create: {
              id: file.id,
              projectId: id,
              path: file.path,
              isMain: file.isMain,
              size: file.size,
              sha256: file.sha256,
              storageKey: file.storageKey,
            },
            update: {
              isMain: file.isMain,
              size: file.size,
              sha256: file.sha256,
              storageKey: file.storageKey,
              content: null, // migrated: the object store is now the source of truth
            },
          });
        }
      },
      { timeout: 20000 },
    );

    // Delete the objects of removed files (best effort, rows are already gone).
    const pathSet = new Set(paths);
    const removedKeys = existing
      .filter((file) => !pathSet.has(file.path) && file.storageKey)
      .map((file) => file.storageKey as string);

    if (removedKeys.length > 0) {
      deleteObjects(removedKeys).catch((error) =>
        console.error('Failed to delete removed objects:', error),
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Erreur lors de la sauvegarde :', error);
    return NextResponse.json({ error: 'Erreur serveur' }, { status: 500 });
  }
}
