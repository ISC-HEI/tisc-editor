import { getUserProjects } from "./actions"
import { ProjectList } from "../../components/Dashboard/ProjectList"
import Footer from "../../components/Footer"
import CreateProjectModal from "../../components/Dashboard/CreateProjectModal"
import { SignOutButton } from "@/components/SignOutButton"
import { LayoutGrid, Users, HandshakeIcon } from "lucide-react"
import StorageBar from "@/components/Dashboard/StorageBar"

export default async function Dashboard() {
  const projects = await getUserProjects()
  
  const totalProjects = projects.length
  const sharedProjects = projects.filter((p: any) => p.sharedUsers?.length > 0 && p.isAuthor).length
  const guest_projects = projects.filter((p: any) => !p.isAuthor).length

  return (
    // CONTENEUR PARENT : Flex-row pour avoir Sidebar à gauche et Main à droite
    <div className="min-h-screen bg-[#f8fafc] flex flex-row">
      
      {/* 1. LA SIDEBAR (Elle contient déjà la StorageBar à l'intérieur) */}
      <StorageBar />

      {/* 2. LE CONTENU PRINCIPAL */}
      <main className="flex-grow py-12 px-6 overflow-y-auto">
        <div className="max-w-5xl mx-auto">
          
          {/* HEADER DU DASHBOARD */}
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-12">
            <div>
              <div className="flex items-center gap-2 mb-2">
                <div className="h-8 w-1 bg-blue-600 rounded-full" />
                <span className="text-blue-600 font-bold text-xs uppercase tracking-widest">Workspace</span>
              </div>
              <h1 className="text-4xl font-black text-slate-900 tracking-tight">Dashboard</h1>
              <p className="text-slate-500 mt-2 text-lg">Manage your projects and collaborations.</p>
            </div>

            {/* BOUTONS D'ACTION (SignOut, Create...) */}
            <div className="flex items-center gap-3 bg-white p-2 rounded-2xl shadow-sm border border-slate-200">
              <CreateProjectModal />
              <div className="w-[1px] h-8 bg-slate-100 mx-1" />
              <SignOutButton />
            </div>
          </div>

          {/* STATS CARDS */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
            <StatCard icon={<LayoutGrid size={24}/>} label="Total Projects" value={totalProjects} color="blue" />
            <StatCard icon={<Users size={24}/>} label="Shared" value={sharedProjects} color="purple" />
            <StatCard icon={<HandshakeIcon size={24}/>} label="Guest projects" value={guest_projects} color="emerald" />
          </div>

          {/* PROJECT LIST */}
          <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
            <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
              <h2 className="font-bold text-slate-800">Your Projects</h2>
              <span className="bg-slate-200 text-slate-600 text-[10px] font-bold px-2 py-1 rounded-full uppercase">Recent</span>
            </div>
            <div className="p-8">
              <ProjectList initialProjects={projects} />
            </div>
          </div>
          
          <Footer />
        </div>
      </main>
    </div>
  )
}

// Petit composant interne pour cleaner le code des stats
function StatCard({ icon, label, value, color }: any) {
  const colors: any = {
    blue: "bg-blue-50 text-blue-600",
    purple: "bg-purple-50 text-purple-600",
    emerald: "bg-emerald-50 text-emerald-600"
  };
  return (
    <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`p-3 rounded-xl ${colors[color]}`}>{icon}</div>
        <div>
          <p className="text-sm font-medium text-slate-500">{label}</p>
          <p className="text-2xl font-bold text-slate-900">{value}</p>
        </div>
      </div>
    </div>
  )
}