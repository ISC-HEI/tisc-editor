import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    const { id, fileTree } = await req.json();
    
    await prisma.project.update({
        where: { id: id },
        data: { fileTree }
    });

    return NextResponse.json({ success: true });
}