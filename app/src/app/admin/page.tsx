import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function AdminDashboard() {
    const session = await auth();
    if (!session || session.error === 'RefreshTokenError') redirect('/login');
    if (!session?.user?.isAdmin) redirect('/dashboard');

    return <div>Admin Dashboard</div>;
}

// TODO
// - List all users
// - For each user, add possibility to edit quota and possibility to disable account