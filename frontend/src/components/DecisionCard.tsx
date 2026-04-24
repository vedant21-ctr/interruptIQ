import { motion, AnimatePresence } from 'framer-motion';

export function DecisionCard({ decision }: { decision: string }) {
  const isIgnore = decision === 'IGNORE';
  const isDelay = decision === 'DELAY';
  const isNotify = decision === 'NOTIFY NOW';

  let colorStr = 'var(--c-neutral)';
  let glowStr = '0 0 0px var(--c-neutral)';
  
  if (isIgnore) { colorStr = 'var(--c-ignore)'; glowStr = '0 0 40px rgba(156, 163, 175, 0.4)'; }
  if (isDelay) { colorStr = 'var(--c-delay)'; glowStr = '0 0 40px rgba(234, 179, 8, 0.4)'; }
  if (isNotify) { colorStr = 'var(--c-notify)'; glowStr = '0 0 50px rgba(239, 68, 68, 0.5)'; }

  return (
    <div className="glass-card flex flex-col items-center justify-center p-12 min-h-[300px] relative overflow-hidden h-full">
      <div className="absolute top-4 left-4 text-xs font-bold uppercase tracking-[0.2em] text-zinc-500">Live Decision</div>
      <AnimatePresence mode="wait">
        <motion.div
          key={decision}
          initial={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
          animate={{ scale: [0.9, 1.1, 1], opacity: 1, filter: 'blur(0px)' }}
          exit={{ scale: 0.8, opacity: 0, filter: 'blur(10px)' }}
          transition={{ duration: 0.6, type: "spring" }}
          className="text-center"
        >
          {decision ? (
            <motion.h1
              className="text-6xl md:text-8xl font-black tracking-tighter"
              style={{ color: colorStr, textShadow: glowStr }}
              animate={{ textShadow: [glowStr, '0 0 10px rgba(0,0,0,0)', glowStr] }}
              transition={{ repeat: Infinity, duration: 2 }}
            >
              {decision}
            </motion.h1>
          ) : (
            <h1 className="text-3xl font-medium text-zinc-600 tracking-wide animate-pulse">Monitoring...</h1>
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
