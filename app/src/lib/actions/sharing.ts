'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

/**
 * Shares a project with another user by email, granting either editor or
 * viewer access. Only the project owner can share.
 */
export async function shareProject(
  projectId: string,
  sharedUserEmail: string,
  canEdit: boolean = false,
) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  const ownerCheck = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });

  if (ownerCheck?.role !== 'owner') {
    throw new Error('Only owner can share');
  }

  const sharedUser = await prisma.user.findUnique({
    where: {
      email: sharedUserEmail,
    },
  });

  if (!sharedUser) {
    return {
      error: 'User not found',
    };
  }

  if (sharedUser.id === userId) {
    return {
      error: 'You already have access to this project',
    };
  }

  // Vérifier si déjà partagé
  const existing = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId: sharedUser.id,
        projectId,
      },
    },
  });

  if (existing) {
    return {
      error: 'The user already has access to this project',
    };
  }

  await prisma.projectAssignment.create({
    data: {
      userId: sharedUser.id,
      projectId,
      role: canEdit ? 'editor' : 'viewer',
    },
  });

  revalidatePath('/dashboard');

  return {
    success: true,
  };
}

/**
 * Returns all users assigned to a project (including the caller), with their role.
 */
export async function getProjectUsers(projectId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const users = await prisma.projectAssignment.findMany({
    where: {
      projectId,
    },
    include: {
      user: {
        select: {
          id: true,
          email: true,
        },
      },
    },
  });

  return users.map((u: { user: { id: string; email: string }; role: string }) => ({
    id: u.user.id,
    email: u.user.email,
    role: u.role,
  }));
}

/**
 * Returns all users assigned to a project, excluding the current user, with their role.
 */
export async function getProjectMembers(projectId: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  const members = await prisma.projectAssignment.findMany({
    where: {
      projectId,
      userId: { not: userId },
    },
    include: {
      user: { select: { id: true, email: true } },
    },
  });

  return members.map((m: { user: { id: string; email: string }; role: string }) => ({
    id: m.user.id,
    email: m.user.email,
    role: m.role,
  }));
}

/**
 * Returns id/email pairs for a list of user ids.
 */
export async function getUsersEmailFromId(usersId: string[]) {
  return await prisma.user.findMany({
    where: {
      id: {
        in: usersId,
      },
    },
    select: {
      id: true,
      email: true,
    },
  });
}

/**
 * Transfers project ownership to another user who already has access to the
 * project, demoting the current owner to editor.
 */
export async function transferProjectOwnership(projectId: string, newOwnerEmail: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  if (!projectId || !newOwnerEmail) {
    throw new Error('Missing project id or new owner email');
  }

  const currentOwner = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });

  if (!currentOwner || currentOwner.role !== 'owner') {
    throw new Error('Only the owner can transfer ownership');
  }

  const newOwner = await prisma.user.findUnique({
    where: {
      email: newOwnerEmail,
    },
  });

  if (!newOwner) {
    throw new Error('User not found');
  }

  const newOwnerAssignment = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId: newOwner.id,
        projectId,
      },
    },
  });

  if (!newOwnerAssignment) {
    throw new Error(
      "The user doesn't have access to this project. Please share the project with them first.",
    );
  }

  await prisma.$transaction([
    prisma.projectAssignment.update({
      where: {
        userId_projectId: {
          userId: newOwner.id,
          projectId,
        },
      },
      data: {
        role: 'owner',
      },
    }),
    prisma.projectAssignment.update({
      where: {
        userId_projectId: {
          userId,
          projectId,
        },
      },
      data: {
        role: 'editor',
      },
    }),
  ]);

  revalidatePath('/dashboard');

  return {
    success: true,
  };
}

/**
 * Removes a shared user's access to a project. Only the owner can remove users,
 * and the owner cannot remove themselves.
 */
export async function removeSharedUser(projectId: string, sharedUserEmail: string) {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error('Unauthorized');
  }

  const userId = session.user.id;

  const ownerAssignment = await prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });

  if (ownerAssignment?.role !== 'owner') {
    throw new Error('Only owner can remove users');
  }

  const userToRemove = await prisma.user.findUnique({
    where: {
      email: sharedUserEmail,
    },
  });

  if (!userToRemove) {
    throw new Error('User not found');
  }

  if (userToRemove.id === userId) {
    throw new Error('Owner cannot remove themselves');
  }

  await prisma.projectAssignment.delete({
    where: {
      userId_projectId: {
        userId: userToRemove.id,
        projectId,
      },
    },
  });

  revalidatePath('/dashboard');

  return {
    success: true,
  };
}
