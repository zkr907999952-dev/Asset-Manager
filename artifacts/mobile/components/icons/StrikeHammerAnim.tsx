import React from 'react';
import Svg, { Rect, Ellipse, Path, G, Circle, Line } from 'react-native-svg';

interface Props {
  width?: number;
  height?: number;
}

/**
 * Battering ram log head — a very thick, short wooden cylinder.
 * Face-on view: the circular front of the log is what makes contact.
 */
export function StrikeHammerAnim({ width = 140, height = 140 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 140 140">

      {/* ── Log cylinder body (seen from a slight 3/4 angle) ── */}

      {/* Cylinder top face (circular front) — this hits the belly */}
      <Ellipse cx={70} cy={70} rx={60} ry={60} fill="#5C2A0A" />
      {/* Outer ring (bark edge) */}
      <Ellipse cx={70} cy={70} rx={60} ry={60} fill="none" stroke="#3A1605" strokeWidth={4} />
      {/* Bark ring */}
      <Ellipse cx={70} cy={70} rx={56} ry={56} fill="#6A3210" />
      {/* Inner heartwood */}
      <Ellipse cx={70} cy={70} rx={46} ry={46} fill="#7A3A12" />

      {/* ── Annual rings (tree rings) ── */}
      <Ellipse cx={70} cy={70} rx={38} ry={38} fill="none" stroke="#5A2A08" strokeWidth={1.4} opacity={0.7} />
      <Ellipse cx={70} cy={70} rx={29} ry={29} fill="none" stroke="#5A2A08" strokeWidth={1.2} opacity={0.6} />
      <Ellipse cx={70} cy={70} rx={21} ry={21} fill="none" stroke="#4A2006" strokeWidth={1.2} opacity={0.55} />
      <Ellipse cx={70} cy={70} rx={14} ry={14} fill="none" stroke="#4A2006" strokeWidth={1} opacity={0.5} />
      <Ellipse cx={70} cy={70} rx={8} ry={8} fill="none" stroke="#3A1806" strokeWidth={1} opacity={0.5} />
      {/* Pith (center) */}
      <Circle cx={70} cy={70} r={4} fill="#3A1605" opacity={0.7} />
      <Circle cx={70} cy={70} r={2} fill="#2A1004" opacity={0.8} />

      {/* ── Radial cracks / grain rays ── */}
      <Line x1={70} y1={70} x2={70} y2={14} stroke="#4A1E06" strokeWidth={0.9} opacity={0.4} />
      <Line x1={70} y1={70} x2={112} y2={28} stroke="#4A1E06" strokeWidth={0.9} opacity={0.35} />
      <Line x1={70} y1={70} x2={126} y2={70} stroke="#4A1E06" strokeWidth={0.9} opacity={0.4} />
      <Line x1={70} y1={70} x2={112} y2={112} stroke="#4A1E06" strokeWidth={0.9} opacity={0.35} />
      <Line x1={70} y1={70} x2={70} y2={126} stroke="#4A1E06" strokeWidth={0.9} opacity={0.4} />
      <Line x1={70} y1={70} x2={28} y2={112} stroke="#4A1E06" strokeWidth={0.8} opacity={0.3} />
      <Line x1={70} y1={70} x2={14} y2={70} stroke="#4A1E06" strokeWidth={0.9} opacity={0.4} />
      <Line x1={70} y1={70} x2={28} y2={28} stroke="#4A1E06" strokeWidth={0.8} opacity={0.3} />

      {/* ── Face highlight (upper-left light source) ── */}
      <Ellipse cx={52} cy={52} rx={28} ry={22} fill="#C07838" opacity={0.18} />
      <Ellipse cx={46} cy={44} rx={14} ry={10} fill="#E09848" opacity={0.13} />

      {/* ── Bark edge texture ── */}
      <Ellipse cx={70} cy={70} rx={60} ry={60} fill="none" stroke="#8A4420" strokeWidth={2} opacity={0.25} />

      {/* ── Rope attachment points (two small holes where it's suspended) ── */}
      <Ellipse cx={70} cy={20} rx={6} ry={4} fill="#2A1004" opacity={0.6} />
      <Ellipse cx={70} cy={20} rx={3.5} ry={2.2} fill="#1A0A02" opacity={0.7} />
      <Ellipse cx={70} cy={120} rx={6} ry={4} fill="#2A1004" opacity={0.6} />
      <Ellipse cx={70} cy={120} rx={3.5} ry={2.2} fill="#1A0A02" opacity={0.7} />

    </Svg>
  );
}
