import { prisma } from '@/lib/prisma';

interface FileTreeNode {
  type?: string;
  data?: string;
  children?: Record<string, FileTreeNode>;
}

export function calcFileTreeSize(node: FileTreeNode | null | undefined): number {
  if (!node) return 0;
  let size = 0;

  if (node.type === 'file' && node.data) {
    const data = node.data as string;
    if (data.startsWith('data:')) {
      const base64 = data.split(',')[1] ?? '';
      const padding = (base64.match(/=+$/) || [''])[0].length;
      size += Math.round((base64.length * 3) / 4) - padding;
    } else {
      size += new TextEncoder().encode(data).length;
    }
  }

  if (node.children) {
    for (const child of Object.values(node.children) as FileTreeNode[]) {
      size += calcFileTreeSize(child);
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
