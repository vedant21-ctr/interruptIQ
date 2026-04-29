import { motion, AnimatePresence } from 'framer-motion';

export function ReasonPanel({ reason, confidence }: { reason: string, confidence: number }) {
  return (
    <div className="glass-card p-8 min-h-[180px] flex flex-col justify-center relative group">
      <div className="absolute top-0 left-0 w-1 h-full bg-gradient-to-b from-blue-500 to-violet-500 opacity-50 group-hover:opacity-100 transition-opacity duration-500" />
      
      <div className="flex items-center justify-between mb-4">
        <div className="text-xs uppercase tracking-[0.2em] font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-violet-400 flex items-center gap-2">
          <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          AI Context Analysis
        </div>
        
        <AnimatePresence>
          {reason && (
            <motion.div 
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              className="inline-flex items-center gap-2 px-3 py-1 rounded-full glass-panel"
            >
              <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse shadow-[0_0_8px_rgba(96,165,250,0.8)]" />
              <span className="text-xs font-bold text-blue-300 tracking-wider">CONF: {confidence}%</span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={reason || 'empty'}
          initial={{ opacity: 0, y: 15, filter: 'blur(5px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -15, filter: 'blur(5px)' }}
          transition={{ duration: 0.4, type: "spring" }}
        >
          {reason ? (
            <p className="text-lg md:text-xl text-zinc-200 font-light leading-relaxed tracking-wide">
              {reason}
            </p>
          ) : (
            <div className="flex items-center gap-3 opacity-50">
              <div className="w-5 h-5 border-2 border-zinc-600 border-t-zinc-400 rounded-full animate-spin" />
              <p className="text-zinc-400 italic text-sm tracking-wide">Awaiting AI context synthesis...</p>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
