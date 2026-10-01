import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminDashboard() {
  const session = await auth();
  if (!session?.user?.isAdmin) redirect('/dashboard');
  return <div>Admin Dashboard</div>;
}