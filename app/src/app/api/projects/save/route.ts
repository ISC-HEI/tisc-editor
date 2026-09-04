import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return new NextResponse("No session", { status: 401 });
    }

    try {
        const { id, fileTree } = await req.json();
        const dataSize = JSON.stringify(fileTree).length;

        const result = await prisma.$transaction(async (tx) => {
            await tx.$executeRaw`SELECT id FROM "users" WHERE id = ${session.user.id} FOR UPDATE`;

            const user = await tx.user.findUnique({
                where: { id: session.user.id },
                include: { projectLinks: { include: { project: true } } }
            });

            if (!user) throw new Error("User not found");

            const currentUsage = user.projectLinks.reduce((acc: number, link) => {
                if (link.project.id === id) return acc;
                return acc + JSON.stringify(link.project.fileTree).length;
            }, 0);

            const totalAttempted = currentUsage + dataSize;

            if (totalAttempted > user.storageQuota) {
                return {
                    allowed: false,
                    usage: currentUsage,
                    limit: user.storageQuota
                };
            }

            await tx.project.update({
                where: { id },
                data: { fileTree }
            });

            return { allowed: true };
        });

        if (!result.allowed) {
            return new NextResponse(
                `Quota exceeded (${(result.usage! / 1024 / 1024).toFixed(2)}MB / ${(result.limit! / 1024 / 1024).toFixed(2)}MB)`,
                { status: 403 }
            );
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur lors de la sauvegarde :", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}