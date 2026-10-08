'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import SharedUserWindows from './SharedUserWindow';
import EditProjectTagsModal from './EditProjectTagsModal';
import {
  Ellipsis,
  Share2,
  Trash,
  Crown,
  Loader2,
  X,
  LogOut,
  Tag,
  Archive,
  Copy,
} from 'lucide-react';
import {
  getProjectMembers,
  getUsersEmailFromId,
  transferProjectOwnership,
} from '@/lib/actions/sharing';
import {
  deleteProject,
  duplicateProject,
  getProjectAssignmentRole,
  leaveProject,
  setProjectActiveStatus,
} from '@/lib/actions/projects';

const projectFormData = (projectId) => {
  const formData = new FormData();
  formData.append('id', projectId);
  return formData;
};

function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirm',
  isPending = false,
  onConfirm,
  onCancel,
}) {
  return (
    <div
      className="fixed inset-0 z-[400] flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
      onClick={isPending ? undefined : onCancel}
    >
      <div
        className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-5">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <p className="mt-2 text-sm text-slate-600 whitespace-pre-line">{message}</p>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-200">
          <button
            type="button"
            onClick={onCancel}
            disabled={isPending}
            className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={isPending}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 disabled:opacity-50 transition-colors"
          >
            {isPending && <Loader2 size={14} className="animate-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

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
      await leaveProject(projectFormData(projectId));
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
            You are the owner of this shared project. Choose a new owner — they&apos;ll inherit full
            control and you&apos;ll leave as a member.
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
  const menuRef = useRef(null);

  const [isOpen, setIsOpen] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [isTransferring, setIsTransferring] = useState(false);
  const [isEditingTags, setIsEditingTags] = useState(false);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDuplicating, setIsDuplicating] = useState(false);

  const [emails, setEmails] = useState([]);
  const [members, setMembers] = useState([]);
  const [currentRole, setCurrentRole] = useState(isAuthor ? 'owner' : 'editor');
  const [prevIsAuthor, setPrevIsAuthor] = useState(isAuthor);

  const isOwner = currentRole === 'owner';
  const hasOtherMembers = (usersSharing?.length ?? 0) > 1;

  if (isAuthor !== prevIsAuthor) {
    setPrevIsAuthor(isAuthor);
    setCurrentRole(isAuthor ? 'owner' : 'editor');
  }

  useEffect(() => {
    const fetchRole = async () => {
      try {
        const role = await getProjectAssignmentRole(projectId);
        if (role) setCurrentRole(role);
      } catch (err) {
        console.error('Role error:', err);
      }
    };
    fetchRole();
  }, [projectId]);

  useEffect(() => {
    if (!usersSharing || usersSharing.length === 0) return;
    const fetchEmails = async () => {
      try {
        setEmails(await getUsersEmailFromId(usersSharing));
      } catch (err) {
        console.error('Emails error:', err);
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

  const handleRemoveUserSuccess = (emailToRemove) => {
    setEmails((prev) => prev.filter((u) => u.email !== emailToRemove));
    router.refresh();
  };

  const handleLeaveClick = async () => {
    setIsOpen(false);
    try {
      if (!isOwner) {
        await leaveProject(projectFormData(projectId));
        router.refresh();
        return;
      }

      const otherMembers = await getProjectMembers(projectId);
      if (otherMembers.length === 0) return;
      setMembers(otherMembers);
      setIsTransferring(true);
    } catch (err) {
      console.error('Leave error:', err);
    }
  };

  const handleTransferSuccess = () => {
    setIsTransferring(false);
    router.refresh();
  };

  const handleArchiveClick = async () => {
    setIsOpen(false);
    try {
      await setProjectActiveStatus(projectId, !isActive);
      router.refresh();
    } catch (err) {
      console.error('Archiving error:', err);
    }
  };

  const handleDuplicateClick = async () => {
    if (isDuplicating) return;
    setIsDuplicating(true);
    try {
      await duplicateProject(projectFormData(projectId));
      router.refresh();
    } catch (err) {
      console.error('Duplicate error:', err);
    } finally {
      setIsDuplicating(false);
      setIsOpen(false);
    }
  };

  const handleDeleteConfirm = async () => {
    setIsDeleting(true);
    try {
      await deleteProject(projectFormData(projectId));
      setIsConfirmingDelete(false);
      router.refresh();
    } catch (err) {
      console.error('Delete error:', err);
    } finally {
      setIsDeleting(false);
    }
  };

  const menuItem =
    'w-full text-left px-4 py-2 text-sm text-slate-700 hover:bg-blue-50 transition-colors flex items-center gap-2 disabled:opacity-50';

  return (
    <>
      {isSharing && (
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

      {isConfirmingDelete && (
        <ConfirmModal
          title="Delete project"
          message="Are you sure you want to delete this project? This action cannot be undone."
          confirmLabel="Delete"
          isPending={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={() => setIsConfirmingDelete(false)}
        />
      )}

      <div className="relative" ref={menuRef}>
        <button
          type="button"
          onClick={() => setIsOpen((prev) => !prev)}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors font-bold text-gray-500"
        >
          <Ellipsis />
        </button>

        {isOpen && (
          <div className="absolute right-0 mt-2 w-44 bg-white border rounded-lg shadow-xl z-50 py-1 border-gray-100">
            {/* Visible for everyone */}
            <button
              type="button"
              onClick={handleDuplicateClick}
              disabled={isDuplicating}
              className={menuItem}
            >
              {isDuplicating ? <Loader2 size={16} className="animate-spin" /> : <Copy size={16} />}
              Duplicate
            </button>

            {isOwner ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setIsSharing(true);
                    setIsOpen(false);
                  }}
                  className={menuItem}
                >
                  <Share2 size={16} /> Share
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setIsEditingTags(true);
                    setIsOpen(false);
                  }}
                  className={menuItem}
                >
                  <Tag size={16} /> Edit Tags
                </button>

                <button type="button" onClick={handleArchiveClick} className={menuItem}>
                  <Archive size={16} /> {isActive ? 'Archive' : 'Unarchive'}
                </button>

                {hasOtherMembers && (
                  <button type="button" onClick={handleLeaveClick} className={menuItem}>
                    <LogOut size={16} /> Leave
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => {
                    setIsConfirmingDelete(true);
                    setIsOpen(false);
                  }}
                  className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors flex items-center gap-2"
                >
                  <Trash size={16} /> Delete
                </button>
              </>
            ) : (
              <button type="button" onClick={handleLeaveClick} className={menuItem}>
                <LogOut size={16} /> Leave
              </button>
            )}
          </div>
        )}
      </div>
    </>
  );
}
