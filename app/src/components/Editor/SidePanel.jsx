import { X } from 'lucide-react';

export function SidePanel({ title, icon: Icon, onClose, children }) {
  return (
    <div className="absolute left-0 top-0 bottom-0 w-72 bg-white border-r border-slate-200 shadow-xl z-20 flex flex-col">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between bg-slate-50/60">
        <div className="flex items-center gap-2 min-w-0">
          {Icon && <Icon size={15} className="text-slate-400 shrink-0" />}
          <h3 className="font-semibold text-[13px] text-slate-700 truncate">{title}</h3>
        </div>
        <button
          onClick={onClose}
          title="Close"
          aria-label="Close"
          className="p-1.5 rounded-lg text-slate-500 transition-colors duration-150 hover:bg-red-50 hover:text-red-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-300 focus-visible:ring-offset-1"
        >
          <X size={16} />
        </button>
      </div>
      <div className="flex-1 overflow-y-auto p-3">{children}</div>
    </div>
  );
}
