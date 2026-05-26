import React from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, {
  Ellipse, Circle, Path, Line, G, Defs, RadialGradient, Stop, LinearGradient,
} from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';

interface Props {
  width: number;
  height: number;
}

export function CharacterView({ width, height }: Props) {
  const { state } = useGame();
  const avgPressure = state.renderSmallSegs.length > 0
    ? state.renderSmallSegs.reduce((a, s) => a + s.pressure, 0) / state.renderSmallSegs.length
    : 0;
  const avgPain = state.renderSmallSegs.length > 0
    ? state.renderSmallSegs.reduce((a, s) => a + s.pain, 0) / state.renderSmallSegs.length
    : 0;

  const bellyBulge = 1 + avgPressure * 0.004;
  const painFlush = avgPain / 100;

  // SVG proportions
  const cx = width / 2;
  const headY = height * 0.12;
  const neckY = height * 0.22;
  const chestY = height * 0.38;
  const waistY = height * 0.52;
  const hipY = height * 0.60;
  const legEndY = height * 0.95;

  const headR = width * 0.12;
  const shoulderW = width * 0.28;
  const waistW = width * 0.13;
  const hipW = width * 0.22;

  // Belly color: normal → reddish with pain
  const bellyR = Math.round(200 + painFlush * 40);
  const bellyG = Math.round(140 - painFlush * 60);
  const bellyB = Math.round(110 - painFlush * 50);
  const bellyColor = `rgb(${bellyR},${bellyG},${bellyB})`;

  const bellyRadius = waistW * bellyBulge;

  // Rupture holes on belly
  const ruptures = state.intestinalRuptures;

  return (
    <View style={[styles.container, { width, height }]}>
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <Defs>
          <LinearGradient id="skinGrad" x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor="#d4956a" />
            <Stop offset="100%" stopColor="#c07850" />
          </LinearGradient>
          <RadialGradient id="hairGrad" cx="50%" cy="30%" rx="50%" ry="60%">
            <Stop offset="0%" stopColor="#3a2010" />
            <Stop offset="100%" stopColor="#1a0808" />
          </RadialGradient>
          <LinearGradient id="clothGrad" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#1a2060" />
            <Stop offset="100%" stopColor="#0a0a30" />
          </LinearGradient>
          <LinearGradient id="clothBottom" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0%" stopColor="#2a0a20" />
            <Stop offset="100%" stopColor="#140010" />
          </LinearGradient>
        </Defs>

        {/* Hair */}
        <Ellipse cx={cx} cy={headY - headR * 0.2} rx={headR * 1.15} ry={headR * 1.3}
          fill="url(#hairGrad)" />
        <Path d={`M ${cx - headR * 1.1} ${headY + headR * 0.3} 
          Q ${cx - headR * 1.4} ${headY + headR * 1.5} ${cx - headR * 1.2} ${waistY}`}
          stroke="#1a0808" strokeWidth={headR * 0.7} fill="none" strokeLinecap="round" />
        <Path d={`M ${cx + headR * 1.1} ${headY + headR * 0.3} 
          Q ${cx + headR * 1.4} ${headY + headR * 1.5} ${cx + headR * 1.2} ${waistY}`}
          stroke="#1a0808" strokeWidth={headR * 0.7} fill="none" strokeLinecap="round" />

        {/* Neck */}
        <Path d={`M ${cx - headR * 0.28} ${headY + headR * 0.6} 
          L ${cx - headR * 0.22} ${neckY}
          L ${cx + headR * 0.22} ${neckY}
          L ${cx + headR * 0.28} ${headY + headR * 0.6}`}
          fill="url(#skinGrad)" />

        {/* Body / torso */}
        <Path d={`M ${cx - shoulderW} ${neckY}
          Q ${cx - shoulderW * 1.1} ${chestY * 0.85} ${cx - waistW} ${waistY}
          Q ${cx - hipW} ${waistY + (hipY - waistY) * 0.3} ${cx - hipW * 1.05} ${hipY}
          L ${cx + hipW * 1.05} ${hipY}
          Q ${cx + hipW} ${waistY + (hipY - waistY) * 0.3} ${cx + waistW} ${waistY}
          Q ${cx + shoulderW * 1.1} ${chestY * 0.85} ${cx + shoulderW} ${neckY}
          Z`}
          fill="url(#skinGrad)" />

        {/* Top garment (crop top) */}
        <Path d={`M ${cx - shoulderW * 1.05} ${neckY + (chestY - neckY) * 0.15}
          Q ${cx - shoulderW * 1.1} ${chestY * 0.7} ${cx - waistW * 1.05} ${chestY * 0.92}
          L ${cx + waistW * 1.05} ${chestY * 0.92}
          Q ${cx + shoulderW * 1.1} ${chestY * 0.7} ${cx + shoulderW * 1.05} ${neckY + (chestY - neckY) * 0.15}
          L ${cx + shoulderW} ${neckY}
          Q ${cx} ${neckY + (chestY - neckY) * 0.45} ${cx - shoulderW} ${neckY}
          Z`}
          fill="url(#clothGrad)" />

        {/* Bottom garment (shorts/skirt) */}
        <Path d={`M ${cx - hipW * 1.05} ${hipY}
          Q ${cx - hipW * 1.1} ${hipY + (legEndY - hipY) * 0.08} ${cx - hipW * 0.9} ${hipY + (legEndY - hipY) * 0.14}
          L ${cx + hipW * 0.9} ${hipY + (legEndY - hipY) * 0.14}
          Q ${cx + hipW * 1.1} ${hipY + (legEndY - hipY) * 0.08} ${cx + hipW * 1.05} ${hipY}
          Z`}
          fill="url(#clothBottom)" />

        {/* Exposed belly skin highlight */}
        <Ellipse cx={cx} cy={(waistY + chestY) / 2 + 8} rx={waistW * 0.9} ry={(hipY - chestY) * 0.28}
          fill="rgba(255,200,160,0.08)" />

        {/* Belly bulge */}
        {avgPressure > 15 && (
          <Ellipse cx={cx} cy={waistY - 5} rx={bellyRadius * 1.2} ry={bellyRadius * 1.0}
            fill={`rgba(${bellyR},${bellyG * 0.7},${bellyB * 0.7},0.18)`} />
        )}

        {/* Navel */}
        <Ellipse cx={cx} cy={waistY - 4}
          rx={state.navelPierced ? 5 : 4}
          ry={state.navelPierced ? 9 : 7}
          fill="#7a4828" stroke="#5a3018" strokeWidth={0.8} />
        <Ellipse cx={cx} cy={waistY - 6} rx={2} ry={3.5} fill="#8a5030" />
        {state.navelPierced && (
          <Line x1={cx} y1={waistY - 13} x2={cx} y2={waistY + 5}
            stroke="#cccccc" strokeWidth={2} strokeLinecap="round" />
        )}

        {/* Rupture holes */}
        {Array.from({ length: Math.min(ruptures, 5) }).map((_, i) => (
          <Circle key={i}
            cx={cx + (i - 2) * 15}
            cy={waistY + 10}
            r={3}
            fill="#cc0000"
            stroke="#880000"
            strokeWidth={0.8}
          />
        ))}

        {/* Broken intestine marks */}
        {state.intestinalBreaks > 0 && (
          <Path d={`M ${cx - 15} ${waistY - 15} L ${cx + 15} ${waistY + 15}`}
            stroke="#aa0000" strokeWidth={1.5} strokeDasharray="3 2" />
        )}

        {/* Face */}
        <Ellipse cx={cx} cy={headY} rx={headR} ry={headR * 1.1} fill="url(#skinGrad)" />

        {/* Eyes */}
        <Ellipse cx={cx - headR * 0.35} cy={headY - headR * 0.05} rx={headR * 0.16} ry={headR * 0.2}
          fill="#1a0808" />
        <Ellipse cx={cx + headR * 0.35} cy={headY - headR * 0.05} rx={headR * 0.16} ry={headR * 0.2}
          fill="#1a0808" />
        {/* Eye highlights */}
        <Circle cx={cx - headR * 0.3} cy={headY - headR * 0.1} r={headR * 0.05} fill="white" />
        <Circle cx={cx + headR * 0.4} cy={headY - headR * 0.1} r={headR * 0.05} fill="white" />

        {/* Nose */}
        <Ellipse cx={cx} cy={headY + headR * 0.15} rx={headR * 0.05} ry={headR * 0.04} fill="#b06040" />

        {/* Mouth - expression based on pain/pleasure */}
        {avgPain > 30 ? (
          <Path d={`M ${cx - headR * 0.2} ${headY + headR * 0.38}
            Q ${cx} ${headY + headR * 0.25} ${cx + headR * 0.2} ${headY + headR * 0.38}`}
            stroke="#b06040" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        ) : avgPressure > 40 ? (
          <Path d={`M ${cx - headR * 0.2} ${headY + headR * 0.32}
            Q ${cx} ${headY + headR * 0.44} ${cx + headR * 0.2} ${headY + headR * 0.32}`}
            stroke="#b06040" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        ) : (
          <Path d={`M ${cx - headR * 0.15} ${headY + headR * 0.35}
            L ${cx + headR * 0.15} ${headY + headR * 0.35}`}
            stroke="#b06040" strokeWidth={1.5} fill="none" strokeLinecap="round" />
        )}

        {/* Blush spots (when pain/pleasure high) */}
        {(avgPain > 40 || avgPressure > 50) && (
          <>
            <Ellipse cx={cx - headR * 0.52} cy={headY + headR * 0.15} rx={headR * 0.18} ry={headR * 0.1}
              fill="rgba(220,80,80,0.35)" />
            <Ellipse cx={cx + headR * 0.52} cy={headY + headR * 0.15} rx={headR * 0.18} ry={headR * 0.1}
              fill="rgba(220,80,80,0.35)" />
          </>
        )}

        {/* Legs */}
        <Path d={`M ${cx - hipW * 0.7} ${hipY + (legEndY - hipY) * 0.12}
          Q ${cx - hipW * 0.75} ${(hipY + legEndY) / 2} ${cx - hipW * 0.55} ${legEndY}`}
          stroke="url(#skinGrad)" strokeWidth={hipW * 0.55} fill="none" strokeLinecap="round" />
        <Path d={`M ${cx + hipW * 0.7} ${hipY + (legEndY - hipY) * 0.12}
          Q ${cx + hipW * 0.75} ${(hipY + legEndY) / 2} ${cx + hipW * 0.55} ${legEndY}`}
          stroke="url(#skinGrad)" strokeWidth={hipW * 0.55} fill="none" strokeLinecap="round" />

        {/* Arms */}
        <Path d={`M ${cx - shoulderW} ${neckY + (chestY - neckY) * 0.3}
          Q ${cx - shoulderW * 1.5} ${chestY * 0.8} ${cx - shoulderW * 1.3} ${waistY - 20}`}
          stroke="url(#skinGrad)" strokeWidth={shoulderW * 0.32} fill="none" strokeLinecap="round" />
        <Path d={`M ${cx + shoulderW} ${neckY + (chestY - neckY) * 0.3}
          Q ${cx + shoulderW * 1.5} ${chestY * 0.8} ${cx + shoulderW * 1.3} ${waistY - 20}`}
          stroke="url(#skinGrad)" strokeWidth={shoulderW * 0.32} fill="none" strokeLinecap="round" />
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { overflow: 'hidden' },
});
