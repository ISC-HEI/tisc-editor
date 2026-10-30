import { redirect, notFound } from 'next/navigation';
import dynamic from 'next/dynamic';
import { auth } from '@/lib/auth';
import { getProjectAssignmentRole, loadProject } from '@/lib/actions/projects';
import { normalizeFileTree } from '@/lib/filetree';
import RequestAccess from '../components/Dashboard/RequestAccess';
import EditorLoader from '../components/Editor/EditorLoader';

const Editor = dynamic(() => import('../components/Editor/Editor'), {
  loading: () => <EditorLoader />,
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  if (!UUID_RE.test(projectId)) {
    notFound();
  }

  const role = await getProjectAssignmentRole(projectId);

  if (!role) {
    return <RequestAccess projectId={projectId} email={session.user.email} />;
  }

  const project = await loadProject(projectId);

  if (!project) {
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
      role={role}
    />
  );
}
