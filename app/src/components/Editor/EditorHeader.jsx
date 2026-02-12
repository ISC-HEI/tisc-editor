import { ChevronLeft, FileText, Users } from "lucide-react";
import { SignOutButton } from "../SignOutButton";
import { useEffect, useRef } from "react";
import { initPreviewRefs } from "@/hooks/refs";

export const EditorHeader = ({ title }) => {
  const userCountRef = useRef(null);

  useEffect(() => {
    if (userCountRef.current) {
      initPreviewRefs({
        userCount: userCountRef.current
      });
    }
  }, []);

  return (
    <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 bg-white z-10">
      <div className="flex items-center gap-4 flex-1">
        <a href="/dashboard" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Back to Dashboard">
          <ChevronLeft size={20} />
        </a>
        <div className="h-6 w-[1px] bg-slate-200 mx-1" />
        <div className="flex items-center gap-2">
          <div className="bg-blue-50 text-blue-600 p-1.5 rounded">
            <FileText size={16} />
          </div>
          <h1 className="font-semibold text-sm tracking-tight" data-test="editor-title">{title}</h1>
        </div>
      </div>
      <div className="flex items-center justify-center flex-1">
        <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-full shadow-sm">
          <div className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500"></span>
          </div>
          <span className="text-[11px] font-medium text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
            <Users size={12} className="text-slate-400" />
            <span ref={userCountRef}>1</span> Active
          </span>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 flex-1">
        <SignOutButton />
      </div>
    </header>
  );
};