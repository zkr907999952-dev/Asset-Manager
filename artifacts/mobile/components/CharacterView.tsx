import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle, Line, Path, G, Image as SvgImage } from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';
import { useBreathAnimation } from '@/hooks/useBreathAnimation';
import { LETHAL_WEAPONS, CANVAS_W, CAVITY_CX, CAVITY_CY } from '@/constants/gameConfig';

const CHARACTER_IMG = require('@/assets/images/character.png');
const BULLET_HOLE_SMALL = require('@/assets/images/bullet_hole_small.png');
const BULLET_HOLE_LARGE = require('@/assets/images/bullet_hole_large.png');
const LARGE_CALIBER_SET = new Set<string>([LETHAL_WEAPONS.RIFLE_762, LETHAL_WEAPONS.SNIPER_127]);

interface Props {
  width: number;
  height: number;
}

const BELLY_Y_FRAC = 0.56;

export function CharacterView({ width, height }: Props) {
  const { state } = useGame();
  const avgPressure = state.renderSmallSegs.length > 0
    ? state.renderSmallSegs.reduce((a, s) => a + s.pressure, 0) / state.renderSmallSegs.length
    : 0;
  const avgPain = state.renderSmallSegs.length > 0
    ? state.renderSmallSegs.reduce((a, s) => a + s.pain, 0) / state.renderSmallSegs.length
    : 0;

  const breathVal = useBreathAnimation(state.heartRate);
  const amp = state.breathAmplitude;

  const bellyBulge = 1 + avgPressure * 0.004;
  const painFlush = avgPain / 100;
  const ruptures = state.intestinalRuptures;

  const cx = width / 2;
  const bellyCy = height * BELLY_Y_FRAC;
  const bellyRx = width * 0.18 * bellyBulge;
  const bellyRy = height * 0.07 * bellyBulge;

  const bellyR = Math.round(220 + painFlush * 35);
  const bellyG = Math.round(80 - painFlush * 50);
  const bellyB = Math.round(80 - painFlush * 50);

  // Breathing: inhale lifts the torso and slightly expands the belly
  const inhale = (breathVal + 1) / 2;
  const breathTranslateY = -inhale * 4 * amp;
  const breathBellyScale = 1 + inhale * 0.018 * amp;
  const bellyTransform = `translate(${cx}, ${bellyCy}) scale(1, ${breathBellyScale}) translate(${-cx}, ${-bellyCy})`;

  return (
    <View style={[styles.container, { width, height }]}>
      {/* Base character image — shifts up slightly on inhale */}
      <View style={{ transform: [{ translateY: breathTranslateY }] }}>
        <Image
          source={CHARACTER_IMG}
          style={[styles.image, { width, height }]}
          resizeMode="cover"
        />
      </View>

      {/* SVG overlay for dynamic state */}
      <Svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={styles.overlay}>
        {/* Belly breathing group — scales from belly center */}
        <G transform={bellyTransform}>
          {/* Pain flush */}
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

          {/* Pressure shadow */}
          {avgPressure > 30 && (
            <Ellipse
              cx={cx} cy={bellyCy}
              rx={bellyRx * 1.25} ry={bellyRy * 1.2}
              fill="none"
              stroke="rgba(0,0,0,0.35)"
              strokeWidth={2}
            />
          )}

          {/* Rupture holes */}
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

          {/* Navel piercing */}
          {state.navelPierced && (
            <Line
              x1={cx} y1={bellyCy - bellyRy * 0.3}
              x2={cx} y2={bellyCy + bellyRy * 0.3}
              stroke="#dddddd"
              strokeWidth={2}
              strokeLinecap="round"
            />
          )}

          {/* Bullet holes — synced from simulation (physics → CharacterView coords)
              Navel anchor: physics (CAVITY_CX, CAVITY_CY) → CV (width/2, height*BELLY_Y_FRAC)
              xS: belly fills ~full view width   (width / CANVAS_W ≈ 0.53)
              yS: physics is belly-zoomed in; full-body character compresses Y by ~0.55
              Tune CV_HOLE_Y_SCALE if vertical placement drifts after screen size changes. */}
          {state.bulletHoles && state.bulletHoles.map((hole) => {
            const isLarge = hole.weaponId && LARGE_CALIBER_SET.has(hole.weaponId);
            const holeImg = isLarge ? BULLET_HOLE_LARGE : BULLET_HOLE_SMALL;
            const xS = width / CANVAS_W;
            const yS = xS * 0.55; // Y compressed: physics zoomed-belly vs full-body character
            const cvX = width / 2 + (hole.physX - CAVITY_CX) * xS;
            const cvY = height * BELLY_Y_FRAC + (hole.physY - CAVITY_CY) * yS;
            const size = hole.radius * (isLarge ? 11 : 9) * xS;
            const half = size / 2;
            return (
              <SvgImage
                key={`ch-bh-${hole.id}`}
                x={cvX - half}
                y={cvY - half}
                width={size}
                height={size}
                href={holeImg}
                preserveAspectRatio="xMidYMid meet"
              />
            );
          })}
        </G>

        {/* Cheek blush */}
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
