import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle, Line, Path } from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';

const CHARACTER_IMG = require('@/assets/images/character.png');

interface Props {
  width: number;
  height: number;
}

// Character body region (as fractions of image height) where belly overlay sits.
// Image is full-body anime portrait; belly band of bandages is ~0.50–0.62 of height.
const BELLY_Y_FRAC = 0.56;

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
  const ruptures = state.intestinalRuptures;

  // Belly anchor in pixel space (relative to image container)
  const cx = width / 2;
  const bellyCy = height * BELLY_Y_FRAC;
  const bellyRx = width * 0.18 * bellyBulge;
  const bellyRy = height * 0.07 * bellyBulge;

  // Belly tint that intensifies with pain
  const bellyR = Math.round(220 + painFlush * 35);
  const bellyG = Math.round(80 - painFlush * 50);
  const bellyB = Math.round(80 - painFlush * 50);

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Base character image */}
      <Image
        source={CHARACTER_IMG}
        style={[styles.image, { width, height }]}
        resizeMode="cover"
      />

      {/* SVG overlay for dynamic state (belly bulge, pain flush, rupture marks, navel piercing) */}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={styles.overlay}>
        {/* Pain flush over belly area */}
        {avgPain > 20 && (
          <Ellipse
            cx={cx} cy={bellyCy}
            rx={bellyRx * 1.4} ry={bellyRy * 1.6}
            fill={`rgba(${bellyR},${bellyG},${bellyB},${0.12 + painFlush * 0.25})`}
          />
        )}

        {/* Belly bulge highlight (pressure-driven) */}
        {avgPressure > 15 && (
          <Ellipse
            cx={cx} cy={bellyCy}
            rx={bellyRx * 1.15} ry={bellyRy * 1.1}
            fill={`rgba(${bellyR},${bellyG * 0.6},${bellyB * 0.6},0.20)`}
            stroke={`rgba(${bellyR},40,40,0.35)`}
            strokeWidth={1}
          />
        )}

        {/* Pressure shadow (dark ring around bulge) */}
        {avgPressure > 30 && (
          <Ellipse
            cx={cx} cy={bellyCy}
            rx={bellyRx * 1.25} ry={bellyRy * 1.2}
            fill="none"
            stroke="rgba(0,0,0,0.35)"
            strokeWidth={2}
          />
        )}

        {/* Rupture holes on belly */}
        {Array.from({ length: Math.min(ruptures, 5) }).map((_, i) => (
          <Circle
            key={`rpt-${i}`}
            cx={cx + (i - (Math.min(ruptures, 5) - 1) / 2) * (bellyRx * 0.5)}
            cy={bellyCy + Math.sin(i) * (bellyRy * 0.4)}
            r={4}
            fill="#1a0000"
            stroke="#cc0000"
            strokeWidth={1.5}
          />
        ))}

        {/* Broken intestine slash marks */}
        {state.intestinalBreaks > 0 && (
          <Path
            d={`M ${cx - bellyRx * 0.8} ${bellyCy - bellyRy * 0.4}
                L ${cx + bellyRx * 0.8} ${bellyCy + bellyRy * 0.6}`}
            stroke="#aa0000"
            strokeWidth={2}
            strokeDasharray="4 3"
          />
        )}

        {/* Navel piercing indicator */}
        {state.navelPierced && (
          <Line
            x1={cx} y1={bellyCy - bellyRy * 0.3}
            x2={cx} y2={bellyCy + bellyRy * 0.3}
            stroke="#dddddd"
            strokeWidth={2}
            strokeLinecap="round"
          />
        )}

        {/* Pain-mode blush overlay across cheeks (face is upper part of image) */}
        {(avgPain > 40 || avgPressure > 50) && (
          <>
            <Ellipse
              cx={cx - width * 0.13} cy={height * 0.16}
              rx={width * 0.05} ry={height * 0.012}
              fill="rgba(220,80,80,0.30)"
            />
            <Ellipse
              cx={cx + width * 0.13} cy={height * 0.16}
              rx={width * 0.05} ry={height * 0.012}
              fill="rgba(220,80,80,0.30)"
            />
          </>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    overflow: 'hidden',
    backgroundColor: '#0a0202',
  },
  image: {
    position: 'absolute',
    left: 0, top: 0,
  },
  overlay: {
    position: 'absolute',
    left: 0, top: 0,
  },
});
