import { useState } from 'react';
import { useRealtimeData } from './hooks/useRealtimeData';
import { DecisionCard } from './components/DecisionCard';
import { ReasonPanel } from './components/ReasonPanel';
import { AttentionGraph } from './components/AttentionGraph';
import { Counter } from './components/Counter';
import { ActivityLog } from './components/ActivityLog';
import { DemoPanel } from './components/DemoPanel';

export default function App() {
  const [isDemoMode, setIsDemoMode] = useState(false);
  
  const { 
    decision, 
    reason, 
    confidence, 
    activityLog, 
    attentionSaved, 
    graphData,
    expectedOutput,
    triggerDemoScenario 
  } = useRealtimeData(isDemoMode);

  return (
    <div className="max-w-7xl mx-auto w-full p-4 md:p-8 flex flex-col gap-6 min-h-screen">
      
      <header className="flex flex-col sm:flex-row sm:items-end justify-between mb-4 gap-4">
        <div>
          <h1 className="text-3xl font-black bg-gradient-to-r from-violet-400 to-fuchsia-500 bg-clip-text text-transparent transform transition-all">
            Interrupt IQ
          </h1>
          <p className="text-zinc-500 text-sm mt-1 uppercase tracking-widest font-bold">
            {isDemoMode ? "Interactive Demo" : "Live Attention Engine"}
          </p>
        </div>

        <div className="flex items-center gap-4 bg-zinc-900/60 border border-zinc-800 p-1.5 rounded-full">
          <button 
            onClick={() => setIsDemoMode(false)}
            className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${
              !isDemoMode ? 'bg-emerald-500 text-white shadow-[0_0_15px_rgba(16,185,129,0.4)]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {!isDemoMode && <div className="w-1.5 h-1.5 rounded-full bg-white animate-pulse" />}
              LIVE MODE
            </div>
          </button>
          
          <button 
            onClick={() => setIsDemoMode(true)}
            className={`px-4 py-2 rounded-full text-xs font-bold tracking-widest transition-all ${
              isDemoMode ? 'bg-violet-500 text-white shadow-[0_0_15px_rgba(139,92,246,0.4)]' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            DEMO MODE
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 flex-1">
        
        {/* Left Column - Core Decision & Scenarios */}
        <div className="lg:col-span-5 flex flex-col gap-6">
          {isDemoMode && (
            <DemoPanel onTrigger={triggerDemoScenario} />
          )}

          <div className="flex-1 relative">
            <DecisionCard decision={decision} />
            {isDemoMode && decision && expectedOutput && (
              <div className="absolute top-4 right-4 text-[10px] uppercase font-bold tracking-wider px-2 py-1 rounded bg-black/50 border border-zinc-800 text-zinc-400">
                Expected: <span className={
                  expectedOutput === 'IGNORE' ? 'text-zinc-300' :
                  expectedOutput === 'DELAY' ? 'text-yellow-500' : 'text-red-500'
                }>{expectedOutput}</span>
              </div>
            )}
          </div>
          <ReasonPanel reason={reason} confidence={confidence} />
        </div>

        {/* Right Column - Metrics & Logs */}
        <div className="lg:col-span-7 flex flex-col gap-6">
          <Counter value={attentionSaved} />
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1">
            <AttentionGraph data={graphData} />
            <ActivityLog logs={activityLog} />
          </div>
        </div>

      </div>
    </div>
  );
}
