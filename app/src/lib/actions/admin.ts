import { prisma } from "../prisma";
import { requireAdmin } from "./utils";

export function disableUser(userId: string) {
    requireAdmin();

    return prisma.user.update({
        where: { id: userId },
        data: { disabled: true },
    });
}

export function enableUser(userId: string) {
    requireAdmin();

    return prisma.user.update({
        where: { id: userId },
        data: { disabled: false },
    });
}
