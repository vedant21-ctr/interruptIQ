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
    <div className="max-w-screen-2xl mx-auto w-full p-4 md:p-8 flex flex-col gap-8 min-h-screen relative z-10">
      
      {/* Dynamic Background Elements */}
      <div className="fixed top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
      <div className="fixed bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-600/10 blur-[120px] pointer-events-none" />

      <header className="flex flex-col md:flex-row md:items-end justify-between gap-6 glass-card p-6 border-b-0 rounded-3xl">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-500 to-fuchsia-600 flex items-center justify-center shadow-[0_0_30px_rgba(139,92,246,0.3)]">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-4xl font-black text-white tracking-tight drop-shadow-md">
              Interrupt <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">IQ</span>
            </h1>
            <p className="text-zinc-400 text-sm mt-1 uppercase tracking-[0.2em] font-semibold flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              {isDemoMode ? "Interactive Demo" : "Live Attention Engine"}
            </p>
          </div>
        </div>

        <div className="flex items-center p-1.5 glass-panel rounded-full">
          <button 
            onClick={() => setIsDemoMode(false)}
            className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${
              !isDemoMode ? 'bg-zinc-800 text-white shadow-lg scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            <div className="flex items-center gap-2">
              {!isDemoMode && <div className="w-2 h-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />}
              Live
            </div>
          </button>
          
          <button 
            onClick={() => setIsDemoMode(true)}
            className={`px-6 py-2.5 rounded-full text-xs font-black uppercase tracking-widest transition-all duration-300 ${
              isDemoMode ? 'bg-violet-600 text-white shadow-[0_0_20px_rgba(124,58,237,0.5)] scale-105' : 'text-zinc-500 hover:text-zinc-300'
            }`}
          >
            Demo
          </button>
        </div>
      </header>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 flex-1">
        
        {/* Left Column - Core Decision & Scenarios */}
        <div className="xl:col-span-5 flex flex-col gap-8">
          {isDemoMode && (
            <div className="animate-fade-in-up">
              <DemoPanel onTrigger={triggerDemoScenario} />
            </div>
          )}

          <div className="flex-1 relative group">
            <DecisionCard decision={decision} />
            {isDemoMode && decision && expectedOutput && (
              <div className="absolute top-5 right-5 text-[10px] uppercase font-bold tracking-widest px-3 py-1.5 rounded-full glass-panel border-zinc-700/50 flex items-center gap-2 backdrop-blur-md">
                <span className="text-zinc-500">Expected:</span>
                <span className={
                  expectedOutput === 'IGNORE' ? 'text-violet-400 drop-shadow-[0_0_5px_rgba(167,139,250,0.5)]' :
                  expectedOutput === 'DELAY' ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]' : 'text-red-400 drop-shadow-[0_0_5px_rgba(248,113,113,0.5)]'
                }>{expectedOutput}</span>
              </div>
            )}
          </div>
          <ReasonPanel reason={reason} confidence={confidence} />
        </div>

        {/* Right Column - Metrics & Logs */}
        <div className="xl:col-span-7 flex flex-col gap-8">
          <Counter value={attentionSaved} />
          
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 flex-1">
            <div className="glass-card flex flex-col h-[400px] xl:h-auto">
              <AttentionGraph data={graphData} />
            </div>
            <div className="glass-card flex flex-col h-[400px] xl:h-auto">
              <ActivityLog logs={activityLog} />
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
