import React from 'react';
import Svg, { Rect, Ellipse, Path, G, Circle, Line } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
}

/**
 * Rear view of a fist — knuckles facing the viewer.
 * The screen IS the attacker; user sees the back of the hand coming at them.
 */
export function StrikeFistAnim({ width = 100, height = 100 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100">

      {/* ── Wrist base ── */}
      <Rect x={22} y={72} width={56} height={22} rx={8} fill="#C08060" />
      <Rect x={22} y={72} width={56} height={8} rx={5} fill="#B07050" opacity={0.4} />
      <Rect x={22} y={87} width={56} height={7} rx={7} fill="#9A5838" opacity={0.35} />

      {/* ── Back of hand ── */}
      <Rect x={18} y={40} width={64} height={38} rx={10} fill="#C08060" />
      {/* Hand highlight (upper area) */}
      <Rect x={18} y={40} width={64} height={16} rx={9} fill="#D49070" opacity={0.55} />

      {/* ── Tendon ridges ── */}
      <Line x1={30} y1={42} x2={30} y2={65} stroke="#A86848" strokeWidth={1.2} opacity={0.3} />
      <Line x1={40} y1={41} x2={40} y2={65} stroke="#A86848" strokeWidth={1.2} opacity={0.3} />
      <Line x1={50} y1={41} x2={50} y2={65} stroke="#A86848" strokeWidth={1.2} opacity={0.3} />
      <Line x1={60} y1={41} x2={60} y2={65} stroke="#A86848" strokeWidth={1.2} opacity={0.3} />
      <Line x1={70} y1={42} x2={70} y2={65} stroke="#A86848" strokeWidth={1} opacity={0.25} />

      {/* ── Curled finger segments (4 fingers, showing backs) ── */}
      {/* Index */}
      <Rect x={20} y={20} width={14} height={28} rx={6} fill="#C08060" />
      <Rect x={20} y={20} width={14} height={10} rx={5} fill="#D49070" opacity={0.5} />
      {/* Middle */}
      <Rect x={36} y={16} width={14} height={32} rx={6} fill="#C08060" />
      <Rect x={36} y={16} width={14} height={10} rx={5} fill="#D49070" opacity={0.5} />
      {/* Ring */}
      <Rect x={52} y={16} width={14} height={32} rx={6} fill="#C08060" />
      <Rect x={52} y={16} width={14} height={10} rx={5} fill="#D49070" opacity={0.5} />
      {/* Pinky */}
      <Rect x={68} y={20} width={12} height={26} rx={5} fill="#C08060" />
      <Rect x={68} y={20} width={12} height={9} rx={5} fill="#D49070" opacity={0.5} />

      {/* ── Knuckle bumps (4 prominent) ── */}
      <Ellipse cx={27} cy={40} rx={8} ry={6} fill="#D09068" />
      <Ellipse cx={27} cy={39} rx={5.5} ry={3.5} fill="#E0A878" opacity={0.7} />

      <Ellipse cx={43} cy={37} rx={8} ry={6} fill="#D09068" />
      <Ellipse cx={43} cy={36} rx={5.5} ry={3.5} fill="#E0A878" opacity={0.7} />

      <Ellipse cx={59} cy={37} rx={8} ry={6} fill="#D09068" />
      <Ellipse cx={59} cy={36} rx={5.5} ry={3.5} fill="#E0A878" opacity={0.7} />

      <Ellipse cx={74} cy={40} rx={7} ry={5.5} fill="#D09068" />
      <Ellipse cx={74} cy={39} rx={5} ry={3.2} fill="#E0A878" opacity={0.7} />

      {/* ── Knuckle crease line ── */}
      <Path
        d="M 19 46 Q 27 44 43 43 Q 59 43 75 46 Q 80 47 82 48"
        stroke="#A86848"
        strokeWidth={1.4}
        fill="none"
        opacity={0.4}
        strokeLinecap="round"
      />

      {/* ── Thumb (left side, tucked) ── */}
      <Ellipse cx={12} cy={57} rx={7} ry={12} fill="#BF7855" />
      <Ellipse cx={12} cy={53} rx={4.5} ry={6} fill="#CF8E6A" opacity={0.6} />
      <Ellipse cx={12} cy={49} rx={5} ry={5} fill="#C8845E" />
      <Ellipse cx={12} cy={48} rx={3.5} ry={3} fill="#D4966E" opacity={0.55} />

    </Svg>
  );
}
