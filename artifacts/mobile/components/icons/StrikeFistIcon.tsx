import React from 'react';
import Svg, { Rect, Path, Ellipse, Circle, G } from 'react-native-svg';

interface Props {
  size?: number;
  opacity?: number;
}

export function StrikeFistIcon({ size = 36, opacity = 1 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" opacity={opacity}>
      {/* Thumb (left side) */}
      <Ellipse cx={7} cy={22} rx={3.5} ry={5.5} fill="#C08060" />
      <Ellipse cx={7} cy={22} rx={2.4} ry={4.2} fill="#D49070" />

      {/* Palm / main fist body */}
      <Rect x={9} y={16} width={20} height={14} rx={4} fill="#C08060" />

      {/* Top highlight */}
      <Rect x={9} y={16} width={20} height={4} rx={3} fill="#D89878" opacity={0.6} />

      {/* Finger row (4 fingers curled) */}
      <Rect x={9} y={10} width={4.2} height={9} rx={2.1} fill="#C08060" />
      <Rect x={14} y={9} width={4.2} height={10} rx={2.1} fill="#C08060" />
      <Rect x={19} y={9} width={4.2} height={10} rx={2.1} fill="#C08060" />
      <Rect x={24} y={10} width={4.2} height={9} rx={2.1} fill="#C08060" />

      {/* Knuckle highlights */}
      <Ellipse cx={11.1} cy={13} rx={1.8} ry={1.1} fill="#E8AA88" opacity={0.7} />
      <Ellipse cx={16.1} cy={12} rx={1.8} ry={1.1} fill="#E8AA88" opacity={0.7} />
      <Ellipse cx={21.1} cy={12} rx={1.8} ry={1.1} fill="#E8AA88" opacity={0.7} />
      <Ellipse cx={26.1} cy={13} rx={1.8} ry={1.1} fill="#E8AA88" opacity={0.7} />

      {/* Knuckle crease line */}
      <Rect x={9} y={18.5} width={20} height={1} rx={0.5} fill="#A06040" opacity={0.35} />

      {/* Bottom shadow */}
      <Rect x={9} y={27} width={20} height={3} rx={3} fill="#9A5838" opacity={0.3} />
    </Svg>
  );
}
