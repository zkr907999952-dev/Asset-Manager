import React, { useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Polyline, Rect, Line } from 'react-native-svg';

export type ComaState = 'none' | 'tachycardia' | 'bradycardia';

function getECGColor(bpm: number, comaState: ComaState): string {
  if (comaState === 'tachycardia') return '#ff2222';
  if (comaState === 'bradycardia') return '#4488ff';
  if (bpm < 50) return '#4488ff';
  if (bpm <= 100) return '#00dd55';
  if (bpm <= 130) return '#ffaa00';
  return '#ff3333';
}

function ecgSample(phase: number, comaState: ComaState): number {
  const t = phase % 1.0;
  if (comaState === 'bradycardia') {
    let y = 0;
    if (t > 0.28 && t < 0.34) y += 0.9 * Math.sin(Math.PI * (t - 0.28) / 0.06);
    if (t > 0.34 && t < 0.38) y -= 0.15 * Math.sin(Math.PI * (t - 0.34) / 0.04);
    if (t > 0.42 && t < 0.60) y += 0.2 * Math.sin(Math.PI * (t - 0.42) / 0.18);
    return y;
  }
  if (comaState === 'tachycardia') {
    let y = 0;
    const noise = (Math.random() - 0.5) * 0.08;
    if (t > 0.1 && t < 0.18) y += 0.18 * Math.sin(Math.PI * (t - 0.1) / 0.08);
    if (t > 0.24 && t < 0.27) y -= 0.1 * Math.sin(Math.PI * (t - 0.24) / 0.03);
    if (t > 0.27 && t < 0.33) y += 1.05 * Math.sin(Math.PI * (t - 0.27) / 0.06);
    if (t > 0.33 && t < 0.37) y -= 0.18 * Math.sin(Math.PI * (t - 0.33) / 0.04);
    if (t > 0.40 && t < 0.54) y += 0.28 * Math.sin(Math.PI * (t - 0.40) / 0.14);
    return y + noise;
  }
  let y = 0;
  if (t > 0.08 && t < 0.18) y += 0.2 * Math.sin(Math.PI * (t - 0.08) / 0.10);
  if (t > 0.25 && t < 0.28) y -= 0.12 * Math.sin(Math.PI * (t - 0.25) / 0.03);
  if (t > 0.28 && t < 0.35) y += 1.0 * Math.sin(Math.PI * (t - 0.28) / 0.07);
  if (t > 0.35 && t < 0.40) y -= 0.2 * Math.sin(Math.PI * (t - 0.35) / 0.05);
  if (t > 0.44 && t < 0.64) y += 0.32 * Math.sin(Math.PI * (t - 0.44) / 0.20);
  return y;
}

const BUFFER_SIZE = 100;
const TICK_MS = 40;

interface Props {
  heartRate: number;
  comaState: ComaState;
  width: number;
  height: number;
  transparent?: boolean;
  showLabel?: boolean;
}

export function HeartRateMonitor({ heartRate, comaState, width, height, transparent = false, showLabel = true }: Props) {
  const bufRef = useRef<Float32Array>(new Float32Array(BUFFER_SIZE));
  const writeIdxRef = useRef(0);
  const phaseRef = useRef(0);
  const [tick, setTick] = useState(0);

  const color = getECGColor(heartRate, comaState);

  useEffect(() => {
    const effectiveBpm = comaState === 'tachycardia' ? 185 : comaState === 'bradycardia' ? 30 : heartRate;
    const timer = setInterval(() => {
      const phasePerTick = (effectiveBpm / 60) * (TICK_MS / 1000);
      phaseRef.current = (phaseRef.current + phasePerTick) % 1.0;
      const y = ecgSample(phaseRef.current, comaState);
      bufRef.current[writeIdxRef.current % BUFFER_SIZE] = y;
      writeIdxRef.current++;
      setTick(t => t + 1);
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [heartRate, comaState]);

  const graphH = showLabel ? height - 16 : height;
  const midY = graphH / 2;
  const amplitude = graphH * 0.42;

  const buf = bufRef.current;
  const writeIdx = writeIdxRef.current;
  let pointsStr = '';
  for (let i = 0; i < BUFFER_SIZE; i++) {
    const dataIdx = (writeIdx + i) % BUFFER_SIZE;
    const v = buf[dataIdx];
    const x = (i / (BUFFER_SIZE - 1)) * width;
    const y = midY - v * amplitude;
    if (i > 0) pointsStr += ' ';
    pointsStr += x.toFixed(1) + ',' + y.toFixed(1);
  }

  const displayBpm = comaState === 'tachycardia' ? '---' : comaState === 'bradycardia' ? '---' : String(heartRate);

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={graphH} style={styles.svg}>
        {!transparent && (
          <Rect x={0} y={0} width={width} height={graphH} fill="#000c08" opacity={0.92} rx={3} />
        )}
        <Line x1={0} y1={midY} x2={width} y2={midY} stroke={color} strokeWidth={0.4} strokeOpacity={0.2} />
        <Polyline
          points={pointsStr}
          fill="none"
          stroke={color}
          strokeWidth={1.5}
          strokeLinejoin="round"
          strokeLinecap="round"
        />
      </Svg>
      {showLabel && (
        <View style={styles.labelRow}>
          <Text style={[styles.bpmNum, { color }]}>{displayBpm}</Text>
          <Text style={[styles.bpmUnit, { color }]}>BPM</Text>
          {comaState !== 'none' && (
            <Text style={[styles.comaTag, { color }]}>
              {comaState === 'tachycardia' ? '心跳过速' : '心跳过缓'}
            </Text>
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
  svg: {},
  labelRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    paddingHorizontal: 4,
    gap: 3,
    height: 16,
  },
  bpmNum: {
    fontSize: 11,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
  },
  bpmUnit: {
    fontSize: 8,
    fontFamily: 'Inter_400Regular',
    opacity: 0.8,
  },
  comaTag: {
    fontSize: 8,
    fontFamily: 'Inter_700Bold',
    letterSpacing: 0.5,
    opacity: 0.9,
    marginLeft: 4,
  },
});
