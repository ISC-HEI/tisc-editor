"use client";

import { useState, useTransition } from "react";
import { setUserDisabled, updateUserQuota } from "@/lib/actions/admin";

const MB = 1024 ** 2;

type Props = {
  user: {
    id: string;
    name: string | null;
    email: string;
    disabled: boolean;
    storageQuota: number;
    createdAt: string;
  };
  isSelf: boolean;
};

export function UserRow({ user, isSelf }: Props) {
  const [quotaMb, setQuotaMb] = useState(String(user.storageQuota / MB));
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    startTransition(async () => {
      setError(null);
      try {
        await fn();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });

  const changed = Math.round(Number(quotaMb) * MB) !== user.storageQuota;
  const initial = (user.name ?? user.email)[0]?.toUpperCase();

  return (
    <tr className={`align-middle transition hover:bg-slate-50/60 ${user.disabled ? "opacity-70" : ""}`}>
      {/* User */}
      <td className="px-8 py-4">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-blue-50 text-sm font-semibold text-blue-600">
            {initial}
          </div>
          <div className="min-w-0">
            <p className="truncate font-medium text-slate-900">
              {user.name ?? "—"}
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
      <td className="px-4 py-4 text-slate-500">
        {new Date(user.createdAt).toLocaleDateString()}
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
            disabled={pending || !changed || quotaMb === ""}
            onClick={() => run(() => updateUserQuota(user.id, Math.round(Number(quotaMb) * MB)))}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-slate-100 disabled:text-slate-400"
          >
            Save
          </button>
        </div>
        {error && <p role="alert" className="mt-1 text-xs text-red-600">{error}</p>}
      </td>

      {/* Status */}
      <td className="px-4 py-4">
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold uppercase tracking-wide ${
            user.disabled ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700"
          }`}
        >
          <span className={`h-1.5 w-1.5 rounded-full ${user.disabled ? "bg-amber-500" : "bg-emerald-500"}`} />
          {user.disabled ? "Disabled" : "Active"}
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
              ? "border-emerald-200 text-emerald-700 hover:bg-emerald-50"
              : "border-red-200 text-red-600 hover:bg-red-50"
          }`}
        >
          {pending ? "…" : user.disabled ? "Enable" : "Disable"}
        </button>
      </td>
    </tr>
  );
}
