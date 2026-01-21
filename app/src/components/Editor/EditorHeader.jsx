import { ChevronLeft, FileText } from "lucide-react";
import { SignOutButton } from "../SignOutButton";

export const EditorHeader = ({ title }) => (
  <header className="h-14 border-b border-slate-200 flex items-center justify-between px-4 shrink-0 bg-white z-10">
    <div className="flex items-center gap-4">
      <a href="/dashboard" className="p-2 hover:bg-slate-100 rounded-lg text-slate-500 transition-colors" title="Back to Dashboard">
        <ChevronLeft size={20} />
      </a>
      <div className="h-6 w-[1px] bg-slate-200 mx-1" />
      <div className="flex items-center gap-2">
        <div className="bg-blue-50 text-blue-600 p-1.5 rounded">
          <FileText size={16} />
        </div>
        <h1 className="font-semibold text-sm tracking-tight">{title}</h1>
      </div>
    </div>
    <div className="flex items-center gap-3">
      <SignOutButton />
    </div>
  </header>
);