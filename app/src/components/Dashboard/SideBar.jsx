import StorageBar from "./StorageBar";
import Link from "next/link";

export default function Sidebar() {
    return (
        <aside className="w-64 bg-white border-r h-screen flex flex-col">
            <div className="p-6 font-bold text-red-600 text-xl tracking-tighter">
                🦅 TYPST STUDIO
            </div>
            
            <nav className="flex-1 px-4 space-y-1">
                <Link href="/dashboard" className="block p-2 text-sm font-medium hover:bg-gray-50 rounded-lg transition-colors">
                    Mes Projets
                </Link>
            </nav>

            <StorageBar />
        </aside>
    );
}