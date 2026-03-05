export default function Footer() {
    const version = process.env.NEXT_PUBLIC_APP_VERSION || "v0.0.0";
    const isDev = version.includes('-') && !version.includes('main');

    return (
        <footer className="absolute bottom-0 left-0 w-full z-10 py-3 px-6 flex items-center justify-between pointer-events-none select-none bg-transparent">
            
            <p className="text-gray-400 text-[9px] uppercase tracking-[0.2em] font-medium">
                TISC Editor
            </p>

            <div className="flex items-center gap-2 px-2 py-1 bg-white/40 backdrop-blur-md border border-gray-200/20 rounded-full shadow-sm">
                <span className={`w-1 h-1 rounded-full ${isDev ? 'bg-amber-400' : 'bg-emerald-400'}`} />
                <span className="text-gray-500 font-mono text-[9px] leading-none">
                    {version}
                </span>
            </div>

            <p className="text-gray-400 text-[9px] uppercase tracking-[0.2em] font-medium">
                Reynard Adrien
            </p>
        </footer>
    );
}