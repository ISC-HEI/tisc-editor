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
            const user = await tx.user.findUnique({
                where: { id: session.user.id },
                include: { projectLinks: { include: { project: true } } }
            });

            if (!user) throw new Error("User not found");

            const ownedLinks = user.projectLinks.filter(link => link.role === "owner");

            const currentProject = ownedLinks.find(link => link.project.id === id)?.project;
            const previousSize = currentProject
                ? Buffer.byteLength(JSON.stringify(currentProject.fileTree), 'utf8')
                : 0;

            const otherProjectsUsage = ownedLinks.reduce((acc, link) => {
                if (link.project.id === id) return acc;
                return acc + Buffer.byteLength(JSON.stringify(link.project.fileTree), 'utf8');
            }, 0);

            const totalAttempted = otherProjectsUsage + dataSize;
            const isGrowing = dataSize > previousSize;

            if (isGrowing && totalAttempted > user.storageQuota) {
                return {
                    allowed: false,
                    usage: otherProjectsUsage + previousSize,
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