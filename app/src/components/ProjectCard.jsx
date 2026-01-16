import Link from "next/link"
import { ProjectActions } from "./ProjectAction"

export function ProjectCard({ project }) {
  return (
    <div className="group relative bg-white border border-gray-200 rounded-xl p-4 hover:border-blue-300 hover:shadow-md transition-all duration-200 flex items-center justify-between">
      <Link 
        href={`/?projectId=${project.id}`} 
        className="flex-grow flex flex-col"
      >
        <span className="font-semibold text-gray-900 group-hover:text-blue-600 transition-colors">
          {project.title}
        </span>
        <span className="text-xs text-gray-400 mt-1 uppercase tracking-wider">
          Go to this project →
        </span>
      </Link>

      <div className="ml-4">
        <ProjectActions
          projectId={project.id}
          usersSharing={project.sharedUsers}
          title={project.title}
          />
      </div>
    </div>
  )
}