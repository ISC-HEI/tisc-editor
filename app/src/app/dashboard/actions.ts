'use server'

import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"

interface FileNode {
    type: 'file' | 'folder';
    name: string;
    fullPath?: string;
    data?: string;
    content?: string;
    children?: { [key: string]: FileNode };
}

const fetchOptions = {
    headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'TISC-Editor-App'
    },
    next: { revalidate: 3600 }
};

export async function getUserProjects() {
    const session = await auth()
    if (!session?.user?.id) throw new Error("No authorization")

    const userId = session.user.id

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: { sharedProjects: true }
    })
    const sharedIds = user?.sharedProjects || []

    const projects = await prisma.project.findMany({
        where: {
            OR: [
                { userId: userId },
                { id: { in: sharedIds } }
            ]
        },
        orderBy: { id: 'desc' }
    })

    return projects.map(project => ({
        ...project,
        isAuthor: project.userId === userId
    }))
}

export async function createProject(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("No authorization")

    const title = formData.get("title") as string
    const packageId = formData.get("template") as string
    const entryFile = formData.get("entryFile") as string

    if (!title || !packageId) return

    let projectData = { 
        fileTree: {
            type: "folder" as const,
            name: "root",
            children: {} as Record<string, FileNode>
        }
    };

    if (packageId !== "blank") {
        const imported = await importPackageAsTree(packageId, entryFile);
        if (imported) {
            projectData.fileTree = imported.fileTree as any;
        }
    } else {
        projectData.fileTree.children["main.typ"] = {
            type: 'file',
            name: "main.typ",
            fullPath: "root/main.typ",
            data: ""
        };
    }

    await prisma.project.create({
        data: {
            title: title,
            userId: session.user.id,
            fileTree: projectData.fileTree as any,
        }
    })

    revalidatePath("/")
}

const buildTreeFromGitHub = async (url: string, currentPath: string = "", templateFile = ""): Promise<{ [key: string]: FileNode }> => {
    const response = await fetch(url, fetchOptions);
    if (response.status === 403) throw new Error("GitHub API Rate limit exceeded.");

    const items = await response.json();
    if (!Array.isArray(items)) return {};

    const children: { [key: string]: FileNode } = {};

    for (const item of items) {
        if (item.name.startsWith('.') || item.name.endsWith('.md') || item.name === "LICENSE" || item.name === templateFile) {
            continue;
        }

        const newPath = currentPath === "" ? `${item.name}` : `${currentPath}/${item.name}`;

        if (item.type === 'dir') {
            children[item.name] = {
                type: 'folder',
                name: item.name,
                children: await buildTreeFromGitHub(item.url, newPath, templateFile)
            };
        } else {
            children[item.name] = {
                type: 'file',
                name: item.name,
                fullPath: newPath,
                data: await getFileContentAsBase64(item.download_url)
            };
        }
    }
    return children;
};

async function getFileContentAsBase64(url: string) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) return "";

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    return `data:application/octet-stream;base64,${base64}`;
}

export const importPackageAsTree = async (packageName: string, templateFile: string) => {
    const url = `https://api.github.com/repos/typst/packages/contents/packages/preview/${packageName}`;

    try {
        const treeData = await buildTreeFromGitHub(url, "", templateFile);

        const response = await fetch(`https://raw.githubusercontent.com/typst/packages/main/packages/preview/${packageName}/${templateFile}`, fetchOptions);
        const content = await response.text();
        
        const mainFileName = "main.typ";

        treeData[mainFileName] = {
            type: 'file',
            name: mainFileName,
            fullPath: mainFileName,
            data: content.replace(/\0/g, '')
        };

        return {
            fileTree: {
                type: "folder",
                name: "root",
                children: treeData
            }
        };
    } catch (error) {
        console.error(error);
        return null;
    }
};

export async function deleteProject(formData: FormData) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("No authorization")

    const projectId = formData.get("id") as string

    if (!projectId) return

    await prisma.project.delete({
        where: {
            id: projectId,
            userId: session.user.id
        }
    })

    revalidatePath("/")
}

export async function saveProjectData(projectId: string, content: string, fileTree: any) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Non autorisé")

    await prisma.project.update({
        where: {
            id: projectId,
            userId: session.user.id
        },
        data: {
            fileTree: fileTree
        }
    })
    revalidatePath("/")
}

export async function loadProject(id: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Non autorisé")
    return await getProjectById(id, session.user.id)
}

async function getProjectById(projectId: string, userId: string) {
    const project = await prisma.project.findUnique({
        where: { id: projectId }
    })

    if (!project) return null;

    if (project.userId === userId || project.sharedUsers.includes(userId)) {
        return project;
    }

    return null;
}

export async function shareProject(projectId: string, sharedUserEmail: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Non autorisé");

    const project = await prisma.project.findUnique({
        where: { id: projectId },
        select: { sharedUsers: true, userId: true }
    });

    if (!project) throw new Error("Projet introuvable");

    const sharedUser = await prisma.user.findUnique({ where: { email: sharedUserEmail } });
    if (!sharedUser) throw new Error("User not found");

    if (project.sharedUsers.includes(sharedUser.id) || project.userId === sharedUser.id) {
        throw new Error("User already has access");
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

export async function removeSharedUser(projectId: string, sharedUserEmail: string) {
    const session = await auth();
    if (!session?.user?.id) throw new Error("Unauthorized");

    const [project, userToRemove] = await Promise.all([
        prisma.project.findUnique({
            where: { id: projectId },
            select: { userId: true, sharedUsers: true }
        }),
        prisma.user.findUnique({
            where: { email: sharedUserEmail },
            select: { id: true, sharedProjects: true }
        })
    ]);

    if (!project || !userToRemove) throw new Error("Not found");

    if (project.userId !== session.user.id) {
        throw new Error("Only owner can remove");
    }

    const newSharedUsers = project.sharedUsers.filter(id => id !== userToRemove.id);
    const newSharedProjects = userToRemove.sharedProjects.filter(id => id !== projectId);

    await prisma.$transaction([
        prisma.project.update({
            where: { id: projectId },
            data: { sharedUsers: newSharedUsers }
        }),
        prisma.user.update({
            where: { id: userToRemove.id },
            data: { sharedProjects: newSharedProjects }
        })
    ]);

    revalidatePath("/dashboard");
    return { success: true };
}

export async function getUsersEmailFromId(usersId: string[]) {
    return await prisma.user.findMany({
        where: { id: { in: usersId } },
        select: { id: true, email: true }
    });
}

export async function handleSignOut() {
    await signOut()
}