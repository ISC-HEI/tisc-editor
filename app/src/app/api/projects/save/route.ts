import { prisma } from "@/lib/prisma";
import { NextResponse } from "next/server";

/**
 * API Route Handler for persisting the project's file tree.
 * Updates the 'fileTree' JSON field in the database for a specific project.
 * * @param {Request} req - The incoming Next.js Request object containing the project ID and the updated file tree.
 * @returns {Promise<NextResponse>} A JSON response indicating the success of the update operation.
 */
export async function POST(req: Request) {
    const { id, fileTree } = await req.json();
    
    await prisma.project.update({
        where: { id: id },
        data: { fileTree }
    });

    return NextResponse.json({ success: true });
}