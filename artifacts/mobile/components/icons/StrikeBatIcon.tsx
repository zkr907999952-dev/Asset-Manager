import React from 'react';
import Svg, { Rect, Path, Ellipse, Circle, G, Line } from 'react-native-svg';

interface Props {
  size?: number;
  opacity?: number;
}

export function StrikeBatIcon({ size = 36, opacity = 1 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" opacity={opacity}>
      {/* Bat angled from lower-left (knob) to upper-right (barrel) */}

      {/* Handle / grip tape */}
      <Path
        d="M 6 30 Q 5.5 29 7 27.5 L 14 20.5 Q 15.5 19 16.5 20 L 15.5 21 Q 14.5 20.5 13 22 L 7.5 28 Q 6.5 29.5 7 30.5 Z"
        fill="#1A1A1A"
        opacity={0.85}
      />
      {/* Grip tape wrapping lines */}
      <Line x1={9} y1={28.5} x2={12} y2={25.5} stroke="#333" strokeWidth={1} opacity={0.6} />
      <Line x1={10.5} y1={27} x2={13.5} y2={24} stroke="#333" strokeWidth={1} opacity={0.6} />

      {/* Taper / neck */}
      <Path
        d="M 13 22 L 16.5 19 Q 18.5 17.5 20 18.5 L 17 21.5 Z"
        fill="#7A4818"
      />

      {/* Barrel */}
      <Path
        d="M 17 21.5 Q 19 19.5 22 17.5 L 31 8.5 Q 33.5 6 32.5 5 Q 31.5 4 29 6.5 L 19 15.5 Q 16.5 17.5 16 19 Z"
        fill="#9A5820"
      />
      {/* Barrel highlight */}
      <Path
        d="M 20 19.5 Q 22 17 25 14 L 31 8 Q 32.5 6.5 32 5.8 Q 29.5 7 27 10 L 21 16.5 Z"
        fill="#C07830"
        opacity={0.5}
      />
      {/* Barrel wood grain lines */}
      <Line x1={20} y1={20} x2={29.5} y2={8} stroke="#7A3810" strokeWidth={0.6} opacity={0.45} />
      <Line x1={22} y1={21} x2={31} y2={10} stroke="#7A3810" strokeWidth={0.5} opacity={0.35} />

      {/* Barrel cap (end) */}
      <Ellipse cx={30.5} cy={6.5} rx={2.5} ry={2.5} fill="#6A3810" />
      <Ellipse cx={30.5} cy={6.5} rx={1.5} ry={1.5} fill="#9A5820" />

      {/* Knob endcap */}
      <Ellipse cx={6.5} cy={30.5} rx={2.8} ry={2.8} fill="#111" />
      <Ellipse cx={6.5} cy={30.5} rx={1.6} ry={1.6} fill="#333" />
    </Svg>
  );
}
