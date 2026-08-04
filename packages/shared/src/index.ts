export interface InformationPayload {
  id: string;
  title: string;
  body: string;
  sender: string;
  category: 'social' | 'development' | 'system' | 'urgent';
  source: string;
  timestamp: number;
}

export interface UserContextState {
  heartRate?: number;
  motion?: 'driving' | 'walking' | 'still';
  location?: string;
  battery: number;
  activity: 'coding' | 'meeting' | 'idle' | 'sleeping';
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
  charging: boolean;
  visibility: 'visible' | 'hidden';
  network: 'online' | 'offline';
}

export interface DecisionResponse {
  decision: 'IGNORE' | 'DELAY' | 'NOTIFY NOW';
  reason: string;
  confidence: number;
  signalsUsed: string[];
}
