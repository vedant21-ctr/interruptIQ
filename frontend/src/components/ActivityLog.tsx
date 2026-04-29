import { motion, AnimatePresence } from 'framer-motion';
import { LogEntry } from '../hooks/useRealtimeData';

export function ActivityLog({ logs }: { logs: LogEntry[] }) {
  return (
    <div className="glass-card p-6 flex-1 flex flex-col h-full relative overflow-hidden">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
          <h3 className="text-xs uppercase tracking-[0.2em] font-black text-zinc-400">Live Activity Stream</h3>
        </div>
        <div className="w-2 h-2 rounded-full bg-blue-500 animate-ping" />
      </div>
      
      <div className="flex-1 overflow-hidden relative">
        <div className="absolute inset-0 overflow-y-auto pr-2 scrollbar-hide flex flex-col gap-4">
          <AnimatePresence initial={false}>
            {logs.map((log) => {
              let colorTag = 'text-zinc-500';
              let dotBg = 'bg-zinc-500';
              let borderCol = 'border-zinc-800';
              
              if (log.decision === 'IGNORE') { 
                colorTag = 'text-violet-400'; 
                dotBg = 'bg-violet-400'; 
                borderCol = 'border-violet-500/20'; 
              }
              if (log.decision === 'DELAY') { 
                colorTag = 'text-yellow-400'; 
                dotBg = 'bg-yellow-400'; 
                borderCol = 'border-yellow-500/20';
              }
              if (log.decision === 'NOTIFY NOW') { 
                colorTag = 'text-red-400'; 
                dotBg = 'bg-red-400'; 
                borderCol = 'border-red-500/20';
              }

              return (
                <motion.div
                  key={log.id}
                  initial={{ opacity: 0, x: -20, scale: 0.95 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ type: "spring", stiffness: 200, damping: 20 }}
                  className={`p-4 rounded-2xl glass-panel ${borderCol} flex items-center justify-between shadow-md hover:scale-[1.02] transition-transform duration-300`}
                >
                  <div className="flex items-center gap-4">
                    <div className={`w-3 h-3 rounded-full ${dotBg} shadow-[0_0_12px_currentColor]`} />
                    <div>
                      <div className="text-sm font-semibold text-zinc-200 capitalize tracking-wide">{log.type} Context</div>
                      <div className="text-[10px] text-zinc-500 font-mono mt-1 flex items-center gap-2">
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        {log.time.toLocaleTimeString([], { hour12: true, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                      </div>
                    </div>
                  </div>
                  <div className={`text-xs font-black uppercase tracking-[0.2em] px-3 py-1.5 rounded-full bg-black/40 ${colorTag}`}>
                    {log.decision}
                  </div>
                </motion.div>
              )
            })}
          </AnimatePresence>
          {logs.length === 0 && (
            <div className="h-full flex flex-col items-center justify-center opacity-50">
              <svg className="w-12 h-12 text-zinc-600 mb-4 animate-bounce" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 002-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
              <div className="text-zinc-500 text-sm italic tracking-widest uppercase">Waiting for logs...</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
