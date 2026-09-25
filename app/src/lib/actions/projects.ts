'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { checkUserQuota } from '@/lib/quota-service';
import { Prisma } from '@prisma/client';
import { FileNode } from '@/types/filetree';
import { getLatestVersion, importPackageAsTree } from './github-import';

export async function getUserProjects() {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('No authorization');
  }

  const userId = session.user.id;

  const assignments = await prisma.projectAssignment.findMany({
    where: {
      userId,
    },
    include: {
      project: {
        select: {
          id: true,
          title: true,
          isActive: true,
          userLinks: {
            select: {
              userId: true,
              role: true,
              user: {
                select: {
                  name: true,
                },
              },
            },
          },
          tags: {
            include: {
              tag: true,
            },
          },
          thumbnail: {
            select: { projectId: true },
          },
        },
      },
    },
    orderBy: {
      project: {
        id: 'desc',
      },
    },
  });

  type AssignmentWithProject = (typeof assignments)[number];
  type ProjectTagWithTag = AssignmentWithProject['project']['tags'][number];
  type UserLinkEntry = AssignmentWithProject['project']['userLinks'][number];

  return assignments.map((a: AssignmentWithProject) => {
    const { thumbnail, ...project } = a.project;

    const ownerLink = a.project.userLinks.find((link: UserLinkEntry) => link.role === 'owner');

    return {
      ...project,
      isAuthor: a.role === 'owner',
      role: a.role,
      hasThumbnail: !!thumbnail,
      ownerName: ownerLink?.user?.name ?? null,

      tags: a.project.tags.map((projectTag: ProjectTagWithTag) => projectTag.tag),
      usersSharing: a.project.userLinks
        .filter((link: UserLinkEntry) => link.userId !== userId)
        .map((link: UserLinkEntry) => link.userId),
    };
  });
}

export async function getProjectAssignmentRole(projectId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId: session.user.id,
        projectId,
      },
    },
  });

  return assignment?.role ?? null;
}

export async function createProject(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('No authorization');
  }

  const userId = session.user.id;

  const title = formData.get('title') as string;
  const packageBase = formData.get('packageBase') as string;
  const packageSubPath = formData.get('packageSubPath') as string;
  const entryFile = formData.get('entryFile') as string;

  const tags = formData
    .getAll('tags')
    .map((tag) => String(tag).trim().toLowerCase())
    .filter(Boolean);

  const uniqueTags = [...new Set(tags)];

  if (!title || !packageBase) {
    throw new Error('Missing project information');
  }

  if (uniqueTags.length > 10) {
    throw new Error('Maximum 10 tags allowed');
  }

  if (uniqueTags.some((tag) => tag.length > 50)) {
    throw new Error('Tags must be 50 characters or fewer');
  }

  const projectData = {
    fileTree: {
      type: 'folder' as const,
      name: 'root',
      children: {} as Record<string, FileNode>,
    },
  };

  if (packageBase !== 'blank') {
    const latestVersion = await getLatestVersion(packageBase);

    const packageId = `${packageBase}/${latestVersion}${
      packageSubPath ? `/${packageSubPath}` : ''
    }`;

    const imported = await importPackageAsTree(packageId, entryFile);

    if (imported) {
      projectData.fileTree = imported.fileTree;
    } else {
      throw new Error('Template import failed.');
    }
  } else {
    projectData.fileTree.children['main.typ'] = {
      type: 'file',
      name: 'main.typ',
      fullPath: 'main.typ',
      isMain: true,
      data: '',
    };
  }

  const dataSize = Buffer.byteLength(JSON.stringify(projectData.fileTree), 'utf8');

  const quota = await checkUserQuota(userId, dataSize);

  if (!quota.allowed) {
    throw new Error(
      `Quota exceeded (${(quota.usage / 1024 / 1024).toFixed(2)}MB / ${(
        quota.limit! /
        1024 /
        1024
      ).toFixed(2)}MB). Cannot create project.`,
    );
  }

  const project = await prisma.$transaction(async (tx) => {
    const project = await tx.project.create({
      data: {
        title,
        fileTree: projectData.fileTree as unknown as Prisma.InputJsonValue,

        userLinks: {
          create: {
            user: {
              connect: {
                id: userId,
              },
            },
            role: 'owner',
          },
        },
      },
    });

    for (const tagName of uniqueTags) {
      const tagRecord = await tx.tag.upsert({
        where: {
          name: tagName,
        },
        update: {},
        create: {
          name: tagName,
        },
      });

      await tx.projectTag.create({
        data: {
          projectId: project.id,
          tagId: tagRecord.id,
        },
      });
    }

    return project;
  });

  revalidatePath('/dashboard');

  return project;
}

export async function loadProject(id: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  return await getProjectById(id, userId);
}

async function getProjectById(projectId: string, userId: string) {
  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
    include: {
      project: {
        include: {
          tags: {
            include: {
              tag: true,
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    return null;
  }

  return {
    ...assignment.project,
    tags: assignment.project.tags.map((projectTag) => projectTag.tag),
  };
}




export async function deleteProject(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  const projectId = formData.get('id') as string;

  if (!projectId) {
    throw new Error('Missing project id');
  }

  return await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const assignment = await tx.projectAssignment.findUnique({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
    });

    if (!assignment) {
      throw new Error('Unauthorized');
    }

    if (assignment.role !== 'owner') {
      throw new Error('Only project owners can delete the project');
    }

    await tx.project.delete({
      where: {
        id: projectId,
      },
    });

    revalidatePath('/dashboard');

    return {
      action: 'deleted',
    };
  });
}

export async function leaveProject(formData: FormData) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;
  const projectId = formData.get('id') as string;

  if (!projectId) {
    throw new Error('Missing project id');
  }

  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });

  if (!assignment) {
    throw new Error('Unauthorized');
  }

  const membersCount = await prisma.projectAssignment.count({
    where: {
      projectId,
    },
  });

  if (assignment.role === 'owner') {
    if (membersCount === 1) {
      await prisma.project.delete({
        where: {
          id: projectId,
        },
      });

      revalidatePath('/dashboard');

      return {
        action: 'deleted',
      };
    }

    throw new Error(
      'Vous devez transférer la propriété à un autre membre avant de quitter le projet.',
    );
  }

  await prisma.projectAssignment.delete({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });

  revalidatePath('/dashboard');

  return {
    action: 'left',
  };
}

export async function saveProjectData(
  projectId: string,
  content: string,
  fileTree: Prisma.InputJsonValue,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });

  if (!assignment) {
    throw new Error('Access denied');
  }

  await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      fileTree,
    },
  });

  revalidatePath('/dashboard');
}

export const setProjectActiveStatus = async (projectId: string, isActive: boolean) => {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  const assignment = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });

  if (!assignment) {
    throw new Error('Access denied');
  }

  if (assignment.role !== 'owner') {
    throw new Error('Only project owners can change the active status');
  }

  await prisma.project.update({
    where: {
      id: projectId,
    },
    data: {
      isActive,
    },
  });

  revalidatePath('/dashboard');
};