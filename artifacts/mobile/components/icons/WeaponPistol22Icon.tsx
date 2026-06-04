import React from 'react';
import Svg, { Rect, Path, Circle, Line, G, Ellipse } from 'react-native-svg';

interface Props { size?: number; opacity?: number; selected?: boolean }

export function WeaponPistol22Icon({ size = 44, opacity = 1, selected = false }: Props) {
  const c = selected ? '#e8b84a' : '#aaa8a0';
  const dark = selected ? '#8a6a1a' : '#555';
  const grip = selected ? '#6b3a18' : '#3a2010';
  return (
    <Svg width={size} height={size * 0.6} viewBox="0 0 64 38" opacity={opacity}>
      <G>
        {/* Barrel */}
        <Rect x={6} y={14} width={34} height={6} rx={2} fill={c} />
        <Rect x={6} y={14} width={34} height={2} rx={1} fill="rgba(255,255,255,0.18)" />
        {/* Muzzle */}
        <Rect x={2} y={13} width={6} height={8} rx={1.5} fill={dark} />
        <Circle cx={2} cy={17} r={2.5} fill="#111" />
        {/* Slide */}
        <Rect x={28} y={11} width={12} height={10} rx={2} fill={dark} />
        {/* Ejection port */}
        <Rect x={30} y={12.5} width={7} height={4} rx={1} fill="#1a1a1a" />
        {/* Frame */}
        <Rect x={28} y={20} width={14} height={5} rx={1.5} fill={c} />
        {/* Grip */}
        <Path d="M38 21 L36 37 Q34 39 32 37 L30 21 Z" fill={grip} />
        <Line x1={32} y1={23} x2={32} y2={36} stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />
        <Line x1={34} y1={23} x2={34} y2={36} stroke="rgba(255,255,255,0.08)" strokeWidth={0.8} />
        {/* Trigger guard */}
        <Path d="M30 21 Q28 28 30 32 L34 32 Q36 28 34 21" fill="none" stroke={dark} strokeWidth={1.5} />
        {/* Trigger */}
        <Line x1={32} y1={23} x2={31} y2={30} stroke={c} strokeWidth={1.2} strokeLinecap="round" />
        {/* Front sight */}
        <Rect x={10} y={12} width={2} height={3} rx={0.5} fill={dark} />
        {/* Rear sight notch */}
        <Rect x={36} y={11} width={5} height={2} rx={0.5} fill={dark} />
        <Rect x={37.5} y={11} width={2} height={2} rx={0.3} fill="#1a1a1a" />
      </G>
    </Svg>
  );
}
