import { useState, useEffect } from 'react';

export function useUserContext() {
  const [context, setContext] = useState({
    battery: 100,
    location: 'home',
    activity: 'active',
    motion: 0,
    heart_rate: 70
  });

  useEffect(() => {
    // Battery API
    let active = true;
    if ('getBattery' in navigator) {
      (navigator as any).getBattery().then((battery: any) => {
        if (!active) return;
        const updateBattery = () => {
          setContext(c => ({ ...c, battery: Math.floor(battery.level * 100) }));
        };
        updateBattery();
        battery.addEventListener('levelchange', updateBattery);
      });
    }

    // Geolocation Mock (always prompt, or avoid prompting constantly - better to mock dynamically or use real API once)
    // For demo, we just randomly pick 'road' or 'home' unless geolocation is fast.
    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          // just mock location checking based on speed if available, or just random
          const isMoving = pos.coords.speed ? pos.coords.speed > 2 : false;
          setContext(c => ({ ...c, location: isMoving ? 'road' : 'home' }));
        },
        () => {
          // fallback
          setContext(c => ({ ...c, location: 'home' }));
        }
      );
    }

    // Visibility & Activity
    const updateVisibility = () => {
      setContext(c => ({ ...c, activity: document.visibilityState === 'visible' ? 'active' : 'idle' }));
    };
    document.addEventListener('visibilitychange', updateVisibility);

    let motion = 0;
    const handleMouse = () => { motion += 1; };
    const handleKey = () => { motion += 2; };
    window.addEventListener('mousemove', handleMouse);
    window.addEventListener('keydown', handleKey);

    // Heart rate mock (fluctuates around 70)
    // Motion interval
    const interval = setInterval(() => {
      setContext(c => ({
        ...c,
        motion: Math.min(motion, 10),
        heart_rate: 65 + Math.floor(Math.random() * 15)
      }));
      motion = 0; // reset motion counter
    }, 1000);

    return () => {
      active = false;
      document.removeEventListener('visibilitychange', updateVisibility);
      window.removeEventListener('mousemove', handleMouse);
      window.removeEventListener('keydown', handleKey);
      clearInterval(interval);
    };
  }, []);

  return context;
}
