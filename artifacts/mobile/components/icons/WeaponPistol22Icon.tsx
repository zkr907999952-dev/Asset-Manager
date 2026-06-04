import React from 'react';
import Svg, { Rect, Path, Circle, Line, G, Ellipse } from 'react-native-svg';

interface Props { size?: number; opacity?: number; selected?: boolean }

export function WeaponPistol22Icon({ size = 44, opacity = 1, selected = false }: Props) {
  const c = selected ? '#d0cfc8' : '#909088';
  const dark = selected ? '#484840' : '#2c2c26';
  const grip = selected ? '#5a3218' : '#2e180a';
  const sup = selected ? '#b0b0a8' : '#727068';
  return (
    <Svg width={size} height={size * 0.65} viewBox="0 0 72 46" opacity={opacity}>
      <G>
        {/* === Suppressor (long cylinder) === */}
        <Rect x={2} y={15} width={28} height={8} rx={4} fill={sup} />
        <Rect x={2} y={15} width={28} height={2.5} rx={2} fill="rgba(255,255,255,0.18)" />
        {/* Suppressor end cap */}
        <Ellipse cx={3} cy={19} rx={2} ry={4} fill={dark} />
        <Circle cx={3} cy={19} r={1.5} fill="#0a0a0a" />
        {/* Suppressor vents */}
        <Line x1={10} y1={15} x2={10} y2={23} stroke="rgba(0,0,0,0.25)" strokeWidth={0.8} />
        <Line x1={16} y1={15} x2={16} y2={23} stroke="rgba(0,0,0,0.25)" strokeWidth={0.8} />
        <Line x1={22} y1={15} x2={22} y2={23} stroke="rgba(0,0,0,0.25)" strokeWidth={0.8} />

        {/* === Barrel / frame connector === */}
        <Rect x={28} y={16} width={8} height={6} rx={1} fill={c} />

        {/* === Slide (compact) === */}
        <Rect x={34} y={13} width={18} height={10} rx={2} fill={dark} />
        {/* Ejection port */}
        <Rect x={36} y={14} width={10} height={4} rx={1} fill="#131313" />
        {/* Slide serrations */}
        <Line x1={44} y1={13} x2={44} y2={23} stroke="rgba(255,255,255,0.12)" strokeWidth={0.7} />
        <Line x1={47} y1={13} x2={47} y2={23} stroke="rgba(255,255,255,0.12)" strokeWidth={0.7} />
        <Line x1={50} y1={13} x2={50} y2={23} stroke="rgba(255,255,255,0.12)" strokeWidth={0.7} />
        {/* Rear sight */}
        <Rect x={48} y={12} width={4} height={2} rx={0.5} fill={c} />
        <Rect x={49} y={12} width={2} height={2} rx={0.3} fill="#111" />

        {/* === Frame === */}
        <Rect x={34} y={22} width={18} height={5} rx={1.5} fill={c} />
        {/* Front sight */}
        <Rect x={36} y={11} width={1.5} height={3} rx={0.4} fill={c} />

        {/* === Compact Grip === */}
        <Path d="M48 23 L46 43 Q44 45 42 43 L40 23 Z" fill={grip} />
        {/* Grip texture lines */}
        <Line x1={42} y1={26} x2={42} y2={42} stroke="rgba(255,255,255,0.07)" strokeWidth={0.8} />
        <Line x1={44} y1={26} x2={44} y2={42} stroke="rgba(255,255,255,0.07)" strokeWidth={0.8} />

        {/* === Trigger guard === */}
        <Path d="M42 24 Q39 30 41 35 L46 35 Q48 30 45 24" fill="none" stroke={dark} strokeWidth={1.4} />
        {/* Trigger */}
        <Line x1={43.5} y1={25} x2={43} y2={32} stroke={c} strokeWidth={1.1} strokeLinecap="round" />

        {/* === Magazine base (compact) === */}
        <Rect x={41} y={42} width={5} height={2} rx={1} fill={dark} />
      </G>
    </Svg>
  );
}
