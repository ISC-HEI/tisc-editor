'use server';

import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

/**
 * Returns the current session's user id, or throws if not authenticated.
 * Pass a custom message to match a caller's original error wording.
 */
export async function requireUserId(message = 'Unauthorized'): Promise<string> {
  const session = await auth();

  if (!session?.user?.id) {
    throw new Error(message);
  }

  return session.user.id;
}

/**
 * Returns the assignment linking a user to a project, or null if they have no access.
 */
export async function getAssignment(userId: string, projectId: string) {
  return prisma.projectAssignment.findUnique({
    where: {
      userId_projectId: {
        userId,
        projectId,
      },
    },
  });
}

/**
 * Returns the user's assignment on a project, or throws if they have no access.
 * Pass a custom message to match a caller's original error wording.
 */
export async function requireAssignment(userId: string, projectId: string, message = 'Access denied') {
  const assignment = await getAssignment(userId, projectId);

  if (!assignment) {
    throw new Error(message);
  }

  return assignment;
}

/**
 * Returns the user's assignment on a project only if they are the owner, or throws
 * a single message otherwise (whether the assignment is missing or not owner).
 * Matches the "assignment?.role !== 'owner'" pattern used for share/transfer/remove.
 */
export async function requireOwnerAssignment(
  userId: string,
  projectId: string,
  message = 'Only owner can perform this action',
) {
  const assignment = await getAssignment(userId, projectId);

  if (assignment?.role !== 'owner') {
    throw new Error(message);
  }

  return assignment;
}
