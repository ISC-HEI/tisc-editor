import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { getAllUsers } from "@/lib/actions/admin";
import { UserRow } from "@/components/Admin/user-row";

export default async function AdminDashboard() {
    const session = await auth();
    if (!session || session.error === "RefreshTokenError") redirect("/login");
    if (!session.user?.isAdmin) redirect("/dashboard");

    const users = await getAllUsers();

    return (
        <div className="p-6">
            <h1 className="mb-4 text-2xl font-semibold">Admin Dashboard</h1>
            <table className="w-full text-left text-sm">
                <thead>
                    <tr className="border-b">
                        <th className="py-2">Name</th>
                        <th>Email</th>
                        <th>Created</th>
                        <th>Quota (MB)</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
                    {users.map((u) => (
                        <UserRow
                            key={u.id}
                            user={{ ...u, createdAt: u.createdAt.toISOString() }}
                            isSelf={u.id === session.user.id}
                        />
                    ))}
                </tbody>
            </table>
        </div>
    );
}
