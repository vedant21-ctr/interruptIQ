import { useState, useEffect, useRef } from 'react';
import axios from 'axios';

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

export function useRealtimeData(isDemoMode: boolean) {
  const [decision, setDecision] = useState('');
  const [reason, setReason] = useState('');
  const [confidence, setConfidence] = useState(0);
  const [activityLog, setActivityLog] = useState<LogEntry[]>([]);
  const [attentionSaved, setAttentionSaved] = useState(0);
  const [graphData, setGraphData] = useState<GraphDataPoint[]>([]);
  
  // For demo
  const [expectedOutput, setExpectedOutput] = useState('');

  // Internal counts for graph
  const [counts, setCounts] = useState({ ignored: 0, delayed: 0, notified: 0 });

  // Context State
  const contextRef = useRef({
    battery: 100,
    location: 'home',
    activity: 'active',
    motion: 0,
    heart_rate: 70
  });

  // Track live context natively (we can keep tracking it even in demo mode, but we just won't poll it)
  useEffect(() => {
    let active = true;
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        if (!active) return;
        const updateBattery = () => { contextRef.current.battery = Math.floor(battery.level * 100); };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
      });
    }

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const isMoving = pos.coords.speed ? pos.coords.speed > 2 : false;
          contextRef.current.location = isMoving ? 'road' : 'home';
        },
        () => { contextRef.current.location = 'home'; }
      );
    }

    const updateVisibility = () => {
      contextRef.current.activity = document.visibilityState === 'visible' ? 'active' : 'idle';
    };
    document.addEventListener('visibilitychange', updateVisibility);

    let motionAcc = 0;
    const handleMouse = () => { motionAcc += 1; };
    const handleKey = () => { motionAcc += 2; };
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('keydown', handleKey);

    const intVal = setInterval(() => {
      contextRef.current.motion = Math.min(motionAcc, 10);
      contextRef.current.heart_rate = 65 + Math.floor(Math.random() * 15);
      motionAcc = 0;
    }, 1000);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('keydown', handleKey);
      clearInterval(intVal);
    };
  }, []);

  const processResponse = (data: any, notifType: string, expected?: string) => {
    if (data && data.decision) {
      setDecision(data.decision);
      setReason(data.reason);
      setConfidence(data.confidence);
      if (expected) setExpectedOutput(expected);

      // Update log
      setActivityLog(prev => {
        const newLog: LogEntry = {
          id: Math.random().toString(36).substr(2, 9),
          type: notifType,
          decision: data.decision,
          time: new Date()
        };
        return [newLog, ...prev].slice(0, 6);
      });

      // Update saved counter and counts
      setCounts(prevCounts => {
        let newCounts = { ...prevCounts };
        if (data.decision === 'IGNORE') {
          setAttentionSaved(s => s + 2);
          newCounts.ignored += 1;
        } else if (data.decision === 'DELAY') {
          setAttentionSaved(s => s + 1);
          newCounts.delayed += 1;
        } else {
          newCounts.notified += 1;
        }

        // Update graph data with new counts
        setGraphData(prevG => {
          const newPoint = {
            time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
            ...newCounts
          };
          return [...prevG, newPoint].slice(-15);
        });

        return newCounts;
      });
    }
  };

  // Polling logic for LIVE MODE
  useEffect(() => {
    // For graph initialization
    setGraphData([{
        time: new Date().toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' }),
        ignored: counts.ignored, delayed: counts.delayed, notified: counts.notified
    }]);

    if (isDemoMode) {
      setExpectedOutput('');
      return; // Disable polling in demo mode
    }

    const NOTIFICATION_TYPES = ['social', 'work', 'urgent'];
    const poll = async () => {
      const notifType = NOTIFICATION_TYPES[Math.floor(Math.random() * NOTIFICATION_TYPES.length)];
      
      console.group(`[Live Mode] API Request: ${notifType}`);
      console.log("Payload:", { context: contextRef.current, notification: notifType });
      
      try {
        const response = await axios.post('http://localhost:8000/decision', {
          context: contextRef.current,
          notification: notifType
        });
        
        console.log("Response:", response.data);
        console.groupEnd();
        
        processResponse(response.data, notifType);
      } catch (err) {
        console.error("Polling error", err);
        console.groupEnd();
      }
    };

    const interval = setInterval(poll, 3000); 
    return () => clearInterval(interval);
  }, [isDemoMode]);

  // Demo Trigger
  const triggerDemoScenario = async (context: any, notification: string, expected: string) => {
    console.group(`[Demo Mode] API Request: ${notification}`);
    console.log("Payload:", { context, notification });
    
    try {
      const response = await axios.post('http://localhost:8000/decision', {
        context,
        notification
      });
      
      console.log("Response:", response.data);
      console.groupEnd();
      
      processResponse(response.data, notification, expected);
    } catch (err) {
      console.error("Demo API error", err);
      console.groupEnd();
    }
  };

  return {
    decision,
    reason,
    confidence,
    activityLog,
    attentionSaved,
    graphData,
    context: contextRef.current,
    expectedOutput,
    triggerDemoScenario
  };
}
