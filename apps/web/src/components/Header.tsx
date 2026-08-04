import { Cpu, LogOut } from 'lucide-react';

interface HeaderProps {
  activePage: string;
  setActivePage: (page: any) => void;
  loading: boolean;
  sync: () => void;
  handleLogout: () => void;
  token: string | null;
}

export function Header({
  activePage,
  setActivePage,
  loading,
  sync,
  handleLogout,
  token
}: HeaderProps) {
  return (
    <header className="relative z-10 bg-zinc-950/80 border-b border-zinc-800/80 px-6 py-4 flex items-center justify-between backdrop-blur-md">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
          <Cpu className="w-5 h-5 text-white" />
        </div>
        <div>
          <h1 className="text-xl font-bold tracking-tight">
            Interrupt<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">IQ</span>
          </h1>
          <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-wider">AI Context Gateway Simulator</p>
        </div>
      </div>

      <nav className="flex items-center gap-1 bg-zinc-900 border border-zinc-800 p-1 rounded-xl">
        {(['dashboard', 'context', 'injector', 'decisions', 'feedback', 'memory', 'settings'] as const).map((page) => (
          <button
            key={page}
            onClick={() => setActivePage(page)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold uppercase tracking-wider transition-all ${
              activePage === page
                ? 'bg-zinc-800 text-white shadow-sm'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            {page}
          </button>
        ))}
      </nav>

      <div className="flex items-center gap-3">
        {loading && <div className="w-2 h-2 rounded-full bg-violet-500 animate-ping" />}
        <span className="relative flex h-2.5 w-2.5">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
        </span>
        <span className="text-[11px] font-bold text-zinc-400">Host: Online</span>
        
        {token && (
          <button
            onClick={handleLogout}
            className="p-2 rounded-lg hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-all border border-transparent hover:border-zinc-700"
          >
            <LogOut className="w-4 h-4" />
          </button>
        )}
      </div>
    </header>
  );
}
