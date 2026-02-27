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
    isMain?: boolean,
    children?: { [key: string]: FileNode };
}

const fetchOptions = {
    headers: {
        'Authorization': `Bearer ${process.env.GITHUB_TOKEN}`,
        'User-Agent': 'TISC-Editor-App'
    },
    next: { revalidate: 3600 }
};

/**
 * Retrieves all projects associated with the current user.
 * Includes both owned projects and projects shared with the user.
 * @returns {Promise<Array>} List of projects with an 'isAuthor' flag.
 * @throws {Error} If the user is not authenticated.
 */
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

    return projects.map((project: any) => ({
        ...project,
        isAuthor: project.userId === userId
    }))
}

/**
 * Creates a new project. 
 * Can initialize from a "blank" state or import a template from the Typst package repository.
 * @param {FormData} formData - Contains 'title', 'template' (package ID), and 'entryFile'.
 */
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
            fullPath: "main.typ",
            isMain: true,
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

/**
 * Recursively fetches a directory structure from GitHub and converts it into a local FileNode tree.
 * @param {string} url - GitHub API URL for the directory.
 * @param {string} currentPath - Cumulative path for internal file tracking.
 * @param {string} templateFile - The main entry file to skip during initial recursion.
 * @returns {Promise<Object>} A mapped object of FileNodes.
 */
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

/**
 * Downloads a file from GitHub and encodes it as a Base64 Data URL.
 * Necessary for storing images and binary assets in the JSON file tree.
 * @param {string} url - The raw download URL.
 */
async function getFileContentAsBase64(url: string) {
    const response = await fetch(url, fetchOptions);
    if (!response.ok) return "";

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const base64 = buffer.toString('base64');

    return `data:application/octet-stream;base64,${base64}`;
}

/**
 * Orchestrates the import of a Typst package from GitHub.
 * Fetches the directory structure and the main template file content.
 * @param {string} packageName - The full name/version of the package (e.g., "charged-ieee/0.1.0").
 * @param {string} templateFile - The entry point file name defined in the package.
 * @returns {Promise<Object|null>} An object containing the formatted fileTree or null on failure.
 */
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
            isMain: true,
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

/**
 * Permanently deletes a project from the database.
 * Security: Validates that the requesting user is the actual owner of the project.
 * @param {FormData} formData - Must contain the 'id' of the project to delete.
 */
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

/**
 * Updates the project's file structure and content in the database.
 * Triggers a path revalidation to ensure the dashboard reflects the latest changes.
 * @param {string} projectId - Unique identifier of the project.
 * @param {string} content - (Optional) Text content of the main file.
 * @param {any} fileTree - The complete JSON structure of the project.
 */
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

/**
 * Fetches a project by ID and validates if the current user has access (owner or shared).
 * @param {string} id - The project ID.
 * @returns {Promise<Object|null>} The project data or null if unauthorized/not found.
 */
export async function loadProject(id: string) {
    const session = await auth()
    if (!session?.user?.id) throw new Error("Non autorisé")
    return await getProjectById(id, session.user.id)
}

/**
 * Internal helper to retrieve a project and verify access rights.
 * Checks if the user is either the owner or part of the allowed collaborators.
 * @param {string} projectId - The ID of the project to fetch.
 * @param {string} userId - The ID of the user requesting access.
 * @returns {Promise<Object|null>} The project object if authorized, otherwise null.
 */
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

/**
 * Grants access to a project to another user via their email.
 * Uses a Prisma transaction to update both the project's shared list and the user's project list.
 * @param {string} projectId - Target project.
 * @param {string} sharedUserEmail - Email of the collaborator to add.
 * @throws {Error} If user not found or already has access.
 */
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

/**
 * Revokes a user's access to a project.
 * Only the project owner can perform this action.
 */
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

    const newSharedUsers = project.sharedUsers.filter((id: string) => id !== userToRemove.id);
    const newSharedProjects = userToRemove.sharedProjects.filter((id: string) => id !== projectId);

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

/**
 * Resolves a list of user IDs into their corresponding email addresses.
 * Used for displaying the list of collaborators in the UI.
 * @param {string[]} usersId - Array of unique user identifiers.
 * @returns {Promise<Array>} List of objects containing user IDs and emails.
 */
export async function getUsersEmailFromId(usersId: string[]) {
    return await prisma.user.findMany({
        where: { id: { in: usersId } },
        select: { id: true, email: true }
    });
}

/**
 * Signs the current user out of the application and clears the session.
 */
export async function handleSignOut() {
    await signOut()
}