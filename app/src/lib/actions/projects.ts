'use server';

import { randomUUID } from 'crypto';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { checkUserQuota } from '@/lib/quota-service';
import { Prisma } from '@prisma/client';
import { FileNode } from '@/types/filetree';
import { flattenTree, buildTree } from '@/lib/filetree';
import { putObject, copyObject, mapLimit } from '@/lib/storage';
import {
  prepareFiles,
  uploadFiles,
  readFileContents,
  cleanupProjectObjects,
  projectPrefix,
} from '@/lib/project-storage';
import { getLatestVersion, importPackageAsTree } from './github-import';
import { requireUserId, getAssignment, requireAssignment } from './utils';

/**
 * Creates a new project for the current user, either blank or imported from a
 * Typst package template, after validating tags and checking storage quota.
 */
export async function createProject(formData: FormData) {
  const userId = await requireUserId('No authorization');

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

  const projectId = randomUUID();
  const files = prepareFiles(projectId, flattenTree(projectData.fileTree));
  const dataSize = files.reduce((sum, file) => sum + file.size, 0);

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

  try {
    // Objects first: a failure afterwards only leaves orphans, never broken rows.
    await uploadFiles(files);

    const project = await prisma.$transaction(async (tx) => {
      const project = await tx.project.create({
        data: {
          id: projectId,
          title,

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

      if (files.length > 0) {
        await tx.projectFile.createMany({
          data: files.map((file) => ({
            id: file.id,
            projectId,
            path: file.path,
            isMain: file.isMain,
            size: file.size,
            sha256: file.sha256,
            storageKey: file.storageKey,
          })),
        });
      }

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
  } catch (error) {
    await cleanupProjectObjects(projectId);
    throw error;
  }
}

/**
 * Loads a project by id for the current user, returning null if they have no access.
 */
export async function loadProject(id: string) {
  const userId = await requireUserId();

  return await getProjectById(id, userId);
}

/**
 * Fetches a project with its tags and its file tree (rebuilt from ProjectFile
 * rows and the object store), scoped to a user's assignment (private helper).
 */
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
          files: {
            orderBy: {
              path: 'asc',
            },
          },
        },
      },
    },
  });

  if (!assignment) {
    return null;
  }

  const { files, ...project } = assignment.project;

  const contents = await readFileContents(files);

  return {
    ...project,
    fileTree: buildTree(
      files.map((file, index) => ({
        path: file.path,
        isMain: file.isMain,
        content: contents[index],
      })),
    ),
    tags: project.tags.map((projectTag) => projectTag.tag),
  };
}

/**
 * Returns all projects the current user is assigned to, along with the user's
 * role, ownership info, tags and sharing status for each project.
 */
export async function getUserProjects() {
  const userId = await requireUserId('No authorization');

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

/**
 * Returns the current user's role on a given project, or null if not assigned.
 */
export async function getProjectAssignmentRole(projectId: string) {
  const userId = await requireUserId();

  const assignment = await getAssignment(userId, projectId);

  return assignment?.role ?? null;
}

/**
 * Sets a project's active status. Only the owner can perform this action.
 */
export const setProjectActiveStatus = async (projectId: string, isActive: boolean) => {
  const userId = await requireUserId();

  const assignment = await requireAssignment(userId, projectId);

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

/**
 * Removes the current user from a project. If they are the sole owner, the
 * project is deleted; if they are an owner with other members, ownership must
 * be transferred first.
 */
export async function leaveProject(formData: FormData) {
  const userId = await requireUserId();
  const projectId = formData.get('id') as string;

  if (!projectId) {
    throw new Error('Missing project id');
  }

  const assignment = await requireAssignment(userId, projectId, 'Unauthorized');

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

      await cleanupProjectObjects(projectId);

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

/**
 * Deletes a project. Only the owner is allowed to perform this action.
 */
export async function deleteProject(formData: FormData) {
  const userId = await requireUserId();

  const projectId = formData.get('id') as string;

  if (!projectId) {
    throw new Error('Missing project id');
  }

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
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

    return {
      action: 'deleted',
    };
  });

  // Rows are gone: now remove the objects (best effort, outside the transaction).
  await cleanupProjectObjects(projectId);

  revalidatePath('/dashboard');

  return result;
}

/**
 * Duplicates a project. Any member (owner, editor or viewer) can duplicate.
 * The copy belongs only to the current user and is not shared with anyone.
 */
export async function duplicateProject(formData: FormData) {
  const userId = await requireUserId();

  const projectId = formData.get('id');
  if (typeof projectId !== 'string' || !projectId) {
    throw new Error('Missing project id');
  }

  const assignment = await prisma.projectAssignment.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });
  if (!assignment) {
    throw new Error('You do not have access to this project');
  }

  const source = await prisma.project.findUnique({
    where: { id: projectId },
    select: {
      title: true,
      files: {
        select: {
          path: true,
          mimeType: true,
          size: true,
          sha256: true,
          isMain: true,
          content: true,
          storageKey: true,
        },
      },
    },
  });
  if (!source) {
    throw new Error('Project not found');
  }

  const newProjectId = randomUUID();

  const copies = source.files.map((file) => {
    const id = randomUUID();

    return {
      id,
      path: file.path,
      mimeType: file.mimeType,
      size: file.size,
      sha256: file.sha256,
      isMain: file.isMain,
      storageKey: `${projectPrefix(newProjectId)}${id}`,
      sourceKey: file.storageKey,
      sourceContent: file.content,
    };
  });

  try {
    await mapLimit(copies, 8, async (copy) => {
      if (copy.sourceKey) {
        await copyObject(copy.sourceKey, copy.storageKey);
      } else {
        // Not migrated yet: the content still lives in the database.
        await putObject(copy.storageKey, copy.sourceContent ?? new Uint8Array());
      }
    });

    const newProject = await prisma.$transaction(async (tx) => {
      const created = await tx.project.create({
        data: {
          id: newProjectId,
          title: `${source.title} (copy)`,
          isActive: true,
        },
      });

      if (copies.length > 0) {
        await tx.projectFile.createMany({
          data: copies.map((copy) => ({
            id: copy.id,
            projectId: newProjectId,
            path: copy.path,
            mimeType: copy.mimeType,
            size: copy.size,
            sha256: copy.sha256,
            isMain: copy.isMain,
            storageKey: copy.storageKey,
          })),
        });
      }

      await tx.projectAssignment.create({
        data: { userId, projectId: created.id, role: 'owner' },
      });

      return created;
    });

    revalidatePath('/dashboard');

    return { success: true, id: newProject.id };
  } catch (error) {
    await cleanupProjectObjects(newProjectId);
    throw error;
  }
}
