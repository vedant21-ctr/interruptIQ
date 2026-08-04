import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import { AnimatePresence, motion } from 'framer-motion';
import {
  Activity,
  Cpu,
  Send,
  Sliders,
  AlertTriangle,
  Lock,
  UserPlus
} from 'lucide-react';

import { EventLog, DecisionLog, CriticEvaluationLog } from './types';
import { Header } from './components/Header';
import { DashboardPage } from './pages/DashboardPage';
import { ContextSimulatorPage } from './pages/ContextSimulatorPage';
import { InjectorPage } from './pages/InjectorPage';
import { DecisionsPage } from './pages/DecisionsPage';
import { FeedbackPage } from './pages/FeedbackPage';
import { MemoryExplorerPage } from './pages/MemoryExplorerPage';
import { SettingsPage } from './pages/SettingsPage';

const API_BASE = 'http://localhost:3001/api/v1';

export default function App() {
  // Navigation & Authentication state variables
  const [token, setToken] = useState<string | null>(localStorage.getItem('iiq_token'));
  const [activePage, setActivePage] = useState<'dashboard' | 'context' | 'injector' | 'decisions' | 'feedback' | 'memory' | 'settings'>('dashboard');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Authentication Forms state variables
  const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
  const [authEmail, setAuthEmail] = useState('operator@interrupt-iq.com');
  const [authPassword, setAuthPassword] = useState('Password123!');
  const [authName, setAuthName] = useState('Simulator Operator');

  // Backend fetched entities
  const [context, setContext] = useState<any>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [feedbacks, setFeedbacks] = useState<any[]>([]);
  const [feedbackStats, setFeedbackStats] = useState<any>(null);
  const [memories, setMemories] = useState<any[]>([]);

  // Simulation run metrics
  const [lastInjectedEvent, setLastInjectedEvent] = useState<EventLog | null>(null);
  const [lastEvaluatedDecision, setLastEvaluatedDecision] = useState<DecisionLog | null>(null);
  const [lastEpisode, setLastEpisode] = useState<any | null>(null);
  const [lastCritic, setLastCritic] = useState<CriticEvaluationLog | null>(null);

  // Simulator Context customizers parameters
  const [battery, setBattery] = useState(90);
  const [focusLevel, setFocusLevel] = useState(85);
  const [workingMode, setWorkingMode] = useState('deep-work');
  const [activity, setActivity] = useState('coding');
  const [network, setNetwork] = useState('online');
  const [currentTask, setCurrentTask] = useState('Hotfixing auth middleware');
  const [calendarStatus, setCalendarStatus] = useState('focused');
  const [deviceStatus, setDeviceStatus] = useState('active');
  const [manualNotes, setManualNotes] = useState('Operational validation run');

  // Simulator Event injectors parameters
  const [eventSource, setEventSource] = useState('Slack');
  const [eventSender, setEventSender] = useState('Alice (Product Manager)');
  const [eventTitle, setEventTitle] = useState('Launch blocker issue');
  const [eventBody, setEventBody] = useState('The staging server deployment pipeline has failed. Need immediate inspect.');
  const [eventCategory, setEventCategory] = useState('urgent');
  const [eventPriority, setEventPriority] = useState('high');

  // History search query filters parameters
  const [decisionFilter, setDecisionFilter] = useState<'ALL' | 'IMMEDIATE' | 'BATCH' | 'IGNORE'>('ALL');
  const [memorySearch, setMemorySearch] = useState('');
  const [feedbackComment, setFeedbackComment] = useState('');

  // Handle Logins/Registrations
  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      if (authMode === 'register') {
        await axios.post(`${API_BASE}/auth/register`, {
          email: authEmail,
          password: authPassword,
          name: authName,
        });
        setAuthMode('login');
        setError('Registration successful! Please login.');
      } else {
        const res = await axios.post(`${API_BASE}/auth/login`, {
          email: authEmail,
          password: authPassword,
        });
        const jwtToken = res.data.token;
        localStorage.setItem('iiq_token', jwtToken);
        setToken(jwtToken);
      }
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('iiq_token');
    setToken(null);
    setActivePage('dashboard');
  };

  // Sync operator dashboard data models from APIs
  const syncPlatformMetrics = useCallback(async (jwtToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${jwtToken}` };

      // Load Active Context Snapshot
      const ctxRes = await axios.get(`${API_BASE}/context/current`, { headers });
      setContext(ctxRes.data.context);
      if (ctxRes.data.context) {
        setBattery(ctxRes.data.context.battery);
        setFocusLevel(ctxRes.data.context.focusLevel || 80);
        setWorkingMode(ctxRes.data.context.workingMode || 'deep-work');
        setActivity(ctxRes.data.context.activity);
        setNetwork(ctxRes.data.context.network);
        setCurrentTask(ctxRes.data.context.currentTask || '');
        setCalendarStatus(ctxRes.data.context.calendarStatus || '');
        setDeviceStatus(ctxRes.data.context.deviceStatus || '');
        setManualNotes(ctxRes.data.context.manualNotes || '');
      }

      // Load Recent Events
      const eventsRes = await axios.get(`${API_BASE}/events?limit=10`, { headers });
      setEvents(eventsRes.data.items);

      // Load Decisions history
      const decsRes = await axios.get(`${API_BASE}/decision/history?limit=10`, { headers });
      setDecisions(decsRes.data.items);

      // Load Feedback Analytics
      try {
        const feedStatsRes = await axios.get(`${API_BASE}/feedback`, { headers });
        setFeedbackStats(feedStatsRes.data.analytics);
      } catch {
        // Safe failover
      }

      // Load index database memories
      const memsRes = await axios.post(`${API_BASE}/memory/retrieve`, { limit: 10 }, { headers });
      setMemories(memsRes.data.items);

    } catch (err: any) {
      if (err.response?.status === 401) {
        handleLogout();
      } else {
        setError(err.response?.data?.message || err.message || 'Failed to sync platform telemetry');
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) {
      syncPlatformMetrics(token);
    }
  }, [token, syncPlatformMetrics]);

  // Update context custom variables snapshot
  const handleUpdateContext = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.patch(
        `${API_BASE}/context/current`,
        {
          battery,
          charging: false,
          activity,
          timeOfDay: 'afternoon',
          visibility: 'visible',
          network,
          currentTask,
          focusLevel,
          calendarStatus,
          workingMode,
          deviceStatus,
          manualNotes,
        },
        { headers }
      );
      setContext(res.data.context);
      setError('Context snapshot updated successfully.');
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update context');
    } finally {
      setLoading(false);
    }
  };

  // Run full simulation pipelines
  const handleInjectEvent = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Post notification
      const eventRes = await axios.post(
        `${API_BASE}/events`,
        {
          source: eventSource,
          sender: eventSender,
          title: eventTitle,
          body: eventBody,
          category: eventCategory,
          priority: eventPriority,
        },
        { headers }
      );
      const event = eventRes.data.event;
      setLastInjectedEvent(event);

      // 2. Evaluate Decision
      const decisionRes = await axios.post(
        `${API_BASE}/decision/evaluate`,
        { eventId: event.id },
        { headers }
      );
      const decision = decisionRes.data.decision;
      setLastEvaluatedDecision(decision);

      // 3. Index Memory Episode
      const memRes = await axios.post(
        `${API_BASE}/memory`,
        { decisionId: decision.id },
        { headers }
      );
      
      // Fetch matching semantic retrieve database items
      const retrievalRes = await axios.post(
        `${API_BASE}/memory/retrieve`,
        {
          category: event.category,
          eventSource: event.source,
          decisionType: decision.decision,
          targetConfidence: decision.confidence,
          limit: 3,
        },
        { headers }
      );
      setLastEpisode({
        episode: memRes.data.episode,
        similar: retrievalRes.data.items,
      });

      // 4. Run Critic Review
      const criticRes = await axios.post(
        `${API_BASE}/critic/evaluate`,
        {
          episodeId: memRes.data.episode.id,
          provider: 'mock',
        },
        { headers }
      );
      setLastCritic(criticRes.data.evaluation);

      // Sync active states views
      await syncPlatformMetrics(token);
      setActivePage('injector');

    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Simulation pipeline failed');
    } finally {
      setLoading(false);
    }
  };

  // Submit User Feedback overrides
  const handleFeedback = async (decisionId: string, action: 'ACCEPTED' | 'OVERRIDDEN' | 'DISMISSED') => {
    if (!token) return;
    setLoading(true);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      await axios.post(
        `${API_BASE}/feedback`,
        {
          decisionId,
          userAction: action,
          comment: feedbackComment || 'Operator simulation feedback override',
        },
        { headers }
      );
      setFeedbackComment('');
      setError('Feedback override registered successfully.');
      await syncPlatformMetrics(token);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to submit feedback');
    } finally {
      setLoading(false);
    }
  };

  // Render Login state screen
  if (!token) {
    return (
      <div className="min-h-screen bg-zinc-950 text-zinc-100 flex items-center justify-center font-sans relative">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-600/10 blur-[120px] pointer-events-none" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-fuchsia-600/10 blur-[120px] pointer-events-none" />

        <div className="w-full max-w-md bg-zinc-900/60 border border-zinc-800 rounded-3xl p-8 backdrop-blur-md relative z-10 shadow-2xl">
          <div className="flex justify-center mb-6">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-violet-600 to-fuchsia-600 flex items-center justify-center shadow-lg shadow-violet-500/20">
              <Cpu className="w-6 h-6 text-white" />
            </div>
          </div>

          <div className="text-center mb-8">
            <h1 className="text-2xl font-black tracking-tight text-white">
              Interrupt<span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-400 to-fuchsia-400">IQ</span>
            </h1>
            <p className="text-xs text-zinc-500 mt-1 uppercase tracking-widest font-bold">Simulator Login & Scaffolding</p>
          </div>

          {error && (
            <div className="mb-4 bg-red-950/60 border border-red-800 text-red-200 text-xs px-4 py-2.5 rounded-xl flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuth} className="space-y-4">
            {authMode === 'register' && (
              <div>
                <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Operator Name</label>
                <input
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-xs outline-none text-zinc-100"
                />
              </div>
            )}

            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Email address</label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-xs outline-none text-zinc-100"
              />
            </div>

            <div>
              <label className="text-[10px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Security Password</label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                className="w-full bg-zinc-800/80 border border-zinc-700/50 rounded-xl px-4 py-2.5 text-xs outline-none text-zinc-100"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full mt-4 py-3 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-bold text-white transition-all hover:scale-[1.02] shadow-lg shadow-violet-500/10"
            >
              {authMode === 'login' ? 'Authenticate Operator' : 'Register Operator'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-zinc-800/80 text-center text-xs">
            <button
              onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
              className="text-zinc-400 hover:text-violet-400 transition-all font-semibold flex items-center justify-center gap-1.5 mx-auto"
            >
              {authMode === 'login' ? <UserPlus className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              {authMode === 'login' ? 'Create new operator account' : 'Access existing operator account'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Active dashboard view layout
  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 flex flex-col font-sans select-none overflow-x-hidden">
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-violet-900/10 blur-[130px]" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-fuchsia-900/10 blur-[130px]" />
      </div>

      <Header
        activePage={activePage}
        setActivePage={setActivePage}
        loading={loading}
        sync={() => syncPlatformMetrics(token)}
        handleLogout={handleLogout}
        token={token}
      />

      {error && (
        <div className="relative z-10 bg-violet-950/40 border-b border-violet-800/80 text-violet-200 px-6 py-2.5 text-xs font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-violet-400" />
            {error}
          </span>
          <button onClick={() => setError(null)} className="text-zinc-500 hover:text-zinc-300 font-bold">×</button>
        </div>
      )}

      {/* Main Grid Workspace */}
      <main className="relative z-10 flex-1 p-6 max-w-7xl mx-auto w-full grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Side: Context customizer and quick telemetry */}
        <section className="lg:col-span-4 flex flex-col gap-6">
          {/* Active Context details panel */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-widest mb-4 flex items-center gap-2">
              <Sliders className="w-4 h-4 text-violet-400" />
              Aggregated Context
            </h3>

            {context ? (
              <div className="space-y-3">
                <div className="flex justify-between items-center bg-zinc-900/80 border border-zinc-850 p-2.5 rounded-xl">
                  <span className="text-[10px] text-zinc-500 uppercase font-black">Focus Score Gauge</span>
                  <span className="text-xs font-bold text-violet-400">{context.focusLevel || 80}/100</span>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-zinc-900/80 border border-zinc-850 rounded-xl">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold">Working Mode</span>
                    <p className="text-xs text-zinc-200 mt-1 font-semibold capitalize">{context.workingMode || 'Deep work'}</p>
                  </div>
                  <div className="p-2.5 bg-zinc-900/80 border border-zinc-850 rounded-xl">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold">Current Activity</span>
                    <p className="text-xs text-zinc-200 mt-1 font-semibold capitalize">{context.activity}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-2.5 bg-zinc-900/80 border border-zinc-850 rounded-xl">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold">Battery Status</span>
                    <p className="text-xs text-zinc-200 mt-1 font-semibold">{context.battery}%</p>
                  </div>
                  <div className="p-2.5 bg-zinc-900/80 border border-zinc-850 rounded-xl">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold">Network Connection</span>
                    <p className="text-xs text-zinc-200 mt-1 font-semibold capitalize">{context.network}</p>
                  </div>
                </div>

                {context.currentTask && (
                  <div className="p-2.5 bg-zinc-900/80 border border-zinc-850 rounded-xl">
                    <span className="text-[9px] text-zinc-500 uppercase font-bold">Current Task Focus</span>
                    <p className="text-xs text-zinc-400 mt-1 font-medium italic">"{context.currentTask}"</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-32 bg-zinc-900/30 animate-pulse rounded-2xl flex items-center justify-center">
                <div className="w-4 h-4 rounded-full border border-violet-500 border-t-transparent animate-spin" />
              </div>
            )}
          </div>

          {/* Quick simulation runner */}
          <div className="bg-zinc-900/60 border border-zinc-800/80 rounded-3xl p-5 backdrop-blur-sm">
            <h3 className="text-xs font-bold uppercase text-zinc-400 tracking-widest mb-4 flex items-center gap-2">
              <Send className="w-4 h-4 text-fuchsia-400" />
              Event Simulator Pipeline
            </h3>

            <form onSubmit={handleInjectEvent} className="space-y-4">
              <div>
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Notification Source</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={eventSource}
                    onChange={(e) => setEventSource(e.target.value)}
                    className="bg-zinc-800 border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  >
                    <option value="Slack">Slack</option>
                    <option value="Email">Email</option>
                    <option value="GitHub">GitHub</option>
                  </select>
                  <input
                    type="text"
                    value={eventSender}
                    onChange={(e) => setEventSender(e.target.value)}
                    placeholder="Sender"
                    className="bg-zinc-800 border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs outline-none font-semibold text-white"
                  />
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Priority & Category</label>
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={eventPriority}
                    onChange={(e) => setEventPriority(e.target.value)}
                    className="bg-zinc-800 border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="urgent">Urgent</option>
                  </select>
                  <select
                    value={eventCategory}
                    onChange={(e) => setEventCategory(e.target.value)}
                    className="bg-zinc-800 border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs outline-none"
                  >
                    <option value="urgent">Urgent</option>
                    <option value="social">Social</option>
                    <option value="development">Development</option>
                    <option value="system">System</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Title</label>
                <input
                  type="text"
                  value={eventTitle}
                  onChange={(e) => setEventTitle(e.target.value)}
                  className="w-full bg-zinc-800 border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs outline-none font-semibold text-white"
                />
              </div>

              <div>
                <label className="text-[9px] uppercase font-bold tracking-wider text-zinc-500 block mb-1">Body Message</label>
                <textarea
                  value={eventBody}
                  onChange={(e) => setEventBody(e.target.value)}
                  rows={2}
                  className="w-full bg-zinc-800 border border-zinc-750 rounded-lg px-2.5 py-1.5 text-xs outline-none resize-none font-semibold text-white"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-xl bg-gradient-to-r from-violet-600 to-fuchsia-600 text-xs font-bold text-white transition-all shadow-md shadow-fuchsia-500/10 flex items-center justify-center gap-1.5"
              >
                <Cpu className="w-4 h-4" />
                Ingest & Run Simulation
              </button>
            </form>
          </div>
        </section>

        {/* Right Side: View Tabs Layout Container */}
        <section className="lg:col-span-8 flex flex-col gap-6 min-h-[500px]">
          <AnimatePresence mode="wait">
            
            {/* VIEW: DASHBOARD */}
            {activePage === 'dashboard' && (
              <motion.div
                key="dashboard"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                <DashboardPage
                  events={events}
                  decisions={decisions}
                  feedbackStats={feedbackStats}
                  memories={memories}
                />
              </motion.div>
            )}

            {/* VIEW: CONTEXT SIMULATOR */}
            {activePage === 'context' && (
              <motion.div
                key="context"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                <ContextSimulatorPage
                  battery={battery}
                  setBattery={setBattery}
                  focusLevel={focusLevel}
                  setFocusLevel={setFocusLevel}
                  workingMode={workingMode}
                  setWorkingMode={setWorkingMode}
                  activity={activity}
                  setActivity={setActivity}
                  network={network}
                  setNetwork={setNetwork}
                  currentTask={currentTask}
                  setCurrentTask={setCurrentTask}
                  calendarStatus={calendarStatus}
                  setCalendarStatus={setCalendarStatus}
                  deviceStatus={deviceStatus}
                  setDeviceStatus={setDeviceStatus}
                  manualNotes={manualNotes}
                  setManualNotes={setManualNotes}
                  handleUpdateContext={handleUpdateContext}
                  loading={loading}
                />
              </motion.div>
            )}

            {/* VIEW: EVENT INJECTOR / DECISION OUTCOME */}
            {activePage === 'injector' && (
              <motion.div
                key="injector"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                <InjectorPage
                  lastEvaluatedDecision={lastEvaluatedDecision}
                  lastCritic={lastCritic}
                  handleFeedback={handleFeedback}
                  loading={loading}
                />
              </motion.div>
            )}

            {/* VIEW: DECISION CENTER */}
            {activePage === 'decisions' && (
              <motion.div
                key="decisions"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                <DecisionsPage
                  decisions={decisions}
                  decisionFilter={decisionFilter}
                  setDecisionFilter={setDecisionFilter}
                />
              </motion.div>
            )}

            {/* VIEW: FEEDBACK CENTER */}
            {activePage === 'feedback' && (
              <motion.div
                key="feedback"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                <FeedbackPage
                  decisions={decisions}
                  feedbackComment={feedbackComment}
                  setFeedbackComment={setFeedbackComment}
                  handleFeedback={handleFeedback}
                />
              </motion.div>
            )}

            {/* VIEW: MEMORY EXPLORER */}
            {activePage === 'memory' && (
              <motion.div
                key="memory"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                <MemoryExplorerPage
                  memories={memories}
                  memorySearch={memorySearch}
                  setMemorySearch={setMemorySearch}
                />
              </motion.div>
            )}

            {/* VIEW: SETTINGS */}
            {activePage === 'settings' && (
              <motion.div
                key="settings"
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -15 }}
                transition={{ duration: 0.15 }}
              >
                <SettingsPage
                  token={token}
                  apiBase={API_BASE}
                />
              </motion.div>
            )}

          </AnimatePresence>
        </section>

      </main>
    </div>
  );
}
