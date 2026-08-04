import { Layers } from 'lucide-react';
import { DecisionLog } from '../types';

interface DecisionsPageProps {
  decisions: DecisionLog[];
  decisionFilter: 'ALL' | 'IMMEDIATE' | 'BATCH' | 'IGNORE';
  setDecisionFilter: (val: 'ALL' | 'IMMEDIATE' | 'BATCH' | 'IGNORE') => void;
}

export function DecisionsPage({
  decisions,
  decisionFilter,
  setDecisionFilter
}: DecisionsPageProps) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
          <Layers className="w-4 h-4 text-violet-400" />
          Decision History Explorer
        </h3>

        <div className="flex items-center gap-1.5">
          {(['ALL', 'IMMEDIATE', 'BATCH', 'IGNORE'] as const).map((filter) => (
            <button
              key={filter}
              onClick={() => setDecisionFilter(filter)}
              className={`px-3 py-1 rounded-lg text-[9px] font-bold uppercase border transition-all ${
                decisionFilter === filter
                  ? 'bg-zinc-800 text-white border-zinc-700'
                  : 'text-zinc-500 hover:text-zinc-300 border-transparent'
              }`}
            >
              {filter}
            </button>
          ))}
        </div>
      </div>

      {decisions.length === 0 ? (
        <p className="text-xs text-zinc-650 text-center py-12">No decisions logs in history databases yet.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] text-left border-collapse">
            <thead>
              <tr className="border-b border-zinc-850 text-zinc-500 uppercase tracking-wider font-bold">
                <th className="py-2.5">Decision ID</th>
                <th className="py-2.5">Decision Type</th>
                <th className="py-2.5">Reason</th>
                <th className="py-2.5 text-right">Confidence</th>
                <th className="py-2.5 text-right">Timestamp</th>
              </tr>
            </thead>
            <tbody>
              {decisions
                .filter((d) => decisionFilter === 'ALL' || d.decision === decisionFilter)
                .map((d) => (
                  <tr key={d.id} className="border-b border-zinc-850 hover:bg-zinc-900/20">
                    <td className="py-3 font-mono text-[10px] text-zinc-500 max-w-[120px] truncate">{d.id}</td>
                    <td className="py-3">
                      <span className={`px-1.5 py-0.5 rounded font-black uppercase text-[9px] ${
                        d.decision === 'IMMEDIATE' ? 'bg-red-950 text-red-400' :
                        d.decision === 'BATCH' ? 'bg-yellow-950 text-yellow-400' :
                        'bg-zinc-800 text-zinc-400'
                      }`}>{d.decision}</span>
                    </td>
                    <td className="py-3 text-zinc-300 max-w-[200px] truncate">{d.reason}</td>
                    <td className="py-3 text-right font-mono font-bold text-zinc-400">{Math.round(d.confidence * 100)}%</td>
                    <td className="py-3 text-right text-zinc-500">{new Date(d.createdAt).toLocaleTimeString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
