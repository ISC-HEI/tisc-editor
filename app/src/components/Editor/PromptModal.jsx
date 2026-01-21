export const PromptModal = ({ isOpen, title, value, onChange, onConfirm, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-slate-900/40 backdrop-blur-sm">
      <div className="bg-white p-6 rounded-2xl shadow-2xl w-80 border border-slate-200 animate-in fade-in zoom-in duration-200">
        <h3 className="text-lg font-bold mb-4 text-slate-900 leading-tight">{title}</h3>
        <input 
          autoFocus
          placeholder="Enter name..."
          className="w-full px-4 py-2 border border-slate-200 rounded-xl mb-6 outline-none focus:ring-2 focus:ring-blue-500 transition-all"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && onConfirm()}
        />
        <div className="flex gap-3 justify-end">
          <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-slate-500 hover:text-slate-700">Cancel</button>
          <button onClick={onConfirm} className="px-5 py-2 bg-blue-600 text-white text-sm font-semibold rounded-xl hover:bg-blue-700 shadow-sm shadow-blue-200 transition-all">Confirm</button>
        </div>
      </div>
    </div>
  );
};