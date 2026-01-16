"use client"

import { useState, useRef, useEffect } from "react"
import { deleteProject, getUsersEmailFromId } from "../app/dashboard/actions"
import SharedUserWindows from "./SharedUserWindow"

export function ProjectActions({ projectId, title, usersSharing }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  
  const [emails, setEmails] = useState([])

  const menuRef = useRef(null)

  useEffect(() => {
    const fetchEmails = async () => {
      try {
        const data = await getUsersEmailFromId(usersSharing)
        setEmails(data)
      } catch (error) {
        console.error("Erreur lors du chargement des emails:", error)
      }
    }

    fetchEmails()

    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [usersSharing])

  const handleShare = async (e) => {
    e.preventDefault()
    setIsSharing(true)
    setIsOpen(false)
  }

  return (
    <>
      {isSharing && (
        <SharedUserWindows
        projectId={projectId}
          title={title}
          users={emails}
          onClose={() => {setIsSharing(false)}}
        />
      )}
      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault()
            setIsOpen(!isOpen)
          }}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors font-bold text-gray-500"
        >
          •••
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-xl z-50 py-1 border-gray-100">
            <button
              type="button"
              onClick={handleShare}
              className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors"
            >
              Share
            </button>

            <form action={deleteProject}>
              <input type="hidden" name="id" value={projectId} />
              <button
                type="submit"
                className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
              >
                Delete
              </button>
            </form>
          </div>
        )}
      </div>
    </>
  )
}