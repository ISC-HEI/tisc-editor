'use server';

import { prisma } from '@/lib/prisma';
import { requireUserId } from './utils';

/**
 * Computes the current user's storage usage from their owned projects,
 * along with their quota limit and usage percentage.
 */
export async function getUserStorage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { storageQuota: true },
  });

  if (!user) {
    return null;
  }

  const { _sum } = await prisma.projectFile.aggregate({
    _sum: { size: true },
    where: {
      project: {
        userLinks: {
          some: { userId, role: 'owner' },
        },
      },
    },
  });

  const usage = _sum.size ?? 0;

  return {
    usage,
    limit: user.storageQuota,
    percentage: (usage / user.storageQuota) * 100,
  };
}
