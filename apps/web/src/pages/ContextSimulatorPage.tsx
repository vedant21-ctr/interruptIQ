import React from 'react';
import { Sliders } from 'lucide-react';

interface ContextSimulatorPageProps {
  battery: number;
  setBattery: (val: number) => void;
  focusLevel: number;
  setFocusLevel: (val: number) => void;
  workingMode: string;
  setWorkingMode: (val: string) => void;
  activity: string;
  setActivity: (val: string) => void;
  network: string;
  setNetwork: (val: string) => void;
  currentTask: string;
  setCurrentTask: (val: string) => void;
  calendarStatus: string;
  setCalendarStatus: (val: string) => void;
  deviceStatus: string;
  setDeviceStatus: (val: string) => void;
  manualNotes: string;
  setManualNotes: (val: string) => void;
  handleUpdateContext: (e: React.FormEvent) => void;
  loading: boolean;
}

export function ContextSimulatorPage({
  battery,
  setBattery,
  focusLevel,
  setFocusLevel,
  workingMode,
  setWorkingMode,
  activity,
  setActivity,
  network,
  setNetwork,
  currentTask,
  setCurrentTask,
  calendarStatus,
  setCalendarStatus,
  deviceStatus,
  setDeviceStatus,
  manualNotes,
  setManualNotes,
  handleUpdateContext,
  loading
}: ContextSimulatorPageProps) {
  return (
    <div className="bg-zinc-900/40 border border-zinc-800 rounded-3xl p-6">
      <h3 className="text-sm font-bold uppercase tracking-wider text-zinc-300 mb-6 flex items-center gap-2">
        <Sliders className="w-5 h-5 text-violet-400" />
        Operator Context Snapshot Customizer
      </h3>

      <form onSubmit={handleUpdateContext} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="text-[11px] font-semibold text-zinc-500 flex justify-between mb-2">
              <span>Simulated Battery Level</span>
              <span>{battery}%</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={battery}
              onChange={(e) => setBattery(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>

          <div>
            <label className="text-[11px] font-semibold text-zinc-500 flex justify-between mb-2">
              <span>Simulated Focus Score</span>
              <span>{focusLevel}/100</span>
            </label>
            <input
              type="range"
              min="0"
              max="100"
              value={focusLevel}
              onChange={(e) => setFocusLevel(Number(e.target.value))}
              className="w-full h-1.5 bg-zinc-800 rounded-lg appearance-none cursor-pointer accent-violet-500"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1.5">Working Mode</label>
            <select
              value={workingMode}
              onChange={(e) => setWorkingMode(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2 text-xs outline-none text-zinc-200"
            >
              <option value="deep-work">Deep Work</option>
              <option value="MEETING">Meeting</option>
              <option value="chill">Chill Mode</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1.5">Activity</label>
            <select
              value={activity}
              onChange={(e) => setActivity(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2 text-xs outline-none text-zinc-200"
            >
              <option value="coding">Coding</option>
              <option value="presentation">Presentation</option>
              <option value="coffee-break">Coffee Break</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1.5">Connection</label>
            <select
              value={network}
              onChange={(e) => setNetwork(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2 text-xs outline-none text-zinc-200"
            >
              <option value="online">Online</option>
              <option value="offline">Offline</option>
            </select>
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1.5">Device Status</label>
            <input
              type="text"
              value={deviceStatus}
              onChange={(e) => setDeviceStatus(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2 text-xs outline-none text-zinc-200"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1.5">Current Task</label>
            <input
              type="text"
              value={currentTask}
              onChange={(e) => setCurrentTask(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2 text-xs outline-none text-zinc-200"
            />
          </div>

          <div>
            <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1.5">Calendar Status</label>
            <input
              type="text"
              value={calendarStatus}
              onChange={(e) => setCalendarStatus(e.target.value)}
              className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-3 py-2 text-xs outline-none text-zinc-200"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1.5">Manual Operator Notes</label>
          <textarea
            value={manualNotes}
            onChange={(e) => setManualNotes(e.target.value)}
            rows={3}
            className="w-full bg-zinc-800 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-xs outline-none text-zinc-200 resize-none"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="py-2.5 px-6 bg-violet-600 hover:bg-violet-500 text-xs font-bold text-white rounded-xl transition-all shadow-md shadow-violet-600/10"
        >
          Persist Custom Context Snapshot
        </button>
      </form>
    </div>
  );
}
