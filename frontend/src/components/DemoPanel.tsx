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
    <div className="glass-card p-6 flex flex-col justify-center relative overflow-hidden group">
      <div className="absolute -top-10 -right-10 w-40 h-40 bg-violet-600/20 rounded-full blur-3xl group-hover:bg-violet-500/30 transition-all duration-700" />
      <div className="flex items-center gap-2 mb-6">
        <svg className="w-5 h-5 text-violet-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
        </svg>
        <span className="text-xs uppercase tracking-[0.2em] font-black text-violet-400">Demo Scenarios</span>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 relative z-10">
        {SCENARIOS.map((s, i) => (
          <motion.button
            key={s.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            whileHover={{ scale: 1.05, y: -2 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => onTrigger(s.context, s.notification, s.expected)}
            className="flex flex-col items-center justify-center p-4 rounded-2xl glass-panel border border-zinc-700/50 hover:border-violet-500/50 hover:bg-gradient-to-br hover:from-violet-500/20 hover:to-fuchsia-500/10 transition-all text-center cursor-pointer group shadow-lg"
          >
            <span className="text-3xl mb-2 drop-shadow-md group-hover:scale-110 transition-transform duration-300">{s.icon}</span>
            <span className="text-xs font-bold text-zinc-300 tracking-wide">{s.label}</span>
          </motion.button>
        ))}
      </div>
    </div>
  );
}
