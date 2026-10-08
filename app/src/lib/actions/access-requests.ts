'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';
import { requireUserId, requireOwnerAssignment } from './utils';
import { sendMail } from '../email';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const COOLDOWN_MS = 24 * 60 * 60 * 1000; // une relance max par 24 h

export type RequestAccessState = { success?: boolean; error?: string };

/**
 * Creates (or renews) an access request and notifies the project owner by email.
 */
export async function requestProjectAccess(
  _prev: RequestAccessState,
  formData: FormData,
): Promise<RequestAccessState> {
  const userId = await requireUserId();
  const projectId = String(formData.get('projectId') ?? '');

  if (!UUID_RE.test(projectId)) {
    return { error: 'Invalid project' };
  }

  const ownerAssignment = await prisma.projectAssignment.findFirst({
    where: { projectId, role: 'owner' },
    include: {
      user: { select: { email: true } },
      project: { select: { title: true } },
    },
  });

  if (!ownerAssignment) {
    return { success: true };
  }

  const alreadyAssigned = await prisma.projectAssignment.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (alreadyAssigned) {
    return { error: 'You already have access to this project' };
  }

  const existing = await prisma.accessRequest.findUnique({
    where: { userId_projectId: { userId, projectId } },
  });

  if (existing?.status === 'denied') {
    return { error: 'Your previous request was declined by the owner' };
  }

  if (existing?.status === 'pending' && Date.now() - existing.requestedAt.getTime() < COOLDOWN_MS) {
    return { error: 'You already requested access. The owner has been notified.' };
  }

  const request = await prisma.accessRequest.upsert({
    where: { userId_projectId: { userId, projectId } },
    create: { userId, projectId },
    update: { status: 'pending', requestedAt: new Date(), resolvedAt: null },
  });

  const requester = await prisma.user.findUnique({
    where: { id: userId },
    select: { name: true, email: true },
  });

  await sendMail(
    ownerAssignment.user.email,
    'Access request for your project',
    `${requester?.name ?? requester?.email} (${requester?.email}) is requesting access to the project "${ownerAssignment.project.title}".`,
    {
      label: 'ACCESS REQUEST',
      code: 'pending approval',
      cta: {
        label: 'Review request',
        url: `${process.env.AUTH_URL}/access-requests/${request.id}`,
      },
    },
  );

  return { success: true };
}

/**
 * Approves (as viewer or editor) or denies an access request.
 * Only the project owner can resolve it.
 */
export async function resolveAccessRequest(
  requestId: string,
  decision: 'viewer' | 'editor' | 'deny',
): Promise<void> {
  const userId = await requireUserId();

  if (!UUID_RE.test(requestId) || !['viewer', 'editor', 'deny'].includes(decision)) {
    throw new Error('Invalid request');
  }

  const request = await prisma.accessRequest.findUnique({
    where: { id: requestId },
    include: {
      user: { select: { email: true } },
      project: { select: { title: true } },
    },
  });

  if (!request) {
    throw new Error('Request not found');
  }

  await requireOwnerAssignment(
    userId,
    request.projectId,
    'Only the owner can handle access requests',
  );

  if (request.status !== 'pending') {
    throw new Error('This request has already been handled');
  }

  if (decision === 'deny') {
    await prisma.accessRequest.update({
      where: { id: requestId },
      data: { status: 'denied', resolvedAt: new Date() },
    });
  } else {
    await prisma.$transaction([
      prisma.projectAssignment.upsert({
        where: { userId_projectId: { userId: request.userId, projectId: request.projectId } },
        create: { userId: request.userId, projectId: request.projectId, role: decision },
        update: {},
      }),
      prisma.accessRequest.update({
        where: { id: requestId },
        data: { status: 'approved', resolvedAt: new Date() },
      }),
    ]);

    await sendMail(
      request.user.email,
      'Your access request was approved',
      `You now have ${decision} access to the project "${request.project.title}".`,
      {
        label: 'ACCESS GRANTED',
        code: `${decision} access granted`,
        cta: {
          label: 'Open the project',
          url: `${process.env.AUTH_URL}/dashboard?projectId=${request.projectId}`,
        },
      },
    );
  }

  revalidatePath(`/access-requests/${requestId}`);
}
