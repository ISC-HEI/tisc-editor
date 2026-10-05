'use client';

import { useEffect, useState, useTransition } from 'react';
import { getUserProjects, setUserDisabled, updateUserQuota } from '@/lib/actions/admin';

const MB = 1024 ** 2;

type Props = {
  user: {
    id: string;
    name: string | null;
    email: string;
    disabled: boolean;
    storageQuota: number;
    createdAt: string;
    projectCount: number;
  };
  isSelf: boolean;
};

type ProjectItem = Awaited<ReturnType<typeof getUserProjects>>[number];

const ROLE_STYLES: Record<string, string> = {
  owner: 'bg-blue-50 text-blue-700',
  editor: 'bg-violet-50 text-violet-700',
  viewer: 'bg-slate-100 text-slate-600',
};

export function UserRow({ user, isSelf }: Props) {
  const [quotaMb, setQuotaMb] = useState(String(user.storageQuota / MB));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Projects modal
  const [open, setOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[] | null>(null);
  const [projectsError, setProjectsError] = useState<string | null>(null);
  const [loadingProjects, startLoading] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });

  const openProjects = () => {
    setOpen(true);
    startLoading(async () => {
      setProjectsError(null);
      try {
        setProjects(await getUserProjects(user.id));
      } catch (e) {
        setProjectsError(e instanceof Error ? e.message : 'Something went wrong');
      }
    });
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  const changed = Math.round(Number(quotaMb) * MB) !== user.storageQuota;
  const initial = (user.name ?? user.email)[0]?.toUpperCase();
  const displayName = user.name ?? user.email;
  const projectLabel = `${user.projectCount} ${user.projectCount === 1 ? 'project' : 'projects'}`;

  return (
    <tr
      className={`align-middle transition hover:bg-slate-50/60 ${user.disabled ? 'opacity-70' : ''}`}
    >
      {/* User */}
      <td className="px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">
              {user.name ?? '—'}
              {isSelf && (
                <span className="ml-2 rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-blue-600">
                  You
                </span>
              )}
            </p>
            <p className="truncate text-xs text-slate-500">{user.email}</p>
          </div>
        </div>
      </td>

      {/* Created */}
      <td className="px-4 py-4 text-slate-500">{new Date(user.createdAt).toLocaleDateString()}</td>

      {/* Projects */}
      <td className="px-4 py-4">
        <button
          type="button"
          onClick={openProjects}
          disabled={user.projectCount === 0}
          title={user.projectCount === 0 ? 'No projects' : 'View projects'}
          className="inline-flex items-center gap-1.5 rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100 disabled:cursor-default disabled:bg-slate-100 disabled:text-slate-400"
        >
          {projectLabel}
        </button>

        {open && (
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-4 text-left"
            onClick={() => setOpen(false)}
          >
            <div
              role="dialog"
              aria-modal="true"
              aria-label={`Projects of ${displayName}`}
              className="flex max-h-[80vh] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
                <div className="min-w-0">
                  <h2 className="truncate font-semibold text-slate-900">{displayName}</h2>
                  <p className="text-xs text-slate-500">{projectLabel}</p>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  aria-label="Close"
                  className="rounded-lg px-2 py-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
                >
                  ✕
                </button>
              </div>

              <div className="overflow-y-auto">
                {loadingProjects && !projects && (
                  <p className="px-6 py-8 text-center text-sm text-slate-400">Loading…</p>
                )}
                {projectsError && (
                  <p role="alert" className="px-6 py-8 text-center text-sm text-red-600">
                    {projectsError}
                  </p>
                )}
                {projects && projects.length === 0 && (
                  <p className="px-6 py-8 text-center text-sm text-slate-400">No projects.</p>
                )}
                <ul className="divide-y divide-slate-100">
                  {projects?.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <p className="truncate text-sm font-medium text-slate-900">{p.title}</p>
                        {!p.isActive && (
                          <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                            Inactive
                          </span>
                        )}
                      </div>
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                          ROLE_STYLES[p.role] ?? ROLE_STYLES.viewer
                        }`}
                      >
                        {p.role}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}
      </td>

      {/* Quota */}
      <td className="px-4 py-4">
        <div className="flex items-center gap-2">
          <div className="relative">
            <input
              type="number"
              min={0}
              step="any"
              value={quotaMb}
              onChange={(e) => setQuotaMb(e.target.value)}
              disabled={pending}
              className="w-28 rounded-lg border border-slate-200 bg-white py-1.5 pl-3 pr-10 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-2 focus:ring-blue-100 disabled:opacity-50"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400">
              MB
            </span>
          </div>
          <button
            disabled={pending || !changed || quotaMb === ''}
            onClick={() => run(() => updateUserQuota(user.id, Math.round(Number(quotaMb) * MB)))}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            Save
          </button>
        </div>
        {error && (
          <p role="alert" className="mt-1 text-xs text-red-600">
            {error}
          </p>
        )}
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
            user.disabled ? 'bg-amber-50 text-amber-700' : 'bg-emerald-50 text-emerald-700'
          }`}
        >
          <span
            className={`h-1.5 w-1.5 rounded-full ${user.disabled ? 'bg-amber-500' : 'bg-emerald-500'}`}
          />
          {user.disabled ? 'Disabled' : 'Active'}
        </span>
      </td>

      {/* Action */}
      <td className="px-8 py-4 text-right">
        <button
          disabled={pending || isSelf}
          onClick={() => run(() => setUserDisabled(user.id, !user.disabled))}
          title={isSelf ? "You can't disable your own account" : undefined}
          className={`rounded-lg border px-3 py-1.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
            user.disabled
              ? 'border-emerald-200 text-emerald-700 hover:bg-emerald-50'
              : 'border-red-200 text-red-600 hover:bg-red-50'
          }`}
        >
          {pending ? '…' : user.disabled ? 'Enable' : 'Disable'}
        </button>
      </td>
    </tr>
  );
}
