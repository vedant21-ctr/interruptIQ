import { Settings as SettingsIcon, CheckCircle } from 'lucide-react';

interface SettingsPageProps {
  token: string | null;
  apiBase: string;
}

export function SettingsPage({
  token,
  apiBase
}: SettingsPageProps) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6 space-y-6">
      <div>
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-2 flex items-center gap-2">
          <SettingsIcon className="w-4 h-4 text-zinc-400" />
          Simulator Configurations Settings
        </h3>
        <p className="text-[11px] text-zinc-500">Inspect system builds details and operator credential variables.</p>
      </div>

      <div className="space-y-4">
        <div className="p-4 bg-zinc-900/80 border border-zinc-850 rounded-2xl flex justify-between items-center text-xs">
          <div>
            <span className="font-bold text-zinc-300">API Endpoint Base</span>
            <p className="text-[10px] text-zinc-500 mt-0.5">Where simulator hooks dispatch request payloads</p>
          </div>
          <span className="font-mono text-zinc-400">{apiBase}</span>
        </div>

        <div className="p-4 bg-zinc-900/80 border border-zinc-850 rounded-2xl flex justify-between items-center text-xs">
          <div>
            <span className="font-bold text-zinc-300">Fastify Server State</span>
            <p className="text-[10px] text-zinc-500 mt-0.5">Connection status ping results</p>
          </div>
          <span className="text-emerald-400 font-bold flex items-center gap-1.5">
            <CheckCircle className="w-4 h-4" />
            Connected
          </span>
        </div>

        <div className="p-4 bg-zinc-900/80 border border-zinc-850 rounded-2xl flex justify-between items-center text-xs">
          <div>
            <span className="font-bold text-zinc-300">Active Operator Session Token</span>
            <p className="text-[10px] text-zinc-500 mt-0.5">SHA255 session keys token hash preview</p>
          </div>
          <span className="font-mono text-[10px] text-zinc-500 truncate max-w-[200px]">{token}</span>
        </div>
      </div>
    </div>
  );
}
