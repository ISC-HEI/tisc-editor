import { prisma } from "@/lib/prisma";

export async function checkUserQuota(
  userId: string,
  newDataSize: number = 0,
  excludeProjectId?: string
) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: {
      projectLinks: {
        include: { project: true }
      }
    }
  });

  if (!user) throw new Error("User not found");

  const currentUsage = user.projectLinks.reduce((acc: number, link) => {
    if (excludeProjectId && link.project.id === excludeProjectId) {
      return acc;
    }
    return acc + JSON.stringify(link.project.fileTree).length;
  }, 0);

  const totalAttempted = currentUsage + newDataSize;

  if (totalAttempted > user.storageQuota) {
    return {
      allowed: false,
      usage: currentUsage,
      limit: user.storageQuota
    };
  }

  return { allowed: true, usage: currentUsage, limit: user.storageQuota };
}