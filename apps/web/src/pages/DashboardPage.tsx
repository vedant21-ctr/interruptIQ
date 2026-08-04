import { Activity, Layers } from 'lucide-react';
import { EventLog, DecisionLog } from '../types';
import { StatsMatrix } from '../components/StatsMatrix';

interface DashboardPageProps {
  events: EventLog[];
  decisions: DecisionLog[];
  feedbackStats: { overrideRate: number } | null;
  memories: any[];
}

export function DashboardPage({
  events,
  decisions,
  feedbackStats,
  memories
}: DashboardPageProps) {
  const overridePercent = feedbackStats ? Math.round(feedbackStats.overrideRate * 100) : 0;

  return (
    <div className="space-y-6">
      <StatsMatrix
        eventsCount={events.length}
        decisionsCount={decisions.length}
        overrideRate={overridePercent}
        memoriesCount={memories.length}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
            <Activity className="w-4 h-4 text-emerald-400" />
            Ingested Event Feeds
          </h3>
          
          {events.length === 0 ? (
            <p className="text-xs text-zinc-600 mt-6 text-center">No simulation events injected yet.</p>
          ) : (
            <div className="space-y-2 mt-4">
              {events.map((ev) => (
                <div key={ev.id} className="p-3 bg-zinc-900/85 border border-zinc-850 rounded-xl flex justify-between items-center">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-white">{ev.sender}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 uppercase font-semibold">{ev.source}</span>
                    </div>
                    <p className="text-[10px] text-zinc-400 mt-0.5 truncate max-w-[200px]">{ev.title}</p>
                  </div>
                  <span className="text-[9px] font-black uppercase px-2 py-0.5 rounded bg-zinc-800 border border-zinc-750 text-zinc-300">{ev.category}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-zinc-900/40 border border-zinc-800 rounded-2xl p-5">
          <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-widest mb-3 flex items-center gap-2">
            <Layers className="w-4 h-4 text-violet-400" />
            Latest AI Pipeline Decisions
          </h3>
          
          {decisions.length === 0 ? (
            <p className="text-xs text-zinc-600 mt-6 text-center">No pipeline evaluations executed yet.</p>
          ) : (
            <div className="space-y-2 mt-4">
              {decisions.map((dec) => (
                <div key={dec.id} className="p-3 bg-zinc-900/85 border border-zinc-850 rounded-xl flex justify-between items-center">
                  <div>
                    <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded-md ${
                      dec.decision === 'IMMEDIATE' ? 'bg-red-500/10 text-red-400 border border-red-500/20' :
                      dec.decision === 'BATCH' ? 'bg-yellow-500/10 text-yellow-400 border border-yellow-500/20' :
                      'bg-zinc-850 text-zinc-400 border border-zinc-750'
                    }`}>{dec.decision}</span>
                    <p className="text-[10px] text-zinc-500 mt-1 truncate max-w-[180px]">{dec.reason}</p>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-black text-white">{Math.round(dec.confidence * 100)}%</span>
                    <p className="text-[8px] text-zinc-600">confidence</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
