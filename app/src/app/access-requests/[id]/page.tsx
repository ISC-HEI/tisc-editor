import Link from 'next/link';
import { redirect, notFound } from 'next/navigation';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { resolveAccessRequest } from '@/lib/actions/access-requests';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function AccessRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth();

  if (!session?.user?.id) {
    redirect(`/login?callbackUrl=${encodeURIComponent(`/access-requests/${id}`)}`);
  }

  if (!UUID_RE.test(id)) {
    notFound();
  }

  const request = await prisma.accessRequest.findUnique({
    where: { id },
    include: {
      user: { select: { name: true, email: true } },
      project: { select: { title: true } },
    },
  });

  if (!request) {
    notFound();
  }

  const assignment = await prisma.projectAssignment.findUnique({
    where: { userId_projectId: { userId: session.user.id, projectId: request.projectId } },
  });

  if (assignment?.role !== 'owner') {
    notFound();
  }

  const isPending = request.status === 'pending';

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#fafafa] px-6">
      <div className="w-full max-w-lg text-center">
        <p className="font-mono text-sm tracking-widest text-neutral-400">ACCESS REQUEST</p>

        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-neutral-900">
          {isPending ? 'Review access request' : 'Request already handled'}
        </h1>

        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-neutral-500">
          <span className="font-medium text-neutral-700">
            {request.user.name ?? request.user.email}
          </span>{' '}
          wants to access the project{' '}
          <span className="font-medium text-neutral-700">“{request.project.title}”</span>.
        </p>

        <div className="mx-auto mt-8 max-w-xs rounded-lg border border-neutral-200 bg-white px-4 py-3 text-left font-mono text-xs shadow-sm">
          <div className="flex gap-2">
            <span className="select-none text-neutral-300">1</span>
            <span>
              <span className="text-violet-500">#user</span>
              <span className="text-neutral-400">:</span>{' '}
              <span className="break-all text-neutral-600">{request.user.email}</span>
            </span>
          </div>
          <div className="mt-1 flex gap-2">
            <span className="select-none text-neutral-300">2</span>
            <span>
              <span className="text-violet-500">#status</span>
              <span className="text-neutral-400">:</span>{' '}
              <span className="text-neutral-600">{request.status}</span>
            </span>
          </div>
        </div>

        {isPending ? (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <form action={resolveAccessRequest.bind(null, id, 'viewer')}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                Grant viewer access
              </button>
            </form>

            <form action={resolveAccessRequest.bind(null, id, 'editor')}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
              >
                Grant editor access
              </button>
            </form>

            <form action={resolveAccessRequest.bind(null, id, 'deny')}>
              <button
                type="submit"
                className="inline-flex items-center rounded-md border border-neutral-200 bg-white px-4 py-2 text-sm font-medium text-neutral-700 transition hover:bg-neutral-50"
              >
                Deny
              </button>
            </form>
          </div>
        ) : (
          <Link
            href="/dashboard"
            className="mt-8 inline-flex items-center rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-neutral-700"
          >
            Back to dashboard
          </Link>
        )}
      </div>
    </main>
  );
}
