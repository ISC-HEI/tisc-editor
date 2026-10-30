'use client';

import { useEffect, useState, useTransition } from 'react';
import { deleteUser } from '@/lib/actions/admin';

const MB = 1024 ** 2;

type Props = {
  user: {
    id: string;
    email: string;
    displayName: string;
    ownedProjectCount: number;
    storageUsed: number;
  };
  transferCandidates: { id: string; label: string }[];
  onClose: () => void;
};

export function DeleteUserDialog({ user, transferCandidates, onClose }: Props) {
  const hasProjects = user.ownedProjectCount > 0;
  const [mode, setMode] = useState<'transfer' | 'delete'>(hasProjects ? 'transfer' : 'delete');
  const [targetId, setTargetId] = useState('');
  const [confirmEmail, setConfirmEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !pending && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose, pending]);

  const transfer = hasProjects && mode === 'transfer';
  const canSubmit = !pending && confirmEmail === user.email && (!transfer || targetId !== '');

  const submit = () =>
    startTransition(async () => {
      setError(null);
      try {
        await deleteUser(user.id, transfer ? targetId : null);
        onClose();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });

  const projectLabel = `${user.ownedProjectCount} owned ${
    user.ownedProjectCount === 1 ? 'project' : 'projects'
  } (${(user.storageUsed / MB).toFixed(2)} MB)`;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 text-left"
      onClick={() => !pending && onClose()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Delete ${user.displayName}`}
        className="w-full max-w-lg overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <div className="min-w-0">
            <h2 className="truncate font-semibold text-slate-900">Delete {user.displayName}</h2>
            <p className="text-xs text-slate-500">This action cannot be undone.</p>
          </div>
          <button
            onClick={onClose}
            disabled={pending}
            aria-label="Close"
            className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          >
            ✕
          </button>
        </div>

        <div className="space-y-5 px-6 py-5 text-sm">
          {hasProjects ? (
            <fieldset className="space-y-3">
              <legend className="mb-2 font-medium text-slate-900">{projectLabel}</legend>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'transfer'}
                  onChange={() => setMode('transfer')}
                  className="mt-0.5"
                />
                <span className="flex-1">
                  <span className="text-slate-700">Transfer them to another user</span>
                  {mode === 'transfer' && (
                    <select
                      value={targetId}
                      onChange={(e) => setTargetId(e.target.value)}
                      className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100"
                    >
                      <option value="">Select a user…</option>
                      {transferCandidates.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.label}
                        </option>
                      ))}
                    </select>
                  )}
                </span>
              </label>
              <label className="flex items-start gap-2">
                <input
                  type="radio"
                  name="mode"
                  checked={mode === 'delete'}
                  onChange={() => setMode('delete')}
                  className="mt-0.5"
                />
                <span className="text-red-600">Delete them permanently</span>
              </label>
            </fieldset>
          ) : (
            <p className="text-slate-600">This user doesn&apos;t own any project.</p>
          )}

          <p className="text-xs text-slate-500">
            Their comments and access to shared projects will also be removed.
          </p>

          <label className="block">
            <span className="text-slate-700">
              Type <span className="font-mono font-semibold">{user.email}</span> to confirm
            </span>
            <input
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              disabled={pending}
              className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-slate-900 outline-none focus:border-red-500 focus:ring-2 focus:ring-red-100"
            />
          </label>

          {error && (
            <p role="alert" className="text-xs text-red-600">
              {error}
            </p>
          )}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
          <button
            onClick={onClose}
            disabled={pending}
            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            Cancel
          </button>
          <button
            onClick={submit}
            disabled={!canSubmit}
            className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            {pending ? 'Deleting…' : 'Delete user'}
          </button>
        </div>
      </div>
    </div>
  );
}
