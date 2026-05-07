export function LanguageSidebar({ isOpen, onClose, onSelectLang }) {
  if (!isOpen) return null;

  const langs = [
    { code: 'fr', label: 'Français', flag: '🇫🇷' },
    { code: 'en', label: 'English', flag: '🇬🇧' },
    { code: 'de', label: 'Deutsch', region: 'ch', flag: '🇨🇭' }
  ];

  return (
    <div className="fixed right-0 top-0 h-full w-64 bg-white shadow-2xl border-l border-slate-200 z-50 p-6 animate-in slide-in-from-right">
      <div className="flex justify-between items-center mb-8">
        <h2 className="font-bold text-xl">Languages</h2>
        <button onClick={onClose} className="text-slate-400 hover:text-slate-900">✕</button>
      </div>
      
      <div className="flex flex-col gap-3">
        {langs.map((l) => (
          <button 
            key={l.code}
            onClick={() => onSelectLang(l.code)}
            className="flex items-center gap-3 p-3 rounded-xl hover:bg-slate-50 border border-transparent hover:border-slate-200 transition-all group"
          >
            <span className="text-2xl">{l.flag}</span>
            <span className="font-medium text-slate-700 group-hover:text-blue-600">{l.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}