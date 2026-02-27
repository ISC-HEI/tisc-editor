import { useState, useEffect, useRef } from 'react';
import { AppWindow, X, Terminal, Trash2, Ban } from 'lucide-react';
import { infos } from '@/hooks/refs';

function PaneLog() {
    const [isOpen, setIsOpen] = useState(false);
    const scrollRef = useRef(null);

    useEffect(() => {
        if (isOpen && scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [isOpen, infos.logs]);

    const handleClear = (e) => {
        e.stopPropagation();
        infos.logs = [];
    };

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-2 font-sans text-slate-900">
            {isOpen && (
                <div className="w-80 sm:w-[450px] h-96 bg-white border border-slate-200 rounded-lg shadow-2xl flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
                    
                    <div className="px-3 py-2 bg-slate-50 border-b border-slate-200 flex items-center justify-between font-sans">
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2 text-slate-500 text-[11px] uppercase tracking-wider font-bold">
                                <Terminal size={14} className="text-blue-500" />
                                <span>Output</span>
                            </div>
                            <div className="h-4 w-[1px] bg-slate-300"></div>
                            <span className="text-[10px] text-slate-400 font-mono italic">
                                {infos.logs.length} entries
                            </span>
                        </div>
                        
                        <div className="flex items-center gap-1">
                            <button 
                                onClick={handleClear}
                                title="Clear Console"
                                className="p-1.5 text-slate-400 hover:text-red-500 hover:bg-slate-200/50 rounded transition-all group"
                            >
                                <Trash2 size={14} className="group-hover:scale-110" />
                            </button>
                            <button 
                                onClick={() => setIsOpen(false)}
                                className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 rounded transition-all"
                            >
                                <X size={14} />
                            </button>
                        </div>
                    </div>

                    <div 
                        ref={scrollRef} 
                        className="flex-1 overflow-y-auto bg-[#fafafa] font-mono text-[12px] selection:bg-blue-100"
                    >
                        {infos.logs.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-full text-slate-300 gap-2">
                                <Ban size={32} strokeWidth={1} />
                                <span className="text-[10px] uppercase tracking-widest font-semibold">No logs</span>
                            </div>
                        ) : (
                            <div className="flex flex-col">
                                {infos.logs.map((log) => (
                                    <div 
                                        key={log.id} 
                                        className="flex gap-3 px-4 py-1.5 border-b border-slate-100 hover:bg-slate-50 transition-colors group"
                                    >
                                        <span className="text-slate-400 shrink-0 w-16 opacity-60 group-hover:opacity-100 transition-opacity">
                                            {log.time}
                                        </span>
                                        <div className="flex gap-2 min-w-0">
                                            <span className={`font-bold shrink-0 ${
                                                log.type === 'error' ? 'text-red-500' : 
                                                log.type === 'warning' ? 'text-amber-600' : 
                                                log.type === 'success' ? 'text-green-600' : 'text-blue-600'
                                            }`}>
                                                {log.type === 'error' ? '✖' : log.type === 'warning' ? '⚠' : 'S'}
                                            </span>
                                            <span className="text-slate-700 break-words whitespace-pre-wrap leading-relaxed">
                                                {log.msg}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            <button
                onClick={() => setIsOpen(!isOpen)}
                className={`group relative p-3.5 rounded-full shadow-lg transition-all duration-300 active:scale-95 border ${
                    isOpen 
                    ? 'bg-blue-600 text-white border-transparent' 
                    : 'bg-white text-slate-500 hover:text-slate-800 border-slate-200 hover:border-slate-300'
                }`}
            >
                <AppWindow size={22} />
                
                {!isOpen && infos.logs.some(l => l.type === 'error') && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 items-center justify-center text-[8px] text-white font-bold">
                            !
                        </span>
                    </span>
                )}
            </button>
        </div>
    );
}

export default PaneLog;