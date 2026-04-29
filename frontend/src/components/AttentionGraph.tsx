import { AreaChart, Area, XAxis, Tooltip, ResponsiveContainer, CartesianGrid, YAxis } from 'recharts';
import { GraphDataPoint } from '../hooks/useRealtimeData';

export function AttentionGraph({ data }: { data: GraphDataPoint[] }) {
  return (
    <div className="glass-card p-6 h-full flex flex-col relative overflow-hidden group">
      {/* Background Glows */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/5 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-emerald-500/5 rounded-full blur-3xl" />

      <div className="flex items-center justify-between mb-6 relative z-10">
        <div className="flex items-center gap-2">
          <svg className="w-5 h-5 text-zinc-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
          </svg>
          <h3 className="text-xs uppercase tracking-[0.2em] font-black text-zinc-400">Attention Activity</h3>
        </div>
      </div>
      
      <div className="flex-1 w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorIgnored" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#a78bfa" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#a78bfa" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorDelayed" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#fbbf24" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#fbbf24" stopOpacity={0}/>
              </linearGradient>
              <linearGradient id="colorNotified" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f87171" stopOpacity={0.3}/>
                <stop offset="95%" stopColor="#f87171" stopOpacity={0}/>
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} opacity={0.5} />
            <XAxis dataKey="time" hide />
            <YAxis hide domain={['dataMin', 'dataMax + 2']} />
            <Tooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(24, 24, 27, 0.8)', 
                backdropFilter: 'blur(12px)',
                border: '1px solid rgba(255,255,255,0.1)', 
                borderRadius: '16px',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)'
              }}
              itemStyle={{ fontWeight: 800, fontFamily: 'Outfit, sans-serif' }}
              labelStyle={{ color: '#a1a1aa', marginBottom: '8px', fontSize: '12px', fontWeight: 'bold' }}
            />
            <Area type="monotone" dataKey="ignored" stroke="#a78bfa" fillOpacity={1} fill="url(#colorIgnored)" strokeWidth={3} isAnimationActive={true} animationDuration={800} />
            <Area type="monotone" dataKey="delayed" stroke="#fbbf24" fillOpacity={1} fill="url(#colorDelayed)" strokeWidth={3} isAnimationActive={true} animationDuration={800} />
            <Area type="monotone" dataKey="notified" stroke="#f87171" fillOpacity={1} fill="url(#colorNotified)" strokeWidth={3} isAnimationActive={true} animationDuration={800} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="flex flex-wrap gap-6 mt-6 justify-center relative z-10 glass-panel py-3 rounded-2xl">
        <div className="flex items-center gap-2 group cursor-pointer">
          <span className="w-3 h-3 rounded-full bg-violet-400 shadow-[0_0_8px_rgba(167,139,250,0.8)] group-hover:scale-125 transition-transform" />
          <span className="text-xs font-black uppercase tracking-wider text-violet-400">Ignored</span>
        </div>
        <div className="flex items-center gap-2 group cursor-pointer">
          <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.8)] group-hover:scale-125 transition-transform" />
          <span className="text-xs font-black uppercase tracking-wider text-yellow-400">Delayed</span>
        </div>
        <div className="flex items-center gap-2 group cursor-pointer">
          <span className="w-3 h-3 rounded-full bg-red-400 shadow-[0_0_8px_rgba(248,113,113,0.8)] group-hover:scale-125 transition-transform" />
          <span className="text-xs font-black uppercase tracking-wider text-red-400">Notified</span>
        </div>
      </div>
    </div>
  );
}
