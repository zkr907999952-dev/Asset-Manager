import React from 'react';
import Svg, { Rect, Path, Circle, Line, G, Ellipse } from 'react-native-svg';

interface Props { size?: number; opacity?: number; selected?: boolean }

export function WeaponRifle762Icon({ size = 56, opacity = 1, selected = false }: Props) {
  const c = selected ? '#c8c0a8' : '#888880';
  const dark = selected ? '#404038' : '#2a2a22';
  const wood = selected ? '#7a3e18' : '#4a2510';
  return (
    <Svg width={size} height={size * 0.45} viewBox="0 0 88 40" opacity={opacity}>
      <G>
        {/* Barrel (long) */}
        <Rect x={2} y={17} width={52} height={5} rx={2} fill={c} />
        <Rect x={2} y={17} width={52} height={1.8} rx={1} fill="rgba(255,255,255,0.13)" />
        {/* Muzzle brake */}
        <Rect x={1} y={16} width={3} height={7} rx={1} fill={dark} />
        <Circle cx={1.5} cy={19.5} r={2.2} fill="#080808" />
        {/* Gas block */}
        <Rect x={30} y={15} width={5} height={9} rx={1} fill={dark} />
        {/* Handguard */}
        <Rect x={14} y={16} width={20} height={7} rx={1.5} fill={dark} />
        <Line x1={17} y1={16} x2={17} y2={23} stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} />
        <Line x1={21} y1={16} x2={21} y2={23} stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} />
        <Line x1={25} y1={16} x2={25} y2={23} stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} />
        <Line x1={29} y1={16} x2={29} y2={23} stroke="rgba(255,255,255,0.08)" strokeWidth={0.7} />
        {/* Receiver */}
        <Rect x={52} y={14} width={18} height={11} rx={2} fill={dark} />
        {/* Charging handle */}
        <Rect x={64} y={13} width={4} height={3} rx={1} fill={c} />
        {/* Magazine */}
        <Path d="M58 25 L56 36 L62 36 L60 25 Z" fill={dark} />
        {/* Trigger guard */}
        <Path d="M58 26 Q55 31 57 35 L62 35 Q64 31 61 26" fill="none" stroke={c} strokeWidth={1.3} />
        {/* Trigger */}
        <Line x1={59} y1={27} x2={58.5} y2={33} stroke={c} strokeWidth={1.1} strokeLinecap="round" />
        {/* Stock (wood) */}
        <Path d="M70 16 L88 18 L88 22 L70 25 Z" fill={wood} />
        <Line x1={74} y1={16.5} x2={74} y2={24.5} stroke="rgba(255,255,255,0.07)" strokeWidth={0.8} />
        <Line x1={79} y1={17} x2={79} y2={24} stroke="rgba(255,255,255,0.07)" strokeWidth={0.8} />
        {/* Front sight post */}
        <Rect x={7} y={14} width={2} height={4} rx={0.5} fill={c} />
        {/* Rear sight (scope ring) */}
        <Ellipse cx={62} cy={14} rx={5} ry={3.5} fill="none" stroke={c} strokeWidth={1.5} />
        <Line x1={57} y1={14} x2={67} y2={14} stroke={c} strokeWidth={0.7} />
        <Line x1={62} y1={10} x2={62} y2={18} stroke={c} strokeWidth={0.7} />
        <Circle cx={62} cy={14} r={1.2} fill={c} />
        {/* Scope body hint */}
        <Rect x={54} y={9} width={16} height={6} rx={2.5} fill={dark} opacity={0.7} />
        <Rect x={55} y={10} width={14} height={4} rx={1.5} fill="#111" opacity={0.7} />
      </G>
    </Svg>
  );
}
