import { motion, useSpring, useTransform } from 'framer-motion';
import { useEffect } from 'react';

export function Counter({ value }: { value: number }) {
  const springValue = useSpring(value, { stiffness: 100, damping: 20 });
  
  useEffect(() => {
    springValue.set(value);
  }, [value, springValue]);

  return (
    <div className="flex items-center justify-between glass-card p-6">
      <div className="text-sm font-bold uppercase tracking-[0.2em] text-emerald-500">
        Focus Saved Today
      </div>
      <div className="flex items-baseline gap-2">
        <motion.span className="text-4xl font-black text-emerald-400">
          {useTransform(springValue, (latest) => Math.round(latest))}
        </motion.span>
        <span className="text-zinc-500 font-bold uppercase text-sm tracking-wider">min</span>
      </div>
    </div>
  );
}
