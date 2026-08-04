import { Cpu } from 'lucide-react';
import { DecisionLog, CriticEvaluationLog } from '../types';

interface InjectorPageProps {
  lastEvaluatedDecision: DecisionLog | null;
  lastCritic: CriticEvaluationLog | null;
  handleFeedback: (decisionId: string, action: 'ACCEPTED' | 'OVERRIDDEN' | 'DISMISSED') => void;
  loading: boolean;
}

export function InjectorPage({
  lastEvaluatedDecision,
  lastCritic,
  handleFeedback,
  loading
}: InjectorPageProps) {
  if (!lastEvaluatedDecision) {
    return (
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-12 text-center">
        <div className="w-12 h-12 rounded-2xl bg-zinc-900 flex items-center justify-center text-zinc-500 mb-4 mx-auto">
          <Cpu className="w-6 h-6 animate-pulse" />
        </div>
        <h4 className="text-sm font-bold text-zinc-400 mb-1">No Active Run Data</h4>
        <p className="text-xs text-zinc-600 max-w-sm mx-auto mt-2">Trigger a simulation run using the sidebar panel to evaluate and inspect the decision outcome telemetries.</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
      {/* Pipeline Decision Details */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block mb-4">Pipeline Evaluated Output</span>

          <div className="flex items-center justify-between">
            <span className={`text-lg font-black uppercase px-3 py-1.5 rounded-xl border ${
              lastEvaluatedDecision.decision === 'IMMEDIATE' ? 'bg-red-500/10 text-red-400 border-red-500/25' :
              lastEvaluatedDecision.decision === 'BATCH' ? 'bg-yellow-500/10 text-yellow-400 border-yellow-500/25' :
              'bg-zinc-850 text-zinc-400 border-zinc-750'
            }`}>{lastEvaluatedDecision.decision}</span>

            <div className="text-right">
              <span className="text-xl font-black text-white">{Math.round(lastEvaluatedDecision.confidence * 100)}%</span>
              <span className="block text-[8px] text-zinc-500 font-bold uppercase mt-0.5">Trust Score</span>
            </div>
          </div>

          <div className="space-y-4 mt-6">
            <div>
              <span className="text-[9px] text-zinc-500 uppercase font-black block">Decision Reason</span>
              <p className="text-xs text-zinc-300 font-medium leading-relaxed mt-1">{lastEvaluatedDecision.reason}</p>
            </div>

            {lastEvaluatedDecision.signalsUsed.length > 0 && (
              <div>
                <span className="text-[9px] text-zinc-500 uppercase font-black block mb-1.5">Attributes Attributions</span>
                <div className="flex flex-wrap gap-1">
                  {lastEvaluatedDecision.signalsUsed.map((sig, i) => (
                    <span key={i} className="text-[9px] font-bold px-2 py-0.5 rounded bg-zinc-800 text-zinc-400 border border-zinc-750">{sig}</span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {lastEvaluatedDecision.explanation?.narrative && (
          <div className="mt-8 pt-4 border-t border-zinc-800/80">
            <span className="text-[9px] text-zinc-500 uppercase font-black block mb-1">AI Explanation Narrative</span>
            <p className="text-xs text-zinc-400 leading-relaxed italic">"{lastEvaluatedDecision.explanation.narrative}"</p>
          </div>
        )}
      </div>

      {/* Decision Critic Report */}
      <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-5 flex flex-col justify-between">
        <div>
          <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block mb-4">AI Critic Report</span>

          {lastCritic ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className={`text-[10px] font-black uppercase px-2.5 py-1 rounded border ${
                  lastCritic.verdict === 'APPROPRIATE' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25' :
                  'bg-red-500/10 text-red-400 border-red-500/25'
                }`}>{lastCritic.verdict}</span>

                <div className="text-right">
                  <span className="text-base font-black text-white">{Math.round(lastCritic.confidence * 100)}%</span>
                  <p className="text-[8px] text-zinc-500 font-bold uppercase mt-0.5">Trust Score</p>
                </div>
              </div>

              <div>
                <span className="text-[9px] text-zinc-500 uppercase font-black block">Critic Verdict Details</span>
                <p className="text-xs text-zinc-300 leading-relaxed mt-1">{lastCritic.explanation}</p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl">
                  <span className="text-[9px] text-emerald-400 font-black uppercase">Strengths</span>
                  <ul className="list-disc list-inside text-[10px] text-zinc-400 space-y-1 mt-1">
                    {lastCritic.strengths.slice(0, 2).map((s, i) => <li key={i}>{s}</li>)}
                  </ul>
                </div>
                <div className="p-3 bg-zinc-900/60 border border-zinc-850 rounded-xl">
                  <span className="text-[9px] text-red-400 font-black uppercase">Weaknesses</span>
                  <ul className="list-disc list-inside text-[10px] text-zinc-400 space-y-1 mt-1">
                    {lastCritic.weaknesses.slice(0, 2).map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            <p className="text-xs text-zinc-600 mt-6 text-center animate-pulse">Running critic evaluation engine...</p>
          )}
        </div>

        {/* Quick feedback actions */}
        <div className="mt-8 pt-4 border-t border-zinc-800/80">
          <span className="text-[10px] text-zinc-500 uppercase font-black block mb-2">Override Decision Feedback</span>
          <div className="flex gap-2">
            <button
              onClick={() => handleFeedback(lastEvaluatedDecision.id, 'ACCEPTED')}
              className="flex-1 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-[10px] font-bold text-white uppercase tracking-wider transition-all"
            >
              Accept
            </button>
            <button
              onClick={() => handleFeedback(lastEvaluatedDecision.id, 'OVERRIDDEN')}
              className="flex-1 py-1.5 rounded-lg bg-yellow-600 hover:bg-yellow-500 text-[10px] font-bold text-white uppercase tracking-wider transition-all"
            >
              Override
            </button>
            <button
              onClick={() => handleFeedback(lastEvaluatedDecision.id, 'DISMISSED')}
              className="flex-1 py-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-[10px] font-bold text-white uppercase tracking-wider transition-all border border-zinc-700"
            >
              Dismiss
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
