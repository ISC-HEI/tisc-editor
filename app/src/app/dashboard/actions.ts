'use server'

import { auth, signOut } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { revalidatePath } from "next/cache"
import { checkUserQuota, calcFileTreeSize } from "@/lib/quota-service";

interface FileNode {
    type: 'file' | 'folder';
    name: string;
    fullPath?: string;
    data?: string;
    content?: string;
    isMain?: boolean;
    children?: { [key: string]: FileNode };
}

function getFetchOptions(useAuth = true) {
    const headers: Record<string, string> = {
        'User-Agent': 'TISC-Editor-App'
    };

    if (useAuth && process.env.GITHUB_TOKEN) {
        headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
    }

    return {
        headers,
        next: { revalidate: 86400 }
    };
}

async function fetchGitHub(url: string) {
    const authResponse = await fetch(url, getFetchOptions(true));
    if (
        process.env.GITHUB_TOKEN &&
        (authResponse.status === 401 ||
            (authResponse.status === 404 && url.includes("raw.githubusercontent.com")))
    ) {
        console.warn(`GitHub token invalid or blocked, retrying without auth for ${url}`);
        return await fetch(url, getFetchOptions(false));
    }
    return authResponse;
}



export async function getUserProjects() {

    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("No authorization")
    }

    const userId = session.user.id

    const assignments = await prisma.projectAssignment.findMany({
        where: {
            userId
        },
        include: {
            project: {
                include: {
                    userLinks: true,
                    tags: {
                        include: {
                            tag: true
                        }
                    }
                }
            }
        },
        orderBy: {
            project: {
                id: 'desc'
            }
        }
    })

    return assignments.map((a: { project: any; role: string; }) => ({
        ...a.project,
        isAuthor: a.role === 'owner',
        role: a.role,

        tags: a.project.tags.map(
            (projectTag: any) => projectTag.tag
        ),

        usersSharing: a.project.userLinks
            .filter((link: any) => link.userId !== userId)
            .map((link: any) => link.userId)
    }))
}

export async function getProjectAssignmentRole(projectId: string) {
    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const assignment = await prisma.projectAssignment.findUnique({
        where: {
            userId_projectId: {
                userId: session.user.id,
                projectId
            }
        }
    })

    return assignment?.role ?? null
}


export async function createProject(formData: FormData) {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("No authorization");
    }

    const userId = session.user.id;

    const title = formData.get("title") as string;
    const packageBase = formData.get("packageBase") as string;
    const packageSubPath = formData.get("packageSubPath") as string;
    const entryFile = formData.get("entryFile") as string;

    const tags = formData
        .getAll("tags")
        .map((tag) => String(tag).trim().toLowerCase())
        .filter(Boolean);

    const uniqueTags = [...new Set(tags)];

    if (!title || !packageBase) {
        throw new Error("Missing project information");
    }

    if (uniqueTags.length > 10) {
        throw new Error("Maximum 10 tags allowed");
    }

    if (uniqueTags.some((tag) => tag.length > 50)) {
        throw new Error("Tags must be 50 characters or fewer");
    }

    let projectData = {
        fileTree: {
            type: "folder" as const,
            name: "root",
            children: {} as Record<string, FileNode>
        }
    };

    if (packageBase !== "blank") {
        const latestVersion = await getLatestVersion(packageBase);

        const packageId = `${packageBase}/${latestVersion}${
            packageSubPath ? `/${packageSubPath}` : ""
        }`;

        const imported = await importPackageAsTree(
            packageId,
            entryFile
        );

        if (imported) {
            projectData.fileTree = imported.fileTree as any;
        } else {
            throw new Error("Template import failed.");
        }
    } else {
        projectData.fileTree.children["main.typ"] = {
            type: "file",
            name: "main.typ",
            fullPath: "main.typ",
            isMain: true,
            data: ""
        };
    }

    const dataSize = Buffer.byteLength(
        JSON.stringify(projectData.fileTree),
        "utf8"
    );

    const quota = await checkUserQuota(
        userId,
        dataSize
    );

    if (!quota.allowed) {
        throw new Error(
            `Quota exceeded (${(
                quota.usage /
                1024 /
                1024
            ).toFixed(2)}MB / ${(
                quota.limit! /
                1024 /
                1024
            ).toFixed(2)}MB). Cannot create project.`
        );
    }

    const project = await prisma.$transaction(async (tx) => {
        const project = await tx.project.create({
            data: {
                title,
                fileTree: projectData.fileTree as any,

                userLinks: {
                    create: {
                        user: {
                            connect: {
                                id: userId
                            }
                        },
                        role: "owner"
                    }
                }
            }
        });

        for (const tagName of uniqueTags) {
            const tagRecord = await tx.tag.upsert({
                where: {
                    name: tagName
                },
                update: {},
                create: {
                    name: tagName
                }
            });

            await tx.projectTag.create({
                data: {
                    projectId: project.id,
                    tagId: tagRecord.id
                }
            });
        }

        return project;
    });

    revalidatePath("/dashboard");

    return project;
}

export const addTagToProject = async (
    projectId: string,
    tag: string
) => {
    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    if (!projectId || !tag?.trim()) {
        throw new Error("Missing project id or tag")
    }

    const tagName = tag.trim()

    const assignment = await prisma.projectAssignment.findUnique({
        where: {
            userId_projectId: {
                userId,
                projectId
            }
        }
    })

    if (!assignment) {
        throw new Error("Access denied")
    }

    const tagRecord = await prisma.tag.upsert({
        where: {
            name: tagName
        },
        update: {},
        create: {
            name: tagName
        }
    })

    await prisma.projectTag.upsert({
        where: {
            projectId_tagId: {
                projectId,
                tagId: tagRecord.id
            }
        },
        update: {},
        create: {
            projectId,
            tagId: tagRecord.id
        }
    })

    revalidatePath("/dashboard")

    return {
        success: true,
        tag: tagRecord
    }
}


export const removeTagFromProject = async (
    projectId: string,
    tag: string
) => {
    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    if (!projectId || !tag?.trim()) {
        throw new Error("Missing project id or tag")
    }

    const tagName = tag.trim()

    const assignment = await prisma.projectAssignment.findUnique({
        where: {
            userId_projectId: {
                userId,
                projectId
            }
        }
    })

    if (!assignment) {
        throw new Error("Access denied")
    }

    const tagRecord = await prisma.tag.findUnique({
        where: {
            name: tagName
        }
    })

    if (!tagRecord) {
        return {
            success: true
        }
    }

    await prisma.projectTag.deleteMany({
        where: {
            projectId,
            tagId: tagRecord.id
        }
    })

    const remainingProjects = await prisma.projectTag.count({
        where: {
            tagId: tagRecord.id
        }
    })

    if (remainingProjects === 0) {
        await prisma.tag.delete({
            where: {
                id: tagRecord.id
            }
        })
    }

    revalidatePath("/dashboard")

    return {
        success: true
    }
}


export const getTagsByUser = async () => {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    return prisma.tag.findMany({
        where: {
            projects: {
                some: {
                    project: {
                        userLinks: {
                            some: {
                                userId,
                            },
                        },
                    },
                },
            },
        },
        orderBy: {
            name: "asc",
        },
        select: {
            id: true,
            name: true,
        },
    });
};

export const getProjectTags = async (projectId: string) => {
    const session = await auth();

    if (!session?.user?.id) {
        throw new Error("Unauthorized");
    }

    const userId = session.user.id;

    const assignment = await prisma.projectAssignment.findUnique({
        where: {
            userId_projectId: {
                userId,
                projectId
            }
        }
    });

    if (!assignment) {
        throw new Error("Access denied");
    }

    const projectTags = await prisma.projectTag.findMany({
        where: {
            projectId
        },
        include: {
            tag: {
                select: {
                    id: true,
                    name: true
                }
            }
        },
        orderBy: {
            tag: {
                name: "asc"
            }
        }
    });

    const availableTags = await prisma.tag.findMany({
        orderBy: {
            name: "asc"
        },
        select: {
            id: true,
            name: true
        }
    });

    return {
        projectTags: projectTags.map((item) => item.tag),
        availableTags
    };
};

export async function getUserStorage() {

    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    const user = await prisma.user.findUnique({
        where: {
            id: userId
        },
        select: {
            storageQuota: true,
            projectLinks: {
                include: {
                    project: {
                        select: {
                            fileTree: true
                        }
                    }
                }
            }
        }
    })

    if (!user) {
        return null
    }

    const ownedLinks = user.projectLinks.filter((link: any) => link.role === "owner")

    const usage = ownedLinks.reduce((acc: number, link: { project: { fileTree: any } }) => {
        return acc + calcFileTreeSize(link.project.fileTree)
    }, 0)

    return {
        usage,
        limit: user.storageQuota,
        percentage: (usage / user.storageQuota) * 100
    }
}

const buildTreeFromGitHub = async (
    url: string,
    currentPath: string = "",
    templateFile = ""
): Promise<{ [key: string]: FileNode }> => {

    const response = await fetchGitHub(url)

    if (!response.ok) {
        if (response.status === 403) {
            throw new Error("GitHub API rate limit exceeded.");
        }
        throw new Error(`GitHub API error ${response.status} ${response.statusText}`);
    }

    const items = await response.json()

    if (!Array.isArray(items)) {
        return {}
    }

    const children: { [key: string]: FileNode } = {}

    for (const item of items) {

        const newPath =
            currentPath === ""
                ? `${item.name}`
                : `${currentPath}/${item.name}`

        if (
            item.name.startsWith('.') ||
            item.name.endsWith('.md') ||
            item.name === "LICENSE" ||
            newPath === templateFile
        ) {
            continue
        }

        if (item.type === 'dir') {
            children[item.name] = {
                type: 'folder',
                name: item.name,
                children: await buildTreeFromGitHub(
                    item.url,
                    newPath,
                    templateFile
                )
            }
        } else {
            children[item.name] = {
                type: 'file',
                name: item.name,
                fullPath: newPath,
                data: await getFileContentAsBase64(
                    item.download_url
                )
            }
        }
    }

    return children
}


async function getFileContentAsBase64(url: string) {

    const response = await fetchGitHub(url)

    if (!response.ok) {
        throw new Error(`Unable to download file from GitHub: ${response.status} ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();

    const buffer = Buffer.from(arrayBuffer)

    const base64 = buffer.toString('base64')

    return `data:application/octet-stream;base64,${base64}`
}

async function getLatestVersion(packageBaseName: string): Promise<string> {
    const url = `https://api.github.com/repos/typst/packages/contents/packages/preview/${encodeURIComponent(packageBaseName)}`

    const response = await fetchGitHub(url)

    if (!response.ok) {
        throw new Error(`Unable to list versions for ${packageBaseName}: ${response.status} ${response.statusText}`)
    }

    const items = await response.json()

    if (!Array.isArray(items)) {
        throw new Error(`No versions found for ${packageBaseName}`)
    }

    const versions = items
        .filter((item: any) => item.type === "dir")
        .map((item: any) => item.name as string)
        .filter((name: string) => /^\d+\.\d+\.\d+$/.test(name))

    if (versions.length === 0) {
        throw new Error(`No valid semver versions found for ${packageBaseName}`)
    }

    versions.sort((a: string, b: string) => {
        const pa = a.split('.').map(Number)
        const pb = b.split('.').map(Number)
        for (let i = 0; i < 3; i++) {
            if (pa[i] !== pb[i]) return pb[i] - pa[i]
        }
        return 0
    })

    return versions[0]
}

export const importPackageAsTree = async (
    packageName: string,
    templateFile: string
) => {

    if (!packageName || !templateFile) {
        throw new Error("Invalid package name or template file.");
    }

    const safePackageName = packageName.split('/').map(encodeURIComponent).join('/');
    const safeTemplateFile = encodeURIComponent(templateFile);

    const url =
        `https://api.github.com/repos/typst/packages/contents/packages/preview/${safePackageName}`

    try {

        const treeData = await buildTreeFromGitHub(
            url,
            "",
            templateFile
        )

        const rawUrl = `https://raw.githubusercontent.com/typst/packages/main/packages/preview/${safePackageName}/${safeTemplateFile}`;
        const response = await fetchGitHub(rawUrl)

        if (!response.ok) {
            throw new Error(`Unable to download template "${templateFile}" from GitHub: ${response.status} ${response.statusText} (${rawUrl})`)
        }

        const content = await response.text()

        const mainFileName = "main.typ"

        treeData[mainFileName] = {
            type: 'file',
            name: mainFileName,
            fullPath: mainFileName,
            isMain: true,
            data: content.replace(/\0/g, '')
        }

        return {
            fileTree: {
                type: "folder",
                name: "root",
                children: treeData
            }
        }

    } catch (error) {

        console.error("Template import error:", error)

        throw new Error(`Template import failed: ${error instanceof Error ? error.message : String(error)}`)
    }
}


export async function deleteProject(formData: FormData) {

    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    const projectId = formData.get("id") as string

    if (!projectId) {
        throw new Error("Missing project id")
    }

    return await prisma.$transaction(async (tx: { projectAssignment: { findUnique: (arg0: { where: { userId_projectId: { userId: string; projectId: string; }; }; }) => any; delete: (arg0: { where: { userId_projectId: { userId: string; projectId: string; }; }; }) => any; }; project: { delete: (arg0: { where: { id: string; }; }) => any; }; }) => {

        const assignment =
            await tx.projectAssignment.findUnique({
                where: {
                    userId_projectId: {
                        userId,
                        projectId
                    }
                }
            })

        if (!assignment) {
            throw new Error("Unauthorized")
        }

        if (assignment.role !== "owner") {
            throw new Error("Only project owners can delete the project")
        }

        await tx.project.delete({
            where: {
                id: projectId
            }
        })

        revalidatePath("/dashboard")

        return {
            action: "deleted"
        }
    })
}


export async function leaveProject(formData: FormData) {
    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id
    const projectId = formData.get("id") as string

    if (!projectId) {
        throw new Error("Missing project id")
    }

    const assignment = await prisma.projectAssignment.findUnique({
        where: {
            userId_projectId: {
                userId,
                projectId
            }
        }
    })

    if (!assignment) {
        throw new Error("Unauthorized")
    }

    const membersCount = await prisma.projectAssignment.count({
        where: {
            projectId
        }
    })

    if (assignment.role === "owner") {
        if (membersCount === 1) {
            await prisma.project.delete({
                where: {
                    id: projectId
                }
            })

            revalidatePath("/dashboard")

            return {
                action: "deleted"
            }
        }

        throw new Error("Vous devez transférer la propriété à un autre membre avant de quitter le projet.")
    }

    await prisma.projectAssignment.delete({
        where: {
            userId_projectId: {
                userId,
                projectId
            }
        }
    })

    revalidatePath("/dashboard")

    return {
        action: "left"
    }
}


export async function saveProjectData(
    projectId: string,
    content: string,
    fileTree: any
) {

    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    const assignment =
        await prisma.projectAssignment.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId
                }
            }
        })

    if (!assignment) {
        throw new Error("Access denied")
    }

    await prisma.project.update({
        where: {
            id: projectId
        },
        data: {
            fileTree
        }
    })

    revalidatePath("/dashboard")
}


export async function loadProject(id: string) {

    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    return await getProjectById(id, userId)
}


async function getProjectById(
    projectId: string,
    userId: string
) {

    const assignment =
        await prisma.projectAssignment.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId
                }
            },
            include: {
                project: true
            }
        })

    if (!assignment) {
        return null
    }

    return assignment.project
}


export async function shareProject(
    projectId: string,
    sharedUserEmail: string
) {

    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    const ownerCheck =
        await prisma.projectAssignment.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId
                }
            }
        })

    if (ownerCheck?.role !== "owner") {
        throw new Error("Only owner can share")
    }

    const sharedUser =
        await prisma.user.findUnique({
            where: {
                email: sharedUserEmail
            }
        })

    if (!sharedUser) {
        return {
            error: "Utilisateur non trouvé"
        }
    }


    if (sharedUser.id === userId) {
        return {
            error: "Vous avez déjà accès à ce projet"
        }
    }

    // Vérifier si déjà partagé
    const existing =
        await prisma.projectAssignment.findUnique({
            where: {
                userId_projectId: {
                    userId: sharedUser.id,
                    projectId
                }
            }
        })

    if (existing) {
        return {
            error: "L'utilisateur a déjà accès"
        }
    }


    await prisma.projectAssignment.create({
        data: {
            userId: sharedUser.id,
            projectId,
            role: "editor"
        }
    })

    revalidatePath("/dashboard")

    return {
        success: true
    }
}


export async function transferProjectOwnership(
    projectId: string,
    newOwnerEmail: string
) {
    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    if (!projectId || !newOwnerEmail) {
        throw new Error("Missing project id or new owner email")
    }

    const currentOwner =
        await prisma.projectAssignment.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId
                }
            }
        })

    if (!currentOwner || currentOwner.role !== "owner") {
        throw new Error("Only the owner can transfer ownership")
    }

    const newOwner =
        await prisma.user.findUnique({
            where: {
                email: newOwnerEmail
            }
        })

    if (!newOwner) {
        throw new Error("Utilisateur introuvable")
    }

    const newOwnerAssignment =
        await prisma.projectAssignment.findUnique({
            where: {
                userId_projectId: {
                    userId: newOwner.id,
                    projectId
                }
            }
        })

    if (!newOwnerAssignment) {
        throw new Error("L'utilisateur n'a pas accès à ce projet")
    }

    await prisma.$transaction([
        prisma.projectAssignment.update({
            where: {
                userId_projectId: {
                    userId: newOwner.id,
                    projectId
                }
            },
            data: {
                role: "owner"
            }
        }),
        prisma.projectAssignment.update({
            where: {
                userId_projectId: {
                    userId,
                    projectId
                }
            },
            data: {
                role: "editor"
            }
        })
    ])

    revalidatePath("/dashboard")

    return {
        success: true
    }
}


export async function removeSharedUser(
    projectId: string,
    sharedUserEmail: string
) {

    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    const ownerAssignment =
        await prisma.projectAssignment.findUnique({
            where: {
                userId_projectId: {
                    userId,
                    projectId
                }
            }
        })

    if (ownerAssignment?.role !== "owner") {
        throw new Error("Only owner can remove users")
    }

    const userToRemove =
        await prisma.user.findUnique({
            where: {
                email: sharedUserEmail
            }
        })

    if (!userToRemove) {
        throw new Error("User not found")
    }

    if (userToRemove.id === userId) {
        throw new Error("Owner cannot remove themselves")
    }

    await prisma.projectAssignment.delete({
        where: {
            userId_projectId: {
                userId: userToRemove.id,
                projectId
            }
        }
    })

    revalidatePath("/dashboard")

    return {
        success: true
    }
}


export async function getProjectUsers(projectId: string) {

    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const users =
        await prisma.projectAssignment.findMany({
            where: {
                projectId
            },
            include: {
                user: {
                    select: {
                        id: true,
                        email: true
                    }
                }
            }
        })

    return users.map((u: { user: { id: any; email: any; }; role: any; }) => ({
        id: u.user.id,
        email: u.user.email,
        role: u.role
    }))
}


export async function getUsersEmailFromId(usersId: string[]) {

    return await prisma.user.findMany({
        where: {
            id: {
                in: usersId
            }
        },
        select: {
            id: true,
            email: true
        }
    })
}


export async function getProjectMembers(projectId: string) {
    const session = await auth()

    if (!session?.user?.id) {
        throw new Error("Unauthorized")
    }

    const userId = session.user.id

    const members = await prisma.projectAssignment.findMany({
        where: {
            projectId,
            userId: { not: userId }
        },
        include: {
            user: { select: { id: true, email: true } }
        }
    })

    return members.map((m: { user: { id: any; email: any }; role: any }) => ({
        id: m.user.id,
        email: m.user.email,
        role: m.role
    }))
}


export async function handleSignOut() {
    await signOut()
}