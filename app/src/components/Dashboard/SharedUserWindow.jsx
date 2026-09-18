'use client';
import { useState, useTransition, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { shareProject, removeSharedUser, transferProjectOwnership } from '@/app/dashboard/actions';
import {
  Trash,
  Plus,
  Users,
  X,
  Mail,
  Loader2,
  ArrowRight,
  Eye,
  Pencil,
  ChevronDown,
  Check,
} from 'lucide-react';

export default function SharedUserWindow({ projectId, title, users, onClose, onRemoveSuccess }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [role, setRole] = useState('view'); // 'view' | 'edit'
  const [roleOpen, setRoleOpen] = useState(false);
  const roleRef = useRef(null);

  const roles = [
    { value: 'view', label: 'See', icon: Eye },
    { value: 'edit', label: 'Edit', icon: Pencil },
  ];
  const currentRole = roles.find((r) => r.value === role);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (roleRef.current && !roleRef.current.contains(e.target)) {
        setRoleOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleShare = async () => {
    if (!email) return;
    setError('');

    startTransition(async () => {
      const result = await shareProject(projectId, email, role === 'edit');
      if (result?.error) {
        setError(result.error);
      } else {
        setEmail('');
      }
    });
  };

  const handleRemove = async (targetEmail) => {
    setError('');
    startTransition(async () => {
      try {
        const result = await removeSharedUser(projectId, targetEmail);
        if (result.success) {
          onRemoveSuccess(targetEmail);
        }
      } catch (err) {
        setError(err.message);
      }
    });
  };

  const handleTransfer = async (targetEmail) => {
    setError('');
    setSuccess('');
    startTransition(async () => {
      try {
        const result = await transferProjectOwnership(projectId, targetEmail);
        if (result?.success) {
          setSuccess('Propriété transférée avec succès.');
          router.refresh();
        }
      } catch (err) {
        setError(err.message);
      }
    });
  };

  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
          <div>
            <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">
              Share Project
            </h2>
            <h3 className="text-lg font-bold text-slate-900 truncate max-w-[250px]">{title}</h3>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6">
          <p className="text-sm text-slate-500 mb-4">
            Invite collaborators by their email address to work together.
          </p>

          <div className="relative flex items-center gap-2">
            <div className="relative flex-grow text-slate-400 focus-within:text-blue-600 transition-colors">
              <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="email"
                placeholder="colleague@company.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={isPending}
                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
              />
            </div>

            <div className="relative" ref={roleRef}>
              <button
                type="button"
                onClick={() => setRoleOpen((o) => !o)}
                disabled={isPending}
                className="flex items-center gap-2 pl-3 pr-2.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 transition-all text-sm font-medium text-slate-700 hover:bg-slate-100 whitespace-nowrap"
              >
                <currentRole.icon size={15} className="text-slate-400" />
                {currentRole.label}
                <ChevronDown
                  size={14}
                  className={`text-slate-400 transition-transform ${roleOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {roleOpen && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-slate-200 rounded-xl shadow-lg overflow-hidden z-10 animate-in fade-in zoom-in-95 duration-150 origin-top-right">
                  {roles.map((r) => {
                    const Icon = r.icon;
                    const active = r.value === role;
                    return (
                      <button
                        key={r.value}
                        type="button"
                        onClick={() => {
                          setRole(r.value);
                          setRoleOpen(false);
                        }}
                        className={`w-full flex items-center gap-2.5 px-3.5 py-2.5 text-sm text-left transition-colors ${
                          active
                            ? 'bg-blue-50 text-blue-700 font-semibold'
                            : 'text-slate-700 hover:bg-slate-50'
                        }`}
                      >
                        <Icon size={15} className={active ? 'text-blue-600' : 'text-slate-400'} />
                        <span className="flex-grow">{r.label}</span>
                        {active && <Check size={14} className="text-blue-600" />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            <button
              className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-2.5 rounded-xl transition-all shadow-sm shadow-blue-200"
              onClick={handleShare}
              disabled={isPending || !email}
            >
              {isPending ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <Plus data-test="add-shared-user" size={20} />
              )}
            </button>
          </div>

          {error && (
            <div className="mt-3 text-xs font-medium text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {success && (
            <div className="mt-3 text-xs font-medium text-emerald-700 bg-emerald-50 p-2 rounded-lg border border-emerald-100">
              {success}
            </div>
          )}

          <div className="mt-8" data-test="shared-user-container">
            <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <Users size={14} /> Shared with ({users.length})
            </h3>

            {users.length === 0 ? (
              <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                <p className="text-sm text-slate-400 italic font-medium">No one has access yet.</p>
              </div>
            ) : (
              <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                {users.map((u, index) => (
                  <li
                    key={index}
                    className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                        {u.email.charAt(0)}
                      </div>
                      <div>
                        <span className="text-sm font-medium text-slate-700 truncate max-w-[180px] block">
                          {u.email}
                        </span>
                        <span className="text-[11px] text-slate-400 uppercase tracking-widest">
                          {u.role === 'owner' ? 'Owner' : u.role === 'editor' ? 'Editor' : 'Viewer'}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {u.role !== 'owner' && (
                        <button
                          type="button"
                          className="flex items-center gap-2 px-3 py-1 text-xs font-semibold text-slate-700 bg-slate-100 rounded-full hover:bg-slate-200 transition-colors"
                          onClick={() => handleTransfer(u.email)}
                          disabled={isPending}
                        >
                          <ArrowRight size={14} /> Owner
                        </button>
                      )}
                      <button
                        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                        onClick={() => handleRemove(u.email)}
                        disabled={isPending}
                        title="Remove access"
                      >
                        <Trash size={16} />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
          <button
            onClick={onClose}
            className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
