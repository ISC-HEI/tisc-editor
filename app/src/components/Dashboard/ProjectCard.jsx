import Link from "next/link"
import { ProjectActions } from "./ProjectAction"
import { Folder, Users, ChevronRight } from "lucide-react"

export function ProjectCard({ project }) {
  const isSharedWithMe = !project.isAuthor;

  return (
    <div className="group relative bg-white border border-slate-200 rounded-2xl p-5 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 flex items-center justify-between">
      
      <Link 
        href={`/?projectId=${project.id}`} 
        className="flex-grow flex items-center gap-4"
      >
        <div className={`p-3 rounded-xl transition-colors ${
          isSharedWithMe 
            ? "bg-emerald-50 text-emerald-600 group-hover:bg-emerald-100" 
            : "bg-slate-50 text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600"
        }`}>
          {isSharedWithMe ? <Users size={22} /> : <Folder size={22} />}
        </div>

        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">
              {project.title}
            </span>
            
            {isSharedWithMe && (
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md">
                Guest
              </span>
            )}
          </div>
          
          <div className="flex items-center text-xs text-slate-400 mt-1 font-medium">
            <span className="group-hover:text-blue-500 transition-colors">
              Open editor
            </span>
            <ChevronRight size={14} className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
          </div>
        </div>
      </Link>

      <div className="ml-4 pl-4 border-l border-slate-100">
        <ProjectActions
          projectId={project.id}
          usersSharing={project.sharedUsers}
          title={project.title}
          isAuthor={project.isAuthor}
        />
      </div>
    </div>
  )
}