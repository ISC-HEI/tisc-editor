import Link from 'next/link';
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { getAdminStats, getAllUsers } from '@/lib/actions/admin';
import { UserRow } from '@/components/Admin/user-row';

const MB = 1024 ** 2;
const NEAR_QUOTA_PERCENT = 90;

type User = Awaited<ReturnType<typeof getAllUsers>>[number];

const SORTS = {
  name: (u: User) => (u.name ?? u.email).toLowerCase(),
  created: (u: User) => u.createdAt.getTime(),
  lastLogin: (u: User) => u.lastLoginAt?.getTime() ?? 0,
  projects: (u: User) => u._count.projectLinks,
  usage: (u: User) => u.storageUsed,
} as const;

type SortKey = keyof typeof SORTS;

function SortHeader({
  label,
  sortKey,
  current,
  dir,
  className,
}: {
  label: string;
  sortKey: SortKey;
  current: SortKey;
  dir: 'asc' | 'desc';
  className: string;
}) {
  const active = current === sortKey;
  const nextDir = active && dir === 'asc' ? 'desc' : 'asc';
  return (
    <th
      className={className}
      aria-sort={active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none'}
    >
      <Link
        href={`/admin?sort=${sortKey}&dir=${nextDir}`}
        className={`inline-flex items-center gap-1 transition hover:text-slate-700 ${
          active ? 'text-slate-700' : ''
        }`}
      >
        {label}
        <span className="text-[10px]">{active ? (dir === 'asc' ? '▲' : '▼') : '↕'}</span>
      </Link>
    </th>
  );
}

function isNearQuota(u: User) {
  return u.storageQuota > 0
    ? (u.storageUsed / u.storageQuota) * 100 >= NEAR_QUOTA_PERCENT
    : u.storageUsed > 0;
}

export default async function AdminDashboard({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string }>;
}) {
  const session = await auth();
  if (!session || session.error === 'RefreshTokenError') redirect('/login');
  if (!session.user?.isAdmin) redirect('/dashboard');

  const params = await searchParams;
  const sort: SortKey = params.sort && params.sort in SORTS ? (params.sort as SortKey) : 'name';
  const dir = params.dir === 'desc' ? 'desc' : 'asc';

  const [users, { projectCount, totalStorage }] = await Promise.all([
    getAllUsers(),
    getAdminStats(),
  ]);

  const getValue = SORTS[sort];
  users.sort((a, b) => {
    const va = getValue(a);
    const vb = getValue(b);
    const cmp = va < vb ? -1 : va > vb ? 1 : 0;
    return dir === 'asc' ? cmp : -cmp;
  });

  const disabledCount = users.filter((u) => u.disabled).length;
  const nearQuotaCount = users.filter(isNearQuota).length;

  const stats = [
    { label: 'Total users', value: users.length, color: 'bg-blue-50 text-blue-600' },
    {
      label: 'Active',
      value: users.length - disabledCount,
      color: 'bg-emerald-50 text-emerald-600',
    },
    { label: 'Disabled', value: disabledCount, color: 'bg-amber-50 text-amber-600' },
    { label: 'Projects', value: projectCount, color: 'bg-violet-50 text-violet-600' },
    {
      label: 'Storage used (MB)',
      value: (totalStorage / MB).toFixed(1),
      color: 'bg-sky-50 text-sky-600',
    },
    {
      label: `Users ≥ ${NEAR_QUOTA_PERCENT}% of quota`,
      value: nearQuotaCount,
      color: 'bg-red-50 text-red-600',
    },
  ];

  const transferCandidates = users.map((u) => ({
    id: u.id,
    label: u.name ? `${u.name} (${u.email})` : u.email,
  }));

  const header = (label: string, sortKey: SortKey, className = 'px-4 py-3 font-medium') => (
    <SortHeader label={label} sortKey={sortKey} current={sort} dir={dir} className={className} />
  );

  return (
    <main className="min-h-screen bg-slate-50 px-6 py-12">
      <div className="mx-auto max-w-6xl">
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
                className={`flex h-12 min-w-12 items-center justify-center rounded-2xl px-2 text-lg font-bold ${s.color}`}
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
                  {header('User', 'name', 'px-8 py-3 font-medium')}
                  {header('Created', 'created')}
                  {header('Last login', 'lastLogin')}
                  {header('Projects', 'projects')}
                  {header('Quota / Usage', 'usage')}
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-8 py-3 text-right font-medium">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {users.map(({ _count, ...u }) => (
                  <UserRow
                    key={u.id}
                    user={{
                      ...u,
                      createdAt: u.createdAt.toISOString(),
                      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
                      projectCount: _count.projectLinks,
                    }}
                    transferCandidates={transferCandidates.filter((c) => c.id !== u.id)}
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
