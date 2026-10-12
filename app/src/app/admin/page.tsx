import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAllUsers } from '@/lib/actions/admin';
import { UserRow } from '@/components/Admin/user-row';

export default async function AdminDashboard() {
  const session = await auth();
  if (!session || session.error === 'RefreshTokenError') redirect('/login');
  if (!session.user?.isAdmin) redirect('/dashboard');

  const users = await getAllUsers();
  const disabledCount = users.filter((u: { disabled: boolean }) => u.disabled).length;

  const stats = [
    { label: 'Total users', value: users.length, color: 'bg-blue-50 text-blue-600' },
    {
      label: 'Active',
      value: users.length - disabledCount,
      color: 'bg-emerald-50 text-emerald-600',
    },
    { label: 'Disabled', value: disabledCount, color: 'bg-amber-50 text-amber-600' },
  ];

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <div className="border-l-4 border-blue-600 pl-3">
              <span className="text-xs font-semibold uppercase tracking-widest text-blue-600">
                Administration
              </span>
            </div>
            <h1 className="mt-3 text-4xl font-bold tracking-tight text-slate-900">
              User management
            </h1>
            <p className="mt-2 text-slate-500">Manage storage quotas and account access.</p>
          </div>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50"
          >
            ← Back to dashboard
          </Link>
        </div>

        {/* Stats */}
        <div className="mt-10 grid gap-4 sm:grid-cols-3">
          {stats.map((s) => (
            <div
              key={s.label}
              className="flex items-center gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
            >
              <div
                className={`flex h-12 w-12 items-center justify-center rounded-2xl text-lg font-bold ${s.color}`}
              >
                {s.value}
              </div>
              <p className="text-sm text-slate-500">{s.label}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <section className="mt-8 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
          <div className="flex items-center justify-between border-b border-slate-100 px-8 py-5">
            <h2 className="font-semibold text-slate-900">Users</h2>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {users.length} total
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="text-xs uppercase tracking-widest text-slate-400">
                  <th className="px-8 py-3 font-medium">User</th>
                  <th className="px-4 py-3 font-medium">Created</th>
                  <th className="px-4 py-3 font-medium">Projects</th>
                  <th className="px-4 py-3 font-medium">Quota</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-8 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {/* eslint-disable-next-line @typescript-eslint/ban-ts-comment */}
                {/* @ts-ignore */}
                {users.map(({ _count, ...u }) => (
                  <UserRow
                    key={u.id}
                    user={
                      {
                        ...u,
                        createdAt: u.createdAt.toISOString(),
                        projectCount: _count.projectLinks,
                      } as Parameters<typeof UserRow>[0]['user']
                    }
                    isSelf={u.id === session.user.id}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
