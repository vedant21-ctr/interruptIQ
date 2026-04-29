import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export function Counter({ value }: { value: number }) {
  const springValue = useSpring(value, { stiffness: 50, damping: 15 });
  
  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return (
    <motion.div 
      whileHover={{ scale: 1.02 }}
      className="flex items-center justify-between glass-card p-6 bg-gradient-to-r from-emerald-900/20 to-transparent relative overflow-hidden group"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl group-hover:bg-emerald-500/20 transition-all duration-500" />
      
      <div className="flex items-center gap-4 relative z-10">
        <div className="p-3 glass-panel rounded-xl text-emerald-400">
          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div>
          <div className="text-xs font-bold uppercase tracking-[0.25em] text-emerald-500/80 mb-1">
            Focus Saved Today
          </div>
          <div className="flex items-baseline gap-2">
            <motion.span className="text-4xl md:text-5xl font-black text-emerald-400 drop-shadow-[0_0_15px_rgba(52,211,153,0.4)] tracking-tighter">
              {useTransform(springValue, (latest) => Math.round(latest))}
            </motion.span>
            <span className="text-emerald-500/50 font-bold uppercase text-sm tracking-widest">Minutes</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
