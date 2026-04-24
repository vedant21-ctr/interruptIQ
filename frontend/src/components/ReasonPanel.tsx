import { motion, AnimatePresence } from 'framer-motion';

export function ReasonPanel({ reason, confidence }: { reason: string, confidence: number }) {
  return (
    <div className="glass-card p-6 min-h-[160px] flex flex-col justify-center">
      <div className="text-xs uppercase tracking-[0.2em] font-bold text-violet-500/80 mb-3">AI Context Analysis</div>
      <AnimatePresence mode="wait">
        <motion.div
          key={reason}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.4 }}
        >
          {reason ? (
            <>
              <p className="text-lg text-zinc-300 font-medium leading-relaxed mb-4">{reason}</p>
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-violet-500/10 border border-violet-500/20">
                <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
                <span className="text-sm font-semibold text-violet-300 tracking-wide">Confidence: {confidence}%</span>
              </div>
            </>
          ) : (
            <p className="text-zinc-600 italic">Awaiting AI context synthesis...</p>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
