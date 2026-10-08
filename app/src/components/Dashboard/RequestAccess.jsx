'use client';

import { useActionState } from 'react';
import Link from 'next/link';
import { requestProjectAccess } from '@/lib/actions/access-requests';

export default function RequestAccess({ projectId, email }) {
  const [state, formAction, pending] = useActionState(requestProjectAccess, {});

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-lg text-center">
        <p className="font-mono text-sm tracking-widest text-neutral-400">403</p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
          You need access
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-500">
          You do not have permission to open this project. You can ask its owner for access.
        </p>

        <div className="mx-auto mt-8 max-w-xs rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left font-mono text-xs shadow-sm">
          <div className="flex gap-2">
            <span className="select-none text-neutral-300">1</span>
            <span>
              <span className="text-violet-500">#error</span>
              <span className="text-neutral-400">:</span>{' '}
              <span className="text-neutral-600">access required</span>
            </span>
          </div>
          {email && (
            <div className="mt-1 flex gap-2">
              <span className="select-none text-neutral-300">2</span>
              <span>
                <span className="text-violet-500">#user</span>
                <span className="text-neutral-400">:</span>{' '}
                <span className="break-all text-neutral-600">{email}</span>
              </span>
            </div>
          )}
        </div>

        {state.success && (
          <p role="status" className="mx-auto mt-6 max-w-sm text-sm leading-6 text-emerald-600">
            Request sent. The owner has been notified by email.
          </p>
        )}

        {state.error && (
          <p role="alert" className="mx-auto mt-6 max-w-sm text-sm leading-6 text-red-600">
            {state.error}
          </p>
        )}

        <div className="mt-8 flex items-center justify-center gap-3">
          {!state.success && (
            <form action={formAction}>
              <input type="hidden" name="projectId" value={projectId} />
              <button
                type="submit"
                disabled={pending}
                className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
              >
                {pending ? 'Sending…' : 'Request access'}
              </button>
            </form>
          )}

          <Link
            href="/dashboard"
            className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
          >
            Back to dashboard
          </Link>
        </div>
      </div>
    </main>
  );
}
