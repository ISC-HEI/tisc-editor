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


  return (
    <tr className="border-b align-middle">
      <td className="py-2">{user.name ?? "—"}</td>
      <td>{user.email}</td>
      <td>{new Date(user.createdAt).toLocaleDateString()}</td>
      <td>
        <input
          type="number"
          min={0}
          step="any"
          value={quotaMb}
          onChange={(e) => setQuotaMb(e.target.value)}
          className="w-24 rounded border px-2 py-1"
          disabled={pending}
        />
        <button
          className="ml-2 rounded border px-2 py-1 disabled:opacity-50"
          disabled={pending || !changed || quotaMb === ""}
          onClick={() => run(() => updateUserQuota(user.id, Math.round(Number(quotaMb) * MB)))}
        >
          Save
        </button>
      </td>
      <td>
        <button
          className="rounded border px-2 py-1 disabled:opacity-50"
          disabled={pending || isSelf}
          onClick={() => run(() => setUserDisabled(user.id, !user.disabled))}
        >
          {user.disabled ? "Enable" : "Disable"}
        </button>
        {error && <span className="ml-2 text-red-600">{error}</span>}
      </td>
    </tr>
  );
}
