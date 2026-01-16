'use server'

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
const { randomBytes } = require('node:crypto');

export async function getUserProjects() {
    const session = await auth()
    if (!session?.user?.id) throw new Error("No authorization")

    return await prisma.project.findMany({
        where: { userId: parseInt(session.user.id) },
        orderBy: { id: 'desc' }
    })
}

export async function createProject(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("No authorization")

    const title = formData.get("title") as string
    if (!title) return

    await prisma.project.create({
        data: {
            title: title,
            userId: parseInt(session.user.id),
            fileTree: {},
        }
    })

    revalidatePath("/")
}

export async function deleteProject(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("No authorization")

    const projectId = formData.get("id") as string
    
    if (!projectId) return

    await prisma.project.delete({
        where: {
            id: parseInt(projectId),
            userId: parseInt(session.user.id)
        }
    })

    revalidatePath("/")
}

export async function saveProjectData(projectId: number, content: string, fileTree: any) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Non autorisé")

    await prisma.project.update({
        where: { 
            id: projectId,
            userId: parseInt(session.user.id) 
        },
        data: {
            content: content,
            fileTree: fileTree
        }
    })
    revalidatePath("/")
}
                    
export async function loadProject(id: number) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Non autorisé")

    const project = await getProjectById(id, parseInt(session.user.id))
    return project
}

async function getProjectById(projectId: number, userId: number) {
    const project = await prisma.project.findUnique({
        where: { id: projectId }
    })

    if (!project) return null;

    if (project.userId === userId) {
        return project;
    }
    if (project.sharedUsers.includes(userId)) {
        return project;
    }
    

    return null;
}

export async function shareProject(projectId: number, sharedUserEmail: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Non autorisé");

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { sharedUsers: true, userId: true }
    });

    if (!project) throw new Error("Projet introuvable");
    
    const sharedUser = await prisma.user.findUnique({ where: { email: sharedUserEmail } });
    if (!sharedUser) throw new Error("This user didn't exist.");

    if (project.sharedUsers.includes(sharedUser.id) || project.userId === sharedUser.id) {
        throw new Error("This user already have access to this project.");
    }

    const [updatedProject, updatedUser] = await prisma.$transaction([
        prisma.project.update({
            where: { id: projectId },
            data: { sharedUsers: { push: sharedUser.id } }
        }),
        prisma.user.update({
            where: { id: sharedUser.id },
            data: { sharedProjects: { push: projectId } }
        })
    ]);

    revalidatePath("/dashboard"); 
    return updatedUser;
}

export async function getUsersEmailFromId(usersId: number[]) {
    const users = await prisma.user.findMany({
        where: {
            id: {
                in: usersId
            }
        },
        select: {
            id: true,
            email: true
        }
    });

    return users;
}