import React from 'react';
import Svg, { Rect, Path, Circle, Line, G } from 'react-native-svg';

interface Props { size?: number; opacity?: number; selected?: boolean }

export function WeaponPistol9mmIcon({ size = 44, opacity = 1, selected = false }: Props) {
  const c = selected ? '#e0c060' : '#999890';
  const dark = selected ? '#705010' : '#444';
  const grip = selected ? '#5a2e10' : '#2e1808';
  return (
    <Svg width={size} height={size * 0.65} viewBox="0 0 68 44" opacity={opacity}>
      <G>
        {/* Barrel */}
        <Rect x={4} y={15} width={38} height={7} rx={2.5} fill={c} />
        <Rect x={4} y={15} width={38} height={2.5} rx={1} fill="rgba(255,255,255,0.15)" />
        {/* Muzzle */}
        <Rect x={1} y={14} width={5} height={9} rx={2} fill={dark} />
        <Circle cx={1.5} cy={18.5} r={2.8} fill="#0a0a0a" />
        {/* Slide (wider, more modern) */}
        <Rect x={30} y={11} width={16} height={12} rx={2.5} fill={dark} />
        <Rect x={31} y={12} width={14} height={5} rx={1} fill="#1c1c1c" />
        {/* Serrations on slide */}
        <Line x1={38} y1={12} x2={38} y2={23} stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
        <Line x1={40} y1={12} x2={40} y2={23} stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
        <Line x1={42} y1={12} x2={42} y2={23} stroke="rgba(255,255,255,0.12)" strokeWidth={0.8} />
        {/* Frame */}
        <Rect x={30} y={22} width={16} height={6} rx={1.5} fill={c} />
        {/* Grip (polymer, slightly wider) */}
        <Path d="M44 24 L42 43 Q39 45 36 43 L32 24 Z" fill={grip} />
        <Line x1={36} y1={26} x2={36} y2={42} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
        <Line x1={38} y1={26} x2={38} y2={42} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
        <Line x1={34} y1={26} x2={34} y2={42} stroke="rgba(255,255,255,0.07)" strokeWidth={1} />
        {/* Trigger guard */}
        <Path d="M34 25 Q31 31 33 36 L39 36 Q41 31 38 25" fill="none" stroke={dark} strokeWidth={1.8} />
        {/* Trigger */}
        <Path d="M36 27 L35 33" stroke={c} strokeWidth={1.5} strokeLinecap="round" />
        {/* Front sight */}
        <Rect x={9} y={13} width={2.5} height={3.5} rx={0.5} fill={dark} />
        {/* Rear sight */}
        <Rect x={37} y={11} width={7} height={2.5} rx={0.5} fill={dark} />
        <Rect x={38.5} y={11} width={4} height={2.5} rx={0.4} fill="#111" />
        {/* Rail (under barrel) */}
        <Rect x={12} y={22} width={18} height={2} rx={0.5} fill={dark} />
        <Rect x={14} y={22.5} width={2} height={1} fill="rgba(255,255,255,0.1)" />
        <Rect x={18} y={22.5} width={2} height={1} fill="rgba(255,255,255,0.1)" />
        <Rect x={22} y={22.5} width={2} height={1} fill="rgba(255,255,255,0.1)" />
      </G>
    </Svg>
  );
}
