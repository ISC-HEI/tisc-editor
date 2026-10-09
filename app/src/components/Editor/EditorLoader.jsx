const sk = 'h-2.5 rounded-full bg-slate-200 dark:bg-slate-700 animate-pulse';

function Lines(widths) {
  return (
    <div className="flex flex-col gap-3">
      {widths.map((w, i) =>
        w === 0 ? (
          <div key={i} className="h-3" />
        ) : (
          <div key={i} className={sk} style={{ width: `${w}%` }} />
        ),
      )}
    </div>
  );
}

export default function EditorLoader() {
  return (
    <div
      role="status"
      aria-live="polite"
      aria-label="Loading the editor"
      className="fixed inset-0 z-50 flex flex-col bg-slate-50 text-slate-800 dark:bg-slate-950 dark:text-slate-100"
    >
      {/* Progress bar */}
      <div className="h-[3px] w-full bg-slate-200 dark:bg-slate-800">
        <div className="h-full w-1/3 animate-pulse rounded-full bg-cyan-500 dark:bg-cyan-400" />
      </div>

      {/* Fake toolbar */}
      <div className="flex h-12 items-center gap-3 border-b border-slate-200 bg-white px-4 dark:border-slate-800 dark:bg-slate-900">
        <div className={`${sk} w-24`} />
        <div className={`${sk} w-40`} />
        <div className="flex-1" />
        <div className="h-6 w-20 animate-pulse rounded-md bg-slate-200 dark:bg-slate-700" />
      </div>

      {/* Fake split view */}
      <div className="relative grid min-h-0 flex-1 grid-cols-1 gap-3 p-3 md:grid-cols-2">
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <Lines widths={[92, 78, 86, 40, 0, 95, 70, 88, 55, 0, 82, 90, 64, 76]} />
        </div>

        <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 md:block">
          <div className="mx-auto mt-2 aspect-[1/1.414] w-[min(320px,70%)] rounded-md border border-slate-200 p-6 shadow-lg dark:border-slate-700">
            <div className={`${sk} mb-5 h-3.5 w-[55%]`} />
            <Lines widths={[100, 94, 98, 60, 0, 96, 88, 100, 72]} />
          </div>
        </div>

        {/* Centered badge */}
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="flex items-center gap-3 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm shadow-xl dark:border-slate-700 dark:bg-slate-900">
            <div className="h-[18px] w-[18px] animate-spin rounded-full border-2 border-slate-200 border-t-cyan-500 dark:border-slate-700 dark:border-t-cyan-400" />
            <div>
              <div>Loading your editor…</div>
              <div className="text-xs text-slate-500 dark:text-slate-400">
                Preparing your workspace
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
