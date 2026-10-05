import { prisma } from "../prisma";
import { requireAdmin, requireUser } from "./utils";

export async function disableUser(userId: string) {
    requireAdmin();
    await requireUser(userId);

    return prisma.user.update({
        where: { id: userId },
        data: { disabled: true },
    });
}

export async function enableUser(userId: string) {
    requireAdmin();
    await requireUser(userId);

    return prisma.user.update({
        where: { id: userId },
        data: { disabled: false },
    });
}

export async function updateUserQuota(userId: string, quota: number) {
    requireAdmin();
    await requireUser(userId);

    return prisma.user.update({
        where: { id: userId },
        data: { storageQuota: quota },
    });
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
