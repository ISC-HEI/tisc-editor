import { prisma } from '@/lib/prisma';

/**
 * Sums the size of every file stored in the projects owned by a user.
 */
async function getOwnedStorageUsage(userId: string, excludeProjectId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageQuota: true },
  });

  if (!user) throw new Error('User not found');

  const { _sum } = await prisma.projectFile.aggregate({
    _sum: { size: true },
    where: {
      ...(excludeProjectId ? { projectId: { not: excludeProjectId } } : {}),
      project: { userLinks: { some: { userId, role: 'owner' } } },
    },
  });

  return { usage: _sum.size ?? 0, limit: user.storageQuota };
}

export async function checkUserQuota(
  userId: string,
  newDataSize: number = 0,
  excludeProjectId?: string,
) {
  const { usage, limit } = await getOwnedStorageUsage(userId, excludeProjectId);

  const totalAttempted = usage + newDataSize;

  if (totalAttempted > limit) {
    return { allowed: false, usage, limit };
  }

  return { allowed: true, usage, limit };
}
