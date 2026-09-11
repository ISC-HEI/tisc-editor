'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  deleteProject,
  leaveProject,
  getUsersEmailFromId,
  getProjectAssignmentRole,
  transferProjectOwnership,
  setProjectActiveStatus,
  getProjectMembers,
} from '@/app/dashboard/actions';
import SharedUserWindows from './SharedUserWindow';
import EditProjectTagsModal from './EditProjectTagsModal';
import { Ellipsis, Share2, Trash, Crown, Loader2, X, LogOut, Tag, Archive } from 'lucide-react';

function TransferOwnershipModal({ projectId, members, onClose, onSuccess }) {
  const [selected, setSelected] = useState(null);
  const [isPending, setIsPending] = useState(false);
  const [error, setError] = useState('');

  const handleConfirm = async () => {
    if (!selected) return;
    setIsPending(true);
    setError('');
    try {
      await transferProjectOwnership(projectId, selected);
      const formData = new FormData();
      formData.append('id', projectId);
      await leaveProject(formData);
      onSuccess();
    } catch (err) {
      setError(err.message);
      setIsPending(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-slate-900/50 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-amber-50">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-amber-100 rounded-xl">
              <Crown size={18} className="text-amber-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Transfer Ownership</h2>
              <p className="text-xs text-slate-500">Required before leaving</p>
            </div>
          </div>
          <button
            onClick={onClose}
            disabled={isPending}
            className="p-1.5 hover:bg-amber-100 rounded-full text-slate-400 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-500 mb-5">
            You are the owner of this shared project. Choose a new owner — they'll inherit full
            control and you'll leave as a member.
          </p>

          <ul className="space-y-2 max-h-52 overflow-y-auto">
            {members.map((m) => (
              <li key={m.id}>
                <button
                  type="button"
                  onClick={() => setSelected(m.email)}
                  className={`w-full flex items-center gap-3 p-3 rounded-xl border-2 transition-all text-left ${
                    selected === m.email
                      ? 'border-amber-400 bg-amber-50'
                      : 'border-slate-100 hover:border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase shrink-0">
                    {m.email.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-slate-700 truncate">{m.email}</p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">
                      {m.role}
                    </p>
                  </div>
                  {selected === m.email && <Crown size={14} className="text-amber-500 shrink-0" />}
                </button>
              </li>
            ))}
          </ul>

          {error && (
            <div className="mt-3 text-xs font-medium text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
              {error}
            </div>
          )}
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex gap-3">
          <button
            onClick={onClose}
            disabled={isPending}
            className="flex-1 px-4 py-2 border border-slate-200 text-slate-600 font-semibold rounded-xl hover:bg-slate-100 disabled:opacity-50 text-sm transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!selected || isPending}
            className="flex-[2] flex items-center justify-center gap-2 bg-amber-500 hover:bg-amber-600 disabled:bg-slate-200 disabled:text-slate-400 text-white py-2 rounded-xl font-bold text-sm shadow-sm transition-all"
          >
            {isPending ? <Loader2 size={16} className="animate-spin" /> : <Crown size={14} />}
            Transfer & Leave
          </button>
        </div>
      </div>
    </div>
  );
}

export function ProjectActions({ projectId, title, usersSharing, isAuthor, isActive = true }) {
  const router = useRouter();
  const [isOpen, setIsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [emails, setEmails] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentRole, setCurrentRole] = useState(isAuthor ? 'owner' : 'editor');
  const isOwner = currentRole === 'owner';
  const menuRef = useRef(null);

  useEffect(() => {
    setCurrentRole(isAuthor ? 'owner' : 'editor');
  }, [isAuthor]);

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const role = await getProjectAssignmentRole(projectId);
        if (role) setCurrentRole(role);
      } catch (err) {
        console.error('Erreur rôle:', err);
      }
    };
    fetchRole();
  }, [projectId]);

  useEffect(() => {
    if (!usersSharing || usersSharing.length === 0) return;
    const fetchEmails = async () => {
      try {
        const data = await getUsersEmailFromId(usersSharing);
        setEmails(data);
      } catch (err) {
        console.error('Erreur emails:', err);
      }
    };
    fetchEmails();
  }, [usersSharing]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setIsOpen(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShare = (e) => {
    e.preventDefault();
    setIsSharing(true);
    setIsOpen(false);
  };

  const handleRemoveUserSuccess = (emailToRemove) => {
    setEmails((prev) => prev.filter((u) => u.email !== emailToRemove));
  };

  const handleLeaveClick = async (e) => {
    e.preventDefault();
    setIsOpen(false);

    if (!isOwner) {
      const formData = new FormData();
      formData.append('id', projectId);
      await leaveProject(formData);
      router.refresh();
      return;
    }

    try {
      const otherMembers = await getProjectMembers(projectId);
      if (otherMembers.length === 0) {
        const formData = new FormData();
        formData.append('id', projectId);
        await leaveProject(formData);
        router.refresh();
      } else {
        setMembers(otherMembers);
        setIsTransferring(true);
      }
    } catch (err) {
      console.error('Erreur leave:', err);
    }
  };

  const handleTransferSuccess = () => {
    setIsTransferring(false);
    router.refresh();
  };

  const handleArchiveClick = async (e) => {
    e.preventDefault();
    setIsOpen(false);

    if (!isOwner) {
      alert('Only the owner can archive the project.');
      return;
    }

    setProjectActiveStatus(projectId, !isActive)
      .then(() => {
        router.refresh();
      })
      .catch((err) => {
        console.error('Archiving Error:', err);
      });
  };

  return (
    <>
      {isOwner && isSharing && (
        <SharedUserWindows
          projectId={projectId}
          title={title}
          users={emails}
          onClose={() => setIsSharing(false)}
          onRemoveSuccess={handleRemoveUserSuccess}
        />
      )}

      {isTransferring && (
        <TransferOwnershipModal
          projectId={projectId}
          members={members}
          onClose={() => setIsTransferring(false)}
          onSuccess={handleTransferSuccess}
        />
      )}

      {isEditingTags && (
        <EditProjectTagsModal projectId={projectId} onClose={() => setIsEditingTags(false)} />
      )}

      {isOwner ? (
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setIsOpen(!isOpen);
            }}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors font-bold text-gray-500"
          >
            <Ellipsis />
          </button>

          {isOpen && (
            <div className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-xl z-50 py-1 border-gray-100">
              <button
                type="button"
                onClick={handleShare}
                className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Share2 size={16} /> Share
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEditingTags(true);
                  setIsOpen(false);
                }}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Tag size={16} /> Edit Tags
              </button>

              <button
                type="button"
                onClick={handleArchiveClick}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-2"
              >
                <Archive size={16} /> {isActive ? 'Archive' : 'Unarchive'}
              </button>

              <button
                type="button"
                onClick={handleLeaveClick}
                className="w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-slate-50 transition-colors flex items-center gap-2"
              >
                <LogOut size={16} /> Leave
              </button>

              <form action={deleteProject}>
                <input type="hidden" name="id" value={projectId} />
                <button
                  type="submit"
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Trash size={16} /> Delete
                </button>
              </form>
            </div>
          )}
        </div>
      ) : (
        <button
          type="button"
          onClick={handleLeaveClick}
          className="flex items-center gap-2 px-3 py-2 text-sm font-medium text-slate-700 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
          title="Leave project"
        >
          <LogOut size={16} /> Leave
        </button>
      )}
    </>
  );
}
