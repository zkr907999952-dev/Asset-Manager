import React from 'react';
import Svg, { Rect, Ellipse, Path, G, Circle, Line, Defs, LinearGradient, Stop } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
}

/**
 * Flat side view of a baseball bat — no perspective scaling.
 * Barrel on the left (impact side), knob/handle on the right.
 */
export function StrikeBatAnim({ width = 200, height = 80 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 200 80">

      {/* ── Barrel (left, fat end) ── */}
      {/* Main barrel cylinder */}
      <Ellipse cx={28} cy={40} rx={26} ry={26} fill="#7A3810" />
      <Ellipse cx={28} cy={40} rx={22} ry={22} fill="#9A4E1A" />
      {/* Barrel top highlight */}
      <Ellipse cx={26} cy={33} rx={14} ry={8} fill="#C07030" opacity={0.5} />
      {/* Barrel face rings */}
      <Ellipse cx={28} cy={40} rx={16} ry={16} fill="none" stroke="#6A2E08" strokeWidth={1.5} opacity={0.4} />
      <Ellipse cx={28} cy={40} rx={8} ry={8} fill="none" stroke="#6A2E08" strokeWidth={1} opacity={0.3} />
      <Circle cx={28} cy={40} r={3} fill="#5A2206" opacity={0.6} />

      {/* ── Bat body (barrel → taper → handle) ── */}
      {/* Top rail */}
      <Path
        d="M 28 14 L 150 29 L 150 31 L 28 16 Z"
        fill="#C07030"
        opacity={0.5}
      />
      {/* Body rectangle (main wood shaft) */}
      <Rect x={28} y={14} width={122} height={52} rx={0} fill="#9A4E1A" />
      {/* Top highlight stripe */}
      <Rect x={28} y={14} width={122} height={14} rx={0} fill="#C87830" opacity={0.45} />
      {/* Bottom shadow stripe */}
      <Rect x={28} y={52} width={122} height={14} rx={0} fill="#5A2A08" opacity={0.4} />

      {/* Wood grain lines */}
      <Line x1={40} y1={14} x2={40} y2={66} stroke="#6A2E08" strokeWidth={0.8} opacity={0.3} />
      <Line x1={60} y1={14} x2={60} y2={66} stroke="#6A2E08" strokeWidth={0.7} opacity={0.25} />
      <Line x1={80} y1={14} x2={80} y2={66} stroke="#6A2E08" strokeWidth={0.7} opacity={0.25} />
      <Line x1={100} y1={14} x2={100} y2={66} stroke="#6A2E08" strokeWidth={0.7} opacity={0.25} />
      <Line x1={120} y1={14} x2={120} y2={66} stroke="#6A2E08" strokeWidth={0.7} opacity={0.25} />
      <Line x1={140} y1={14} x2={140} y2={66} stroke="#6A2E08" strokeWidth={0.8} opacity={0.3} />

      {/* ── Taper neck (barrel → handle transition) ── */}
      <Path
        d="M 150 14 L 166 22 L 166 58 L 150 66 Z"
        fill="#7A3A10"
        opacity={0.7}
      />
      <Path
        d="M 150 14 L 166 22 L 166 30 L 150 22 Z"
        fill="#B06828"
        opacity={0.4}
      />

      {/* ── Handle / grip ── */}
      <Rect x={166} y={22} width={22} height={36} rx={0} fill="#1A1A1A" />
      {/* Grip tape highlight */}
      <Rect x={166} y={22} width={22} height={10} rx={0} fill="#333" opacity={0.6} />
      {/* Grip tape wrap lines */}
      <Line x1={166} y1={28} x2={188} y2={28} stroke="#555" strokeWidth={1.5} opacity={0.5} />
      <Line x1={166} y1={34} x2={188} y2={34} stroke="#555" strokeWidth={1.5} opacity={0.5} />
      <Line x1={166} y1={40} x2={188} y2={40} stroke="#555" strokeWidth={1.5} opacity={0.5} />
      <Line x1={166} y1={46} x2={188} y2={46} stroke="#555" strokeWidth={1.5} opacity={0.5} />
      <Line x1={166} y1={52} x2={188} y2={52} stroke="#555" strokeWidth={1.5} opacity={0.5} />

      {/* ── Knob endcap ── */}
      <Rect x={188} y={18} width={10} height={44} rx={5} fill="#111" />
      <Rect x={189} y={20} width={7} height={40} rx={4} fill="#2A2A2A" />
      {/* Knob highlight */}
      <Ellipse cx={192} cy={29} rx={2.5} ry={5} fill="#444" opacity={0.5} />

    </Svg>
  );
}
