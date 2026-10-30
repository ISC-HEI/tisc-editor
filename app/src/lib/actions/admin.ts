'use server';

import { revalidatePath } from 'next/cache';
import { prisma } from '../prisma';
import { cleanupProjectObjects } from '../project-storage';
import { requireAdmin, requireUser } from './utils';

export async function setUserDisabled(userId: string, disabled: boolean) {
  const admin = await requireAdmin();
  await requireUser(userId);

  if (admin?.id === userId) {
    throw new Error("You can't disable your own account");
  }

  await prisma.user.update({ where: { id: userId }, data: { disabled } });
  revalidatePath('/admin');
}

export async function updateUserQuota(userId: string, quota: number) {
  const MAX_INT = 2_147_483_647;

  await requireAdmin();
  await requireUser(userId);
  if (!Number.isFinite(quota) || quota < 0 || quota > MAX_INT) {
    throw new Error('Invalid quota');
  }

  await prisma.user.update({ where: { id: userId }, data: { storageQuota: quota } });
  revalidatePath('/admin');
}

/**
 * Deletes a user. Their owned projects are either transferred to `transferToUserId`
 * (who becomes owner) or deleted when it is null. Shared projects are only unlinked.
 */
export async function deleteUser(userId: string, transferToUserId: string | null) {
  const admin = await requireAdmin();
  await requireUser(userId);

  if (admin?.id === userId) {
    throw new Error("You can't delete your own account");
  }
  if (transferToUserId === userId) {
    throw new Error("Projects can't be transferred to the deleted user");
  }
  if (transferToUserId) {
    await requireUser(transferToUserId);
  }

  const ownedProjectIds = (
    await prisma.projectAssignment.findMany({
      where: { userId, role: 'owner' },
      select: { projectId: true },
    })
  ).map((l) => l.projectId);

  await prisma.$transaction(async (tx) => {
    if (transferToUserId) {
      for (const projectId of ownedProjectIds) {
        await tx.projectAssignment.upsert({
          where: { userId_projectId: { userId: transferToUserId, projectId } },
          update: { role: 'owner' },
          create: { userId: transferToUserId, projectId, role: 'owner' },
        });
      }
    } else if (ownedProjectIds.length > 0) {
      await tx.project.deleteMany({ where: { id: { in: ownedProjectIds } } });
    }

    // Cascades to accounts, sessions, assignments, access requests and comments.
    await tx.user.delete({ where: { id: userId } });
  });

  if (!transferToUserId) {
    await Promise.all(ownedProjectIds.map((id) => cleanupProjectObjects(id)));
  }

  revalidatePath('/admin');
}

export async function getAllUsers() {
  await requireAdmin();

  const [users, ownerLinks, projectSizes] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        disabled: true,
        storageQuota: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { projectLinks: true } },
      },
      orderBy: { name: 'asc' },
    }),
    prisma.projectAssignment.findMany({
      where: { role: 'owner' },
      select: { userId: true, projectId: true },
    }),
    prisma.projectFile.groupBy({
      by: ['projectId'],
      _sum: { size: true },
    }),
  ]);

  // Same rule as the quota service: only projects the user owns count toward their usage.
  const sizeByProject = new Map(projectSizes.map((p) => [p.projectId, p._sum.size ?? 0]));
  const usageByUser = new Map<string, number>();
  const ownedCountByUser = new Map<string, number>();
  for (const { userId, projectId } of ownerLinks) {
    usageByUser.set(userId, (usageByUser.get(userId) ?? 0) + (sizeByProject.get(projectId) ?? 0));
    ownedCountByUser.set(userId, (ownedCountByUser.get(userId) ?? 0) + 1);
  }

  return users.map((u) => ({
    ...u,
    storageUsed: usageByUser.get(u.id) ?? 0,
    ownedProjectCount: ownedCountByUser.get(u.id) ?? 0,
  }));
}

export async function getAdminStats() {
  await requireAdmin();

  const [projectCount, { _sum }] = await Promise.all([
    prisma.project.count(),
    prisma.projectFile.aggregate({ _sum: { size: true } }),
  ]);

  return { projectCount, totalStorage: _sum.size ?? 0 };
}

export async function getUserProjects(userId: string) {
  await requireAdmin();

  const links = await prisma.projectAssignment.findMany({
    where: { userId },
    select: {
      role: true,
      project: { select: { id: true, title: true, isActive: true } },
    },
    orderBy: { project: { title: 'asc' } },
  });

  const sizes = await prisma.projectFile.groupBy({
    by: ['projectId'],
    _sum: { size: true },
    where: { projectId: { in: links.map((l) => l.project.id) } },
  });
  const sizeByProject = new Map(sizes.map((s) => [s.projectId, s._sum.size ?? 0]));

  return links.map((l) => ({
    id: l.project.id,
    title: l.project.title,
    isActive: l.project.isActive,
    role: l.role,
    size: sizeByProject.get(l.project.id) ?? 0,
  }));
}
