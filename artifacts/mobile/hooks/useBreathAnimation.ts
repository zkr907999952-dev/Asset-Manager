import { useEffect, useRef, useState } from 'react';

/**
 * Returns a breath value in the range [-1, 1] that oscillates like a sine wave.
 * The breathing rate scales with heart rate:
 *   72 BPM  → ~14 breaths/min → period ~4300ms (calm)
 *   120 BPM → ~20 breaths/min → period ~3000ms (elevated)
 *   180 BPM → ~27 breaths/min → period ~2200ms (distressed)
 */
export function useBreathAnimation(heartRate: number): number {
  const [breathVal, setBreathVal] = useState(0);
  const phaseRef = useRef(0);
  const heartRateRef = useRef(heartRate);
  heartRateRef.current = heartRate;

  useEffect(() => {
    const TICK_MS = 50;
    const id = setInterval(() => {
      const bpm = 14 + Math.max(0, heartRateRef.current - 72) * 0.115;
      const periodMs = 60000 / bpm;
      const increment = (2 * Math.PI * TICK_MS) / periodMs;
      phaseRef.current = (phaseRef.current + increment) % (2 * Math.PI);
      setBreathVal(Math.sin(phaseRef.current));
    }, TICK_MS);
    return () => clearInterval(id);
  }, []);

  return breathVal;
}
