import { getUserProjects, createProject } from "./actions"
import { ProjectCard } from "../../components/ProjectCard"
import Footer from "../../components/Footer"

export default async function Dashboard() {
  const projects = await getUserProjects()

  return (
    <>
      <main className="min-h-screen bg-gray-50 py-12 px-6">
        <div className="max-w-3xl mx-auto">

          {/* Header Section */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-10">
            <div>
              <h1 className="text-3xl font-extrabold text-gray-900 tracking-tight">Dashboard</h1>
              <p className="text-gray-500 mt-1">Manage your projects and collaborations.</p>
            </div>

            <form action={createProject} className="flex gap-2">
              <input
                name="title"
                placeholder="New project..."
                className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                required
              />
              <button
                type="submit"
                className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2 rounded-lg font-semibold transition-colors shadow-sm"
              >
                +
              </button>
            </form>
          </div>

          {/* Projects Grid */}
          <div className="grid grid-cols-1 gap-3">
            {projects.length === 0 ? (
              <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
                <p className="text-gray-400">No projects currently.</p>
              </div>
            ) : (
              <>
                <h3>Your projects</h3>
                {projects.map((project) => (
                  <ProjectCard key={project.id} project={project} />
                ))}
              </>
            )}
          </div>

        </div>
      </main>
      <Footer />
    </>
  )
}