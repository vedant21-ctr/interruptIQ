import { Brain, Search } from 'lucide-react';

interface MemoryExplorerPageProps {
  memories: any[];
  memorySearch: string;
  setMemorySearch: (val: string) => void;
}

export function MemoryExplorerPage({
  memories,
  memorySearch,
  setMemorySearch
}: MemoryExplorerPageProps) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400 flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-400" />
          Immutable Episodic Memory Explorer
        </h3>

        <div className="relative max-w-xs w-full">
          <Search className="w-3.5 h-3.5 text-zinc-500 absolute left-3 top-2.5" />
          <input
            type="text"
            value={memorySearch}
            onChange={(e) => setMemorySearch(e.target.value)}
            placeholder="Search explanation logs..."
            className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl pl-9 pr-4 py-2 text-xs outline-none text-zinc-200"
          />
        </div>
      </div>

      {memories.length === 0 ? (
        <p className="text-xs text-zinc-650 text-center py-12">No memory episodes stored in local index DB yet.</p>
      ) : (
        <div className="space-y-3">
          {memories
            .filter((m) => memorySearch === '' || m.episode.explanation.toLowerCase().includes(memorySearch.toLowerCase()))
            .map((m) => (
              <div key={m.episode.id} className="p-3.5 bg-zinc-900/85 border border-zinc-850 rounded-xl">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[9px] text-zinc-650">{m.episode.id.substring(0, 8)}...</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-300 font-bold uppercase text-[9px]">{m.episode.decisionType}</span>
                    <span className="text-[10px] text-zinc-500 font-semibold">{m.episode.outcome}</span>
                  </div>
                  <span className="text-[10px] font-bold text-violet-400">Score: {m.relevanceScore || '1.0'}</span>
                </div>
                <p className="text-[11px] text-zinc-300 mt-2 font-medium">"{m.episode.explanation}"</p>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
