import { LineChart, Line, XAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { GraphDataPoint } from '../hooks/useRealtimeData';

export function AttentionGraph({ data }: { data: GraphDataPoint[] }) {
  return (
    <div className="glass-card p-6 h-full min-h-[250px] flex flex-col">
      <h3 className="text-xs uppercase tracking-[0.2em] font-bold text-zinc-500 mb-6">Attention Activity</h3>
      
      <div className="flex-1 w-full -ml-4">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data}>
            <XAxis dataKey="time" hide />
            <Tooltip 
              contentStyle={{ backgroundColor: '#18181b', border: '1px solid #27272a', borderRadius: '12px' }}
              itemStyle={{ fontWeight: 600 }}
              labelStyle={{ color: '#a1a1aa', marginBottom: '4px' }}
            />
            <Line type="monotone" dataKey="ignored" stroke="#9ca3af" strokeWidth={3} dot={false} isAnimationActive={true} animationDuration={500} />
            <Line type="monotone" dataKey="delayed" stroke="#eab308" strokeWidth={3} dot={false} isAnimationActive={true} animationDuration={500} />
            <Line type="monotone" dataKey="notified" stroke="#ef4444" strokeWidth={3} dot={false} isAnimationActive={true} animationDuration={500} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      <div className="flex gap-4 mt-4 justify-center">
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-zinc-400"></span><span className="text-xs font-bold text-zinc-400">Ignored</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-yellow-500"></span><span className="text-xs font-bold text-yellow-500">Delayed</span></div>
        <div className="flex items-center gap-2"><span className="w-3 h-3 rounded-full bg-red-500"></span><span className="text-xs font-bold text-red-500">Notified</span></div>
      </div>
    </div>
  );
}
