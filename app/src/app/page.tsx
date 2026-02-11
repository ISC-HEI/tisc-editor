import { loadProject } from "@/app/dashboard/actions"
import { redirect } from "next/navigation";
import dynamic from "next/dynamic";
import { auth } from "@/lib/auth"

const Editor = dynamic(() => import("../components/Editor/Editor"), {
  loading: () => <h2>The editor is loading</h2>
})

type FileTree = {
  type: "folder" | "file";
  name: string;
  children: Record<string, FileTree>;
};

export default async function Page({ searchParams, }: { searchParams: Promise<{ projectId?: string }> }) {
  const session = await auth();
  
  if (!session?.user?.id) {
    redirect("/login"); 
  }

  const { projectId } = await searchParams;

  if (!projectId) {
    redirect("/dashboard");
  }

  const project = await loadProject(projectId);

  if (!project) {
    redirect("/dashboard");
  }

  function normalizeFileTree(value: any): FileTree {
    if (
      value &&
      typeof value === "object" &&
      value.type &&
      value.name &&
      typeof value.children === "object"
    ) {
      return {
        type: value.type === "file" ? "file" : "folder",
        name: String(value.name),
        children: value.children ?? {},
      };
    }

    return { type: "folder", name: "root", children: {} };
  }

  const projectData = {
    id: project.id,
    title: project.title,
    fileTree: normalizeFileTree(project.fileTree),
  };

  return (
    <Editor
      projectId={projectData.id}
      title={projectData.title}
      fileTree={projectData.fileTree}
      userId={session.user.id}
    />
  );
}