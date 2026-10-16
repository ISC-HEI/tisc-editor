'use server';

import { after } from 'next/server';
import { prisma } from '@/lib/prisma';
import { sendMail } from '../email';
import { requireUserId, requireAssignment } from './utils';
import {
  COMMENT_ROLES,
  EDIT_ROLES,
  MAX_COMMENT_LENGTH,
  applyLineChanges,
  normalizeFilePath,
  parseLineChanges,
} from '../comment-anchors';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_THREADS_PER_PROJECT = 1000;

const authorSelect = { select: { id: true, email: true, name: true } };

export interface CommentAnchorInput {
  filePath: string;
  line: number | null;
  pageOffset: number;
  x: number;
  dy: number;
}

function assertUuid(id: string) {
  if (typeof id !== 'string' || !UUID_RE.test(id)) {
    throw new Error('Invalid id');
  }
}

function cleanBody(body: string) {
  const text = typeof body === 'string' ? body.trim() : '';
  if (!text) throw new Error('Comment cannot be empty');
  if (text.length > MAX_COMMENT_LENGTH) {
    throw new Error(`Comment is too long (max ${MAX_COMMENT_LENGTH} characters)`);
  }
  return text;
}

function cleanAnchor(anchor: CommentAnchorInput) {
  const finite = (v: unknown) => typeof v === 'number' && Number.isFinite(v);
  const filePath = normalizeFilePath(anchor?.filePath);

  if (
    !filePath ||
    filePath.length > 255 ||
    !(anchor.line === null || (Number.isInteger(anchor.line) && anchor.line >= 0)) ||
    !Number.isInteger(anchor.pageOffset) ||
    !finite(anchor.x) ||
    !finite(anchor.dy)
  ) {
    throw new Error('Invalid comment position');
  }

  return {
    filePath,
    line: anchor.line,
    pageOffset: anchor.pageOffset,
    x: anchor.x,
    dy: anchor.dy,
  };
}

async function requireCommentRole(userId: string, projectId: string) {
  const assignment = await requireAssignment(userId, projectId);
  if (!COMMENT_ROLES.includes(assignment.role)) {
    throw new Error('You are not allowed to comment on this project');
  }
  return assignment;
}

async function findComment(commentId: string) {
  assertUuid(commentId);
  const comment = await prisma.comment.findUnique({ where: { id: commentId } });
  if (!comment) throw new Error('Comment not found');
  return comment;
}

/**
 * Returns every comment thread of a project (roots with their replies).
 * Any member, including viewers, can read comments.
 */
export async function listComments(projectId: string) {
  const userId = await requireUserId();
  assertUuid(projectId);
  await requireAssignment(userId, projectId);

  return prisma.comment.findMany({
    where: { projectId, parentId: null },
    orderBy: { createdAt: 'asc' },
    include: {
      author: authorSelect,
      resolvedBy: authorSelect,
      replies: {
        orderBy: { createdAt: 'asc' },
        include: { author: authorSelect },
      },
    },
  });
}

/**
 * Starts a new comment thread anchored at a preview position.
 * Allowed for owners, editors and commenters.
 */
export async function createComment(projectId: string, body: string, anchor: CommentAnchorInput) {
  const userId = await requireUserId();
  assertUuid(projectId);
  await requireCommentRole(userId, projectId);

  const text = cleanBody(body);
  const position = cleanAnchor(anchor);

  const count = await prisma.comment.count({ where: { projectId, parentId: null } });
  if (count >= MAX_THREADS_PER_PROJECT) {
    throw new Error('This project has reached the maximum number of comments');
  }

  const comment = await prisma.comment.create({
    data: { projectId, authorId: userId, body: text, ...position },
  });

  return { success: true, id: comment.id };
}

/**
 * Adds a reply to a thread and notifies the thread author by email.
 * Allowed for owners, editors and commenters, on open threads only.
 */
export async function replyToComment(commentId: string, body: string) {
  const userId = await requireUserId();
  const root = await findComment(commentId);

  if (root.parentId) throw new Error('Replies must target a thread');
  if (root.resolved) throw new Error('This thread is resolved');

  await requireCommentRole(userId, root.projectId);
  const text = cleanBody(body);

  await prisma.comment.create({
    data: { projectId: root.projectId, authorId: userId, parentId: root.id, body: text },
  });

  if (root.authorId !== userId) {
    after(async () => {
      const [rootAuthor, replier, project] = await Promise.all([
        prisma.user.findUnique({ where: { id: root.authorId }, select: { email: true } }),
        prisma.user.findUnique({ where: { id: userId }, select: { name: true, email: true } }),
        prisma.project.findUnique({ where: { id: root.projectId }, select: { title: true } }),
      ]);

      // The author may have left the project since: don't leak replies to them.
      const stillMember = await prisma.projectAssignment.findUnique({
        where: { userId_projectId: { userId: root.authorId, projectId: root.projectId } },
        select: { role: true },
      });
      if (!rootAuthor || !stillMember) return;

      const snippet = text.length > 200 ? `${text.slice(0, 200)}…` : text;

      await sendMail(
        rootAuthor.email,
        'New reply to your comment',
        `${replier?.name ?? replier?.email} replied to your comment on the project "${project?.title ?? 'Untitled'}": "${snippet}"`,
        {
          label: 'COMMENT',
          code: 'new reply',
          cta: {
            label: 'Open the project',
            url: `${process.env.AUTH_URL}/dashboard?projectId=${root.projectId}`,
          },
        },
      );
    });
  }

  return { success: true };
}

/**
 * Resolves or reopens a thread. Only the project owner or the thread author can.
 */
export async function setCommentResolved(commentId: string, resolved: boolean) {
  const userId = await requireUserId();
  const root = await findComment(commentId);

  if (root.parentId) throw new Error('Only threads can be resolved');

  const assignment = await requireAssignment(userId, root.projectId);
  if (assignment.role !== 'owner' && root.authorId !== userId) {
    throw new Error('Only the owner or the author can resolve this comment');
  }

  await prisma.comment.update({
    where: { id: root.id },
    data: {
      resolved: Boolean(resolved),
      resolvedAt: resolved ? new Date() : null,
      resolvedById: resolved ? userId : null,
    },
  });

  return { success: true };
}

/**
 * Deletes a comment (a thread deletes its replies too).
 * Only the project owner or the comment author can.
 */
export async function deleteComment(commentId: string) {
  const userId = await requireUserId();
  const comment = await findComment(commentId);

  const assignment = await requireAssignment(userId, comment.projectId);
  if (assignment.role !== 'owner' && comment.authorId !== userId) {
    throw new Error('Only the owner or the author can delete this comment');
  }

  await prisma.comment.delete({ where: { id: comment.id } });

  return { success: true };
}

/**
 * Shifts the anchored lines of a file's threads after edits that added or
 * removed lines. Called by the editing client (owners and editors only).
 * Rows are locked so concurrent editors apply their shifts one after another.
 */
export async function shiftCommentAnchors(projectId: string, filePath: string, changes: unknown) {
  const userId = await requireUserId();
  assertUuid(projectId);

  const assignment = await requireAssignment(userId, projectId);
  if (!EDIT_ROLES.includes(assignment.role)) {
    throw new Error('Forbidden');
  }

  const lineChanges = parseLineChanges(changes);
  if (!lineChanges) throw new Error('Invalid changes');
  if (lineChanges.length === 0) return { success: true };

  const path = normalizeFilePath(filePath);

  await prisma.$transaction(async (tx) => {
    const rows = await tx.$queryRaw<{ id: string; line: number }[]>`
      SELECT id, line FROM comments
      WHERE project_id = ${projectId}::uuid
        AND file_path = ${path}
        AND parent_id IS NULL
        AND line IS NOT NULL
      FOR UPDATE`;

    for (const row of rows) {
      const next = applyLineChanges(row.line, lineChanges);
      if (next !== row.line) {
        await tx.comment.update({ where: { id: row.id }, data: { line: Math.max(0, next) } });
      }
    }
  });

  return { success: true };
}
