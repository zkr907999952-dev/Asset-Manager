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

const NAVEL_X = CANVAS_W / 2;
const NAVEL_Y_EXTERNAL = CANVAS_H * 0.575;
const NAVEL_Y_INTERNAL = CAVITY_CY - 20;
const NAVEL_RADIUS = 28;

function segmentColor(health: number, pain: number, _pressure: number, ruptured: boolean, broken: boolean, perforated: boolean, isLarge: boolean): string {
  if (broken) return '#cc1010';
  if (ruptured) return '#dd3030';
  const baseR = isLarge ? 176 : 230;
  const baseG = isLarge ? 96 : 138;
  const baseB = isLarge ? 80 : 138;
  const healthFactor = health / 100;
  const painFactor = pain / 100;
  let r = Math.round(Math.min(255, baseR + painFactor * 60));
  let g = Math.round(Math.max(20, baseG * healthFactor));
  let b = Math.round(Math.max(20, baseB * healthFactor));
  if (perforated) { r = Math.min(255, r + 30); g = Math.max(20, g - 20); b = Math.max(20, b - 20); }
  return `rgb(${r},${g},${b})`;
}

function computeRodGeoFor(
  inserted: boolean,
  anchor: { x: number; y: number } | null,
  handle: { x: number; y: number },
  rodLen: number,
  stirAmp: number,
  time: number,
): { headX: number; headY: number; tailX: number; tailY: number; insideLen: number; dx: number; dy: number } {
  if (inserted && anchor) {
    const handleDist = Math.hypot(handle.x - anchor.x, handle.y - anchor.y);
    const insideLen = Math.max(0, rodLen - handleDist);
    let dx = anchor.x - handle.x, dy = anchor.y - handle.y;
    const dmag = Math.hypot(dx, dy) || 1;
    dx /= dmag; dy /= dmag;
    let ox = 0, oy = 0;
    if (stirAmp > 0) {
      const s = Math.sin(time * 0.25) * stirAmp;
      ox = -dy * s; oy = dx * s;
    }
    return {
      headX: anchor.x + dx * insideLen + ox,
      headY: anchor.y + dy * insideLen + oy,
      tailX: handle.x,
      tailY: handle.y,
      insideLen,
      dx, dy,
    };
  }
  return {
    headX: handle.x,
    headY: handle.y,
    tailX: handle.x,
    tailY: handle.y - rodLen,
    insideLen: rodLen * 0.5,
    dx: 0, dy: -1,
  };
}

// Compute sample points along the collision-active part of a rod for debug visualization
function computeRodCollisionSamples(
  g: { headX: number; headY: number; tailX: number; tailY: number },
  inserted: boolean,
  anchor: { x: number; y: number } | null,
  steps = 7,
): { x: number; y: number }[] {
  const pts: { x: number; y: number }[] = [];
  const startX = inserted && anchor ? anchor.x : g.tailX;
  const startY = inserted && anchor ? anchor.y : g.tailY;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      x: startX + (g.headX - startX) * t,
      y: startY + (g.headY - startY) * t,
    });
  }
  return pts;
}

interface CanvasProps {
  canvasLayout: { x: number; y: number; width: number; height: number } | null;
  onLayout: (layout: { x: number; y: number; width: number; height: number }) => void;
}

export function SimulationCanvas({ canvasLayout, onLayout }: CanvasProps) {
  const {
    state, physicsRef, triggerDialogue, addElectrode,
    insertViaNavel, retractTool, setNavelPierced, setEnemaHeadIdx,
    setEnemaInSmall, setEnemaSmallHeadIdx,
  } = useGame();
  const lastDialogueTime = useRef(0);
  const isDragging = useRef(false);

  const toPhysicsCoords = useCallback((localX: number, localY: number) => {
    if (!canvasLayout) return { x: localX, y: localY };
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

  // Ref bundle so panResponder always sees latest values (avoids stale closure)
  const hrRef = useRef({
    state,
    toPhysicsCoords,
    addElectrode,
    setEnemaHeadIdx,
    setEnemaInSmall,
    setEnemaSmallHeadIdx,
    insertViaNavel,
    setNavelPierced,
    triggerDialogue,
  });
  hrRef.current.state = state;
  hrRef.current.toPhysicsCoords = toPhysicsCoords;
  hrRef.current.addElectrode = addElectrode;
  hrRef.current.setEnemaHeadIdx = setEnemaHeadIdx;
  hrRef.current.setEnemaInSmall = setEnemaInSmall;
  hrRef.current.setEnemaSmallHeadIdx = setEnemaSmallHeadIdx;
  hrRef.current.insertViaNavel = insertViaNavel;
  hrRef.current.setNavelPierced = setNavelPierced;
  hrRef.current.triggerDialogue = triggerDialogue;

  const findNearestLargeNodeIdx = (pos: { x: number; y: number }) => {
    let best = -1, bestD = 9999;
    physicsRef.current.largeNodes.forEach((n, i) => {
      const d = Math.hypot(n.x - pos.x, n.y - pos.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return { idx: best, dist: bestD };
  };

  const findNearestSmallNodeIdx = (pos: { x: number; y: number }) => {
    let best = -1, bestD = 9999;
    physicsRef.current.smallNodes.forEach((n, i) => {
      const d = Math.hypot(n.x - pos.x, n.y - pos.y);
      if (d < bestD) { bestD = d; best = i; }
    });
    return { idx: best, dist: bestD };
  };

  const panResponder = useRef(PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderGrant: (evt) => {
      const { state: s, toPhysicsCoords: tpc, addElectrode: ae, setEnemaHeadIdx: sehi,
              insertViaNavel: ivn, setNavelPierced: snp, triggerDialogue: td } = hrRef.current;
      isDragging.current = true;
      const { locationX, locationY } = evt.nativeEvent;
      const pos = tpc(locationX, locationY);
      const isInternal = s.viewMode === 'internal';
      const navelY = isInternal ? NAVEL_Y_INTERNAL : NAVEL_Y_EXTERNAL;
      const distToNavel = Math.hypot(pos.x - NAVEL_X, pos.y - navelY);

      if (!isInternal && distToNavel < NAVEL_RADIUS) {
        if (s.activeTool === TOOLS.NEEDLE && !s.navelPierced) {
          snp(true);
          td('pain_high');
          return;
        }
        if (
          s.navelPierced &&
          (s.activeTool === TOOLS.METAL_ROD ||
            s.activeTool === TOOLS.VIBRATOR ||
            s.activeTool === TOOLS.NEEDLE)
        ) {
          ivn();
          physicsRef.current.toolPos = { x: NAVEL_X, y: NAVEL_Y_INTERNAL - 40 };
          return;
        }
      }

      physicsRef.current.toolPos = pos;

      if (s.activeTool === TOOLS.ELECTRIC) {
        ae(pos.x, pos.y);
        return;
      }
      if (s.activeTool === TOOLS.GRAB) {
        let closest = -1, closestDist = 999, closestType: 'small' | 'large' = 'small';
        const tryNodes = (nodes: { x: number; y: number }[], type: 'small' | 'large') => {
          nodes.forEach((n, i) => {
            const d = Math.hypot(n.x - pos.x, n.y - pos.y);
            if (d < closestDist) { closestDist = d; closest = i; closestType = type; }
          });
        };
        tryNodes(physicsRef.current.smallNodes, 'small');
        tryNodes(physicsRef.current.largeNodes, 'large');
        const grabRange = 20 + s.toolParam1 * 0.25;
        if (closestDist < grabRange) {
          physicsRef.current.grabbedNode = { type: closestType, idx: closest };
          td('grab');
        }
        return;
      }
      if (s.activeTool === TOOLS.ENEMA) {
        const { setEnemaInSmall: seis, setEnemaSmallHeadIdx: seishi, triggerDialogue: td } = hrRef.current;
        if (s.enemaInSmall) {
          // In small intestine — find nearest small node, allow retreat to large
          const cecum = physicsRef.current.largeNodes[0];
          const cecumDist = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (cecumDist < 45 && cecumDist < sDist) {
            seis(false);
            sehi(0);
          } else if (sIdx >= 0 && sDist < 65) {
            seishi(sIdx);
          }
        } else {
          const { idx, dist } = findNearestLargeNodeIdx(pos);
          if (idx >= 0 && dist < 60) {
            sehi(idx);
          }
          // Check if tube head has reached cecum (idx 0) and user is near small intestine
          if (physicsRef.current.enemaHeadIdx === 0) {
            const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
            if (sIdx >= 0 && sDist < 55) {
              seis(true);
              seishi(sIdx);
              td('enema_enter_small');
            }
          }
        }
        return;
      }
    },
    onPanResponderMove: (evt) => {
      const { state: s, toPhysicsCoords: tpc, setEnemaHeadIdx: sehi,
              setEnemaInSmall: seis, setEnemaSmallHeadIdx: seishi, triggerDialogue: td } = hrRef.current;
      const { locationX, locationY } = evt.nativeEvent;
      const pos = tpc(locationX, locationY);

      if (s.activeTool === TOOLS.ENEMA) {
        const prevPos = physicsRef.current.toolPos;
        // Pull nearby large intestine nodes along with the tube drag
        if (prevPos && !s.enemaInSmall) {
          const dragDx = pos.x - prevPos.x;
          const dragDy = pos.y - prevPos.y;
          const pullRadius = 45;
          physicsRef.current.largeNodes.forEach(n => {
            if (n.pinned) return;
            const d = Math.hypot(n.x - pos.x, n.y - pos.y);
            if (d < pullRadius && d > 0.1) {
              const f = (1 - d / pullRadius) * 0.35;
              n.x += dragDx * f;
              n.y += dragDy * f;
            }
          });
        }

        if (s.enemaInSmall) {
          // In small intestine — find nearest small node, allow retreat to large
          const cecum = physicsRef.current.largeNodes[0];
          const cecumDist = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (cecumDist < 45 && cecumDist < sDist) {
            seis(false);
            sehi(0);
          } else if (sIdx >= 0 && sDist < 65) {
            seishi(sIdx);
          }
        } else {
          // Move head freely to nearest large node
          const { idx, dist } = findNearestLargeNodeIdx(pos);
          if (idx >= 0 && dist < 60) {
            sehi(idx);
          }
          // Check transition into small intestine
          if (physicsRef.current.enemaHeadIdx === 0) {
            const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
            if (sIdx >= 0 && sDist < 55) {
              seis(true);
              seishi(sIdx);
              td('enema_enter_small');
            }
          }
        }
        physicsRef.current.toolPos = pos;
        return;
      }

      physicsRef.current.toolPos = pos;

      const now = Date.now();
      if (now - lastDialogueTime.current > 4000 && s.activeTool) {
        lastDialogueTime.current = now;
        if (s.activeTool === TOOLS.METAL_ROD || s.activeTool === TOOLS.VIBRATOR) {
          td('stirring');
        }
      }
    },
    onPanResponderRelease: () => {
      isDragging.current = false;
      if (!physicsRef.current.toolInserted) {
        physicsRef.current.toolPos = null;
      }
      physicsRef.current.grabbedNode = null;
    },
  })).current;

  const { renderSmallNodes, renderLargeNodes, renderSmallSegs, renderLargeSegs } = state;
  const isInternal = state.viewMode === 'internal';

  const avgPain = renderSmallSegs.length > 0
    ? renderSmallSegs.reduce((a, s) => a + s.pain, 0) / renderSmallSegs.length : 0;
  const avgPressure = renderSmallSegs.length > 0
    ? renderSmallSegs.reduce((a, s) => a + s.pressure, 0) / renderSmallSegs.length : 0;
  const bulge = 1 + avgPressure * 0.003;

  const smallPath = buildSmoothPath(renderSmallNodes);

  const handlePos = state.toolPos;
  const renderTime = Date.now() / 33;

  const enemaPath = (() => {
    if (state.activeTool !== TOOLS.ENEMA || renderLargeNodes.length === 0) return '';
    if (state.enemaInSmall && renderSmallNodes.length > 0) {
      // Tube fills all of large intestine (anus→cecum), then continues into small intestine
      const largePart = [...renderLargeNodes].reverse(); // anus (N_LARGE-1) → cecum (0)
      const smallHeadIdx = Math.max(0, Math.min(renderSmallNodes.length - 1, state.enemaSmallHeadIdx));
      // small part: from junction (N_SMALL-1) toward smallHeadIdx
      const smallPart = [...renderSmallNodes.slice(smallHeadIdx)].reverse(); // N_SMALL-1 → smallHeadIdx
      return buildSmoothPath([...largePart, ...smallPart]);
    }
    const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, state.enemaHeadIdx));
    const slice = renderLargeNodes.slice(headIdx).reverse();
    return buildSmoothPath(slice);
  })();
  const enemaHead = state.activeTool === TOOLS.ENEMA
    ? (state.enemaInSmall && renderSmallNodes.length > 0
        ? renderSmallNodes[Math.max(0, Math.min(renderSmallNodes.length - 1, state.enemaSmallHeadIdx))]
        : renderLargeNodes[Math.max(0, Math.min(renderLargeNodes.length - 1, state.enemaHeadIdx))])
    : null;
  const enemaHeadInSmall = state.activeTool === TOOLS.ENEMA && state.enemaInSmall;

  const ELEC_CTRL_X = 36;
  const ELEC_CTRL_Y = CANVAS_H - 38;

  // Compute rod geometry for current tool (used for rendering + collision box debug)
  const rodGeo = (() => {
    if (!handlePos) return null;
    const tool = state.activeTool;
    if (tool === TOOLS.METAL_ROD || tool === TOOLS.VIBRATOR) {
      const isVib = tool === TOOLS.VIBRATOR;
      const rodLen = 80 + state.toolParam1 * (isVib ? 1.2 : 1.0);
      const stirAmp = state.toolActive ? (isVib ? 4 : 2 + state.toolParam2 * 0.04) : 0;
      return { g: computeRodGeoFor(state.toolInserted, state.toolAnchor, handlePos, rodLen, stirAmp, renderTime), radius: 9 };
    }
    if (tool === TOOLS.NEEDLE) {
      const rodLen = 90 + state.toolParam1 * 1.0;
      const stirAmp = state.toolActive ? 1.5 + state.toolParam2 * 0.04 : 0;
      return { g: computeRodGeoFor(state.toolInserted, state.toolAnchor, handlePos, rodLen, stirAmp, renderTime), radius: 5 };
    }
    return null;
  })();

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
        {/* Always-dark background — prevents gradient leaks */}
        <Rect x={0} y={0} width={CANVAS_W} height={CANVAS_H} fill="#0a0202" />

        <Defs>
          <ClipPath id="cavityClip">
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX * bulge} ry={CAVITY_RY} />
          </ClipPath>
        </Defs>

        {/* ===== BACKGROUND LAYER ===== */}
        {isInternal ? (
          <G>
            <SvgImage
              href={CAVITY_BG}
              x={CAVITY_CX - CAVITY_RX * bulge - 8}
              y={CAVITY_CY - CAVITY_RY - 8}
              width={(CAVITY_RX * bulge + 8) * 2}
              height={(CAVITY_RY + 8) * 2}
              preserveAspectRatio="xMidYMid slice"
              clipPath="url(#cavityClip)"
            />
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY}
              rx={CAVITY_RX * bulge} ry={CAVITY_RY}
              fill="none" stroke="#6a2020" strokeWidth={2} />
          </G>
        ) : (
          <G>
            <SvgImage
              href={BELLY_EXTERNAL_IMG}
              x={0} y={0}
              width={CANVAS_W} height={CANVAS_H}
              preserveAspectRatio="xMidYMid slice"
            />
            {avgPressure > 15 && (
              <Ellipse cx={CANVAS_W / 2} cy={CANVAS_H * 0.48}
                rx={CANVAS_W * 0.30 * (1 + avgPressure * 0.003) * bulge}
                ry={CANVAS_H * 0.13 * (1 + avgPressure * 0.003) * bulge}
                fill={`rgba(220,70,90,${Math.min(0.32, avgPressure * 0.003)})`} />
            )}
            {avgPain > 20 && (
              <Ellipse cx={CANVAS_W / 2} cy={CANVAS_H * 0.50}
                rx={CANVAS_W * 0.28} ry={CANVAS_H * 0.10}
                fill={`rgba(255,80,80,${Math.min(0.28, avgPain * 0.003)})`} />
            )}
            {(state.activeTool === TOOLS.NEEDLE ||
              ((state.activeTool === TOOLS.METAL_ROD || state.activeTool === TOOLS.VIBRATOR) && state.navelPierced)) && (
              <Circle cx={NAVEL_X} cy={NAVEL_Y_EXTERNAL} r={NAVEL_RADIUS}
                fill="none" stroke="rgba(255,180,80,0.5)" strokeWidth={1.5} strokeDasharray="3 3" />
            )}
            {state.navelPierced && (
              <G>
                <Line x1={NAVEL_X} y1={NAVEL_Y_EXTERNAL - 14}
                  x2={NAVEL_X} y2={NAVEL_Y_EXTERNAL + 14}
                  stroke="#dcdcdc" strokeWidth={2.5} strokeLinecap="round" />
                <Circle cx={NAVEL_X} cy={NAVEL_Y_EXTERNAL - 14} r={3} fill="#f0f0f0" />
                <Circle cx={NAVEL_X} cy={NAVEL_Y_EXTERNAL + 14} r={3} fill="#f0f0f0" />
              </G>
            )}
            {state.renderSmallSegs.filter(s => s.ruptured).slice(0, 3).map((_, i) => (
              <Ellipse key={`rup-${i}`}
                cx={CANVAS_W * (0.35 + i * 0.15)} cy={CANVAS_H * (0.42 + i * 0.03)}
                rx={14 + i * 3} ry={8 + i * 2}
                fill="rgba(140,20,20,0.55)" />
            ))}
          </G>
        )}

        {/* ===== INTERNAL ORGANS LAYER ===== */}
        {isInternal && (
          <G clipPath="url(#cavityClip)">
            <SvgImage
              href={INTESTINES_REF}
              x={CAVITY_CX - CAVITY_RX * 0.92} y={CAVITY_CY - CAVITY_RY * 0.92}
              width={CAVITY_RX * 0.92 * 2} height={CAVITY_RY * 0.92 * 2}
              preserveAspectRatio="xMidYMid meet" opacity={0.42} />
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX - 2} ry={CAVITY_RY - 2}
              fill="none" stroke="#3a1010" strokeWidth={4} />

            {/* Large intestine */}
            {renderLargeSegs.map((seg, i) => {
              if (i >= renderLargeNodes.length - 1) return null;
              const a = renderLargeNodes[i], b = renderLargeNodes[i + 1];
              const w = LARGE_RADIUS * 2 + (seg.pressure / 100) * LARGE_RADIUS;
              const col = segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, seg.perforated, true);
              return <Line key={`lg-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={col} strokeWidth={w} strokeLinecap="round" />;
            })}
            {renderLargeSegs.map((seg, i) => {
              if (i >= renderLargeNodes.length - 1) return null;
              const a = renderLargeNodes[i], b = renderLargeNodes[i + 1];
              return <Line key={`lgh-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke="rgba(255,180,160,0.2)" strokeWidth={LARGE_RADIUS * 0.6} strokeLinecap="round" />;
            })}

            {/* Small intestine */}
            {renderSmallSegs.map((seg, i) => {
              if (i >= renderSmallNodes.length - 1) return null;
              const a = renderSmallNodes[i], b = renderSmallNodes[i + 1];
              const w = SMALL_RADIUS * 2 + (seg.pressure / 100) * SMALL_RADIUS;
              const col = segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, seg.perforated, false);
              return <Line key={`sm-${i}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                stroke={col} strokeWidth={w} strokeLinecap="round" />;
            })}
            {renderSmallNodes.length > 1 && (
              <Path d={smallPath} stroke="rgba(255,220,200,0.15)" strokeWidth={3} fill="none" strokeLinecap="round" />
            )}

            {/* Rupture & perforation markers */}
            {renderSmallSegs.map((seg, i) =>
              seg.ruptured ? (
                <Circle key={`rpt-${i}`} cx={renderSmallNodes[i]?.x ?? 0} cy={renderSmallNodes[i]?.y ?? 0}
                  r={5} fill="#000000" stroke="#cc2020" strokeWidth={1} />
              ) : seg.perforated ? (
                <Circle key={`prf-${i}`} cx={renderSmallNodes[i]?.x ?? 0} cy={renderSmallNodes[i]?.y ?? 0}
                  r={2.5} fill="#440000" stroke="#aa3030" strokeWidth={0.8} />
              ) : null
            )}

            {/* Debug overlays */}
            {state.debugMode && renderSmallSegs.map((seg, i) => {
              const n = renderSmallNodes[i];
              if (!n) return null;
              const bx = n.x + 12, by = n.y - 12;
              return (
                <G key={`dbg-${i}`}>
                  <Rect x={bx} y={by} width={seg.health * 0.3} height={2} fill="#00cc00" />
                  <Rect x={bx} y={by + 3} width={seg.sensitivity * 0.3} height={2} fill="#cc00cc" />
                  <Rect x={bx} y={by + 6} width={seg.pain * 0.3} height={2} fill="#cc0000" />
                  <Rect x={bx} y={by + 9} width={seg.pressure * 0.3} height={2} fill="#0088ff" />
                </G>
              );
            })}

            {/* Collision box debug — intestine nodes */}
            {state.showCollisionBoxes && renderSmallNodes.map((n, i) => (
              <Circle key={`cb-sm-${i}`} cx={n.x} cy={n.y} r={SMALL_RADIUS}
                fill="none" stroke="rgba(0,255,255,0.4)" strokeWidth={0.8} />
            ))}
            {state.showCollisionBoxes && renderLargeNodes.map((n, i) => (
              <Circle key={`cb-lg-${i}`} cx={n.x} cy={n.y} r={LARGE_RADIUS}
                fill="none" stroke="rgba(0,200,255,0.35)" strokeWidth={0.8} />
            ))}

            {/* Collision box debug — tool geometry */}
            {state.showCollisionBoxes && rodGeo && (() => {
              const samples = computeRodCollisionSamples(
                rodGeo.g,
                state.toolInserted,
                state.toolAnchor,
              );
              return (
                <G>
                  {samples.map((pt, i) => (
                    <Circle key={`cb-tool-${i}`}
                      cx={pt.x} cy={pt.y} r={rodGeo.radius}
                      fill="rgba(255,200,0,0.08)"
                      stroke="rgba(255,200,0,0.55)" strokeWidth={0.7} />
                  ))}
                </G>
              );
            })()}
            {state.showCollisionBoxes && state.activeTool === TOOLS.ENEMA && enemaHead && (
              <Circle cx={enemaHead.x} cy={enemaHead.y} r={LARGE_RADIUS + 2}
                fill="none" stroke="rgba(100,180,255,0.55)" strokeWidth={0.8} />
            )}
            {state.showCollisionBoxes && state.activeTool === TOOLS.ELECTRIC &&
              state.electrodes.map((el, i) => (
                <Circle key={`cb-el-${i}`} cx={el.x} cy={el.y}
                  r={30 + state.toolParam2 * 0.3}
                  fill="none" stroke="rgba(255,255,80,0.4)" strokeWidth={0.7} />
              ))
            }
            {state.showCollisionBoxes && state.activeTool === TOOLS.GRAB && handlePos && (
              <Circle cx={handlePos.x} cy={handlePos.y}
                r={20 + state.toolParam1 * 0.25}
                fill="none" stroke="rgba(100,255,100,0.5)" strokeWidth={0.7} />
            )}

            {/* Navel marker inside cavity */}
            <Circle cx={NAVEL_X} cy={NAVEL_Y_INTERNAL} r={4}
              fill={state.navelPierced ? '#883030' : '#5a2020'}
              stroke="#3a1010" strokeWidth={1} />
          </G>
        )}

        {/* ===== TOOLS LAYER (top of both views) ===== */}

        {/* Rod / Vibrator: lever or free */}
        {handlePos && (state.activeTool === TOOLS.METAL_ROD || state.activeTool === TOOLS.VIBRATOR) && (() => {
          if (!rodGeo) return null;
          const isVib = state.activeTool === TOOLS.VIBRATOR;
          const { g } = rodGeo;
          const rodColor = isVib ? '#b078ff' : '#aaaacc';
          const rodWidth = isVib ? 6 : 5;
          return (
            <G key="rod">
              {isVib && state.toolActive && (
                <Circle cx={g.headX} cy={g.headY}
                  r={30 + state.toolParam2 * 0.4}
                  fill="rgba(180,120,255,0.10)"
                  stroke="rgba(180,120,255,0.5)" strokeWidth={1} strokeDasharray="4 4" />
              )}
              <Line x1={g.tailX} y1={g.tailY} x2={g.headX} y2={g.headY}
                stroke={rodColor} strokeWidth={rodWidth} strokeLinecap="round" />
              <Circle cx={g.tailX} cy={g.tailY} r={isVib ? 9 : 7} fill="#666688" stroke="#222" strokeWidth={1} />
              <Circle cx={g.headX} cy={g.headY} r={isVib ? 8 : 6} fill={rodColor} stroke="#222" strokeWidth={0.5} />
              {state.toolInserted && state.toolAnchor && (
                <Circle cx={state.toolAnchor.x} cy={state.toolAnchor.y} r={6}
                  fill="none" stroke="#ffaa44" strokeWidth={1.5} strokeDasharray="2 2" />
              )}
            </G>
          );
        })()}

        {/* Needle: lever or free */}
        {handlePos && state.activeTool === TOOLS.NEEDLE && (() => {
          if (!rodGeo) return null;
          const { g } = rodGeo;
          return (
            <G key="needle">
              <Line x1={g.tailX} y1={g.tailY} x2={g.headX} y2={g.headY}
                stroke="#cccccc" strokeWidth={2.2} strokeLinecap="round" />
              <Circle cx={g.tailX} cy={g.tailY} r={5} fill="#888899" stroke="#222" strokeWidth={1} />
              <Circle cx={g.headX} cy={g.headY} r={2} fill="#ff4040" />
              {state.toolInserted && state.toolAnchor && (
                <Circle cx={state.toolAnchor.x} cy={state.toolAnchor.y} r={5}
                  fill="none" stroke="#ffaa44" strokeWidth={1.2} strokeDasharray="2 2" />
              )}
            </G>
          );
        })()}

        {/* Grab indicator */}
        {handlePos && state.activeTool === TOOLS.GRAB && (
          <Circle cx={handlePos.x} cy={handlePos.y}
            r={10 + state.toolParam1 * 0.25}
            fill={state.toolActive ? 'rgba(96,192,96,0.30)' : 'rgba(96,192,96,0.18)'}
            stroke="#60c060" strokeWidth={1.5} />
        )}

        {/* Syringe */}
        {handlePos && state.activeTool === TOOLS.SYRINGE && (
          <G>
            <Rect x={handlePos.x - 6} y={handlePos.y - 30}
              width={12} height={30} rx={2} fill="#60c0c0" fillOpacity={0.85}
              stroke="#88aaaa" strokeWidth={0.8} />
            {state.toolActive && (
              <Rect x={handlePos.x - 4} y={handlePos.y - 28}
                width={8} height={6} fill="#aaccff" />
            )}
            <Line x1={handlePos.x} y1={handlePos.y}
              x2={handlePos.x} y2={handlePos.y + 18}
              stroke="#aaaaaa" strokeWidth={2} />
            <Circle cx={handlePos.x} cy={handlePos.y + 18} r={1.8} fill="#ff4040" />
          </G>
        )}

        {/* Enema tube — drawn through the large intestine (and small when enemaInSmall) */}
        {state.activeTool === TOOLS.ENEMA && enemaPath && (
          <G>
            <Path d={enemaPath}
              stroke={enemaHeadInSmall ? 'rgba(220,120,80,0.7)' : 'rgba(80,140,220,0.6)'}
              strokeWidth={enemaHeadInSmall ? 4.5 : 6}
              fill="none" strokeLinecap="round" />
            <Path d={enemaPath}
              stroke={enemaHeadInSmall ? 'rgba(255,200,160,0.55)' : 'rgba(180,220,255,0.5)'}
              strokeWidth={2.5}
              fill="none" strokeLinecap="round" />
            {enemaHead && (
              <G>
                {/* Outer pulse ring — orange-red when in small intestine */}
                <Circle cx={enemaHead.x} cy={enemaHead.y} r={12}
                  fill={enemaHeadInSmall ? 'rgba(200,80,40,0.15)' : 'rgba(50,100,180,0.15)'}
                  stroke={enemaHeadInSmall ? 'rgba(255,160,100,0.5)' : 'rgba(120,180,255,0.4)'}
                  strokeWidth={1} />
                <Circle cx={enemaHead.x} cy={enemaHead.y} r={7}
                  fill={enemaHeadInSmall ? '#b04020' : '#3070b0'}
                  stroke={enemaHeadInSmall ? '#ff9060' : '#80b0e0'}
                  strokeWidth={1.5} />
                {enemaHeadInSmall && (
                  /* Ileocecal marker — show a junction ring at largeNodes[0] */
                  <>
                    {renderLargeNodes[0] && (
                      <Circle cx={renderLargeNodes[0].x} cy={renderLargeNodes[0].y} r={9}
                        fill="none" stroke="rgba(255,200,100,0.6)" strokeWidth={1.5} strokeDasharray="3 2" />
                    )}
                  </>
                )}
                {state.toolActive && (
                  <>
                    <Circle cx={enemaHead.x} cy={enemaHead.y} r={14}
                      fill="none"
                      stroke={enemaHeadInSmall ? 'rgba(255,160,100,0.6)' : 'rgba(150,200,255,0.55)'}
                      strokeWidth={1.5} />
                    <Circle cx={enemaHead.x} cy={enemaHead.y} r={9}
                      fill={enemaHeadInSmall ? 'rgba(255,140,80,0.3)' : 'rgba(150,200,255,0.3)'} />
                  </>
                )}
              </G>
            )}
          </G>
        )}

        {/* Electrodes + wires + controller */}
        {(state.electrodes.length > 0 || state.activeTool === TOOLS.ELECTRIC) && (
          <G>
            {state.electrodes.map((el, i) => {
              const wireColor = state.toolActive ? '#ffee44' : '#888844';
              if (isInternal) {
                return (
                  <G key={`wire-${i}`}>
                    <Line x1={el.x} y1={el.y} x2={NAVEL_X} y2={NAVEL_Y_INTERNAL}
                      stroke={wireColor} strokeWidth={1} strokeOpacity={0.7} />
                    <Line x1={NAVEL_X} y1={NAVEL_Y_INTERNAL}
                      x2={ELEC_CTRL_X} y2={ELEC_CTRL_Y}
                      stroke={wireColor} strokeWidth={1} strokeOpacity={0.7} />
                  </G>
                );
              }
              return (
                <Line key={`wire-${i}`} x1={el.x} y1={el.y}
                  x2={ELEC_CTRL_X} y2={ELEC_CTRL_Y}
                  stroke={wireColor} strokeWidth={1} strokeOpacity={0.7} />
              );
            })}
            {state.electrodes.map((el, i) => (
              <G key={`el-${i}`}>
                <Circle cx={el.x} cy={el.y} r={6} fill="#ffff00" fillOpacity={0.9}
                  stroke="#ffaa00" strokeWidth={1} />
                {state.toolActive && (
                  <Circle cx={el.x} cy={el.y} r={30 + state.toolParam2 * 0.3}
                    fill="rgba(255,255,0,0.06)" stroke="rgba(255,255,0,0.3)" strokeWidth={0.8} />
                )}
              </G>
            ))}
            {state.activeTool === TOOLS.ELECTRIC && (
              <G>
                <Rect x={ELEC_CTRL_X - 20} y={ELEC_CTRL_Y - 16}
                  width={40} height={32} rx={3}
                  fill="#2a2a2a" stroke="#666" strokeWidth={1.2} />
                <Circle cx={ELEC_CTRL_X - 8} cy={ELEC_CTRL_Y}
                  r={3} fill={state.toolActive ? '#ff4040' : '#664040'} />
                <Circle cx={ELEC_CTRL_X + 8} cy={ELEC_CTRL_Y}
                  r={3} fill={state.toolActive ? '#ffcc40' : '#665540'} />
                <Rect x={ELEC_CTRL_X - 16} y={ELEC_CTRL_Y + 7}
                  width={32} height={3}
                  fill={state.toolActive ? '#ffee44' : '#444'} />
              </G>
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
