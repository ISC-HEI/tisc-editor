import { loadProject } from "@/app/dashboard/actions"
import EditorClient from "../components/EditorClient";
import { redirect } from "next/navigation";

type FileTree = {
  type: "folder" | "file";
  name: string;
  children: Record<string, FileTree>;
};

export default async function Page({ searchParams, }: { searchParams: Promise<{ projectId?: string }> }) {
  const { projectId } = await searchParams;

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

  if (!projectId) {
    redirect("/dashboard");
  }

  let projectData: {
    id: number;
    title: string;
    content: string;
    fileTree: FileTree;
  } = {
    id: -1,
    title: "",
    content: "",
    fileTree: { type: "folder", name: "root", children: {} },
  };

  const project = await loadProject(parseInt(projectId));

  if (!project) {
    redirect("/dashboard");
  }
  projectData = {
    id: project.id,
    title: project.title,
    content: project.content || "",
    fileTree: normalizeFileTree(project.fileTree),
  };

  return (
    <EditorClient
      projectId={projectData.id}
      title={projectData.title}
      content={projectData.content}
      fileTree={projectData.fileTree}
    />
  );
}
