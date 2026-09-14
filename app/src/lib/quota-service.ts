import { prisma } from '@/lib/prisma';
import type { Prisma } from '@prisma/client';

interface FileTreeNode {
  type?: string;
  data?: string;
  children?: Record<string, FileTreeNode>;
}

export function calcFileTreeSize(node: Prisma.JsonValue | null | undefined): number {
  if (!node || typeof node !== 'object' || Array.isArray(node)) return 0;

  const typedNode = node as FileTreeNode;
  let size = 0;

  if (typedNode.type === 'file' && typedNode.data) {
    const data = typedNode.data;
    if (data.startsWith('data:')) {
      const base64 = data.split(',')[1] ?? '';
      const padding = (base64.match(/=+$/) || [''])[0].length;
      size += Math.round((base64.length * 3) / 4) - padding;
    } else {
      size += new TextEncoder().encode(data).length;
    }
  }

  if (typedNode.children) {
    for (const child of Object.values(typedNode.children)) {
      size += calcFileTreeSize(child as unknown as Prisma.JsonValue);
    }
  }

  return size;
}

export async function getOwnedStorageUsage(userId: string, excludeProjectId?: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { projectLinks: { include: { project: true } } },
  });

  if (!user) throw new Error('User not found');

  const ownedLinks = user.projectLinks.filter((link) => link.role === 'owner');

  const usage = ownedLinks.reduce((acc: number, link) => {
    if (excludeProjectId && link.project.id === excludeProjectId) return acc;
    return acc + calcFileTreeSize(link.project.fileTree);
  }, 0);

  return { usage, limit: user.storageQuota, ownedLinks };
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
