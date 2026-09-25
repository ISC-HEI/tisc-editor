'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { calcFileTreeSize } from '../quota-service';

export async function getUserStorage() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

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