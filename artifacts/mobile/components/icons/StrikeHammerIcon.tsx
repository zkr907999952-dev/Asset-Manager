import React from 'react';
import Svg, { Rect, Ellipse, Line, Circle, G, Path } from 'react-native-svg';

interface Props {
  size?: number;
  opacity?: number;
  color?: string;
}

export function StrikeHammerIcon({ size = 36, opacity = 1 }: Props) {
  return (
    <Svg width={size} height={size} viewBox="0 0 36 36" opacity={opacity}>

      {/* ── 顶部横梁 (支撑框架) ── */}
      {/* 梁主体 */}
      <Rect x={3} y={3} width={30} height={4} rx={1.5} fill="#4A2008" />
      {/* 梁高光 */}
      <Rect x={3} y={3} width={30} height={1.5} rx={1} fill="#7A3812" opacity={0.7} />
      {/* 梁左端盖 */}
      <Rect x={1.5} y={2.5} width={3} height={5} rx={1} fill="#3A1605" />
      {/* 梁右端盖 */}
      <Rect x={31.5} y={2.5} width={3} height={5} rx={1} fill="#3A1605" />

      {/* ── 左绳 ── */}
      {/* 绳主体（两股拧在一起的效果） */}
      <Line x1={12} y1={7} x2={12} y2={22} stroke="#C8A050" strokeWidth={2} strokeLinecap="round" />
      <Line x1={12} y1={7} x2={12} y2={22} stroke="#E8C070" strokeWidth={0.7} strokeLinecap="round" strokeDasharray="2,2" />

      {/* ── 右绳 ── */}
      <Line x1={24} y1={7} x2={24} y2={22} stroke="#C8A050" strokeWidth={2} strokeLinecap="round" />
      <Line x1={24} y1={7} x2={24} y2={22} stroke="#E8C070" strokeWidth={0.7} strokeLinecap="round" strokeDasharray="2,2" />

      {/* ── 绳扣（梁上） ── */}
      <Circle cx={12} cy={7} r={1.8} fill="#A07830" />
      <Circle cx={12} cy={7} r={0.9} fill="#C8A050" />
      <Circle cx={24} cy={7} r={1.8} fill="#A07830" />
      <Circle cx={24} cy={7} r={0.9} fill="#C8A050" />

      {/* ── 金属绑环（绳连木锤处） ── */}
      {/* 左绑环 */}
      <Rect x={9.5} y={20.5} width={5} height={3.5} rx={1} fill="#707070" />
      <Rect x={10.2} y={21.2} width={3.6} height={2} rx={0.5} fill="#909090" />
      {/* 右绑环 */}
      <Rect x={21.5} y={20.5} width={5} height={3.5} rx={1} fill="#707070" />
      <Rect x={22.2} y={21.2} width={3.6} height={2} rx={0.5} fill="#909090" />

      {/* ── 木锤主体 ── */}
      {/* 左端盖（端面纹理） */}
      <Ellipse cx={5.2} cy={27.5} rx={2.2} ry={5.8} fill="#3A1805" />
      <Ellipse cx={5.2} cy={27.5} rx={1.4} ry={4.5} fill="#5C2A0A" />
      <Circle cx={5.2} cy={27.5} r={0.7} fill="#7A3810" />

      {/* 右端盖（端面纹理） */}
      <Ellipse cx={30.8} cy={27.5} rx={2.2} ry={5.8} fill="#3A1805" />
      <Ellipse cx={30.8} cy={27.5} rx={1.4} ry={4.5} fill="#5C2A0A" />
      <Circle cx={30.8} cy={27.5} r={0.7} fill="#7A3810" />

      {/* 木锤圆柱主体 */}
      <Rect x={5} y={21.8} width={26} height={11.5} rx={5.5} fill="#7A3210" />

      {/* 木纹高光面 */}
      <Rect x={5} y={21.8} width={26} height={4} rx={3} fill="#A04818" opacity={0.65} />

      {/* 木纹暗线 */}
      <Line x1={10} y1={23} x2={10} y2={32.5} stroke="#4A1C06" strokeWidth={0.6} opacity={0.5} />
      <Line x1={15.5} y1={22.5} x2={15.5} y2={33} stroke="#4A1C06" strokeWidth={0.5} opacity={0.4} />
      <Line x1={20.5} y1={22.5} x2={20.5} y2={33} stroke="#4A1C06" strokeWidth={0.5} opacity={0.4} />
      <Line x1={26} y1={23} x2={26} y2={32.5} stroke="#4A1C06" strokeWidth={0.6} opacity={0.5} />

      {/* 底部阴影边 */}
      <Rect x={5} y={30.8} width={26} height={2.5} rx={3} fill="#3A1605" opacity={0.35} />

    </Svg>
  );
}
