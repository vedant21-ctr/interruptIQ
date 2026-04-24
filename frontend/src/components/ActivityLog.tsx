import { motion, AnimatePresence } from 'framer-motion';
import { LogEntry } from '../hooks/useRealtimeData';

export function ActivityLog({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="glass-card p-6 flex-1 flex flex-col min-h-[300px]">
      <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-6">Live Activity Log</h3>
      
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto pr-2 scrollbar-hide flex flex-col gap-3">
          <AnimatePresence initial={false}>
            {logs.map((log) => {
              let colorTag = 'text-zinc-500';
              let dotBg = 'bg-zinc-500';
              
              if (log.decision === 'IGNORE') { colorTag = 'text-zinc-400'; dotBg = 'bg-zinc-400'; }
              if (log.decision === 'DELAY') { colorTag = 'text-yellow-500'; dotBg = 'bg-yellow-500'; }
              if (log.decision === 'NOTIFY NOW') { colorTag = 'text-red-500'; dotBg = 'bg-red-500'; }

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: 50, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex items-center justify-between"
                >
                  <div className="flex items-center gap-3">
                    <div className={`w-2 h-2 rounded-full ${dotBg} shadow-[0_0_10px_currentColor]`} />
                    <div>
                      <div className="text-sm font-medium text-zinc-200 capitalize">{log.decision.toLowerCase()}: {log.type} Context</div>
                      <div className="text-xs text-zinc-600 font-mono mt-1">
                        {log.time.toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs font-black uppercase tracking-wider ${colorTag}`}>
                    {log.decision}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {logs.length === 0 && (
            <div className="text-zinc-600 text-sm italic py-4">Awaiting incoming notifications...</div>
          )}
        </div>
      </div>
    </div>
  );
}
