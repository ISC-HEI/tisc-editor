function Breadcrumbs({ path }) {
  if (!path) return null;

  const parts = path.split('/');

  return (
    <div className="flex items-center px-4 py-2 bg-slate-50 border-b border-slate-200 text-sm text-slate-600 font-medium overflow-x-auto whitespace-nowrap scrollbar-hide">
      {parts.map((part, index) => {
        const isLast = index === parts.length - 1;
        
        return (
          <div key={index} className="flex items-center">
            <span 
              className={`hover:text-blue-600 cursor-default ${isLast ? "text-slate-900 font-bold" : ""}`}
            >
              {part}
            </span>
            {!isLast && (
              <span className="mx-2 text-slate-400 select-none">/</span>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Breadcrumbs;