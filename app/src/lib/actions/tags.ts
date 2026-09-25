'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export const addTagToProject = async (projectId: string, tag: string) => {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  if (!projectId || !tag?.trim()) {
    throw new Error('Missing project id or tag');
  }

  const tagName = tag.trim();

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

export const removeTagFromProject = async (projectId: string, tag: string) => {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  if (!projectId || !tag?.trim()) {
    throw new Error('Missing project id or tag');
  }

  const tagName = tag.trim();

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

export const getTagsByUser = async () => {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
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
      name: 'asc',
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