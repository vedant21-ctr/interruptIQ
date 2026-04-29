

export interface LogEntry {
  id: string;
  type: string;
  decision: string;
  time: Date;
}

interface LogPanelProps {
  logs: LogEntry[];
}

export function LogPanel({ logs }: LogPanelProps) {
  return (
    <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 overflow-hidden flex flex-col h-full max-h-[300px]">
      <h3 className="text-zinc-400 font-medium mb-4 text-sm uppercase tracking-wider">Live Attention Log</h3>
      <div className="flex-1 overflow-y-auto space-y-3 pr-2 scrollbar-thin">
        {logs.map((log) => (
          <div key={log.id} className="flex items-center justify-between py-2 border-b border-zinc-800/50 last:border-0">
            <div className="flex items-center gap-3">
              <span className={`w-2 h-2 rounded-full ${
                log.decision === 'IGNORE' ? 'bg-emerald-500' :
                log.decision === 'DELAY' ? 'bg-amber-500' : 'bg-rose-500'
              }`} />
              <span className="text-sm font-medium capitalize text-zinc-300">
                {log.type} notification
              </span>
            </div>
            <div className="flex items-center gap-4">
              <span className={`text-xs font-bold uppercase tracking-wider ${
                log.decision === 'IGNORE' ? 'text-emerald-500/80' :
                log.decision === 'DELAY' ? 'text-amber-500/80' : 'text-rose-500/80'
              }`}>
                {log.decision}
              </span>
              <span className="text-xs text-zinc-600 font-mono">
                {log.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          </div>
        ))}
        {logs.length === 0 && (
          <div className="text-zinc-600 text-sm italic py-4">No notifications intercepted yet...</div>
        )}
      </div>
    </div>
  );
}
