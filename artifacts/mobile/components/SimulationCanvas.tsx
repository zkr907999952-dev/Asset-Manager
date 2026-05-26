import React, { useRef, useCallback } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Svg, {
  Ellipse, Circle, Line, Path, Rect, Defs, RadialGradient, LinearGradient, Stop, G,
  Image as SvgImage, ClipPath,
} from 'react-native-svg';

const CAVITY_BG = require('@/assets/images/cavity_bg.png');
const INTESTINES_REF = require('@/assets/images/intestines.png');
const BELLY_EXTERNAL_IMG = require('@/assets/images/belly_external.png');
import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  SMALL_RADIUS, LARGE_RADIUS,
} from '../constants/gameConfig';
import { buildSmoothPath } from '../engine/physics';
import { useGame } from '../contexts/GameContext';
import { TOOLS } from '../constants/gameConfig';

function segmentColor(health: number, pain: number, pressure: number, ruptured: boolean, broken: boolean, isLarge: boolean): string {
  if (broken) return '#cc1010';
  if (ruptured) return '#dd3030';
  const baseR = isLarge ? 176 : 230;
  const baseG = isLarge ? 96 : 138;
  const baseB = isLarge ? 80 : 138;
  const healthFactor = health / 100;
  const painFactor = pain / 100;
  const r = Math.round(Math.min(255, baseR + painFactor * 60));
  const g = Math.round(Math.max(20, baseG * healthFactor));
  const b = Math.round(Math.max(20, baseB * healthFactor));
  return `rgb(${r},${g},${b})`;
}

interface CanvasProps {
  canvasLayout: { x: number; y: number; width: number; height: number } | null;
  onLayout: (layout: { x: number; y: number; width: number; height: number }) => void;
}

export function SimulationCanvas({ canvasLayout, onLayout }: CanvasProps) {
  const { state, physicsRef, triggerDialogue, addElectrode } = useGame();
  const lastDialogueTime = useRef(0);
  const isDragging = useRef(false);

  const toPhysicsCoords = useCallback((localX: number, localY: number) => {
    if (!canvasLayout) return { x: localX, y: localY };
    // SVG uses preserveAspectRatio="xMidYMid meet" — the rendered viewBox is fit
    // inside the View, centered. Compute the actual rendered rect.
    const viewW = canvasLayout.width;
    const viewH = canvasLayout.height;
    const scale = Math.min(viewW / CANVAS_W, viewH / CANVAS_H);
    const renderedW = CANVAS_W * scale;
    const renderedH = CANVAS_H * scale;
    const offsetX = (viewW - renderedW) / 2;
    const offsetY = (viewH - renderedH) / 2;
    return {
      x: (localX - offsetX) / scale,
      y: (localY - offsetY) / scale,
    };
  }, [canvasLayout]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      isDragging.current = true;
      const { locationX, locationY } = evt.nativeEvent;
      const pos = toPhysicsCoords(locationX, locationY);
      physicsRef.current.toolPos = pos;

      if (state.activeTool === TOOLS.ELECTRIC) {
        addElectrode(pos.x, pos.y);
        return;
      }
      if (state.activeTool === TOOLS.GRAB) {
        let closest = -1, closestDist = 999, closestType: 'small' | 'large' = 'small';
        const tryNodes = (nodes: { x: number; y: number }[], type: 'small' | 'large') => {
          nodes.forEach((n, i) => {
            const d = Math.sqrt((n.x - pos.x) ** 2 + (n.y - pos.y) ** 2);
            if (d < closestDist) { closestDist = d; closest = i; closestType = type; }
          });
        };
        tryNodes(physicsRef.current.smallNodes, 'small');
        tryNodes(physicsRef.current.largeNodes, 'large');
        if (closestDist < 35) {
          physicsRef.current.grabbedNode = { type: closestType, idx: closest };
          triggerDialogue('grab');
        }
      }
    },
    onPanResponderMove: (evt) => {
      const { locationX, locationY } = evt.nativeEvent;
      const pos = toPhysicsCoords(locationX, locationY);
      physicsRef.current.toolPos = pos;

      const now = Date.now();
      if (now - lastDialogueTime.current > 4000 && state.activeTool) {
        lastDialogueTime.current = now;
        if (state.activeTool === TOOLS.METAL_ROD || state.activeTool === TOOLS.VIBRATOR) {
          triggerDialogue('stirring');
        }
      }
    },
    onPanResponderRelease: () => {
      isDragging.current = false;
      physicsRef.current.toolPos = null;
      physicsRef.current.grabbedNode = null;
    },
  })).current;

  const { renderSmallNodes, renderLargeNodes, renderSmallSegs, renderLargeSegs } = state;

  const isInternal = state.viewMode === 'internal';

  // Compute average pain across small segments
  const avgPain = renderSmallSegs.length > 0
    ? renderSmallSegs.reduce((a, s) => a + s.pain, 0) / renderSmallSegs.length
    : 0;
  // Compute average pressure for belly bulge
  const avgPressure = renderSmallSegs.length > 0
    ? renderSmallSegs.reduce((a, s) => a + s.pressure, 0) / renderSmallSegs.length : 0;
  const bulge = 1 + avgPressure * 0.003;

  // Build smooth path for the entire small intestine
  const smallPath = buildSmoothPath(renderSmallNodes);
  const largePath = buildSmoothPath(renderLargeNodes);

  // Small intestine stroke width varies by avg pressure
  const smallStrokeW = SMALL_RADIUS * 2 + avgPressure * 0.04;

  return (
    <View
      style={styles.container}
      onLayout={e => {
        const { x, y, width, height } = e.nativeEvent.layout;
        onLayout({ x, y, width, height });
      }}
      {...panResponder.panHandlers}
    >
      <Svg
        width="100%"
        height="100%"
        viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Always-dark canvas background — prevents gradient leaks */}
        <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0a0202" />

        {!isInternal && (
          <Defs>
            <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#c07850" stopOpacity="1" />
              <Stop offset="100%" stopColor="#a06040" stopOpacity="1" />
            </LinearGradient>
          </Defs>
        )}

        <Defs>
          <ClipPath id="cavityClip">
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX * bulge} ry={CAVITY_RY} />
          </ClipPath>
        </Defs>

        {/* Cavity / body background */}
        {isInternal ? (
          <>
            {/* Cavity image background (clipped to ellipse) */}
            <SvgImage
              href={CAVITY_BG}
              x={CAVITY_CX - CAVITY_RX * bulge - 8}
              y={CAVITY_CY - CAVITY_RY - 8}
              width={(CAVITY_RX * bulge + 8) * 2}
              height={(CAVITY_RY + 8) * 2}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#cavityClip)"
            />
            {/* Cavity rim */}
            <Ellipse
              cx={CAVITY_CX} cy={CAVITY_CY}
              rx={CAVITY_RX * bulge} ry={CAVITY_RY}
              fill="none" stroke="#6a2020" strokeWidth={2}
            />
          </>
        ) : (
          <Ellipse
            cx={CAVITY_CX} cy={CAVITY_CY}
            rx={CAVITY_RX * bulge + 18} ry={CAVITY_RY + 10}
            fill="url(#skinGrad)"
            stroke="#8a4030" strokeWidth={1.5}
          />
        )}

        {isInternal ? (
          /* ===== INTERNAL VIEW ===== */
          <G clipPath="url(#cavityClip)">
            {/* Faint anatomical intestine reference (clipped, low opacity, behind physics layer) */}
            <SvgImage
              href={INTESTINES_REF}
              x={CAVITY_CX - CAVITY_RX * 0.92}
              y={CAVITY_CY - CAVITY_RY * 0.92}
              width={CAVITY_RX * 0.92 * 2}
              height={CAVITY_RY * 0.92 * 2}
              preserveAspectRatio="xMidYMid meet"
              opacity={0.42}
            />
            {/* Peritoneum lining */}
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX - 2} ry={CAVITY_RY - 2}
              fill="none" stroke="#3a1010" strokeWidth={4} />

            {/* Large intestine (back layer) */}
            {renderLargeSegs.map((seg, i) => {
              if (i >= renderLargeNodes.length - 1) return null;
              const a = renderLargeNodes[i];
              const b = renderLargeNodes[i + 1];
              const w = LARGE_RADIUS * 2 + (seg.pressure / 100) * LARGE_RADIUS;
              const col = segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, true);
              return (
                <Line key={`lg-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={col} strokeWidth={w} strokeLinecap="round" />
              );
            })}
            {/* Large intestine highlight */}
            {renderLargeSegs.map((seg, i) => {
              if (i >= renderLargeNodes.length - 1) return null;
              const a = renderLargeNodes[i]; const b = renderLargeNodes[i + 1];
              return (
                <Line key={`lgh-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke="rgba(255,180,160,0.2)" strokeWidth={LARGE_RADIUS * 0.6} strokeLinecap="round" />
              );
            })}

            {/* Small intestine */}
            {renderSmallSegs.map((seg, i) => {
              if (i >= renderSmallNodes.length - 1) return null;
              const a = renderSmallNodes[i]; const b = renderSmallNodes[i + 1];
              const w = SMALL_RADIUS * 2 + (seg.pressure / 100) * SMALL_RADIUS;
              const col = segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, false);
              return (
                <Line key={`sm-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                  stroke={col} strokeWidth={w} strokeLinecap="round" />
              );
            })}
            {/* Small intestine highlight */}
            {renderSmallNodes.length > 1 && (
              <Path d={smallPath} stroke="rgba(255,220,200,0.15)" strokeWidth={3} fill="none" strokeLinecap="round" />
            )}

            {/* Rupture holes */}
            {renderSmallSegs.map((seg, i) =>
              seg.ruptured ? (
                <Circle key={`rpt-${i}`}
                  cx={renderSmallNodes[i]?.x ?? 0} cy={renderSmallNodes[i]?.y ?? 0}
                  r={5} fill="#000000" stroke="#cc2020" strokeWidth={1} />
              ) : null
            )}

            {/* Debug mode: colored attribute bars */}
            {state.debugMode && renderSmallSegs.map((seg, i) => {
              const n = renderSmallNodes[i];
              if (!n) return null;
              const bx = n.x + 12; const by = n.y - 12;
              return (
                <G key={`dbg-${i}`}>
                  <Rect x={bx} y={by} width={seg.health * 0.3} height={2} fill="#00cc00" />
                  <Rect x={bx} y={by + 3} width={seg.sensitivity * 0.3} height={2} fill="#cc00cc" />
                  <Rect x={bx} y={by + 6} width={seg.pain * 0.3} height={2} fill="#cc0000" />
                  <Rect x={bx} y={by + 9} width={seg.pressure * 0.3} height={2} fill="#0088ff" />
                </G>
              );
            })}

            {/* Collision boxes debug */}
            {state.showCollisionBoxes && renderSmallNodes.map((n, i) => (
              <Circle key={`cb-${i}`} cx={n.x} cy={n.y} r={SMALL_RADIUS}
                fill="none" stroke="rgba(0,255,255,0.4)" strokeWidth={0.8} />
            ))}

            {/* Tool visualization */}
            {state.toolPos && state.activeTool === TOOLS.METAL_ROD && (
              <G>
                <Line x1={state.toolPos.x} y1={state.toolPos.y - 80}
                  x2={state.toolPos.x} y2={state.toolPos.y + 80}
                  stroke="#aaaacc" strokeWidth={5} strokeLinecap="round" />
                <Circle cx={state.toolPos.x} cy={state.toolPos.y} r={6} fill="#aaaacc" />
              </G>
            )}
            {state.toolPos && state.activeTool === TOOLS.GRAB && (
              <Circle cx={state.toolPos.x} cy={state.toolPos.y} r={18}
                fill="rgba(96,192,96,0.25)" stroke="#60c060" strokeWidth={1.5} />
            )}
            {state.toolPos && state.activeTool === TOOLS.VIBRATOR && (
              <G>
                <Circle cx={state.toolPos.x} cy={state.toolPos.y}
                  r={40 + (state.toolParam2 * 0.4)} fill="rgba(180,120,255,0.1)"
                  stroke="rgba(180,120,255,0.5)" strokeWidth={1} strokeDasharray="4 4" />
                <Line x1={state.toolPos.x} y1={state.toolPos.y - 90}
                  x2={state.toolPos.x} y2={state.toolPos.y + 40}
                  stroke="#b078ff" strokeWidth={8} strokeLinecap="round" />
                <Circle cx={state.toolPos.x} cy={state.toolPos.y} r={8} fill="#cc88ff" />
              </G>
            )}
            {state.toolPos && state.activeTool === TOOLS.NEEDLE && (
              <G>
                <Line x1={state.toolPos.x} y1={state.toolPos.y - 100}
                  x2={state.toolPos.x} y2={state.toolPos.y + 20}
                  stroke="#bbbbbb" strokeWidth={2} strokeLinecap="round" />
                <Line x1={state.toolPos.x} y1={state.toolPos.y + 18}
                  x2={state.toolPos.x} y2={state.toolPos.y + 26}
                  stroke="#dddddd" strokeWidth={1} />
              </G>
            )}
            {state.toolPos && state.activeTool === TOOLS.SYRINGE && (
              <G>
                <Rect x={state.toolPos.x - 6} y={state.toolPos.y - 30}
                  width={12} height={30} rx={2} fill="#60c0c0" fillOpacity={0.8} />
                <Line x1={state.toolPos.x} y1={state.toolPos.y}
                  x2={state.toolPos.x} y2={state.toolPos.y + 15}
                  stroke="#aaaaaa" strokeWidth={2} />
              </G>
            )}
            {state.toolPos && state.activeTool === TOOLS.ENEMA && (
              <G>
                {/* Tube + nozzle entering from rectum side */}
                <Line x1={state.toolPos.x} y1={state.toolPos.y - 80}
                  x2={state.toolPos.x} y2={state.toolPos.y + 10}
                  stroke="#88aabb" strokeWidth={4} strokeLinecap="round" />
                <Circle cx={state.toolPos.x} cy={state.toolPos.y + 12} r={5} fill="#aabbcc" />
                {state.toolActive && (
                  <>
                    <Circle cx={state.toolPos.x} cy={state.toolPos.y + 12} r={14}
                      fill="none" stroke="rgba(150,200,255,0.5)" strokeWidth={1.5} />
                    <Circle cx={state.toolPos.x} cy={state.toolPos.y + 12} r={9}
                      fill="rgba(150,200,255,0.25)" />
                  </>
                )}
              </G>
            )}

            {/* Electrodes */}
            {state.electrodes.map((el, i) => (
              <G key={`el-${i}`}>
                <Circle cx={el.x} cy={el.y} r={6} fill="#ffff00" fillOpacity={0.9} stroke="#ffaa00" strokeWidth={1} />
                {state.toolActive && (
                  <Circle cx={el.x} cy={el.y} r={30 + state.toolParam2 * 0.3}
                    fill="rgba(255,255,0,0.06)" stroke="rgba(255,255,0,0.3)" strokeWidth={0.8} />
                )}
              </G>
            ))}
          </G>
        ) : (
          /* ===== EXTERNAL VIEW ===== */
          <G>
            {/* Painted character belly artwork (anime style, matches CharacterView) */}
            <SvgImage
              href={BELLY_EXTERNAL_IMG}
              x={0} y={0}
              width={CANVAS_W} height={CANVAS_H}
              preserveAspectRatio="xMidYMid slice"
            />
            {/* Dynamic bulge — subtle pink glow on bandages when pressure builds */}
            {avgPressure > 15 && (
              <Ellipse
                cx={CANVAS_W / 2}
                cy={CANVAS_H * 0.48}
                rx={CANVAS_W * 0.30 * (1 + avgPressure * 0.003) * bulge}
                ry={CANVAS_H * 0.13 * (1 + avgPressure * 0.003) * bulge}
                fill={`rgba(220,70,90,${Math.min(0.32, avgPressure * 0.003)})`}
              />
            )}
            {/* Pain flush — red blush on abdomen */}
            {avgPain > 20 && (
              <Ellipse
                cx={CANVAS_W / 2}
                cy={CANVAS_H * 0.50}
                rx={CANVAS_W * 0.28}
                ry={CANVAS_H * 0.10}
                fill={`rgba(255,80,80,${Math.min(0.28, avgPain * 0.003)})`}
              />
            )}
            {/* Navel piercing overlay (anchored to image's navel position) */}
            {state.navelPierced && (
              <G>
                <Line
                  x1={CANVAS_W / 2} y1={CANVAS_H * 0.555}
                  x2={CANVAS_W / 2} y2={CANVAS_H * 0.595}
                  stroke="#dcdcdc" strokeWidth={2.5} strokeLinecap="round"
                />
                <Circle cx={CANVAS_W / 2} cy={CANVAS_H * 0.555} r={3} fill="#f0f0f0" />
                <Circle cx={CANVAS_W / 2} cy={CANVAS_H * 0.595} r={3} fill="#f0f0f0" />
              </G>
            )}
            {/* Rupture indicators — bloodstains on bandages */}
            {state.renderSmallSegs.filter(s => s.ruptured).slice(0, 3).map((_, i) => (
              <Ellipse key={`rup-${i}`}
                cx={CANVAS_W * (0.35 + i * 0.15)}
                cy={CANVAS_H * (0.42 + i * 0.03)}
                rx={14 + i * 3} ry={8 + i * 2}
                fill="rgba(140,20,20,0.55)"
              />
            ))}
            {/* Heavy bulge deformation when very high pressure */}
            {avgPressure > 60 && (
              <Ellipse
                cx={CANVAS_W / 2}
                cy={CANVAS_H * 0.51}
                rx={CANVAS_W * 0.32 * bulge}
                ry={CANVAS_H * 0.14 * bulge}
                fill="none"
                stroke="rgba(255,150,150,0.4)"
                strokeWidth={3}
              />
            )}
          </G>
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0404',
  },
});
