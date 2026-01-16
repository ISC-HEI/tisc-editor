import { getUserProjects, createProject } from "./actions"
import { ProjectList } from "../../components/ProjectList"
import Footer from "../../components/Footer"
import CreateProjectModal from "../../components/CreateProjectModal"

export default async function Dashboard() {
  const projects = await getUserProjects()

  return (
    <>
      <main className="min-h-screen bg-gray-50 py-12 px-6">
        <div className="max-w-3xl mx-auto">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
              <p className="text-gray-500 mt-1">Manage your projects and collaborations.</p>
            </div>
            <CreateProjectModal />
          </div>
          <ProjectList initialProjects={projects} />
        </div>
      </main>
      <Footer />
    </>
  )
}