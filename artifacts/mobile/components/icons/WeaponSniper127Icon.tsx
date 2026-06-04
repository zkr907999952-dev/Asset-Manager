import React from 'react';
import Svg, { Rect, Path, Circle, Line, G, Ellipse } from 'react-native-svg';

interface Props { size?: number; opacity?: number; selected?: boolean }

export function WeaponSniper127Icon({ size = 64, opacity = 1, selected = false }: Props) {
  const c = selected ? '#b8c0c8' : '#787880';
  const dark = selected ? '#303840' : '#1e2228';
  const scope = selected ? '#405060' : '#252e36';
  return (
    <Svg width={size} height={size * 0.42} viewBox="0 0 96 40" opacity={opacity}>
      <G>
        {/* Barrel (very long, heavy) */}
        <Rect x={1} y={17} width={56} height={7} rx={3} fill={c} />
        <Rect x={1} y={17} width={56} height={2.5} rx={1.5} fill="rgba(255,255,255,0.14)" />
        {/* Muzzle brake (large) */}
        <Rect x={0} y={15} width={5} height={11} rx={1.5} fill={dark} />
        <Circle cx={1.2} cy={20.5} r={3} fill="#050505" />
        <Rect x={0} y={17} width={5} height={1.5} fill="rgba(255,255,255,0.08)" />
        <Rect x={0} y={21} width={5} height={1.5} fill="rgba(255,255,255,0.08)" />
        {/* Suppressor hint */}
        <Rect x={2} y={16} width={12} height={9} rx={2} fill={dark} opacity={0.5} />
        {/* Heavy barrel fluting */}
        <Line x1={18} y1={17} x2={18} y2={24} stroke="rgba(255,255,255,0.09)" strokeWidth={1} />
        <Line x1={23} y1={17} x2={23} y2={24} stroke="rgba(255,255,255,0.09)" strokeWidth={1} />
        <Line x1={28} y1={17} x2={28} y2={24} stroke="rgba(255,255,255,0.09)" strokeWidth={1} />
        <Line x1={33} y1={17} x2={33} y2={24} stroke="rgba(255,255,255,0.09)" strokeWidth={1} />
        {/* Receiver (large chassis) */}
        <Rect x={55} y={13} width={22} height={14} rx={2.5} fill={dark} />
        <Rect x={56} y={14} width={20} height={5} rx={1.5} fill="#1a1a22" />
        {/* Bolt handle */}
        <Rect x={72} y={11} width={5} height={4} rx={1.5} fill={c} />
        <Circle cx={77} cy={13} r={2.2} fill={c} />
        {/* Large magazine */}
        <Path d="M62 27 L59 39 L68 39 L65 27 Z" fill={dark} />
        <Rect x={60} y={29} width={8} height={1.5} rx={0.5} fill="rgba(255,255,255,0.08)" />
        <Rect x={60} y={32} width={8} height={1.5} rx={0.5} fill="rgba(255,255,255,0.08)" />
        {/* Trigger guard */}
        <Path d="M63 28 Q60 33 62 38 L67 38 Q69 33 66 28" fill="none" stroke={c} strokeWidth={1.5} />
        <Line x1={64.5} y1={29} x2={64} y2={36} stroke={c} strokeWidth={1.2} strokeLinecap="round" />
        {/* Folding/fixed stock */}
        <Path d="M77 15 L96 17 L96 24 L77 27 Z" fill={dark} />
        <Rect x={80} y={18} width={14} height={5} rx={1} fill="#1a1a22" />
        <Line x1={84} y1={15.5} x2={84} y2={26.5} stroke="rgba(255,255,255,0.06)" strokeWidth={0.8} />
        <Line x1={89} y1={16} x2={89} y2={26} stroke="rgba(255,255,255,0.06)" strokeWidth={0.8} />
        {/* Cheek rest */}
        <Rect x={82} y={13} width={12} height={5} rx={2} fill={dark} />
        {/* === Large scope === */}
        {/* Scope body */}
        <Rect x={55} y={6} width={22} height={8} rx={3} fill={scope} />
        <Rect x={56} y={7} width={20} height={6} rx={2} fill="#0d1418" />
        {/* Scope objective lens */}
        <Ellipse cx={76} cy={10} rx={4} ry={4} fill="#0a0e12" stroke={c} strokeWidth={1.2} />
        <Ellipse cx={76} cy={10} rx={2.8} ry={2.8} fill="#060c14" />
        <Circle cx={75} cy={9} r={0.8} fill="rgba(100,180,255,0.35)" />
        {/* Scope eyepiece */}
        <Ellipse cx={56} cy={10} rx={3} ry={3.5} fill="#0a0e12" stroke={c} strokeWidth={1} />
        {/* Scope turrets */}
        <Rect x={63} y={3} width={4} height={4} rx={1} fill={c} />
        <Circle cx={65} cy={3} r={1.2} fill={dark} />
        {/* Scope rings */}
        <Rect x={60} y={5} width={3} height={10} rx={1} fill={c} opacity={0.8} />
        <Rect x={69} y={5} width={3} height={10} rx={1} fill={c} opacity={0.8} />
        {/* Bipod */}
        <Line x1={22} y1={24} x2={18} y2={38} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
        <Line x1={22} y1={24} x2={26} y2={38} stroke={c} strokeWidth={1.5} strokeLinecap="round" />
        <Rect x={16} y={36} width={5} height={2} rx={1} fill={c} />
        <Rect x={24} y={36} width={5} height={2} rx={1} fill={c} />
      </G>
    </Svg>
  );
}
