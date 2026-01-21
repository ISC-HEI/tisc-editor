import { getUserProjects } from "./actions"
import { ProjectList } from "../../components/Dashboard/ProjectList"
import Footer from "../../components/Footer"
import CreateProjectModal from "../../components/Dashboard/CreateProjectModal"
import { SignOutButton } from "@/components/SignOutButton"
import { LayoutGrid, Users, HandshakeIcon } from "lucide-react"

export default async function Dashboard() {
  const projects = await getUserProjects()
  
  const totalProjects = projects.length
  const sharedProjects = projects.filter(p => p.sharedUsers?.length > 0 && p.isAuthor).length
  const collaborations = projects.filter(p => !p.isAuthor).length

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col">
      <main className="flex-grow py-12 px-6">
        <div className="max-w-5xl mx-auto">
          
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-1 bg-blue-600 rounded-full" />
                <span className="text-blue-600 font-bold text-xs uppercase tracking-widest">Workspace</span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">
                Dashboard
              </h1>
              <p className="text-slate-500 mt-2 text-lg">
                Manage your projects and collaborations.
              </p>
            </div>
            
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              <CreateProjectModal />
              <div className="w-[1px] h-8 bg-slate-100 mx-1" />
              <SignOutButton />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
                  <LayoutGrid size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Total Projects</p>
                  <p className="text-2xl font-bold text-slate-900">{totalProjects}</p>
                </div>
              </div>
            </div>
            
            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-purple-50 text-purple-600 rounded-xl">
                  <Users size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Shared With</p>
                  <p className="text-2xl font-bold text-slate-900">{sharedProjects}</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-red-50 text-red-600 rounded-xl">
                  <HandshakeIcon size={24} />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-500">Collaborations</p>
                  <p className="text-2xl font-bold text-slate-900">{collaborations}</p>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Your Projects</h2>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">
                Recent
              </span>
            </div>
            <div className="p-8">
              <ProjectList initialProjects={projects} />
            </div>
          </div>

        </div>
      </main>
      <Footer />
    </div>
  )
}