interface StatsMatrixProps {
  eventsCount: number;
  decisionsCount: number;
  overrideRate: number;
  memoriesCount: number;
}

export function StatsMatrix({
  eventsCount,
  decisionsCount,
  overrideRate,
  memoriesCount
}: StatsMatrixProps) {
  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block">Events</span>
        <span className="text-3xl font-black text-white mt-1 block">{eventsCount}</span>
      </div>
      <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block">Decisions</span>
        <span className="text-3xl font-black text-white mt-1 block">{decisionsCount}</span>
      </div>
      <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block">Override Rate</span>
        <span className="text-3xl font-black text-violet-400 mt-1 block">{overrideRate}%</span>
      </div>
      <div className="p-4 bg-zinc-900/40 border border-zinc-800/80 rounded-2xl">
        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-black block">Memories</span>
        <span className="text-3xl font-black text-fuchsia-400 mt-1 block">{memoriesCount}</span>
      </div>
    </div>
  );
}
