import { prisma } from "@/lib/prisma";

export async function checkUserQuota(userId: string, newDataSize: number = 0) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { projects: true }
  });

  if (!user) throw new Error("User not found");

  const currentUsage = user.projects.reduce((acc: number, project: { fileTree: any; }) => {
    return acc + JSON.stringify(project.fileTree).length;
  }, 0);

  const totalAttempted = currentUsage + newDataSize;

  if (totalAttempted > user.storageQuota) {
    return { 
      allowed: false, 
      usage: currentUsage, 
      limit: user.storageQuota 
    };
  }

  return { allowed: true, usage: currentUsage };
}