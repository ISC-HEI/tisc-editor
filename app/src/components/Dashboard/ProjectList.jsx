"use client"

import { useState } from "react"
import { ProjectCard } from "./ProjectCard"

export function ProjectList({ initialProjects }) {
  const [search, setSearch] = useState("")
  const [showShared, setShowShared] = useState(true)

  const filteredProjects = initialProjects.filter((project) => {
    const matchesName = project.title.toLowerCase().includes(search.toLowerCase())
    const matchesShared = !showShared ? project.isAuthor : true
    
    return matchesName && matchesShared
  })

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row gap-4 bg-white p-4 rounded-xl shadow-sm border border-gray-100">
        <input
          type="text"
          placeholder="Search a project..."
          className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        
        <label className="flex items-center gap-2 cursor-pointer whitespace-nowrap text-sm font-medium text-gray-600">
          <input
            type="checkbox"
            className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500"
            checked={showShared}
            onChange={(e) => setShowShared(e.target.checked)}
          />
          Show shared project
        </label>
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filteredProjects.length === 0 ? (
          <div className="text-center py-20 bg-white border-2 border-dashed border-gray-200 rounded-2xl">
            <p className="text-gray-400">No project found.</p>
          </div>
        ) : (
          filteredProjects.map((project) => (
            <ProjectCard key={project.id} project={project} />
          ))
        )}
      </div>
    </div>
  )
}