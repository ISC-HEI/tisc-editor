import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { auth } from '@/lib/auth';
import type { Prisma } from '@prisma/client';
import { FileNode } from '@/types/filetree';
import { getProjectAssignmentRole, loadProject } from '@/lib/actions/projects';

const Editor = dynamic(() => import('../components/Editor/Editor'), {
  loading: () => <h2>The editor is loading</h2>,
});

function asString(value: Prisma.JsonValue | undefined, fallback = ''): string {
  return typeof value === 'string' ? value : fallback;
}

function normalizeFileTree(value: Prisma.JsonValue): FileNode {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { type: 'folder', name: 'root', children: {} };
  }

  const obj = value as Prisma.JsonObject;

  if (obj.type === 'file') {
    return {
      type: 'file',
      name: asString(obj.name),
      fullPath: asString(obj.fullPath, asString(obj.name)),
      data: asString(obj.data),
      content: typeof obj.content === 'string' ? obj.content : undefined,
      isMain: obj.isMain === true,
    };
  }

  const normalizedChildren: Record<string, FileNode> = {};
  const children = obj.children;
  if (children && typeof children === 'object' && !Array.isArray(children)) {
    for (const [key, child] of Object.entries(children as Prisma.JsonObject)) {
      if (child !== undefined) {
        normalizedChildren[key] = normalizeFileTree(child);
      }
    }
  }

  return {
    type: 'folder',
    name: asString(obj.name, 'root'),
    children: normalizedChildren,
  };
}

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ projectId?: string }>;
}) {
  const session = await auth();

  if (!session?.user?.id) {
    redirect('/login');
  }

  const { projectId } = await searchParams;

  if (!projectId) {
    redirect('/dashboard');
  }

  const project = await loadProject(projectId);

  if (!project) {
    redirect('/dashboard');
  }

  const role = await getProjectAssignmentRole(projectId);

  if (!role) {
    redirect('/dashboard');
  }

  const canEdit = role === 'owner' || role === 'editor';

  const projectData = {
    id: project.id,
    title: project.title,
    fileTree: normalizeFileTree(project.fileTree),
    tags: project.tags || [],
  };

  return (
    <Editor
      projectId={projectData.id}
      title={projectData.title}
      fileTree={projectData.fileTree}
      userId={session.user.id}
      tags={projectData.tags}
      canEdit={canEdit}
    />
  );
}
