import { motion } from 'framer-motion';

export const SCENARIOS = [
  {
    id: 'focus',
    label: 'Focus Mode',
    icon: '🧠',
    context: { location: 'home', motion: 1, heart_rate: 65, battery: 90, activity: 'active' },
    notification: 'social',
    expected: 'IGNORE'
  },
  {
    id: 'driving',
    label: 'Driving Mode',
    icon: '🚗',
    context: { location: 'road', motion: 9, heart_rate: 80, battery: 60, activity: 'idle' },
    notification: 'social',
    expected: 'DELAY'
  },
  {
    id: 'stress',
    label: 'Stress Mode',
    icon: '📈',
    context: { location: 'office', motion: 3, heart_rate: 110, battery: 70, activity: 'active' },
    notification: 'work',
    expected: 'DELAY'
  },
  {
    id: 'battery',
    label: 'Low Battery',
    icon: '🔋',
    context: { location: 'home', motion: 2, heart_rate: 70, battery: 5, activity: 'idle' },
    notification: 'social',
    expected: 'IGNORE'
  },
  {
    id: 'emergency',
    label: 'Emergency',
    icon: '🚨',
    context: { location: 'road', motion: 10, heart_rate: 120, battery: 15, activity: 'idle' },
    notification: 'urgent',
    expected: 'NOTIFY NOW'
  }
];

export function DemoPanel({ onTrigger }: { onTrigger: (ctx: any, notif: string, exp: string) => void }) {
  return (
    <div className="glass-card p-6 min-h-[160px] flex flex-col justify-center">
      <div className="text-xs uppercase tracking-[0.2em] font-bold text-violet-500/80 mb-4">Demo Scenarios</div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        {SCENARIOS.map(s => (
          <motion.button
            key={s.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onTrigger(s.context, s.notification, s.expected)}
            className="flex flex-col items-center justify-center p-3 rounded-xl bg-zinc-900/50 border border-zinc-800 hover:border-violet-500/50 hover:bg-violet-500/10 transition-colors text-center cursor-pointer"
          >
            <span className="text-2xl mb-1">{s.icon}</span>
            <span className="text-xs font-semibold text-zinc-300">{s.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
