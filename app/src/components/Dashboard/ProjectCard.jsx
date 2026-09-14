import Link from 'next/link';
import { ProjectActions } from './ProjectAction';
import { Folder, Users, ChevronRight } from 'lucide-react';

export function ProjectCard({ project }) {
  const isAuthor = project.isAuthor;
  const isSharedWithMe = !isAuthor;

  return (
    <div className="group relative bg-white border border-slate-200 rounded-2xl p-4 hover:border-blue-400 hover:shadow-xl hover:shadow-blue-900/5 transition-all duration-300 flex items-center justify-between">
      <Link href={`/?projectId=${project.id}`} className="flex-grow flex items-center gap-5 min-w-0">
        <div
          className={`group/thumb relative w-16 h-20 shrink-0 rounded-lg overflow-visible border transition-colors z-0 hover:z-20 ${
            project.hasThumbnail
              ? 'border-slate-200 bg-white shadow-sm'
              : isSharedWithMe
              ? 'border-emerald-100 bg-emerald-50'
              : 'border-slate-200 bg-slate-50 group-hover:border-blue-200 group-hover:bg-blue-50'
          }`}
        >
          {project.hasThumbnail ? (
            <>
              <img
                src={`/api/projects/${project.id}/thumbnail`}
                alt=""
                className="w-full h-full object-cover object-top rounded-lg"
                loading="lazy"
              />

              <div className="pointer-events-none absolute -top-3 left-1/2 -translate-x-1/2 w-64 h-96 rounded-xl overflow-hidden border border-slate-200 shadow-2xl bg-white opacity-0 scale-90 origin-top -translate-y-2 group-hover/thumb:opacity-100 group-hover/thumb:scale-100 group-hover/thumb:translate-y-0 transition-all duration-200 ease-out">
                <img
                  src={`/api/projects/${project.id}/thumbnail`}
                  alt=""
                  className="w-full h-full object-cover object-top"
                />
              </div>
            </>
          ) : (
            <div className="w-full h-full flex items-center justify-center rounded-lg overflow-hidden">
              {isSharedWithMe ? (
                <Users size={24} className="text-emerald-500" />
              ) : (
                <Folder size={24} className="text-slate-300 group-hover:text-blue-400 transition-colors" />
              )}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex flex-col min-w-0 gap-1.5">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
              {project.title}
            </span>

            {isSharedWithMe ? (
              <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-emerald-100 text-emerald-700 rounded-md shrink-0">
                Guest
              </span>
            ) : (
              <>
                <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-blue-100 text-blue-700 rounded-md shrink-0">
                  Owner
                </span>

                {project.usersSharing?.length > 0 && (
                  <span className="text-[10px] font-black uppercase tracking-widest px-2 py-0.5 bg-purple-100 text-purple-700 rounded-md shrink-0">
                    Shared · {project.usersSharing.length}
                  </span>
                )}
              </>
            )}
          </div>

          <div className="flex items-center text-xs text-slate-400 font-medium">
            <span className="group-hover:text-blue-500 transition-colors">Open editor</span>
            <ChevronRight
              size={14}
              className="opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-1 transition-all"
            />
          </div>

          {project.tags?.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap">
              {project.tags.slice(0, 3).map((tag) => (
                <span
                  key={tag.id}
                  className="text-[10px] font-semibold px-2 py-0.5 bg-slate-100 text-slate-500 rounded-md"
                >
                  #{tag.name}
                </span>
              ))}

              {project.tags.length > 3 && (
                <span className="text-[10px] font-semibold text-slate-400">
                  +{project.tags.length - 3}
                </span>
              )}
            </div>
          )}
        </div>
      </Link>

      <div className="ml-4 pl-4 border-l border-slate-100 shrink-0">
        <ProjectActions
          projectId={project.id}
          title={project.title}
          isAuthor={isAuthor}
          usersSharing={project.usersSharing}
          isActive={project.isActive}
        />
      </div>
    </div>
  );
}
