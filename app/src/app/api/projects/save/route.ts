import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";
import { checkUserQuota } from "@/lib/quota-service";

export async function POST(req: Request) {
    const session = await auth();

    if (!session?.user?.id) {
        return new NextResponse("Pas de session", { status: 401 });
    }

    try {
        const { id, fileTree } = await req.json();
        
        const dataSize = JSON.stringify(fileTree).length;
     
        const quota = await checkUserQuota(session.user.id, dataSize);

        if (!quota.allowed) {
            return new NextResponse(
                `Quota dépassé (${(quota.usage / 1024 / 1024).toFixed(2)}MB / ${(quota.limit / 1024 / 1024).toFixed(2)}MB)`,
                { status: 403 }
            );
        }

        await prisma.project.update({
            where: { id: id },
            data: { fileTree }
        });

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Erreur lors de la sauvegarde :", error);
        return NextResponse.json({ error: "Erreur serveur" }, { status: 500 });
    }
}