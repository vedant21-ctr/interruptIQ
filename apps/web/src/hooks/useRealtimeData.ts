import { useState, useEffect, useCallback } from 'react';
import axios from 'axios';

const API_BASE = 'http://localhost:3001/api/v1';

export interface LogEntry {
  id: string;
  type: string;
  decision: string;
  time: Date;
}

export interface GraphDataPoint {
  time: string;
  ignored: number;
  delayed: number;
  notified: number;
}

export interface EventLog {
  id: string;
  source: string;
  sender: string;
  title: string;
  body: string;
  category: string;
  priority: string;
  createdAt: string;
}

export interface DecisionLog {
  id: string;
  eventId: string;
  decision: string;
  reason: string;
  confidence: number;
  signalsUsed: string[];
  explanation: {
    narrative: string;
  } | null;
  createdAt: string;
}

export interface MemoryEpisodeLog {
  id: string;
  decisionType: string;
  explanation: string;
  confidence: number;
  outcome: string;
  createdAt: string;
}

export interface CriticEvaluationLog {
  id: string;
  episodeId: string;
  verdict: string;
  confidence: number;
  explanation: string;
  strengths: string[];
  weaknesses: string[];
  suggestedRuleChanges: any[];
  createdAt: string;
}

export function useRealtimeData() {
  const [token, setToken] = useState<string | null>(localStorage.getItem('iiq_token'));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Core entities state
  const [context, setContext] = useState<any>(null);
  const [events, setEvents] = useState<EventLog[]>([]);
  const [decisions, setDecisions] = useState<DecisionLog[]>([]);
  const [memories, setMemories] = useState<any[]>([]);
  const [critics, setCritics] = useState<CriticEvaluationLog[]>([]);

  // Simulation pipeline state
  const [simEvent, setSimEvent] = useState<EventLog | null>(null);
  const [simDecision, setSimDecision] = useState<DecisionLog | null>(null);
  const [simMemory, setSimMemory] = useState<any | null>(null);
  const [simCritic, setSimCritic] = useState<CriticEvaluationLog | null>(null);

  // Authenticate user idempotently (register or login default simulator user)
  const authenticateUser = useCallback(async () => {
    try {
      const email = 'simulator-operator@interrupt-iq.com';
      const password = 'Password123!';

      try {
        // Try login first
        const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
        const jwtToken = res.data.token;
        localStorage.setItem('iiq_token', jwtToken);
        setToken(jwtToken);
        return jwtToken;
      } catch (err: any) {
        // If login fails (user does not exist), register first
        if (err.response?.status === 401 || err.response?.status === 404) {
          await axios.post(`${API_BASE}/auth/register`, {
            email,
            password,
            name: 'Simulator Operator',
          });
          // Retrieve token on successful registration
          const res = await axios.post(`${API_BASE}/auth/login`, { email, password });
          const jwtToken = res.data.token;
          localStorage.setItem('iiq_token', jwtToken);
          setToken(jwtToken);
          return jwtToken;
        }
        throw err;
      }
    } catch (err: any) {
      setError(err.message || 'Authentication failed');
      return null;
    }
  }, []);

  // Fetch all recent data
  const fetchData = useCallback(async (jwtToken: string) => {
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${jwtToken}` };

      // Load context
      const ctxRes = await axios.get(`${API_BASE}/context/current`, { headers });
      setContext(ctxRes.data.context);

      // Load events
      const eventsRes = await axios.get(`${API_BASE}/events?limit=5`, { headers });
      setEvents(eventsRes.data.items);

      // Load decisions
      const decsRes = await axios.get(`${API_BASE}/decision/history?limit=5`, { headers });
      setDecisions(decsRes.data.items);

      // Load memory episodes
      const memsRes = await axios.post(`${API_BASE}/memory/retrieve`, { limit: 5 }, { headers });
      setMemories(memsRes.data.items);

      // Load critic reports
      const criticsRes = await axios.get(`${API_BASE}/critic/history?limit=5`, { headers });
      setCritics(criticsRes.data.items);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to sync platform metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  // Sync state on mount
  useEffect(() => {
    async function init() {
      let activeToken = token;
      if (!activeToken) {
        activeToken = await authenticateUser();
      }
      if (activeToken) {
        await fetchData(activeToken);
      }
    }
    init();
  }, [token, authenticateUser, fetchData]);

  // Update context snapshot signals
  const updateContext = async (signals: {
    battery: number;
    activity: string;
    workingMode: string;
    focusLevel: number;
    network: string;
  }) => {
    if (!token) return;
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };
      const res = await axios.patch(
        `${API_BASE}/context/current`,
        {
          battery: signals.battery,
          charging: false,
          activity: signals.activity,
          timeOfDay: 'afternoon',
          visibility: 'visible',
          network: signals.network,
          focusLevel: signals.focusLevel,
          workingMode: signals.workingMode,
        },
        { headers }
      );
      setContext(res.data.context);
      return res.data.context;
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Failed to update context');
    }
  };

  // Run full simulated pipeline (Ingest → Evaluate → Embed → Criticize)
  const triggerSimulation = async (eventParams: {
    source: string;
    sender: string;
    title: string;
    body: string;
    category: string;
    priority: string;
  }) => {
    if (!token) return;
    setLoading(true);
    setError(null);
    try {
      const headers = { Authorization: `Bearer ${token}` };

      // 1. Ingest Event
      const eventRes = await axios.post(`${API_BASE}/events`, eventParams, { headers });
      const ingestedEvent = eventRes.data.event;
      setSimEvent(ingestedEvent);

      // 2. Evaluate Decision
      const decisionRes = await axios.post(
        `${API_BASE}/decision/evaluate`,
        { eventId: ingestedEvent.id },
        { headers }
      );
      const evaluatedDecision = decisionRes.data.decision;
      setSimDecision(evaluatedDecision);

      // 3. Index Memory Episode (creates semantic retrieval embeddings)
      const memoryRes = await axios.post(
        `${API_BASE}/memory`,
        { decisionId: evaluatedDecision.id },
        { headers }
      );
      const memoryEpisode = memoryRes.data.episode;

      // Load semantic similar matches for viewer
      const retrievalRes = await axios.post(
        `${API_BASE}/memory/retrieve`,
        {
          category: ingestedEvent.category,
          eventSource: ingestedEvent.source,
          decisionType: evaluatedDecision.decision,
          targetConfidence: evaluatedDecision.confidence,
          limit: 3,
        },
        { headers }
      );
      setSimMemory({
        episode: memoryEpisode,
        similar: retrievalRes.data.items,
      });

      // 4. Trigger LLM Critic Evaluation report
      const criticRes = await axios.post(
        `${API_BASE}/critic/evaluate`,
        {
          episodeId: memoryEpisode.id,
          provider: 'mock',
        },
        { headers }
      );
      setSimCritic(criticRes.data.evaluation);

      // Reload global list views
      await fetchData(token);
    } catch (err: any) {
      setError(err.response?.data?.message || err.message || 'Simulation pipeline failed');
    } finally {
      setLoading(false);
    }
  };

  return {
    token,
    loading,
    error,
    context,
    events,
    decisions,
    memories,
    critics,
    simEvent,
    simDecision,
    simMemory,
    simCritic,
    updateContext,
    triggerSimulation,
    sync: () => token && fetchData(token),
  };
}
