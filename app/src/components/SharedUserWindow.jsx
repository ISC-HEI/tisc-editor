"use client"
import { useState, useTransition } from "react"
import { shareProject, removeSharedUser } from "@/app/dashboard/actions"
import { Trash, Plus, Users, X, Mail, Loader2 } from "lucide-react"

export default function SharedUserWindow({ projectId, title, users, onClose, onRemoveSuccess }) {
    const [email, setEmail] = useState('')
    const [isPending, startTransition] = useTransition()
    const [error, setError] = useState('')

    const handleShare = async () => {
        if (!email) return;
        setError('');

        startTransition(async () => {
            try {
                await shareProject(projectId, email);
                setEmail('');
            } catch (err) {
                setError(err.message);
            }
        });
    }

    const handleRemove = async (targetEmail) => {
        setError('');
        startTransition(async () => {
            try {
                const result = await removeSharedUser(projectId, targetEmail);
                if (result.success) {
                    onRemoveSuccess(targetEmail);
                }
            } catch (err) {
                setError(err.message);
            }
        });
    }

    return (
        <div 
            className="fixed inset-0 z-[300] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4" 
            onClick={onClose}
        >
            <div 
                className="bg-white w-full max-w-md rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200" 
                onClick={(e) => e.stopPropagation()}
            >
                <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
                    <div>
                        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest">Share Project</h2>
                        <h3 className="text-lg font-bold text-slate-900 truncate max-w-[250px]">{title}</h3>
                    </div>
                    <button 
                        onClick={onClose} 
                        className="p-2 hover:bg-slate-200 rounded-full text-slate-400 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>
                
                <div className="p-6">
                    <p className="text-sm text-slate-500 mb-4">
                        Invite collaborators by their email address to work together.
                    </p>
                    
                    <div className="relative flex items-center gap-2">
                        <div className="relative flex-grow text-slate-400 focus-within:text-blue-600 transition-colors">
                            <Mail size={18} className="absolute left-3 top-1/2 -translate-y-1/2" />
                            <input 
                                type="email" 
                                placeholder="colleague@company.com" 
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                disabled={isPending}
                                className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all text-slate-900 placeholder:text-slate-400"
                            />
                        </div>
                        <button 
                            className="bg-blue-600 hover:bg-blue-700 disabled:bg-slate-200 text-white p-2.5 rounded-xl transition-all shadow-sm shadow-blue-200"
                            onClick={handleShare}
                            disabled={isPending || !email}
                        >
                            {isPending ? <Loader2 className="animate-spin" size={20} /> : <Plus size={20} />}
                        </button>
                    </div>

                    {error && (
                        <div className="mt-3 text-xs font-medium text-red-500 bg-red-50 p-2 rounded-lg border border-red-100">
                            {error}
                        </div>
                    )}

                    <div className="mt-8">
                        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
                            <Users size={14} /> Shared with ({users.length})
                        </h3>
                        
                        {users.length === 0 ? (
                            <div className="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200">
                                <p className="text-sm text-slate-400 italic font-medium">No one has access yet.</p>
                            </div>
                        ) : (
                            <ul className="space-y-2 max-h-60 overflow-y-auto pr-2 custom-scrollbar">
                                {users.map((u, index) => (
                                    <li key={index} className="flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-colors group">
                                        <div className="flex items-center gap-3">
                                            <div className="h-8 w-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-bold text-xs uppercase">
                                                {u.email.charAt(0)}
                                            </div>
                                            <span className="text-sm font-medium text-slate-700 truncate max-w-[180px]">
                                                {u.email}
                                            </span>
                                        </div>
                                        <button 
                                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all opacity-0 group-hover:opacity-100 focus:opacity-100"
                                            onClick={() => handleRemove(u.email)}
                                            disabled={isPending}
                                            title="Remove access"
                                        >
                                            <Trash size={16} />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 text-center">
                    <button 
                        onClick={onClose}
                        className="text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </div>
    );
}