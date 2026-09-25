'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireUserId, requireAssignment } from './utils';

/**
 * Adds a tag to a project (creating the tag if it doesn't exist yet).
 * Requires the current user to have access to the project.
 */
export const addTagToProject = async (projectId: string, tag: string) => {
  const userId = await requireUserId();

  if (!projectId || !tag?.trim()) {
    throw new Error('Missing project id or tag');
  }

  const tagName = tag.trim();

  await requireAssignment(userId, projectId);

  const tagRecord = await prisma.tag.upsert({
    where: {
      name: tagName,
    },
    update: {},
    create: {
      name: tagName,
    },
  });

  await prisma.projectTag.upsert({
    where: {
      projectId_tagId: {
        projectId,
        tagId: tagRecord.id,
      },
    },
    update: {},
    create: {
      projectId,
      tagId: tagRecord.id,
    },
  });

  revalidatePath('/dashboard');

  return {
    success: true,
    tag: tagRecord,
  };
};

/**
 * Returns a project's current tags along with the full list of all available
 * tags, for use in a tag picker. Requires access to the project.
 */
export const getProjectTags = async (projectId: string) => {
  const userId = await requireUserId();

  await requireAssignment(userId, projectId);

  const projectTags = await prisma.projectTag.findMany({
    where: {
      projectId,
    },
    include: {
      tag: {
        select: {
          id: true,
          name: true,
        },
      },
    },
    orderBy: {
      tag: {
        name: 'asc',
      },
    },
  });

  const availableTags = await prisma.tag.findMany({
    orderBy: {
      name: 'asc',
    },
    select: {
      id: true,
      name: true,
    },
  });

  return {
    projectTags: projectTags.map((item) => item.tag),
    availableTags,
  };
};

/**
 * Returns all tags used across the current user's projects, sorted alphabetically.
 */
export const getTagsByUser = async () => {
  const userId = await requireUserId();

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
      name: 'asc',
    },
    select: {
      id: true,
      name: true,
    },
  });
};

/**
 * Removes a tag from a project, and deletes the tag entirely if it is no
 * longer used by any project. Requires access to the project.
 */
export const removeTagFromProject = async (projectId: string, tag: string) => {
  const userId = await requireUserId();

  if (!projectId || !tag?.trim()) {
    throw new Error('Missing project id or tag');
  }

  const tagName = tag.trim();

  await requireAssignment(userId, projectId);

  const tagRecord = await prisma.tag.findUnique({
    where: {
      name: tagName,
    },
  });

  if (!tagRecord) {
    return {
      success: true,
    };
  }

  await prisma.projectTag.deleteMany({
    where: {
      projectId,
      tagId: tagRecord.id,
    },
  });

  const remainingProjects = await prisma.projectTag.count({
    where: {
      tagId: tagRecord.id,
    },
  });

  if (remainingProjects === 0) {
    await prisma.tag.delete({
      where: {
        id: tagRecord.id,
      },
    });
  }

  revalidatePath('/dashboard');

  return {
    success: true,
  };
};
