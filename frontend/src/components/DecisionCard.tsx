import { motion, AnimatePresence } from 'framer-motion';

export function DecisionCard({ decision }: { decision: string }) {
  const isIgnore = decision === 'IGNORE';
  const isDelay = decision === 'DELAY';
  const isNotify = decision === 'NOTIFY NOW';

  let colorStr = 'var(--c-neutral)';
  let glowStr = '0 0 0px var(--c-neutral)';
  let bgGradient = 'from-zinc-800/20 to-zinc-900/20';
  
  if (isIgnore) { 
    colorStr = 'var(--c-ignore)'; 
    glowStr = '0 0 40px rgba(167, 139, 250, 0.5)'; 
    bgGradient = 'from-violet-900/20 to-zinc-900/20';
  }
  if (isDelay) { 
    colorStr = 'var(--c-delay)'; 
    glowStr = '0 0 40px rgba(251, 191, 36, 0.5)'; 
    bgGradient = 'from-yellow-900/20 to-zinc-900/20';
  }
  if (isNotify) { 
    colorStr = 'var(--c-notify)'; 
    glowStr = '0 0 60px rgba(248, 113, 113, 0.6)'; 
    bgGradient = 'from-red-900/20 to-zinc-900/20';
  }

  return (
    <motion.div 
      className={`glass-card flex flex-col items-center justify-center p-12 min-h-[350px] relative overflow-hidden h-full bg-gradient-to-br ${bgGradient} transition-colors duration-1000`}
      layout
    >
      <div className="absolute top-5 left-5 flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]" />
        <span className="text-[10px] font-bold uppercase tracking-[0.25em] text-zinc-400">Live Decision</span>
      </div>

      {/* Decorative Grid Background */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.02)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.02)_1px,transparent_1px)] bg-[size:32px_32px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_70%)] pointer-events-none" />

      <AnimatePresence mode="wait">
        <motion.div
          key={decision || 'empty'}
          initial={{ scale: 0.8, opacity: 0, filter: 'blur(10px)', y: 20 }}
          animate={{ scale: 1, opacity: 1, filter: 'blur(0px)', y: 0 }}
          exit={{ scale: 0.8, opacity: 0, filter: 'blur(10px)', y: -20 }}
          transition={{ duration: 0.5, type: "spring", bounce: 0.4 }}
          className="text-center z-10"
        >
          {decision ? (
            <motion.h1
              className="text-6xl md:text-8xl font-black tracking-tighter"
              style={{ color: colorStr, textShadow: glowStr }}
              animate={{ 
                textShadow: [glowStr, '0 0 15px rgba(255,255,255,0.1)', glowStr],
                scale: [1, 1.02, 1]
              }}
              transition={{ repeat: Infinity, duration: 3, ease: "easeInOut" }}
            >
              {decision}
            </motion.h1>
          ) : (
            <div className="flex flex-col items-center gap-4">
              <div className="flex gap-2">
                {[0, 1, 2].map((i) => (
                  <motion.div
                    key={i}
                    className="w-3 h-3 rounded-full bg-zinc-600"
                    animate={{ y: [0, -10, 0], opacity: [0.3, 1, 0.3] }}
                    transition={{ repeat: Infinity, duration: 1, delay: i * 0.2 }}
                  />
                ))}
              </div>
              <h1 className="text-2xl font-medium text-zinc-500 tracking-widest uppercase text-sm mt-4">Monitoring Stream...</h1>
            </div>
          )}
        </motion.div>
      </AnimatePresence>
    </motion.div>
  );
}
