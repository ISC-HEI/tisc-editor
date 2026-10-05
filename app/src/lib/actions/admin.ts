"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "../prisma";
import { requireAdmin, requireUser } from "./utils";

export async function setUserDisabled(userId: string, disabled: boolean) {
  const admin = await requireAdmin();
  await requireUser(userId);

  if (admin?.id === userId) {
    throw new Error("You can't disable your own account");
  }

  await prisma.user.update({ where: { id: userId }, data: { disabled } });
  revalidatePath("/admin");
}

export async function updateUserQuota(userId: string, quota: number) {
  const MAX_INT = 2_147_483_647;

  await requireAdmin();
  await requireUser(userId);
  if (!Number.isFinite(quota) || quota < 0 || quota > MAX_INT) {
    throw new Error("Invalid quota");
  }

  await prisma.user.update({ where: { id: userId }, data: { storageQuota: quota } });
  revalidatePath("/admin");
}

export async function getAllUsers() {
    requireAdmin();

    return prisma.user.findMany({
        select: {
            id: true,
            name: true,
            email: true,
            disabled: true,
            storageQuota: true,
            createdAt: true,
        },
    });
}
