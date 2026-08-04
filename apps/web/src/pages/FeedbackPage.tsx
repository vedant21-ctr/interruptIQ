import { MessageSquare } from 'lucide-react';
import { DecisionLog } from '../types';

interface FeedbackPageProps {
  decisions: DecisionLog[];
  feedbackComment: string;
  setFeedbackComment: (val: string) => void;
  handleFeedback: (decisionId: string, action: 'ACCEPTED' | 'OVERRIDDEN' | 'DISMISSED') => void;
}

export function FeedbackPage({
  decisions,
  feedbackComment,
  setFeedbackComment,
  handleFeedback
}: FeedbackPageProps) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
      <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 mb-6 flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-emerald-400" />
        Feedback History & Overrides Logger
      </h3>

      <div className="mb-6">
        <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-2">Leave Operator Comment (applied to next override action)</label>
        <input
          type="text"
          value={feedbackComment}
          onChange={(e) => setFeedbackComment(e.target.value)}
          placeholder="Enter context override reason..."
          className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-xs outline-none text-zinc-100"
        />
      </div>

      {decisions.length === 0 ? (
        <p className="text-xs text-zinc-650 text-center py-12">No decisions logs in history databases to apply feedback overrides to.</p>
      ) : (
        <div className="space-y-3">
          {decisions.slice(0, 5).map((d) => (
            <div key={d.id} className="p-4 bg-zinc-900/80 border border-zinc-850 rounded-2xl flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="font-mono text-[10px] text-zinc-500">{d.id.substring(0, 8)}...</span>
                  <span className={`px-1.5 py-0.5 rounded font-black text-[9px] uppercase ${
                    d.decision === 'IMMEDIATE' ? 'bg-red-500/10 text-red-400' : 'bg-zinc-800 text-zinc-450'
                  }`}>{d.decision}</span>
                </div>
                <p className="text-xs text-zinc-300 mt-1.5 font-medium">Reason: {d.reason}</p>
              </div>

              <div className="flex gap-1.5">
                <button
                  onClick={() => handleFeedback(d.id, 'ACCEPTED')}
                  className="px-3 py-1.5 bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-400 border border-emerald-500/20 text-[10px] font-bold uppercase rounded-lg transition-all"
                >
                  Accept
                </button>
                <button
                  onClick={() => handleFeedback(d.id, 'OVERRIDDEN')}
                  className="px-3 py-1.5 bg-yellow-600/10 hover:bg-yellow-600/20 text-yellow-400 border border-yellow-500/20 text-[10px] font-bold uppercase rounded-lg transition-all"
                >
                  Override
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
