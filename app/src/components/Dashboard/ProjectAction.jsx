"use client"

import { useState, useRef, useEffect } from "react"
import { deleteProject, getUsersEmailFromId } from "@/app/dashboard/actions";
import SharedUserWindows from "./SharedUserWindow"
import { Ellipsis, Link as LinkIcon, Share2, Trash } from "lucide-react" 

export function ProjectActions({ projectId, title, usersSharing, isAuthor }) {
  const [isOpen, setIsOpen] = useState(false)
  const [isSharing, setIsSharing] = useState(false)
  const [emails, setEmails] = useState([])

  const menuRef = useRef(null)

  useEffect(() => {
    if (!isAuthor || !usersSharing || usersSharing.length === 0) return;

    const fetchEmails = async () => {
      try {
        const data = await getUsersEmailFromId(usersSharing)
        setEmails(data)
      } catch (error) {
        console.error("Erreur emails:", error)
      }
    }
    fetchEmails()
  }, [usersSharing, isAuthor])

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  const handleShare = (e) => {
    e.preventDefault()
    setIsSharing(true)
    setIsOpen(false)
  }

  const handleRemoveUserSuccess = (emailToRemove) => {
    setEmails((prev) => prev.filter((user) => user.email !== emailToRemove));
  };

  return (
    <>
      {isAuthor && isSharing && (
        <SharedUserWindows
          projectId={projectId}
          title={title}
          users={emails}
          onClose={() => setIsSharing(false)}
          onRemoveSuccess={handleRemoveUserSuccess}
        />
      )}

      {isAuthor ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              setIsOpen(!isOpen)
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors font-bold text-gray-500"
          >
            <Ellipsis />
        <div className="relative" ref={menuRef}></div>
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-40 bg-white border rounded-lg shadow-xl z-50 py-1 border-gray-100">
              <button
                type="button"
                onClick={handleShare}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Share2 size={20} /> Share
              </button>

              <form action={deleteProject}>
                <input type="hidden" name="id" value={projectId} />
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Trash size={20} /> Delete
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <div className="p-2 text-blue-500 bg-blue-50 rounded-full" title="Project shared with you">
          <LinkIcon size={18} />
        </div>
      )}
    </>
  )
}