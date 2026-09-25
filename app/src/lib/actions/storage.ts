'use server';

import { prisma } from '@/lib/prisma';
import { calcFileTreeSize } from '../quota-service';
import { requireUserId } from './utils';

/**
 * Computes the current user's storage usage from their owned projects,
 * along with their quota limit and usage percentage.
 */
export async function getUserStorage() {
  const userId = await requireUserId();

  const user = await prisma.user.findUnique({
    where: {
      id: userId,
    },
    select: {
      storageQuota: true,
      projectLinks: {
        include: {
          project: {
            select: {
              fileTree: true,
            },
          },
        },
      },
    },
  });

  if (!user) {
    return null;
  }

  type ProjectLink = (typeof user.projectLinks)[number];

  const ownedLinks = user.projectLinks.filter((link: ProjectLink) => link.role === 'owner');

  const usage = ownedLinks.reduce((acc: number, link: ProjectLink) => {
    return acc + calcFileTreeSize(link.project.fileTree);
  }, 0);

  return {
    usage,
    limit: user.storageQuota,
    percentage: (usage / user.storageQuota) * 100,
  };
}
