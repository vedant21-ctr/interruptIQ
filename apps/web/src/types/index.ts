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
  contextSnapshotId: string | null;
  decision: string;
  reason: string;
  confidence: number;
  signalsUsed: string[];
  explanation: {
    narrative: string;
    rulesAttribution: number;
    semanticsAttribution: number;
    mlAttribution: number;
    historyAttribution: number;
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

export interface FeedbackLog {
  id: string;
  decisionId: string;
  originalDecision: string;
  userAction: string;
  comment: string | null;
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
