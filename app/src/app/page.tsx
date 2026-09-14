import { loadProject } from '@/app/dashboard/actions';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { auth } from '@/lib/auth';

const Editor = dynamic(() => import('../components/Editor/Editor'), {
  loading: () => <h2>The editor is loading</h2>,
});

type FileNode = {
  type: 'folder' | 'file';
  name: string;
  fullPath?: string;
  data?: string;
  content?: string;
  isMain?: boolean;
  children?: Record<string, FileNode>;
};

function normalizeFileTree(value: FileNode): FileNode {
  if (!value || typeof value !== 'object') {
    return { type: 'folder', name: 'root', children: {} };
  }

  if (value.type === 'file') {
    return {
      type: 'file',
      name: String(value.name ?? ''),
      fullPath: value.fullPath ?? value.name ?? '',
      data: value.data ?? '',
      content: value.content ?? undefined,
      isMain: value.isMain === true,
    };
  }

  const normalizedChildren: Record<string, FileNode> = {};
  if (value.children && typeof value.children === 'object') {
    for (const [key, child] of Object.entries(value.children)) {
      normalizedChildren[key] = normalizeFileTree(child);
    }
  }

  return {
    type: 'folder',
    name: String(value.name ?? 'root'),
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
    />
  );
}
