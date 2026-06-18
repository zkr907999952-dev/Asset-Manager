import React from 'react';
import { View, Image, StyleSheet } from 'react-native';
import Svg, { Ellipse, Circle, Line, Path, G, Image as SvgImage } from 'react-native-svg';
import { useGame } from '@/contexts/GameContext';
import { useBreathAnimation } from '@/hooks/useBreathAnimation';
import { LETHAL_WEAPONS, CANVAS_W, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY } from '@/constants/gameConfig';

const CHARACTER_IMG = require('@/assets/images/character.png');
const BULLET_HOLE_SMALL = require('@/assets/images/bullet_hole_small.png');
const BULLET_HOLE_LARGE = require('@/assets/images/bullet_hole_large.png');
const LARGE_CALIBER_SET = new Set<string>([LETHAL_WEAPONS.RIFLE_762, LETHAL_WEAPONS.SNIPER_127]);

interface Props {
  width: number;
  height: number;
}

// ── Character image calibration ──────────────────────────────────────────
// Source image: character.png, 768 × 1408 px, displayed with resizeMode="cover".
// CharacterView is always height-limited (tall narrow column), so:
//   imgScale = charHeight / 1408  (fills full height, crops X from both sides symmetrically)
//
// Calibration points measured in the source image (px from top-left):
//   Navel Y  : 787 px  (55.9 % from top)
//   Belly half-width (waist): ±93 px from horizontal center
//   Belly half-height       : ±110 px from navel Y
//
// These replace the old rough "xS = width/CANVAS_W, yS = xS*0.55" estimates
// which were wrong because they used the view width instead of the image scale.
const CHAR_IMG_H       = 1408;
const NAVEL_IMG_Y      = 787;   // navel Y in source image (px)
const BELLY_HALF_W_IMG = 93;    // belly half-width in source image (px)
const BELLY_HALF_H_IMG = 110;   // belly half-height in source image (px)

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

  // Calibrated coordinate mapping: physics → CharacterView
  // imgScale is the cover scale factor (height-limited for this tall narrow view)
  const imgScale = height / CHAR_IMG_H;
  const bellyCy  = NAVEL_IMG_Y * imgScale;                    // navel Y in view pixels
  const xS       = (BELLY_HALF_W_IMG * imgScale) / CAVITY_RX; // physics px → view px (X)
  const yS       = (BELLY_HALF_H_IMG * imgScale) / CAVITY_RY; // physics px → view px (Y)

  // Helper: physics coords → CharacterView coords
  const physToCV = (physX: number, physY: number) => ({
    x: cx + (physX - CAVITY_CX) * xS,
    y: bellyCy + (physY - CAVITY_CY) * yS,
  });

  const bellyRx = BELLY_HALF_W_IMG * imgScale * bellyBulge;
  const bellyRy = BELLY_HALF_H_IMG * imgScale * bellyBulge;

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

          {/* Katana slash scars — red diagonal wounds synced from simulation */}
          {state.slashScars && state.slashScars.map((scar) => {
            const p1 = physToCV(scar.physX1, scar.physY1);
            const p2 = physToCV(scar.physX2, scar.physY2);
            return (
              <G key={`ks-${scar.id}`}>
                <Line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="rgba(180,0,0,0.55)" strokeWidth={3.5} strokeLinecap="round" />
                <Line x1={p1.x} y1={p1.y} x2={p2.x} y2={p2.y}
                  stroke="rgba(240,30,30,0.80)" strokeWidth={1.5} strokeLinecap="round" />
              </G>
            );
          })}

          {/* Stab wounds — needle/bayonet non-navel insertion marks */}
          {state.stabWounds && state.stabWounds.map((wound) => {
            const { x: cvX, y: cvY } = physToCV(wound.physX, wound.physY);
            const r = 4.5 * xS;
            return (
              <G key={`stab-cv-${wound.id}`}>
                <Circle cx={cvX} cy={cvY} r={r * 2.8}
                  fill="rgba(90,0,0,0.35)" />
                <Circle cx={cvX} cy={cvY} r={r}
                  fill="rgba(15,0,0,0.92)" stroke="rgba(150,20,20,0.8)" strokeWidth={0.8} />
                <Line x1={cvX - r * 1.3} y1={cvY} x2={cvX + r * 1.3} y2={cvY}
                  stroke="rgba(10,0,0,0.95)" strokeWidth={1.2} />
                <Line x1={cvX} y1={cvY - r * 1.3} x2={cvX} y2={cvY + r * 1.3}
                  stroke="rgba(10,0,0,0.95)" strokeWidth={1.2} />
              </G>
            );
          })}

          {/* Bullet holes — synced from simulation (physics → CharacterView coords) */}
          {state.bulletHoles && state.bulletHoles.map((hole) => {
            const isLarge = hole.weaponId && LARGE_CALIBER_SET.has(hole.weaponId);
            const holeImg = isLarge ? BULLET_HOLE_LARGE : BULLET_HOLE_SMALL;
            const { x: cvX, y: cvY } = physToCV(hole.physX, hole.physY);
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
