import React, { useRef, useCallback } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import Svg, {
  Ellipse, Circle, Line, Path, Rect, Defs, RadialGradient, LinearGradient, Stop, G,
} from 'react-native-svg';
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

  const toPhysicsCoords = useCallback((screenX: number, screenY: number) => {
    if (!canvasLayout) return { x: screenX, y: screenY };
    const scaleX = CANVAS_W / canvasLayout.width;
    const scaleY = CANVAS_H / canvasLayout.height;
    return {
      x: (screenX - canvasLayout.x) * scaleX,
      y: (screenY - canvasLayout.y) * scaleY,
    };
  }, [canvasLayout]);

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      isDragging.current = true;
      const { pageX, pageY } = evt.nativeEvent;
      const pos = toPhysicsCoords(pageX, pageY);
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
      const { pageX, pageY } = evt.nativeEvent;
      const pos = toPhysicsCoords(pageX, pageY);
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

        {isInternal ? (
          <Defs>
            <RadialGradient id="cavityGrad" cx="50%" cy="50%" rx="50%" ry="50%">
              <Stop offset="0%" stopColor="#1e0808" stopOpacity="1" />
              <Stop offset="100%" stopColor="#0a0202" stopOpacity="1" />
            </RadialGradient>
          </Defs>
        ) : (
          <Defs>
            <LinearGradient id="skinGrad" x1="0" y1="0" x2="0" y2="1">
              <Stop offset="0%" stopColor="#c07850" stopOpacity="1" />
              <Stop offset="100%" stopColor="#a06040" stopOpacity="1" />
            </LinearGradient>
          </Defs>
        )}

        {/* Cavity / body background */}
        {isInternal ? (
          <Ellipse
            cx={CAVITY_CX} cy={CAVITY_CY}
            rx={CAVITY_RX * bulge} ry={CAVITY_RY}
            fill="url(#cavityGrad)"
            stroke="#6a2020" strokeWidth={2}
          />
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
          <>
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
          </>
        ) : (
          /* ===== EXTERNAL VIEW ===== */
          <>
            {/* Belly layers */}
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX * bulge + 10} ry={CAVITY_RY + 6}
              fill="#c87850" fillOpacity={0.6} />
            {/* Subtle intestine glow through skin */}
            {avgPressure > 20 && (
              <Ellipse cx={CAVITY_CX} cy={CAVITY_CY + 10}
                rx={70 * (1 + avgPressure * 0.002)} ry={60 * (1 + avgPressure * 0.002)}
                fill="rgba(220,80,80,0.12)" />
            )}
            {/* Navel */}
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY - 10}
              rx={state.navelPierced ? 5 : 4} ry={state.navelPierced ? 9 : 8}
              fill="#7a4828" stroke="#5a3018" strokeWidth={1} />
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY - 12}
              rx={2} ry={4}
              fill="#8a5030" />
            {state.navelPierced && (
              <Line x1={CAVITY_CX} y1={CAVITY_CY - 19}
                x2={CAVITY_CX} y2={CAVITY_CY - 1}
                stroke="#cccccc" strokeWidth={2.5} strokeLinecap="round" />
            )}
            {/* Skin texture highlights */}
            <Ellipse cx={CAVITY_CX - 20} cy={CAVITY_CY - 40} rx={30} ry={20}
              fill="rgba(255,200,160,0.08)" />
            {/* Waist shadow */}
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY}
              rx={CAVITY_RX * bulge + 14} ry={CAVITY_RY + 10}
              fill="none" stroke="rgba(0,0,0,0.3)" strokeWidth={8} />
          </>
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
