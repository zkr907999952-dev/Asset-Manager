import React, { useRef, useCallback } from 'react';
import { View, PanResponder, StyleSheet } from 'react-native';
import { useBreathAnimation } from '@/hooks/useBreathAnimation';
import Svg, {
  Ellipse, Circle, Line, Path, Rect, Defs, RadialGradient, LinearGradient, Stop, G,
  Image as SvgImage, ClipPath,
} from 'react-native-svg';
import type { ParasiteEntity } from '../contexts/GameContext';

const INTESTINES_REF = require('@/assets/images/intestines.png');
const BELLY_EXTERNAL_IMG = require('@/assets/images/belly_external.png');
import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  SMALL_RADIUS, LARGE_RADIUS, LARGE_RUPTURE_PRESSURE,
  TOOLS, N_SMALL, N_LARGE,
} from '../constants/gameConfig';
import { buildSmoothPath } from '../engine/physics';
import { useGame } from '../contexts/GameContext';

const NAVEL_X = CANVAS_W / 2;
const NAVEL_Y_EXTERNAL = CAVITY_CY;
const NAVEL_Y_INTERNAL = CAVITY_CY;
const NAVEL_RADIUS = 28;

function segmentColor(health: number, pain: number, pressure: number, ruptured: boolean, broken: boolean, perforated: boolean, isLarge: boolean, transplantBase?: { r: number; g: number; b: number }): string {
  if (broken) return '#bb0808';
  if (ruptured) return '#d42020';
  const baseR = transplantBase ? transplantBase.r : (isLarge ? 210 : 245);
  const baseG = transplantBase ? transplantBase.g : (isLarge ? 118 : 168);
  const baseB = transplantBase ? transplantBase.b : (isLarge ? 92 : 150);
  const healthFactor = health / 100;
  const painFactor = pain / 100;
  const pressFactor = Math.min(1, pressure / 80);
  // Pain makes it redder; health degradation darkens
  let r = Math.round(Math.min(255, baseR + painFactor * 45 + pressFactor * 20));
  let g = Math.round(Math.max(18, baseG * (0.4 + healthFactor * 0.6) - pressFactor * 15));
  let b = Math.round(Math.max(18, baseB * (0.4 + healthFactor * 0.6) - pressFactor * 10));
  if (perforated) { r = Math.min(255, r + 25); g = Math.max(18, g - 18); b = Math.max(18, b - 12); }
  return `rgb(${r},${g},${b})`;
}

// Render intestine as smooth bezier segments with per-segment coloring.
// Each segment is drawn as a quadratic bezier from mid(prev,curr) → Q(curr) → mid(curr,next),
// giving smooth curved corners while preserving per-segment health/pain colors.
function buildSmoothSegPath(
  nodes: { x: number; y: number }[],
  i: number,
): string {
  const n = nodes.length;
  if (i >= n - 1) return '';
  const curr = nodes[i];
  const next = nodes[i + 1];
  const startX = i > 0 ? (nodes[i - 1].x + curr.x) / 2 : curr.x;
  const startY = i > 0 ? (nodes[i - 1].y + curr.y) / 2 : curr.y;
  const endX = i < n - 2 ? (next.x + nodes[i + 2].x) / 2 : next.x;
  const endY = i < n - 2 ? (next.y + nodes[i + 2].y) / 2 : next.y;
  const midX = (curr.x + next.x) / 2;
  const midY = (curr.y + next.y) / 2;
  return (
    `M${startX.toFixed(1)},${startY.toFixed(1)}` +
    ` Q${curr.x.toFixed(1)},${curr.y.toFixed(1)} ${midX.toFixed(1)},${midY.toFixed(1)}` +
    ` Q${next.x.toFixed(1)},${next.y.toFixed(1)} ${endX.toFixed(1)},${endY.toFixed(1)}`
  );
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

// Render a tool at a given position (for suspended/hanging tool display)
function SuspendedToolOverlay({
  toolId, pos, param1, param2, time,
}: {
  toolId: string; pos: { x: number; y: number }; param1: number; param2: number; time: number;
}) {
  const tp = pos;
  if (toolId === TOOLS.METAL_ROD) {
    const rodLen = 80 + param1 * 1.0;
    const tailY = tp.y - rodLen;
    return (
      <G opacity={0.55}>
        <Line x1={tp.x} y1={tailY} x2={tp.x} y2={tp.y}
          stroke="#aaaacc" strokeWidth={4} strokeLinecap="round" />
        <Circle cx={tp.x} cy={tailY} r={6} fill="#555577" stroke="#222" strokeWidth={1} />
        <Circle cx={tp.x} cy={tp.y} r={5} fill="#aaaacc" stroke="#222" strokeWidth={0.5} />
      </G>
    );
  }
  if (toolId === TOOLS.VIBRATOR) {
    const rodLen = 80 + param1 * 1.2;
    const tailY = tp.y - rodLen;
    return (
      <G opacity={0.55}>
        <Circle cx={tp.x} cy={tp.y}
          r={28 + param2 * 0.35}
          fill="rgba(180,120,255,0.07)" stroke="rgba(180,120,255,0.35)" strokeWidth={1} strokeDasharray="4 4" />
        <Line x1={tp.x} y1={tailY} x2={tp.x} y2={tp.y}
          stroke="#b078ff" strokeWidth={5} strokeLinecap="round" />
        <Circle cx={tp.x} cy={tailY} r={8} fill="#555577" stroke="#222" strokeWidth={1} />
        <Circle cx={tp.x} cy={tp.y} r={7} fill="#b078ff" stroke="#222" strokeWidth={0.5} />
      </G>
    );
  }
  if (toolId === TOOLS.SYRINGE) {
    return (
      <G opacity={0.55}>
        <Rect x={tp.x - 6} y={tp.y - 30} width={12} height={30} rx={2}
          fill="#60c0c0" fillOpacity={0.85} stroke="#88aaaa" strokeWidth={0.8} />
        <Line x1={tp.x} y1={tp.y} x2={tp.x} y2={tp.y + 18} stroke="#aaaaaa" strokeWidth={2} />
        <Circle cx={tp.x} cy={tp.y + 18} r={1.8} fill="#ff4040" />
        <Circle cx={tp.x} cy={tp.y - 28} r={4} fill="rgba(200,240,255,0.5)" />
      </G>
    );
  }
  if (toolId === TOOLS.NEEDLE) {
    const rodLen = 90 + param1 * 1.0;
    const tailY = tp.y - rodLen;
    return (
      <G opacity={0.55}>
        <Line x1={tp.x} y1={tailY} x2={tp.x} y2={tp.y}
          stroke="#cccccc" strokeWidth={1.8} strokeLinecap="round" />
        <Circle cx={tp.x} cy={tailY} r={4} fill="#888899" stroke="#222" strokeWidth={1} />
        <Circle cx={tp.x} cy={tp.y} r={2} fill="#ff4040" />
      </G>
    );
  }
  if (toolId === TOOLS.ELECTRIC) {
    return (
      <G opacity={0.55}>
        <Circle cx={tp.x} cy={tp.y} r={5} fill="#ffff00" fillOpacity={0.9} stroke="#ffaa00" strokeWidth={1} />
        <Circle cx={tp.x} cy={tp.y} r={28 + param2 * 0.3}
          fill="rgba(255,255,0,0.05)" stroke="rgba(255,255,0,0.25)" strokeWidth={0.7} />
      </G>
    );
  }
  if (toolId === TOOLS.GRAB) {
    return (
      <G opacity={0.55}>
        <Circle cx={tp.x} cy={tp.y} r={10 + param1 * 0.25}
          fill="rgba(96,192,96,0.15)" stroke="#60c060" strokeWidth={1.2} />
      </G>
    );
  }
  if (toolId === TOOLS.BAYONET) {
    const bladeLen = 80 + param1 * 1.5;
    const tailY = tp.y - bladeLen;
    return (
      <G opacity={0.55}>
        <Line x1={tp.x} y1={tailY} x2={tp.x} y2={tp.y}
          stroke="#d8d8e8" strokeWidth={3.5} strokeLinecap="round" />
        <Line x1={tp.x} y1={tailY} x2={tp.x} y2={tp.y}
          stroke="#f0f0ff" strokeWidth={1.5} strokeLinecap="round" />
        <Circle cx={tp.x} cy={tailY} r={5} fill="#555566" stroke="#222" strokeWidth={1} />
        <Circle cx={tp.x} cy={tp.y} r={2.5} fill="#ff3030" />
      </G>
    );
  }
  return null;
}

interface CanvasProps {
  canvasLayout: { x: number; y: number; width: number; height: number } | null;
  onLayout: (layout: { x: number; y: number; width: number; height: number }) => void;
}

export function SimulationCanvas({ canvasLayout, onLayout }: CanvasProps) {
  const {
    state, physicsRef, triggerDialogue, addElectrode,
    insertViaNavel, retractTool, setNavelPierced, setEnemaHeadIdx,
    setEnemaInSmall, setEnemaSmallHeadIdx, setEnemaTarget,
    setSiliconeTarget, setBeadsTarget, setEggTarget,
    toggleMesenteryNode, setResectionSelection,
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

  const hrRef = useRef({
    state,
    toPhysicsCoords,
    addElectrode,
    setEnemaHeadIdx,
    setEnemaInSmall,
    setEnemaSmallHeadIdx,
    setEnemaTarget,
    setSiliconeTarget,
    setBeadsTarget,
    setEggTarget,
    insertViaNavel,
    setNavelPierced,
    triggerDialogue,
    toggleMesenteryNode,
    setResectionSelection,
  });
  hrRef.current.state = state;
  hrRef.current.toPhysicsCoords = toPhysicsCoords;
  hrRef.current.addElectrode = addElectrode;
  hrRef.current.setEnemaHeadIdx = setEnemaHeadIdx;
  hrRef.current.setEnemaInSmall = setEnemaInSmall;
  hrRef.current.setEnemaSmallHeadIdx = setEnemaSmallHeadIdx;
  hrRef.current.setEnemaTarget = setEnemaTarget;
  hrRef.current.setSiliconeTarget = setSiliconeTarget;
  hrRef.current.setBeadsTarget = setBeadsTarget;
  hrRef.current.setEggTarget = setEggTarget;
  hrRef.current.insertViaNavel = insertViaNavel;
  hrRef.current.setNavelPierced = setNavelPierced;
  hrRef.current.triggerDialogue = triggerDialogue;
  hrRef.current.toggleMesenteryNode = toggleMesenteryNode;
  hrRef.current.setResectionSelection = setResectionSelection;

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
              insertViaNavel: ivn, setNavelPierced: snp, triggerDialogue: td,
              toggleMesenteryNode: tmn } = hrRef.current;
      isDragging.current = true;
      const { locationX, locationY } = evt.nativeEvent;
      const pos = tpc(locationX, locationY);

      // Resection selection mode: tapping near any intestine segment midpoint starts selection
      if (s.resectionSelectionMode) {
        const srs = hrRef.current.setResectionSelection;
        const smallNodes = physicsRef.current.smallNodes;
        let bestI = -1, bestD = 9999, bestType: 'small' | 'large' = 'small';
        for (let i = 0; i < smallNodes.length - 1; i++) {
          const mx = (smallNodes[i].x + smallNodes[i + 1].x) / 2;
          const my = (smallNodes[i].y + smallNodes[i + 1].y) / 2;
          const d = Math.hypot(mx - pos.x, my - pos.y);
          if (d < bestD) { bestD = d; bestI = i; bestType = 'small'; }
        }
        const largeNodes = physicsRef.current.largeNodes;
        for (let i = 0; i < largeNodes.length - 1; i++) {
          const mx = (largeNodes[i].x + largeNodes[i + 1].x) / 2;
          const my = (largeNodes[i].y + largeNodes[i + 1].y) / 2;
          const d = Math.hypot(mx - pos.x, my - pos.y);
          if (d < bestD) { bestD = d; bestI = i; bestType = 'large'; }
        }
        if (bestI >= 0 && bestD < 55) {
          srs(bestType, bestI, bestI);
        }
        return;
      }

      // Mesentery selection mode: tapping near any intestine node toggles selection
      if (s.mesenterySelectionMode) {
        const largeNodes = physicsRef.current.largeNodes;
        for (let i = 0; i < largeNodes.length; i++) {
          if (!largeNodes[i].pinned && Math.hypot(largeNodes[i].x - pos.x, largeNodes[i].y - pos.y) < 28) {
            tmn(i, false);
            return;
          }
        }
        const smallNodes = physicsRef.current.smallNodes;
        for (let i = 0; i < smallNodes.length; i++) {
          if (!smallNodes[i].pinned && Math.hypot(smallNodes[i].x - pos.x, smallNodes[i].y - pos.y) < 22) {
            tmn(i, true);
            return;
          }
        }
        return;
      }

      const isInternal = s.viewMode === 'internal';
      const navelY = isInternal ? NAVEL_Y_INTERNAL : NAVEL_Y_EXTERNAL;
      const distToNavel = Math.hypot(pos.x - NAVEL_X, pos.y - navelY);

      if (!isInternal && distToNavel < NAVEL_RADIUS) {
        if ((s.activeTool === TOOLS.NEEDLE || s.activeTool === TOOLS.BAYONET) && !s.navelPierced) {
          snp(true);
          td('pain_high');
          return;
        }
        if (
          s.navelPierced &&
          (s.activeTool === TOOLS.METAL_ROD ||
            s.activeTool === TOOLS.VIBRATOR ||
            s.activeTool === TOOLS.NEEDLE ||
            s.activeTool === TOOLS.BAYONET)
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
      // 长硅胶棒 — independent state via setSiliconeTarget
      if (s.activeTool === TOOLS.SILICONE_ROD) {
        const { setSiliconeTarget: setST } = hrRef.current;
        const { idx, dist: d } = findNearestLargeNodeIdx(pos);
        const retractingFromSmall = idx >= 0 && d < 65 && s.siliconeInSmall;
        if (idx >= 0 && d < 65) {
          setST({ largeIdx: idx });
          if (s.siliconeInSmall) setST({ inSmall: false });
        }
        // Only enter small intestine if not already retracting via a large node
        if (!retractingFromSmall) {
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (sIdx >= 0 && sDist < 88) {
            setST({ inSmall: true, smallIdx: sIdx });
          }
        }
        physicsRef.current.toolPos = pos;
        return;
      }
      // 拉珠 — independent state via setBeadsTarget; external part only pulls
      if (s.activeTool === TOOLS.ANAL_BEADS) {
        const { setBeadsTarget: setBT } = hrRef.current;
        const anusN = physicsRef.current.largeNodes[physicsRef.current.largeNodes.length - 1];
        // Touch below anus → external chain, only retract
        if (anusN && pos.y > anusN.y + 12) {
          setBT({ largeIdx: physicsRef.current.largeNodes.length - 1, inSmall: false });
          physicsRef.current.toolPos = pos;
          return;
        }
        // Check near pull ring (last external bead)
        const chain = physicsRef.current.beadsChain;
        const intCount = s.beadsInSmall
          ? Math.min(40, physicsRef.current.largeNodes.length)
          : Math.min(40, Math.max(0, physicsRef.current.largeNodes.length - s.beadsHeadIdx));
        const extCount = Math.max(0, 40 - intCount);
        if (extCount > 0 && chain.length >= extCount) {
          const pullRing = chain[extCount - 1];
          if (pullRing && Math.hypot(pullRing.x - pos.x, pullRing.y - pos.y) < 32) {
            setBT({ fastPull: true });
            physicsRef.current.toolPos = pos;
            return;
          }
        }
        // Internal → push/pull
        const { idx, dist: d } = findNearestLargeNodeIdx(pos);
        const retractingFromSmall = idx >= 0 && d < 65 && s.beadsInSmall;
        if (idx >= 0 && d < 65) {
          setBT({ largeIdx: idx });
          if (s.beadsInSmall) setBT({ inSmall: false });
        }
        // Only enter small intestine if not already retracting via a large node
        if (!retractingFromSmall) {
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (sIdx >= 0 && sDist < 88) {
            setBT({ inSmall: true, smallIdx: sIdx });
          }
        }
        physicsRef.current.toolPos = pos;
        return;
      }
      if (s.activeTool === TOOLS.ENEMA) {
        // Set animation TARGET — the enema head animates smoothly toward this
        const { setEnemaTarget: setTgt } = hrRef.current;
        if (s.enemaInSmall) {
          const cecum = physicsRef.current.largeNodes[0];
          const cecumDist = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (cecumDist < 50 && cecumDist < sDist) {
            setTgt({ inSmall: false, largeIdx: 0 });
          } else if (sIdx >= 0 && sDist < 70) {
            setTgt({ smallIdx: sIdx, inSmall: true });
          }
        } else {
          const { idx, dist } = findNearestLargeNodeIdx(pos);
          if (idx >= 0 && dist < 65) {
            setTgt({ largeIdx: idx });
          }
          // If near cecum, allow targeting small intestine
          if (idx <= 2 && dist < 65) {
            const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
            if (sIdx >= 0 && sDist < 60) {
              setTgt({ inSmall: true, smallIdx: sIdx });
            }
          }
        }
        return;
      }
      // 吞入跳蛋 — touch sets target position in small intestine or large intestine
      if (s.activeTool === TOOLS.VIBRATING_EGG) {
        const { setEggTarget: setET } = hrRef.current;
        if (s.eggInLarge) {
          // Egg is in large intestine
          const { idx, dist: d } = findNearestLargeNodeIdx(pos);
          if (idx >= 0 && d < 75) {
            setET({ largeIdx: idx, inLarge: true });
          }
          // Near ileocecal junction — allow retracting back to small intestine
          const cecum = physicsRef.current.largeNodes[0];
          const ileocecal = physicsRef.current.smallNodes[physicsRef.current.smallNodes.length - 1];
          const cDist = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
          const iDist = ileocecal ? Math.hypot(ileocecal.x - pos.x, ileocecal.y - pos.y) : 9999;
          if (Math.min(cDist, iDist) < 55) {
            setET({ inLarge: false });
          }
        } else {
          // Egg is in small intestine — touch near small intestine nodes sets target
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (sIdx >= 0 && sDist < 80) {
            setET({ smallIdx: sIdx });
          }
          // Near ileocecal junction → allow entering large intestine
          const terminalIleum = physicsRef.current.smallNodes[physicsRef.current.smallNodes.length - 1];
          const cecum = physicsRef.current.largeNodes[0];
          const tiDist = terminalIleum ? Math.hypot(terminalIleum.x - pos.x, terminalIleum.y - pos.y) : 9999;
          const cDist = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
          if (Math.min(tiDist, cDist) < 55) {
            setET({ inLarge: true, largeIdx: 0 });
          }
        }
        physicsRef.current.toolPos = pos;
        return;
      }
    },
    onPanResponderMove: (evt) => {
      const { state: s, toPhysicsCoords: tpc, triggerDialogue: td } = hrRef.current;
      const { locationX, locationY } = evt.nativeEvent;
      const pos = tpc(locationX, locationY);

      // Resection selection mode: dragging updates end segment
      if (s.resectionSelectionMode && s.resectionIntestine && s.resectionStartSeg >= 0) {
        const srs = hrRef.current.setResectionSelection;
        const intestine = s.resectionIntestine;
        const startSeg = s.resectionStartSeg;
        const maxSeg = s.maxResectionSegments;
        const nodes = intestine === 'small' ? physicsRef.current.smallNodes : physicsRef.current.largeNodes;
        let bestI = startSeg, bestD = 9999;
        for (let i = 0; i < nodes.length - 1; i++) {
          const mx = (nodes[i].x + nodes[i + 1].x) / 2;
          const my = (nodes[i].y + nodes[i + 1].y) / 2;
          const d = Math.hypot(mx - pos.x, my - pos.y);
          if (d < bestD) { bestD = d; bestI = i; }
        }
        const clampedEnd = Math.min(startSeg + maxSeg - 1, Math.max(startSeg, bestI));
        srs(intestine, startSeg, clampedEnd);
        return;
      }

      // 长硅胶棒 move — drag shifts intestine near head; updates target
      if (s.activeTool === TOOLS.SILICONE_ROD) {
        const { setSiliconeTarget: setST } = hrRef.current;
        const prevPos = physicsRef.current.toolPos;
        if (prevPos) {
          const dragDx = pos.x - prevPos.x;
          const dragDy = pos.y - prevPos.y;
          const headNode = s.siliconeInSmall
            ? physicsRef.current.smallNodes[s.siliconeSmallHeadIdx]
            : physicsRef.current.largeNodes[s.siliconeHeadIdx];
          if (headNode) {
            const pullR = 44;
            const nodes = s.siliconeInSmall ? physicsRef.current.smallNodes : physicsRef.current.largeNodes;
            nodes.forEach(n => {
              if (n.pinned) return;
              const nd = Math.hypot(n.x - headNode.x, n.y - headNode.y);
              if (nd < pullR) {
                const f = (1 - nd / pullR) * 0.20;
                n.x += dragDx * f;
                n.y += dragDy * f;
              }
            });
          }
        }
        const { idx, dist: d } = findNearestLargeNodeIdx(pos);
        const retractingFromSmall = idx >= 0 && d < 65 && s.siliconeInSmall;
        if (idx >= 0 && d < 65) {
          setST({ largeIdx: idx });
          if (s.siliconeInSmall) setST({ inSmall: false });
        }
        if (!retractingFromSmall) {
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (sIdx >= 0 && sDist < 88) {
            setST({ inSmall: true, smallIdx: sIdx });
          }
        }
        physicsRef.current.toolPos = pos;
        return;
      }
      // 吞入跳蛋 move — drag shifts small intestine near egg head; updates target
      if (s.activeTool === TOOLS.VIBRATING_EGG) {
        const { setEggTarget: setET } = hrRef.current;
        const prevPos = physicsRef.current.toolPos;
        if (prevPos) {
          const dragDx = pos.x - prevPos.x;
          const dragDy = pos.y - prevPos.y;
          const headNode = s.eggInLarge
            ? physicsRef.current.largeNodes[s.eggLargeHeadIdx]
            : physicsRef.current.smallNodes[s.eggSmallHeadIdx];
          if (headNode) {
            const pullR = 42;
            const nodes = s.eggInLarge ? physicsRef.current.largeNodes : physicsRef.current.smallNodes;
            nodes.forEach(n => {
              if (n.pinned) return;
              const nd = Math.hypot(n.x - headNode.x, n.y - headNode.y);
              if (nd < pullR) {
                const f = (1 - nd / pullR) * 0.18;
                n.x += dragDx * f;
                n.y += dragDy * f;
              }
            });
          }
        }
        if (s.eggInLarge) {
          const { idx, dist: d } = findNearestLargeNodeIdx(pos);
          if (idx >= 0 && d < 75) setET({ largeIdx: idx, inLarge: true });
          const cecum = physicsRef.current.largeNodes[0];
          const ileocecal = physicsRef.current.smallNodes[physicsRef.current.smallNodes.length - 1];
          const cDist = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
          const iDist = ileocecal ? Math.hypot(ileocecal.x - pos.x, ileocecal.y - pos.y) : 9999;
          if (Math.min(cDist, iDist) < 55) setET({ inLarge: false });
        } else {
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (sIdx >= 0 && sDist < 80) setET({ smallIdx: sIdx });
          const terminalIleum = physicsRef.current.smallNodes[physicsRef.current.smallNodes.length - 1];
          const cecum = physicsRef.current.largeNodes[0];
          const tiDist = terminalIleum ? Math.hypot(terminalIleum.x - pos.x, terminalIleum.y - pos.y) : 9999;
          const cDist = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
          if (Math.min(tiDist, cDist) < 55) setET({ inLarge: true, largeIdx: 0 });
        }
        physicsRef.current.toolPos = pos;
        return;
      }
      // 拉珠 move — external zone only pulls; drag shifts intestine near head
      if (s.activeTool === TOOLS.ANAL_BEADS) {
        const { setBeadsTarget: setBT } = hrRef.current;
        const prevPos = physicsRef.current.toolPos;
        if (prevPos) {
          const dragDx = pos.x - prevPos.x;
          const dragDy = pos.y - prevPos.y;
          const headNode = s.beadsInSmall
            ? physicsRef.current.smallNodes[s.beadsSmallHeadIdx]
            : physicsRef.current.largeNodes[s.beadsHeadIdx];
          if (headNode) {
            const pullR = 40;
            const nodes = s.beadsInSmall ? physicsRef.current.smallNodes : physicsRef.current.largeNodes;
            nodes.forEach(n => {
              if (n.pinned) return;
              const nd = Math.hypot(n.x - headNode.x, n.y - headNode.y);
              if (nd < pullR) {
                const f = (1 - nd / pullR) * 0.17;
                n.x += dragDx * f;
                n.y += dragDy * f;
              }
            });
          }
        }
        const anusN = physicsRef.current.largeNodes[physicsRef.current.largeNodes.length - 1];
        if (anusN && pos.y > anusN.y + 12) {
          setBT({ largeIdx: physicsRef.current.largeNodes.length - 1, inSmall: false });
          physicsRef.current.toolPos = pos;
          return;
        }
        const { idx, dist: d } = findNearestLargeNodeIdx(pos);
        const retractingFromSmall = idx >= 0 && d < 65 && s.beadsInSmall;
        if (idx >= 0 && d < 65) {
          setBT({ largeIdx: idx });
          if (s.beadsInSmall) setBT({ inSmall: false });
        }
        if (!retractingFromSmall) {
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (sIdx >= 0 && sDist < 88) {
            setBT({ inSmall: true, smallIdx: sIdx });
          }
        }
        physicsRef.current.toolPos = pos;
        return;
      }
      if (s.activeTool === TOOLS.ENEMA) {
        // Drag physically pulls nearby intestine nodes (original drag mode)
        const prevPos = physicsRef.current.toolPos;
        if (prevPos) {
          const dragDx = pos.x - prevPos.x;
          const dragDy = pos.y - prevPos.y;
          const pullRadius = 50;
          const targetNodes = s.enemaInSmall
            ? physicsRef.current.smallNodes
            : physicsRef.current.largeNodes;
          targetNodes.forEach(n => {
            if (n.pinned) return;
            const d = Math.hypot(n.x - pos.x, n.y - pos.y);
            if (d < pullRadius && d > 0.1) {
              const f = (1 - d / pullRadius) * 0.28;
              n.x += dragDx * f;
              n.y += dragDy * f;
            }
          });
        }
        // Set animation target (smooth head movement with speed cap via 300ms interval)
        const { setEnemaTarget: setTgt } = hrRef.current;
        if (s.enemaInSmall) {
          const cecum = physicsRef.current.largeNodes[0];
          const cecumDist = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
          const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
          if (cecumDist < 50 && cecumDist < sDist) {
            setTgt({ inSmall: false, largeIdx: 0 });
          } else if (sIdx >= 0 && sDist < 70) {
            setTgt({ smallIdx: sIdx, inSmall: true });
          }
        } else {
          const { idx, dist } = findNearestLargeNodeIdx(pos);
          if (idx >= 0 && dist < 65) {
            setTgt({ largeIdx: idx });
          }
          if (idx <= 2 && dist < 65) {
            const { idx: sIdx, dist: sDist } = findNearestSmallNodeIdx(pos);
            if (sIdx >= 0 && sDist < 60) {
              setTgt({ inSmall: true, smallIdx: sIdx });
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

  const {
    renderSmallNodes, renderLargeNodes, renderSmallSegs, renderLargeSegs,
    periScaleSmall, periScaleLarge,
    repairMarks, sutureMarks, largeRepairMarks, largeSutureMarks,
    smallTransplantColor, largeTransplantColor,
    mesenterySelectionMode, mesenterySelectedNodes,
    parasites,
    resectionSelectionMode, resectionIntestine, resectionStartSeg, resectionEndSeg,
    resectedSmallRanges, resectedLargeRanges,
  } = state;
  const isInternal = state.viewMode === 'internal';

  const avgPain = renderSmallSegs.length > 0
    ? renderSmallSegs.reduce((a, s) => a + s.pain, 0) / renderSmallSegs.length : 0;
  const avgPressure = renderSmallSegs.length > 0
    ? renderSmallSegs.reduce((a, s) => a + s.pressure, 0) / renderSmallSegs.length : 0;
  const bulge = 1 + avgPressure * 0.003;
  const expansionScale = state.expansionScale;

  const breathVal = useBreathAnimation(state.heartRate);
  const breathAmp = state.breathAmplitude;
  const inhale = (breathVal + 1) / 2;
  // Image: x=-80 centers 500px img on 340px canvas. Adjusted y downward per user feedback.
  const breathImgOffsetY = -170 - inhale * 5 * breathAmp;
  const breathImgH = 715 + inhale * 14 * breathAmp;
  const navelYBreath = NAVEL_Y_EXTERNAL - inhale * 5 * breathAmp;
  const breathOverlayScale = 1 + inhale * 0.025 * breathAmp;

  const handlePos = state.toolPos;
  const renderTime = Date.now() / 33;

  const enemaVisible = state.activeTool === TOOLS.ENEMA || state.toolStates?.[TOOLS.ENEMA]?.active === true;
  const electricIndepActive = state.toolStates?.[TOOLS.ELECTRIC]?.active === true;

  // Tube path: from head position outward toward anus (entry point)
  // This represents the physical tube that has been inserted
  const enemaPathLarge = (() => {
    if (!enemaVisible || renderLargeNodes.length === 0) return '';
    const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, state.enemaHeadIdx));
    // slice from head to anus end (higher indices = toward anus)
    return buildSmoothPath(renderLargeNodes.slice(headIdx));
  })();
  // Fluid fill path: fluid emanates FROM the head toward cecum (index 0)
  // Only visible when enema is actively injecting (toolActive)
  const enemaFillPath = (() => {
    if (!enemaVisible || renderLargeNodes.length === 0) return '';
    if (state.enemaInSmall) return '';
    const isActive = state.toolActive || state.toolStates?.[TOOLS.ENEMA]?.active === true;
    if (!isActive) return '';
    const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, state.enemaHeadIdx));
    if (headIdx <= 1) return '';
    // Fill from cecum (0) to head — fluid accumulating ahead of the tip
    return buildSmoothPath(renderLargeNodes.slice(0, headIdx + 1));
  })();
  const enemaPathSmall = (() => {
    if (!enemaVisible || !state.enemaInSmall || renderSmallNodes.length === 0) return '';
    const smallHeadIdx = Math.max(0, Math.min(renderSmallNodes.length - 1, state.enemaSmallHeadIdx));
    return buildSmoothPath([...renderSmallNodes.slice(smallHeadIdx)].reverse());
  })();
  const enemaHead = enemaVisible
    ? (state.enemaInSmall && renderSmallNodes.length > 0
        ? renderSmallNodes[Math.max(0, Math.min(renderSmallNodes.length - 1, state.enemaSmallHeadIdx))]
        : renderLargeNodes[Math.max(0, Math.min(renderLargeNodes.length - 1, state.enemaHeadIdx))])
    : null;
  const enemaHeadInSmall = enemaVisible && state.enemaInSmall;

  const ELEC_CTRL_X = 36;
  const ELEC_CTRL_Y = CANVAS_H - 38;

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
    if (tool === TOOLS.BAYONET) {
      const bladeLen = 80 + state.toolParam1 * 1.5;
      const stirAmp = state.toolActive ? 3 + state.toolParam2 * 0.04 : 0;
      return { g: computeRodGeoFor(state.toolInserted, state.toolAnchor, handlePos, bladeLen, stirAmp, renderTime), radius: 4 };
    }
    return null;
  })();

  // Silicone rod paths — use siliconeHeadIdx (independent from enema)
  const siliconeVisible = state.activeTool === TOOLS.SILICONE_ROD;
  const siliconePathLarge = (() => {
    if (!siliconeVisible || renderLargeNodes.length === 0) return '';
    const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, state.siliconeHeadIdx));
    return buildSmoothPath(renderLargeNodes.slice(headIdx));
  })();
  const siliconePathSmall = (() => {
    if (!siliconeVisible || !state.siliconeInSmall || renderSmallNodes.length === 0) return '';
    const smallHeadIdx = Math.max(0, Math.min(renderSmallNodes.length - 1, state.siliconeSmallHeadIdx));
    return buildSmoothPath([...renderSmallNodes.slice(smallHeadIdx)].reverse());
  })();
  const siliconeHead = siliconeVisible
    ? (state.siliconeInSmall && renderSmallNodes.length > 0
        ? renderSmallNodes[Math.max(0, Math.min(renderSmallNodes.length - 1, state.siliconeSmallHeadIdx))]
        : renderLargeNodes[Math.max(0, Math.min(renderLargeNodes.length - 1, state.siliconeHeadIdx))])
    : null;

  // Vibrating egg paths — control line runs from duodenum (node 0) to egg head
  const eggVisible = state.activeTool === TOOLS.VIBRATING_EGG;
  const eggHeadNode = (() => {
    if (!eggVisible || renderSmallNodes.length === 0) return null;
    if (state.eggInLarge && renderLargeNodes.length > 0) {
      const idx = Math.max(0, Math.min(renderLargeNodes.length - 1, state.eggLargeHeadIdx));
      return renderLargeNodes[idx];
    }
    const idx = Math.max(0, Math.min(renderSmallNodes.length - 1, state.eggSmallHeadIdx));
    return renderSmallNodes[idx];
  })();
  const eggTangentAngle = (() => {
    if (!eggVisible) return 0;
    if (state.eggInLarge && renderLargeNodes.length > 1) {
      const idx = Math.max(0, Math.min(renderLargeNodes.length - 1, state.eggLargeHeadIdx));
      const prev = renderLargeNodes[Math.max(0, idx - 1)];
      const next = renderLargeNodes[Math.min(renderLargeNodes.length - 1, idx + 1)];
      return Math.atan2(next.y - prev.y, next.x - prev.x) * 180 / Math.PI;
    }
    if (renderSmallNodes.length > 1) {
      const idx = Math.max(0, Math.min(renderSmallNodes.length - 1, state.eggSmallHeadIdx));
      const prev = renderSmallNodes[Math.max(0, idx - 1)];
      const next = renderSmallNodes[Math.min(renderSmallNodes.length - 1, idx + 1)];
      return Math.atan2(next.y - prev.y, next.x - prev.x) * 180 / Math.PI;
    }
    return 0;
  })();
  // Control line: follows intestine path from duodenum (small node 0) to egg head
  const eggControlLinePath = (() => {
    if (!eggVisible || renderSmallNodes.length === 0) return '';
    if (!state.eggInLarge) {
      const idx = Math.max(0, Math.min(renderSmallNodes.length - 1, state.eggSmallHeadIdx));
      if (idx < 1) return '';
      return buildSmoothPath(renderSmallNodes.slice(0, idx + 1));
    }
    // In large intestine: full small intestine path + large intestine from 0 to egg
    const smallPath = buildSmoothPath(renderSmallNodes);
    const largeIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, state.eggLargeHeadIdx));
    if (largeIdx < 1) return smallPath;
    const largePath = buildSmoothPath(renderLargeNodes.slice(0, largeIdx + 1));
    return smallPath + ' ' + largePath;
  })();

  // Suspended tools: active tools that are not the current tool, with stored positions
  const suspendedTools = Object.entries(state.toolStates ?? {}).filter(([id, ts]) => {
    if (id === state.activeTool) return false;
    return ts.active && ts.pos != null;
  });

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
            {/* Same character image as external view — no dark overlay so brightness matches */}
            <SvgImage
              href={BELLY_EXTERNAL_IMG}
              x={-80} y={breathImgOffsetY}
              width={500} height={breathImgH}
              preserveAspectRatio="xMidYMid meet"
            />
          </G>
        ) : (
          <G>
            {/* External view belly image. x=-80 centers 500px img on 340px canvas.
                y=-189 places navel at CAVITY_CY=248: 0.609*715-189=248. */}
            <SvgImage
              href={BELLY_EXTERNAL_IMG}
              x={-80} y={breathImgOffsetY}
              width={500} height={breathImgH}
              preserveAspectRatio="xMidYMid meet"
            />
            {avgPressure > 15 && (
              <Ellipse cx={CANVAS_W / 2} cy={navelYBreath}
                rx={CANVAS_W * 0.32 * (1 + avgPressure * 0.003) * bulge * breathOverlayScale}
                ry={CANVAS_H * 0.14 * (1 + avgPressure * 0.003) * bulge * breathOverlayScale}
                fill={`rgba(220,70,90,${Math.min(0.32, avgPressure * 0.003)})`} />
            )}
            {avgPain > 20 && (
              <Ellipse cx={CANVAS_W / 2} cy={navelYBreath + 10}
                rx={CANVAS_W * 0.28 * breathOverlayScale} ry={CANVAS_H * 0.11 * breathOverlayScale}
                fill={`rgba(255,80,80,${Math.min(0.28, avgPain * 0.003)})`} />
            )}
            {(state.activeTool === TOOLS.NEEDLE ||
              ((state.activeTool === TOOLS.METAL_ROD || state.activeTool === TOOLS.VIBRATOR) && state.navelPierced)) && (
              <Circle cx={NAVEL_X} cy={navelYBreath} r={NAVEL_RADIUS}
                fill="none" stroke="rgba(255,180,80,0.5)" strokeWidth={1.5} strokeDasharray="3 3" />
            )}
            {state.navelPierced && (
              <G>
                <Line x1={NAVEL_X} y1={navelYBreath - 14}
                  x2={NAVEL_X} y2={navelYBreath + 14}
                  stroke="#dcdcdc" strokeWidth={2.5} strokeLinecap="round" />
                <Circle cx={NAVEL_X} cy={navelYBreath - 14} r={3} fill="#f0f0f0" />
                <Circle cx={NAVEL_X} cy={navelYBreath + 14} r={3} fill="#f0f0f0" />
              </G>
            )}
            {state.renderSmallSegs.filter(s => s.ruptured).slice(0, 3).map((_, i) => (
              <Ellipse key={`rup-${i}`}
                cx={CANVAS_W * (0.35 + i * 0.15)} cy={navelYBreath * (0.95 + i * 0.05)}
                rx={14 + i * 3} ry={8 + i * 2}
                fill="rgba(140,20,20,0.55)" />
            ))}
          </G>
        )}

        {/* ===== INTERNAL ORGANS LAYER ===== */}
        {isInternal && (
          <G clipPath="url(#cavityClip)">
            {/* Intestine anatomical background image — enlarged to fill cavity better */}
            <SvgImage
              href={INTESTINES_REF}
              x={CAVITY_CX - CAVITY_RX * 1.05} y={CAVITY_CY - CAVITY_RY * 1.05}
              width={CAVITY_RX * 1.05 * 2} height={CAVITY_RY * 1.05 * 2}
              preserveAspectRatio="xMidYMid meet" opacity={0.42} />
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX - 2} ry={CAVITY_RY - 2}
              fill="none" stroke="#3a1010" strokeWidth={4} />

            {/* ===== LARGE INTESTINE — smooth bezier segments ===== */}
            {renderLargeSegs.map((seg, i) => {
              if (i >= renderLargeNodes.length - 1) return null;
              if (seg.broken) return null; // visual gap at break
              if (seg.resected) return null; // surgically removed — hidden
              const d = buildSmoothSegPath(renderLargeNodes, i);
              if (!d) return null;
              const lPeriScale = (periScaleLarge?.[i] ?? 1);
              const w = LARGE_RADIUS * lPeriScale * 2 + (seg.pressure / LARGE_RUPTURE_PRESSURE) * LARGE_RADIUS * expansionScale;
              const col = segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, seg.perforated, true, largeTransplantColor ?? undefined);
              return (
                <G key={`lg-${i}`}>
                  <Path d={d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d={d} stroke="rgba(255,200,175,0.22)" strokeWidth={LARGE_RADIUS * 0.65} fill="none" strokeLinecap="round" />
                </G>
              );
            })}

            {/* Ileocecal junction — visible tube connecting terminal ileum to cecum */}
            {renderSmallNodes.length > 0 && renderLargeNodes.length > 0 && (() => {
              const ileum = renderSmallNodes[renderSmallNodes.length - 1];
              const cecum = renderLargeNodes[0];
              const seg0 = renderSmallSegs[renderSmallSegs.length - 1];
              const col = segmentColor(
                seg0?.health ?? 100, seg0?.pain ?? 0, seg0?.pressure ?? 0,
                seg0?.ruptured ?? false, seg0?.broken ?? false, seg0?.perforated ?? false, false,
              );
              const junctionW = (SMALL_RADIUS + LARGE_RADIUS) * 0.75;
              return (
                <G key="ileocecal">
                  <Line x1={ileum.x} y1={ileum.y} x2={cecum.x} y2={cecum.y}
                    stroke={col} strokeWidth={junctionW} strokeLinecap="round" />
                  <Line x1={ileum.x} y1={ileum.y} x2={cecum.x} y2={cecum.y}
                    stroke="rgba(255,210,185,0.18)" strokeWidth={junctionW * 0.5} strokeLinecap="round" />
                </G>
              );
            })()}

            {/* Large intestine cecum end-cap */}
            {renderLargeNodes.length > 0 && (() => {
              const seg0 = renderLargeSegs[0];
              if (seg0?.broken) return null;
              const col = segmentColor(
                seg0?.health ?? 100, seg0?.pain ?? 0, seg0?.pressure ?? 0,
                seg0?.ruptured ?? false, seg0?.broken ?? false, seg0?.perforated ?? false, true,
              );
              const n = renderLargeNodes[0];
              const w = LARGE_RADIUS + (seg0 ? (seg0.pressure / LARGE_RUPTURE_PRESSURE) * LARGE_RADIUS * 0.5 * expansionScale : 0);
              return (
                <Circle key="cecum" cx={n.x} cy={n.y} r={w}
                  fill={col} stroke="rgba(200,130,110,0.35)" strokeWidth={1.2} />
              );
            })()}

            {/* Large intestine rupture burst markers */}
            {renderLargeSegs.map((seg, i) => {
              if (!seg.ruptured) return null;
              const n = renderLargeNodes[i];
              if (!n) return null;
              return (
                <G key={`lgrpt-${i}`}>
                  {[0, 45, 90, 135].map(angle => {
                    const rad = angle * Math.PI / 180;
                    const r = LARGE_RADIUS + 6;
                    return (
                      <Line key={angle}
                        x1={n.x} y1={n.y}
                        x2={n.x + Math.cos(rad) * r} y2={n.y + Math.sin(rad) * r}
                        stroke="#ff3030" strokeWidth={2} strokeLinecap="round" />
                    );
                  })}
                  <Circle cx={n.x} cy={n.y} r={5} fill="#cc0000" stroke="#ff4040" strokeWidth={1} />
                </G>
              );
            })}

            {/* Large intestine perforation markers */}
            {renderLargeSegs.map((seg, i) =>
              seg.perforated && !seg.broken ? (
                <G key={`lgprf-${i}`}>
                  <Circle cx={renderLargeNodes[i]?.x ?? 0} cy={renderLargeNodes[i]?.y ?? 0}
                    r={3.5} fill="#440000" stroke="#aa2020" strokeWidth={1} />
                  <Circle cx={renderLargeNodes[i]?.x ?? 0} cy={renderLargeNodes[i]?.y ?? 0}
                    r={6} fill="none" stroke="rgba(200,40,40,0.4)" strokeWidth={0.8} />
                </G>
              ) : null
            )}

            {/* Large intestine break markers */}
            {renderLargeSegs.map((seg, i) => {
              if (!seg.broken) return null;
              const nodeA = renderLargeNodes[i];
              const nodeB = renderLargeNodes[i + 1];
              if (!nodeA || !nodeB) return null;
              const mx = (nodeA.x + nodeB.x) / 2;
              const my = (nodeA.y + nodeB.y) / 2;
              return (
                <G key={`lgbrk-${i}`}>
                  {/* Torn ends */}
                  <Circle cx={nodeA.x} cy={nodeA.y} r={LARGE_RADIUS * 0.9}
                    fill="#8a1010" stroke="#cc1010" strokeWidth={1.5} />
                  <Circle cx={nodeB.x} cy={nodeB.y} r={LARGE_RADIUS * 0.9}
                    fill="#8a1010" stroke="#cc1010" strokeWidth={1.5} />
                  {/* Gap sever mark */}
                  <Line x1={mx - 5} y1={my - 5} x2={mx + 5} y2={my + 5}
                    stroke="#ff2020" strokeWidth={2} strokeLinecap="round" />
                  <Line x1={mx + 5} y1={my - 5} x2={mx - 5} y2={my + 5}
                    stroke="#ff2020" strokeWidth={2} strokeLinecap="round" />
                </G>
              );
            })}

            {/* ===== SMALL INTESTINE — outline casing pass (drawn first, behind fill) ===== */}
            {renderSmallSegs.map((seg, i) => {
              if (i >= renderSmallNodes.length - 1) return null;
              if (seg.broken) return null;
              if (seg.resected) return null; // surgically removed — hidden
              const d = buildSmoothSegPath(renderSmallNodes, i);
              if (!d) return null;
              const sPeriScale = (periScaleSmall?.[i] ?? 1);
              const w = SMALL_RADIUS * sPeriScale * 2 + (seg.pressure / 100) * SMALL_RADIUS * expansionScale;
              return (
                <Path key={`sm-out-${i}`} d={d}
                  stroke="rgba(175, 100, 80, 0.55)"
                  strokeWidth={w + 3.5}
                  fill="none" strokeLinecap="round" strokeLinejoin="round" />
              );
            })}

            {/* ===== SMALL INTESTINE — fill segments ===== */}
            {renderSmallSegs.map((seg, i) => {
              if (i >= renderSmallNodes.length - 1) return null;
              if (seg.broken) return null; // visual gap at break
              if (seg.resected) return null; // surgically removed — hidden
              const d = buildSmoothSegPath(renderSmallNodes, i);
              if (!d) return null;
              const sPeriScale = (periScaleSmall?.[i] ?? 1);
              const w = SMALL_RADIUS * sPeriScale * 2 + (seg.pressure / 100) * SMALL_RADIUS * expansionScale;
              const col = segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, seg.perforated, false, smallTransplantColor ?? undefined);
              return (
                <G key={`sm-${i}`}>
                  <Path d={d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  <Path d={d} stroke="rgba(255,220,200,0.18)" strokeWidth={SMALL_RADIUS * 0.7} fill="none" strokeLinecap="round" />
                </G>
              );
            })}

            {/* Rupture burst markers */}
            {renderSmallSegs.map((seg, i) => {
              if (!seg.ruptured) return null;
              const n = renderSmallNodes[i];
              if (!n) return null;
              return (
                <G key={`rpt-${i}`}>
                  {/* Burst glow */}
                  <Circle cx={n.x} cy={n.y} r={12}
                    fill="rgba(220,30,30,0.22)" stroke="rgba(255,60,60,0.6)" strokeWidth={1.2} />
                  <Circle cx={n.x} cy={n.y} r={5}
                    fill="#200000" stroke="#cc2020" strokeWidth={1} />
                  {/* Radial burst lines */}
                  {[0, 45, 90, 135].map(angle => {
                    const rad = (angle * Math.PI) / 180;
                    const r1 = 7, r2 = 13;
                    return (
                      <Line key={`rptl-${i}-${angle}`}
                        x1={n.x + Math.cos(rad) * r1} y1={n.y + Math.sin(rad) * r1}
                        x2={n.x + Math.cos(rad) * r2} y2={n.y + Math.sin(rad) * r2}
                        stroke="rgba(255,80,40,0.7)" strokeWidth={1.2} strokeLinecap="round" />
                    );
                  })}
                </G>
              );
            })}
            {renderLargeSegs.map((seg, i) => {
              if (!seg.ruptured) return null;
              const n = renderLargeNodes[i];
              if (!n) return null;
              return (
                <G key={`lgrpt-${i}`}>
                  <Circle cx={n.x} cy={n.y} r={15}
                    fill="rgba(220,30,30,0.22)" stroke="rgba(255,60,60,0.6)" strokeWidth={1.5} />
                  <Circle cx={n.x} cy={n.y} r={6}
                    fill="#200000" stroke="#cc2020" strokeWidth={1.2} />
                  {[0, 45, 90, 135].map(angle => {
                    const rad = (angle * Math.PI) / 180;
                    return (
                      <Line key={`lgrptl-${i}-${angle}`}
                        x1={n.x + Math.cos(rad) * 8} y1={n.y + Math.sin(rad) * 8}
                        x2={n.x + Math.cos(rad) * 16} y2={n.y + Math.sin(rad) * 16}
                        stroke="rgba(255,80,40,0.7)" strokeWidth={1.5} strokeLinecap="round" />
                    );
                  })}
                </G>
              );
            })}

            {/* Small intestine break markers */}
            {renderSmallSegs.map((seg, i) => {
              if (!seg.broken) return null;
              const nodeA = renderSmallNodes[i];
              const nodeB = renderSmallNodes[i + 1];
              if (!nodeA || !nodeB) return null;
              const mx = (nodeA.x + nodeB.x) / 2;
              const my = (nodeA.y + nodeB.y) / 2;
              return (
                <G key={`smbrk-${i}`}>
                  <Circle cx={nodeA.x} cy={nodeA.y} r={SMALL_RADIUS * 0.9}
                    fill="#660808" stroke="#aa1010" strokeWidth={1.2} />
                  <Circle cx={nodeB.x} cy={nodeB.y} r={SMALL_RADIUS * 0.9}
                    fill="#660808" stroke="#aa1010" strokeWidth={1.2} />
                  <Line x1={mx - 4} y1={my - 4} x2={mx + 4} y2={my + 4}
                    stroke="#ff2020" strokeWidth={1.5} strokeLinecap="round" />
                  <Line x1={mx + 4} y1={my - 4} x2={mx - 4} y2={my + 4}
                    stroke="#ff2020" strokeWidth={1.5} strokeLinecap="round" />
                </G>
              );
            })}

            {/* Perforation markers */}
            {renderSmallSegs.map((seg, i) =>
              seg.perforated && !seg.broken ? (
                <Circle key={`prf-${i}`} cx={renderSmallNodes[i]?.x ?? 0} cy={renderSmallNodes[i]?.y ?? 0}
                  r={2.5} fill="#440000" stroke="#aa3030" strokeWidth={0.8} />
              ) : null
            )}

            {/* ===== REPAIR MARKS — + cross at healed perforation sites ===== */}
            {(repairMarks ?? []).map(i => {
              const n = renderSmallNodes[i];
              if (!n) return null;
              return (
                <G key={`rep-${i}`}>
                  <Line x1={n.x - 4} y1={n.y} x2={n.x + 4} y2={n.y} stroke="rgba(220,230,180,0.85)" strokeWidth={1.5} strokeLinecap="round" />
                  <Line x1={n.x} y1={n.y - 4} x2={n.x} y2={n.y + 4} stroke="rgba(220,230,180,0.85)" strokeWidth={1.5} strokeLinecap="round" />
                  <Circle cx={n.x} cy={n.y} r={5.5} fill="none" stroke="rgba(200,215,150,0.45)" strokeWidth={1} />
                </G>
              );
            })}
            {(largeRepairMarks ?? []).map(i => {
              const n = renderLargeNodes[i];
              if (!n) return null;
              return (
                <G key={`lrep-${i}`}>
                  <Line x1={n.x - 5} y1={n.y} x2={n.x + 5} y2={n.y} stroke="rgba(220,230,180,0.85)" strokeWidth={2} strokeLinecap="round" />
                  <Line x1={n.x} y1={n.y - 5} x2={n.x} y2={n.y + 5} stroke="rgba(220,230,180,0.85)" strokeWidth={2} strokeLinecap="round" />
                  <Circle cx={n.x} cy={n.y} r={7} fill="none" stroke="rgba(200,215,150,0.4)" strokeWidth={1.2} />
                </G>
              );
            })}

            {/* ===== SUTURE MARKS — stitch dashes at healed break sites ===== */}
            {(sutureMarks ?? []).map(i => {
              const nodeA = renderSmallNodes[i];
              const nodeB = renderSmallNodes[i + 1];
              if (!nodeA || !nodeB) return null;
              const mx = (nodeA.x + nodeB.x) / 2;
              const my = (nodeA.y + nodeB.y) / 2;
              const ang = Math.atan2(nodeB.y - nodeA.y, nodeB.x - nodeA.x);
              const nx = Math.sin(ang) * 5, ny = -Math.cos(ang) * 5;
              return (
                <G key={`sut-${i}`}>
                  {[-6, -2, 2, 6].map(offset => (
                    <Line key={offset}
                      x1={mx + Math.cos(ang) * offset - nx * 0.6} y1={my + Math.sin(ang) * offset - ny * 0.6}
                      x2={mx + Math.cos(ang) * offset + nx * 0.6} y2={my + Math.sin(ang) * offset + ny * 0.6}
                      stroke="rgba(220,200,160,0.8)" strokeWidth={1.2} strokeLinecap="round" />
                  ))}
                  <Line x1={mx - Math.cos(ang) * 7} y1={my - Math.sin(ang) * 7}
                    x2={mx + Math.cos(ang) * 7} y2={my + Math.sin(ang) * 7}
                    stroke="rgba(220,200,160,0.35)" strokeWidth={0.8} strokeLinecap="round" />
                </G>
              );
            })}
            {(largeSutureMarks ?? []).map(i => {
              const nodeA = renderLargeNodes[i];
              const nodeB = renderLargeNodes[i + 1];
              if (!nodeA || !nodeB) return null;
              const mx = (nodeA.x + nodeB.x) / 2;
              const my = (nodeA.y + nodeB.y) / 2;
              const ang = Math.atan2(nodeB.y - nodeA.y, nodeB.x - nodeA.x);
              const nx = Math.sin(ang) * 6, ny = -Math.cos(ang) * 6;
              return (
                <G key={`lsut-${i}`}>
                  {[-7, -2, 3, 8].map(offset => (
                    <Line key={offset}
                      x1={mx + Math.cos(ang) * offset - nx * 0.7} y1={my + Math.sin(ang) * offset - ny * 0.7}
                      x2={mx + Math.cos(ang) * offset + nx * 0.7} y2={my + Math.sin(ang) * offset + ny * 0.7}
                      stroke="rgba(220,200,160,0.8)" strokeWidth={1.5} strokeLinecap="round" />
                  ))}
                </G>
              );
            })}

            {/* ===== PARASITES ===== */}
            {(parasites ?? []).map((parasite: ParasiteEntity) => {
              const nodes = parasite.intestine === 'small' ? renderSmallNodes : renderLargeNodes;
              const radius = parasite.intestine === 'small' ? SMALL_RADIUS : LARGE_RADIUS;
              const maxOffsetPx = radius - 4;
              const segIdx = Math.max(0, Math.min(nodes.length - 2, parasite.segIdx));
              const nodeA = nodes[segIdx];
              const nodeB = nodes[segIdx + 1] ?? nodeA;
              if (!nodeA) return null;

              // Compute midpoint and perpendicular direction for lateral offset
              const dx = nodeB.x - nodeA.x;
              const dy = nodeB.y - nodeA.y;
              const len = Math.hypot(dx, dy) || 1;
              const nx = -dy / len; // perpendicular
              const ny = dx / len;
              const latPx = parasite.lateralOffset * maxOffsetPx;
              const baseMidX = (nodeA.x + nodeB.x) / 2;
              const baseMidY = (nodeA.y + nodeB.y) / 2;
              const midX = baseMidX + nx * latPx;
              const midY = baseMidY + ny * latPx;

              const now = Date.now();

              if (parasite.phase === 'egg_traveling' || parasite.phase === 'egg_hatching') {
                const hatchProgress = parasite.phase === 'egg_hatching' && parasite.hatchDurationMs > 0
                  ? Math.min(1, (now - parasite.hatchStartTime) / parasite.hatchDurationMs)
                  : 0;
                // Realistic egg: oval amber-tan shell, darker at poles
                const eggW = 4.5 + hatchProgress * 2;
                const eggH = 3.2 + hatchProgress * 1.5;
                const shellAlpha = 0.82 + hatchProgress * 0.18;
                // Crack lines on hatching
                return (
                  <G key={`parasite-${parasite.id}`}>
                    {/* Ambient glow */}
                    <Ellipse cx={midX} cy={midY} rx={eggW + 3} ry={eggH + 2}
                      fill={`rgba(120,85,40,${0.15 + hatchProgress * 0.1})`} />
                    {/* Egg outer shell */}
                    <Ellipse cx={midX} cy={midY} rx={eggW} ry={eggH}
                      fill={`rgba(175,138,78,${shellAlpha})`}
                      stroke={`rgba(140,100,50,0.7)`}
                      strokeWidth={0.6} />
                    {/* Inner yolk area */}
                    <Ellipse cx={midX - eggW * 0.1} cy={midY - eggH * 0.1}
                      rx={eggW * 0.55} ry={eggH * 0.5}
                      fill={`rgba(210,175,100,0.55)`} />
                    {/* Specular highlight */}
                    <Ellipse cx={midX - eggW * 0.28} cy={midY - eggH * 0.35}
                      rx={eggW * 0.22} ry={eggH * 0.2}
                      fill={`rgba(245,230,190,0.5)`} />
                    {/* Cracks when hatching */}
                    {parasite.phase === 'egg_hatching' && hatchProgress > 0.3 && (
                      <>
                        {[0,1,2].map(k => {
                          const a = (k / 3) * Math.PI * 2 + 0.5;
                          const r1 = eggW * 0.4 * hatchProgress;
                          const r2 = eggW * 0.9;
                          return (
                            <Line key={k}
                              x1={midX + Math.cos(a) * r1} y1={midY + Math.sin(a) * r1 * 0.7}
                              x2={midX + Math.cos(a) * r2} y2={midY + Math.sin(a) * r2 * 0.7}
                              stroke={`rgba(100,65,25,${hatchProgress * 0.7})`}
                              strokeWidth={0.7} strokeLinecap="round" />
                          );
                        })}
                      </>
                    )}
                  </G>
                );
              }

              if (parasite.phase === 'worm') {
                const wormLen = Math.max(1, parasite.wormLength);
                // Age-based color darkening: starts full brightness, dims to 40% at 5 minutes
                const LIFESPAN_MS = 5 * 60 * 1000;
                const ageRatio = Math.min(1, (now - (parasite.bornAt ?? now)) / LIFESPAN_MS);
                const ageDarken = 1 - ageRatio * 0.6;
                const { r: wr0, g: wg0, b: wb0 } = parasite.wormColor;
                const wr = Math.round(wr0 * ageDarken);
                const wg = Math.round(wg0 * ageDarken);
                const wb = Math.round(wb0 * ageDarken);
                const alpha = Math.min(1, 0.65 + wormLen / 6 * 0.35);

                // Build segment positions. Handles cross-junction rendering by
                // using the correct node array for each segment.
                const segments: Array<{ x: number; y: number; nx: number; ny: number }> = [];
                for (let w = 0; w < wormLen; w++) {
                  let nodeSet: typeof renderSmallNodes;
                  let sIdx: number;
                  const SMALL_OFF_PX = SMALL_RADIUS - 4;
                  const LARGE_OFF_PX = LARGE_RADIUS - 4;
                  let segLatPx = latPx;

                  if (parasite.crossDirection === 'smallToLarge') {
                    const largeIdx = parasite.segIdx - w;
                    if (largeIdx >= 0) {
                      nodeSet = renderLargeNodes;
                      sIdx = Math.max(0, Math.min(renderLargeNodes.length - 2, largeIdx));
                      segLatPx = parasite.lateralOffset * LARGE_OFF_PX;
                    } else {
                      nodeSet = renderSmallNodes;
                      sIdx = Math.max(0, Math.min(renderSmallNodes.length - 2, N_SMALL - 1 + largeIdx));
                      segLatPx = parasite.lateralOffset * SMALL_OFF_PX;
                    }
                  } else if (parasite.crossDirection === 'largeToSmall') {
                    const smallIdx = parasite.segIdx + w;
                    if (smallIdx <= N_SMALL - 2) {
                      nodeSet = renderSmallNodes;
                      sIdx = Math.max(0, Math.min(renderSmallNodes.length - 2, smallIdx));
                      segLatPx = parasite.lateralOffset * SMALL_OFF_PX;
                    } else {
                      nodeSet = renderLargeNodes;
                      sIdx = Math.max(0, Math.min(renderLargeNodes.length - 2, smallIdx - (N_SMALL - 1)));
                      segLatPx = parasite.lateralOffset * LARGE_OFF_PX;
                    }
                  } else {
                    nodeSet = nodes;
                    sIdx = Math.max(0, Math.min(nodes.length - 2, parasite.segIdx - w));
                    segLatPx = latPx;
                  }

                  const nA = nodeSet[sIdx];
                  const nB = nodeSet[sIdx + 1] ?? nA;
                  if (!nA) break;
                  const sdx = nB.x - nA.x; const sdy = nB.y - nA.y;
                  const slen = Math.hypot(sdx, sdy) || 1;
                  const snx = -sdy / slen; const sny = sdx / slen;
                  segments.push({
                    x: (nA.x + nB.x) / 2 + snx * segLatPx,
                    y: (nA.y + nB.y) / 2 + sny * segLatPx,
                    nx: snx, ny: sny,
                  });
                }
                if (segments.length === 0) return null;

                // When moving in reverse (movingDir === -1), the visual head is
                // at the far end of the segment chain. Reverse so segments[0] is
                // always the rendered head regardless of movement direction.
                const movingDir = parasite.movingDir ?? 1;
                const orderedSegs = movingDir === -1 ? [...segments].reverse() : segments;
                const head = orderedSegs[0];

                // Forward direction: body → head (automatically correct after reversal)
                let rawFwdX: number, rawFwdY: number;
                if (orderedSegs.length > 1) {
                  rawFwdX = orderedSegs[0].x - orderedSegs[1].x;
                  rawFwdY = orderedSegs[0].y - orderedSegs[1].y;
                } else {
                  rawFwdX = head.ny; rawFwdY = -head.nx;
                }
                const fwdLen = Math.hypot(rawFwdX, rawFwdY) || 1;
                const fdx = rawFwdX / fwdLen;
                const fdy = rawFwdY / fwdLen;
                const ldx = -fdy;
                const ldy = fdx;

                return (
                  <G key={`parasite-${parasite.id}`}>
                    {/* Body connector lines */}
                    {orderedSegs.slice(1).map((seg, i) => (
                      <Line key={i}
                        x1={orderedSegs[i].x} y1={orderedSegs[i].y}
                        x2={seg.x} y2={seg.y}
                        stroke={`rgba(${wr},${wg},${wb},${alpha * 0.55})`}
                        strokeWidth={5.5}
                        strokeLinecap="round" />
                    ))}
                    {/* Body segments as ellipses */}
                    {orderedSegs.map((seg, i) => {
                      const isHead = i === 0;
                      const segFade = 1 - i * 0.06;
                      const bodyR = isHead ? 5.5 : 4.8 - i * 0.15;
                      return (
                        <Ellipse key={i}
                          cx={seg.x} cy={seg.y}
                          rx={Math.max(2.2, bodyR)}
                          ry={Math.max(1.8, bodyR * 0.72)}
                          fill={`rgba(${wr},${wg},${wb},${alpha * segFade})`}
                          stroke={`rgba(${Math.min(255,wr+20)},${Math.min(255,wg+20)},${Math.min(255,wb+25)},${alpha * 0.6})`}
                          strokeWidth={0.6} />
                      );
                    })}
                    {/* Segment rings (annulation) */}
                    {orderedSegs.map((seg, i) => (
                      <Ellipse key={`ring-${i}`}
                        cx={seg.x} cy={seg.y}
                        rx={Math.max(2, 4.8 - i * 0.15)}
                        ry={Math.max(1.4, (4.8 - i * 0.15) * 0.35)}
                        fill="none"
                        stroke={`rgba(${Math.max(0,wr-30)},${Math.max(0,wg-30)},${Math.max(0,wb-25)},${0.25 * alpha})`}
                        strokeWidth={0.5} />
                    ))}
                    {/* Eyes — in front of head, side by side along the lateral axis */}
                    <Circle cx={head.x + fdx * 2.2 + ldx * 1.6}
                      cy={head.y + fdy * 2.2 + ldy * 1.6} r={1.0}
                      fill="rgba(18,10,8,0.95)" />
                    <Circle cx={head.x + fdx * 2.2 - ldx * 1.6}
                      cy={head.y + fdy * 2.2 - ldy * 1.6} r={1.0}
                      fill="rgba(18,10,8,0.95)" />
                    {/* Head highlight — in the forward direction */}
                    <Ellipse cx={head.x + fdx * 1.8} cy={head.y + fdy * 1.8}
                      rx={2.2} ry={1.4}
                      fill={`rgba(255,255,255,0.22)`} />
                  </G>
                );
              }
              return null;
            })}

            {/* ===== MESENTERY SELECTION HIGHLIGHT — large intestine ===== */}
            {mesenterySelectionMode && renderLargeNodes.map((n, i) => {
              const isSelected = (mesenterySelectedNodes ?? []).includes(i);
              if (!physicsRef.current.largeNodes[i] || physicsRef.current.largeNodes[i].pinned) return null;
              return (
                <Circle key={`msel-${i}`} cx={n.x} cy={n.y}
                  r={LARGE_RADIUS + 5}
                  fill={isSelected ? 'rgba(255,180,40,0.20)' : 'rgba(100,180,255,0.10)'}
                  stroke={isSelected ? 'rgba(255,180,40,0.75)' : 'rgba(100,180,255,0.35)'}
                  strokeWidth={isSelected ? 1.5 : 0.8} />
              );
            })}

            {/* ===== MESENTERY SELECTION HIGHLIGHT — small intestine ===== */}
            {mesenterySelectionMode && renderSmallNodes.map((n, i) => {
              const isSelected = (state.smallMesenterySelectedNodes ?? []).includes(i);
              if (!physicsRef.current.smallNodes[i] || physicsRef.current.smallNodes[i].pinned) return null;
              return (
                <Circle key={`msel-sm-${i}`} cx={n.x} cy={n.y}
                  r={SMALL_RADIUS + 4}
                  fill={isSelected ? 'rgba(255,180,40,0.20)' : 'rgba(120,200,255,0.08)'}
                  stroke={isSelected ? 'rgba(255,180,40,0.70)' : 'rgba(120,200,255,0.30)'}
                  strokeWidth={isSelected ? 1.2 : 0.7} />
              );
            })}

            {/* ===== RESECTION SELECTION HIGHLIGHT ===== */}
            {resectionSelectionMode && resectionIntestine === 'small' && resectionStartSeg >= 0 && (() => {
              const startIdx = Math.min(resectionStartSeg, resectionEndSeg);
              const endIdx = Math.max(resectionStartSeg, resectionEndSeg);
              return renderSmallNodes.map((n, i) => {
                if (i < startIdx || i > endIdx + 1) return null;
                const nA = renderSmallNodes[i];
                const nB = renderSmallNodes[i + 1];
                if (!nA) return null;
                const isEndpoint = i === startIdx || i === endIdx + 1;
                return (
                  <Circle key={`rsel-sm-${i}`}
                    cx={nB ? (nA.x + nB.x) / 2 : nA.x}
                    cy={nB ? (nA.y + nB.y) / 2 : nA.y}
                    r={SMALL_RADIUS + 5}
                    fill={isEndpoint ? 'rgba(220,60,60,0.30)' : 'rgba(220,60,60,0.18)'}
                    stroke="rgba(220,60,60,0.80)"
                    strokeWidth={isEndpoint ? 1.5 : 0.8} />
                );
              });
            })()}
            {resectionSelectionMode && resectionIntestine === 'large' && resectionStartSeg >= 0 && (() => {
              const startIdx = Math.min(resectionStartSeg, resectionEndSeg);
              const endIdx = Math.max(resectionStartSeg, resectionEndSeg);
              return renderLargeNodes.map((n, i) => {
                if (i < startIdx || i > endIdx + 1) return null;
                const nA = renderLargeNodes[i];
                const nB = renderLargeNodes[i + 1];
                if (!nA) return null;
                const isEndpoint = i === startIdx || i === endIdx + 1;
                return (
                  <Circle key={`rsel-lg-${i}`}
                    cx={nB ? (nA.x + nB.x) / 2 : nA.x}
                    cy={nB ? (nA.y + nB.y) / 2 : nA.y}
                    r={LARGE_RADIUS + 6}
                    fill={isEndpoint ? 'rgba(220,60,60,0.30)' : 'rgba(220,60,60,0.18)'}
                    stroke="rgba(220,60,60,0.80)"
                    strokeWidth={isEndpoint ? 1.5 : 0.8} />
                );
              });
            })()}

            {/* ===== RESECTION ANASTOMOSIS SUTURES — surgical stitch at reconnection point ===== */}
            {(resectedSmallRanges ?? []).map((range, ri) => {
              const nA = renderSmallNodes[range.start];
              const nB = renderSmallNodes[range.end + 1];
              if (!nA || !nB) return null;
              const dx = nB.x - nA.x, dy = nB.y - nA.y;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist, uy = dy / dist;
              const px = -uy, py = ux; // perpendicular
              const mx = (nA.x + nB.x) / 2, my = (nA.y + nB.y) / 2;
              const tubeW = SMALL_RADIUS * 1.6;
              const scarCol = 'rgba(200,170,130,0.75)';
              const stitchCol = 'rgba(230,210,160,0.90)';
              return (
                <G key={`anastsm-${ri}`}>
                  {/* Scar tube bridge between the two reconnected ends */}
                  <Line x1={nA.x} y1={nA.y} x2={nB.x} y2={nB.y}
                    stroke="rgba(160,100,80,0.55)" strokeWidth={tubeW + 3} strokeLinecap="round" />
                  <Line x1={nA.x} y1={nA.y} x2={nB.x} y2={nB.y}
                    stroke={scarCol} strokeWidth={tubeW} strokeLinecap="round" />
                  <Line x1={nA.x} y1={nA.y} x2={nB.x} y2={nB.y}
                    stroke="rgba(255,230,190,0.20)" strokeWidth={tubeW * 0.5} strokeLinecap="round" />
                  {/* Cross-stitch marks across the anastomosis */}
                  {[-8, -4, 0, 4, 8].map(offset => {
                    const cx2 = mx + ux * offset, cy2 = my + uy * offset;
                    const hw = SMALL_RADIUS * 0.85;
                    return (
                      <G key={`stch-sm-${ri}-${offset}`}>
                        <Line x1={cx2 - px * hw} y1={cy2 - py * hw}
                          x2={cx2 + px * hw} y2={cy2 + py * hw}
                          stroke={stitchCol} strokeWidth={1.4} strokeLinecap="round" />
                      </G>
                    );
                  })}
                  {/* Running suture thread line along the axis */}
                  <Line x1={mx - ux * 10} y1={my - uy * 10}
                    x2={mx + ux * 10} y2={my + uy * 10}
                    stroke="rgba(220,200,150,0.45)" strokeWidth={0.8} strokeLinecap="round"
                    strokeDasharray="3 2" />
                  {/* End-cap knot dots */}
                  <Circle cx={nA.x} cy={nA.y} r={SMALL_RADIUS * 0.7}
                    fill="rgba(180,120,90,0.80)" stroke="rgba(220,180,130,0.70)" strokeWidth={1} />
                  <Circle cx={nB.x} cy={nB.y} r={SMALL_RADIUS * 0.7}
                    fill="rgba(180,120,90,0.80)" stroke="rgba(220,180,130,0.70)" strokeWidth={1} />
                </G>
              );
            })}
            {(resectedLargeRanges ?? []).map((range, ri) => {
              const nA = renderLargeNodes[range.start];
              const nB = renderLargeNodes[range.end + 1];
              if (!nA || !nB) return null;
              const dx = nB.x - nA.x, dy = nB.y - nA.y;
              const dist = Math.hypot(dx, dy) || 1;
              const ux = dx / dist, uy = dy / dist;
              const px = -uy, py = ux;
              const mx = (nA.x + nB.x) / 2, my = (nA.y + nB.y) / 2;
              const tubeW = LARGE_RADIUS * 1.6;
              const scarCol = 'rgba(200,165,125,0.75)';
              const stitchCol = 'rgba(235,215,165,0.90)';
              return (
                <G key={`anastlg-${ri}`}>
                  {/* Scar tube bridge */}
                  <Line x1={nA.x} y1={nA.y} x2={nB.x} y2={nB.y}
                    stroke="rgba(155,95,75,0.55)" strokeWidth={tubeW + 4} strokeLinecap="round" />
                  <Line x1={nA.x} y1={nA.y} x2={nB.x} y2={nB.y}
                    stroke={scarCol} strokeWidth={tubeW} strokeLinecap="round" />
                  <Line x1={nA.x} y1={nA.y} x2={nB.x} y2={nB.y}
                    stroke="rgba(255,230,190,0.18)" strokeWidth={tubeW * 0.5} strokeLinecap="round" />
                  {/* Cross-stitch marks */}
                  {[-10, -5, 0, 5, 10].map(offset => {
                    const cx2 = mx + ux * offset, cy2 = my + uy * offset;
                    const hw = LARGE_RADIUS * 0.85;
                    return (
                      <G key={`stch-lg-${ri}-${offset}`}>
                        <Line x1={cx2 - px * hw} y1={cy2 - py * hw}
                          x2={cx2 + px * hw} y2={cy2 + py * hw}
                          stroke={stitchCol} strokeWidth={1.7} strokeLinecap="round" />
                      </G>
                    );
                  })}
                  {/* Running suture thread */}
                  <Line x1={mx - ux * 12} y1={my - uy * 12}
                    x2={mx + ux * 12} y2={my + uy * 12}
                    stroke="rgba(220,200,150,0.45)" strokeWidth={0.9} strokeLinecap="round"
                    strokeDasharray="3 2" />
                  {/* End-cap knot dots */}
                  <Circle cx={nA.x} cy={nA.y} r={LARGE_RADIUS * 0.7}
                    fill="rgba(175,115,85,0.80)" stroke="rgba(220,175,125,0.70)" strokeWidth={1.2} />
                  <Circle cx={nB.x} cy={nB.y} r={LARGE_RADIUS * 0.7}
                    fill="rgba(175,115,85,0.80)" stroke="rgba(220,175,125,0.70)" strokeWidth={1.2} />
                </G>
              );
            })}

            {/* Debug overlays — small intestine */}
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

            {/* Debug overlays — large intestine */}
            {state.debugMode && renderLargeSegs.map((seg, i) => {
              const n = renderLargeNodes[i];
              if (!n) return null;
              const bx = n.x + 18, by = n.y - 14;
              return (
                <G key={`dbgL-${i}`}>
                  <Rect x={bx} y={by} width={seg.health * 0.28} height={3} fill="#44ee44" />
                  <Rect x={bx} y={by + 4} width={seg.sensitivity * 0.28} height={3} fill="#ee44ee" />
                  <Rect x={bx} y={by + 8} width={seg.pain * 0.28} height={3} fill="#ee4444" />
                  <Rect x={bx} y={by + 12} width={(seg.pressure / 180) * 28} height={3} fill="#4488ff" />
                </G>
              );
            })}

            {/* Collision box debug — radii match actual physics: periScale * base * (1 + pressure expansion) */}
            {state.showCollisionBoxes && renderSmallNodes.map((n, i) => {
              const seg = renderSmallSegs[Math.min(i, renderSmallSegs.length - 1)];
              const sPeriScale = periScaleSmall?.[i] ?? 1;
              const r = SMALL_RADIUS * sPeriScale * (1 + ((seg?.pressure ?? 0) / 100) * expansionScale * 0.45);
              return (
                <Circle key={`cb-sm-${i}`} cx={n.x} cy={n.y} r={r}
                  fill="none" stroke="rgba(0,255,255,0.4)" strokeWidth={0.8} />
              );
            })}
            {state.showCollisionBoxes && renderLargeNodes.map((n, i) => {
              const seg = renderLargeSegs[Math.min(i, renderLargeSegs.length - 1)];
              const lPeriScale = periScaleLarge?.[i] ?? 1;
              const r = LARGE_RADIUS * lPeriScale * (1 + ((seg?.pressure ?? 0) / LARGE_RUPTURE_PRESSURE) * expansionScale * 0.45);
              return (
                <Circle key={`cb-lg-${i}`} cx={n.x} cy={n.y} r={r}
                  fill="none" stroke="rgba(0,200,255,0.35)" strokeWidth={0.8} />
              );
            })}

            {state.showCollisionBoxes && rodGeo && (() => {
              const samples = computeRodCollisionSamples(
                rodGeo.g, state.toolInserted, state.toolAnchor,
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
            {state.showCollisionBoxes && enemaVisible && enemaHead && (
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

        {/* ===== SUSPENDED (HANGING) TOOLS LAYER ===== */}
        {/* Tools that are active but not the current tool render at their last position */}
        {isInternal && suspendedTools.map(([toolId, ts]) => {
          if (!ts.pos) return null;
          return (
            <SuspendedToolOverlay
              key={`suspended-${toolId}`}
              toolId={toolId}
              pos={ts.pos}
              param1={ts.param1}
              param2={ts.param2}
              time={renderTime}
            />
          );
        })}

        {/* ===== TOOLS LAYER (active/current tool) ===== */}

        {/* Rod / Vibrator */}
        {handlePos && (state.activeTool === TOOLS.METAL_ROD || state.activeTool === TOOLS.VIBRATOR) && (() => {
          if (!rodGeo) return null;
          const isVib = state.activeTool === TOOLS.VIBRATOR;
          const { g } = rodGeo;
          const rodColor = isVib ? '#b078ff' : '#aaaacc';
          const rodWidth = isVib ? 6 : 5;
          const splitAtNavel = !isInternal && state.toolInserted;
          const nx = NAVEL_X, ny = navelYBreath;
          return (
            <G key="rod">
              {isVib && state.toolActive && (
                <Circle cx={splitAtNavel ? nx : g.headX} cy={splitAtNavel ? ny : g.headY}
                  r={30 + state.toolParam2 * 0.4}
                  fill="rgba(180,120,255,0.10)"
                  stroke="rgba(180,120,255,0.5)" strokeWidth={1} strokeDasharray="4 4" />
              )}
              {splitAtNavel && (
                <Line x1={nx} y1={ny} x2={g.headX} y2={g.headY}
                  stroke={rodColor} strokeWidth={rodWidth} strokeLinecap="round" opacity={0.12} />
              )}
              <Line x1={g.tailX} y1={g.tailY} x2={splitAtNavel ? nx : g.headX} y2={splitAtNavel ? ny : g.headY}
                stroke={rodColor} strokeWidth={rodWidth} strokeLinecap="round" />
              <Circle cx={g.tailX} cy={g.tailY} r={isVib ? 9 : 7} fill="#666688" stroke="#222" strokeWidth={1} />
              {!splitAtNavel && (
                <Circle cx={g.headX} cy={g.headY} r={isVib ? 8 : 6} fill={rodColor} stroke="#222" strokeWidth={0.5} />
              )}
            </G>
          );
        })()}

        {/* Needle */}
        {handlePos && state.activeTool === TOOLS.NEEDLE && (() => {
          if (!rodGeo) return null;
          const { g } = rodGeo;
          const splitAtNavel = !isInternal && state.toolInserted;
          const nx = NAVEL_X, ny = navelYBreath;
          return (
            <G key="needle">
              {splitAtNavel && (
                <Line x1={nx} y1={ny} x2={g.headX} y2={g.headY}
                  stroke="#cccccc" strokeWidth={2.2} strokeLinecap="round" opacity={0.12} />
              )}
              <Line x1={g.tailX} y1={g.tailY} x2={splitAtNavel ? nx : g.headX} y2={splitAtNavel ? ny : g.headY}
                stroke="#cccccc" strokeWidth={2.2} strokeLinecap="round" />
              <Circle cx={g.tailX} cy={g.tailY} r={5} fill="#888899" stroke="#222" strokeWidth={1} />
              {!splitAtNavel && <Circle cx={g.headX} cy={g.headY} r={2} fill="#ff4040" />}
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

        {/* Bayonet */}
        {handlePos && state.activeTool === TOOLS.BAYONET && (() => {
          if (!rodGeo) return null;
          const { g } = rodGeo;
          const bladeWidth = 2 + state.toolParam2 * 0.06;
          const splitAtNavel = !isInternal && state.toolInserted;
          const nx = NAVEL_X, ny = navelYBreath;
          return (
            <G key="bayonet">
              {splitAtNavel && (
                <G opacity={0.12}>
                  <Line x1={nx} y1={ny} x2={g.headX} y2={g.headY}
                    stroke="#d8d8e8" strokeWidth={bladeWidth + 1.5} strokeLinecap="round" />
                  <Line x1={nx} y1={ny} x2={g.headX} y2={g.headY}
                    stroke="#f0f0ff" strokeWidth={bladeWidth * 0.5} strokeLinecap="round" />
                </G>
              )}
              <Line x1={g.tailX} y1={g.tailY} x2={splitAtNavel ? nx : g.headX} y2={splitAtNavel ? ny : g.headY}
                stroke="#d8d8e8" strokeWidth={bladeWidth + 1.5} strokeLinecap="round" />
              <Line x1={g.tailX} y1={g.tailY} x2={splitAtNavel ? nx : g.headX} y2={splitAtNavel ? ny : g.headY}
                stroke="#f0f0ff" strokeWidth={bladeWidth * 0.5} strokeLinecap="round" />
              <Circle cx={g.tailX} cy={g.tailY} r={7} fill="#555566" stroke="#222" strokeWidth={1} />
              {!splitAtNavel && (
                <>
                  <Circle cx={g.headX} cy={g.headY} r={3} fill="#ff3030" stroke="#cc0000" strokeWidth={0.8} />
                  {state.toolActive && (
                    <Circle cx={g.headX} cy={g.headY} r={10}
                      fill="rgba(255,40,40,0.12)" stroke="rgba(255,80,80,0.4)" strokeWidth={1} />
                  )}
                </>
              )}
            </G>
          );
        })()}

        {/* Silicone rod (长硅胶棒) — independent siliconeHeadIdx */}
        {siliconeVisible && siliconePathLarge !== '' && (
          <G>
            <Path d={siliconePathLarge}
              stroke="rgba(100,40,180,0.78)"
              strokeWidth={18 + state.toolParam1 * 0.10}
              fill="none" strokeLinecap="round" />
            <Path d={siliconePathLarge}
              stroke="rgba(200,160,255,0.50)"
              strokeWidth={4.5}
              fill="none" strokeLinecap="round" />
          </G>
        )}
        {siliconeVisible && siliconePathSmall !== '' && (
          <G>
            <Path d={siliconePathSmall}
              stroke="rgba(130,50,220,0.82)"
              strokeWidth={14 + state.toolParam1 * 0.08}
              fill="none" strokeLinecap="round" />
            <Path d={siliconePathSmall}
              stroke="rgba(210,180,255,0.45)"
              strokeWidth={3.5}
              fill="none" strokeLinecap="round" />
          </G>
        )}
        {siliconeVisible && siliconeHead && (
          <G>
            <Circle cx={siliconeHead.x} cy={siliconeHead.y}
              r={8 + state.toolParam1 * 0.06}
              fill="rgba(80,20,160,0.92)" stroke="rgba(160,100,255,0.9)" strokeWidth={1.5} />
            {state.toolActive && (
              <Circle cx={siliconeHead.x} cy={siliconeHead.y}
                r={12 + state.toolParam1 * 0.07}
                fill="none" stroke="rgba(180,130,255,0.38)" strokeWidth={1} />
            )}
          </G>
        )}

        {/* Anal beads (拉珠) — independent beadsHeadIdx + external chain physics */}
        {state.activeTool === TOOLS.ANAL_BEADS && (() => {
          const BEAD_R = (i: number) => Math.min(3 + i * 0.65, 16.0);
          const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, state.beadsHeadIdx));
          const internalCount = state.beadsInSmall
            ? Math.min(40, renderLargeNodes.length)
            : Math.min(40, Math.max(0, renderLargeNodes.length - headIdx));
          const externalCount = Math.max(0, 40 - internalCount);
          const chain = state.beadsChain ?? [];

          // Small-intestine beads — FRONT of chain (smallest beads, indices 0+)
          // Computed first so we know the offset for large-intestine bead indices
          const sBeads: { x: number; y: number; r: number }[] = [];
          if (state.beadsInSmall && renderSmallNodes.length > 0) {
            const sHead = Math.max(0, Math.min(renderSmallNodes.length - 1, state.beadsSmallHeadIdx));
            for (let i = 0; i < 20 && sHead + i < renderSmallNodes.length && sBeads.length < 20; i++) {
              sBeads.push({ ...renderSmallNodes[sHead + i], r: BEAD_R(i) });
            }
          }

          // Large-intestine beads — TAIL of chain; bead indices start after sBeads
          const iBeadOffset = sBeads.length;
          const iBeads: { x: number; y: number; r: number }[] = [];
          for (let i = 0; i < internalCount; i++) {
            const ni = headIdx + i;
            if (ni < renderLargeNodes.length) {
              iBeads.push({ ...renderLargeNodes[ni], r: BEAD_R(iBeadOffset + i) });
            }
          }

          const lastInternal = iBeads[iBeads.length - 1] ?? null;
          const anusNode = renderLargeNodes[renderLargeNodes.length - 1];
          return (
            <G>
              {/* Small-intestine connecting string */}
              {sBeads.map((b, i) => i === 0 ? null : (
                <Line key={`sline-${i}`}
                  x1={sBeads[i-1].x} y1={sBeads[i-1].y} x2={b.x} y2={b.y}
                  stroke="#0f0f0f" strokeWidth={1.2} />
              ))}
              {/* Bridge from last small bead → first large bead (ileocecal junction) */}
              {sBeads.length > 0 && iBeads.length > 0 && (
                <Line
                  x1={sBeads[sBeads.length - 1].x} y1={sBeads[sBeads.length - 1].y}
                  x2={iBeads[0].x} y2={iBeads[0].y}
                  stroke="#111" strokeWidth={1.3} />
              )}
              {/* Internal connecting string */}
              {iBeads.map((b, i) => i === 0 ? null : (
                <Line key={`iline-${i}`}
                  x1={iBeads[i-1].x} y1={iBeads[i-1].y} x2={b.x} y2={b.y}
                  stroke="#111" strokeWidth={1.4} />
              ))}
              {/* Small-intestine beads — slightly brighter (front of chain) */}
              {sBeads.map((b, i) => (
                <G key={`sb-${i}`}>
                  <Circle cx={b.x} cy={b.y} r={b.r} fill="#141414" stroke="#252525" strokeWidth={0.7} />
                  <Circle cx={b.x - b.r * 0.25} cy={b.y - b.r * 0.25} r={b.r * 0.18} fill="rgba(255,255,255,0.09)" />
                </G>
              ))}
              {/* Internal beads — fully opaque (tail through large intestine) */}
              {iBeads.map((b, i) => (
                <G key={`ib-${i}`}>
                  <Circle cx={b.x} cy={b.y} r={b.r} fill="#1c1c1c" stroke="#303030" strokeWidth={0.7} />
                  <Circle cx={b.x - b.r * 0.28} cy={b.y - b.r * 0.28} r={b.r * 0.22} fill="rgba(255,255,255,0.13)" />
                </G>
              ))}
              {/* Bridge from last internal bead → anus node → first external bead */}
              {externalCount > 0 && lastInternal && anusNode && (
                <Line x1={lastInternal.x} y1={lastInternal.y} x2={anusNode.x} y2={anusNode.y}
                  stroke="#111" strokeWidth={1.4} />
              )}
              {externalCount > 0 && chain.length > 0 && anusNode && (
                <Line x1={anusNode.x} y1={anusNode.y} x2={chain[0].x} y2={chain[0].y}
                  stroke="#111" strokeWidth={1.4} opacity={0.5} />
              )}
              {/* External connecting string */}
              {chain.slice(0, externalCount).map((c, i) => i === 0 ? null : (
                <Line key={`eline-${i}`}
                  x1={chain[i-1].x} y1={chain[i-1].y} x2={c.x} y2={c.y}
                  stroke="#111" strokeWidth={1.4} opacity={0.5} />
              ))}
              {/* External beads — semi-transparent */}
              {chain.slice(0, externalCount).map((c, i) => {
                const gIdx = internalCount + i;
                const r = BEAD_R(Math.min(gIdx, 39));
                const isPullRing = i === externalCount - 1;
                return (
                  <G key={`eb-${i}`} opacity={0.48}>
                    <Circle cx={c.x} cy={c.y} r={r} fill="#1c1c1c" stroke="#303030" strokeWidth={0.7} />
                    <Circle cx={c.x - r * 0.28} cy={c.y - r * 0.28} r={r * 0.22} fill="rgba(255,255,255,0.10)" />
                    {isPullRing && (
                      <Circle cx={c.x} cy={c.y} r={r + 4.5}
                        fill="none" stroke="rgba(180,180,180,0.55)" strokeWidth={1.8} />
                    )}
                  </G>
                );
              })}
            </G>
          );
        })()}

        {/* 吞入跳蛋 — control line + vibration rings + pink oval body */}
        {eggVisible && eggControlLinePath !== '' && (
          <Path d={eggControlLinePath}
            stroke="rgba(244,160,184,0.55)"
            strokeWidth={2.2}
            fill="none" strokeLinecap="round" strokeDasharray="5 4" />
        )}
        {/* Thread going out of frame toward mouth — from duodenum (node 0) upward */}
        {eggVisible && renderSmallNodes.length > 0 && (() => {
          const duodenum = renderSmallNodes[0];
          return (
            <Line x1={duodenum.x} y1={duodenum.y}
              x2={duodenum.x} y2={Math.max(0, duodenum.y - 32)}
              stroke="rgba(244,160,184,0.40)" strokeWidth={1.8}
              strokeLinecap="round" strokeDasharray="4 3" />
          );
        })()}
        {/* Vibration rings — drawn behind egg body */}
        {eggVisible && eggHeadNode && state.toolActive && (() => {
          const vib = state.toolParam1 / 100;
          const baseR = 14 + vib * 20;
          const pulse = Math.sin(Date.now() / 120) * 0.5 + 0.5;
          return (
            <G>
              <Circle cx={eggHeadNode.x} cy={eggHeadNode.y}
                r={baseR * (0.85 + pulse * 0.15)}
                fill="none"
                stroke="rgba(244,130,168,0.28)"
                strokeWidth={1.5} />
              <Circle cx={eggHeadNode.x} cy={eggHeadNode.y}
                r={(baseR + 8) * (0.9 + pulse * 0.1)}
                fill="none"
                stroke="rgba(244,160,184,0.15)"
                strokeWidth={1} />
            </G>
          );
        })()}
        {/* Egg body — pink oval rotated along intestine tangent */}
        {eggVisible && eggHeadNode && (() => {
          const { x, y } = eggHeadNode;
          const angle = eggTangentAngle;
          const isActive = state.toolActive;
          return (
            <G transform={`translate(${x},${y}) rotate(${angle})`}>
              {/* Back half (darker) */}
              <Ellipse cx={0} cy={0} rx={9.5} ry={6.5}
                fill="#e088a8" stroke="#c06080" strokeWidth={0.8} />
              {/* Front half (lighter) */}
              <Ellipse cx={-1.5} cy={0} rx={8} ry={5.5}
                fill="#f4a0b8" stroke="none" />
              {/* Midline seam */}
              <Line x1={0} y1={-6} x2={0} y2={6}
                stroke="rgba(200,80,120,0.30)" strokeWidth={0.8} />
              {/* Highlight spot */}
              <Ellipse cx={-3} cy={-2.5} rx={2.5} ry={1.8}
                fill="rgba(255,255,255,0.55)" />
              {/* Vibration indicator dot when active */}
              {isActive && (
                <Circle cx={0} cy={0} r={1.5}
                  fill="rgba(255,160,200,0.85)" />
              )}
            </G>
          );
        })()}

        {/* Enema tube (inserted section from head to anus) */}
        {state.activeTool === TOOLS.ENEMA && enemaPathLarge !== '' && (
          <G>
            <Path d={enemaPathLarge} stroke="rgba(60,110,200,0.55)" strokeWidth={5}
              fill="none" strokeLinecap="round" />
            <Path d={enemaPathLarge} stroke="rgba(160,210,255,0.45)" strokeWidth={2}
              fill="none" strokeLinecap="round" />
          </G>
        )}
        {/* Enema fluid fill (fluid accumulating ahead of head toward cecum) */}
        {state.activeTool === TOOLS.ENEMA && enemaFillPath !== '' && (
          <G>
            <Path d={enemaFillPath} stroke="rgba(100,200,255,0.55)" strokeWidth={7}
              fill="none" strokeLinecap="round" />
            <Path d={enemaFillPath} stroke="rgba(200,240,255,0.4)" strokeWidth={3}
              fill="none" strokeLinecap="round" />
          </G>
        )}
        {state.activeTool === TOOLS.ENEMA && enemaPathSmall !== '' && (
          <G>
            <Path d={enemaPathSmall} stroke="rgba(210,110,70,0.72)" strokeWidth={4.5}
              fill="none" strokeLinecap="round" />
            <Path d={enemaPathSmall} stroke="rgba(255,195,155,0.5)" strokeWidth={2}
              fill="none" strokeLinecap="round" />
          </G>
        )}
        {enemaVisible && enemaHead && (
          <G>
            <Circle cx={enemaHead.x} cy={enemaHead.y} r={12}
              fill={enemaHeadInSmall ? 'rgba(200,80,40,0.15)' : 'rgba(50,100,180,0.15)'}
              stroke={enemaHeadInSmall ? 'rgba(255,160,100,0.5)' : 'rgba(120,180,255,0.4)'}
              strokeWidth={1} />
            <Circle cx={enemaHead.x} cy={enemaHead.y} r={7}
              fill={enemaHeadInSmall ? '#b04020' : '#3070b0'}
              stroke={enemaHeadInSmall ? '#ff9060' : '#80b0e0'}
              strokeWidth={1.5} />
            {enemaHeadInSmall && renderLargeNodes[0] && (
              <Circle cx={renderLargeNodes[0].x} cy={renderLargeNodes[0].y} r={9}
                fill="none" stroke="rgba(255,200,100,0.6)" strokeWidth={1.5} strokeDasharray="3 2" />
            )}
            {(state.toolActive || state.toolStates?.[TOOLS.ENEMA]?.active) && (
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

        {/* Electrodes + wires + controller */}
        {(state.electrodes.length > 0 || state.activeTool === TOOLS.ELECTRIC || electricIndepActive) && (
          <G>
            {state.electrodes.map((el, i) => {
              const elecActive = (state.activeTool === TOOLS.ELECTRIC && state.toolActive) || electricIndepActive;
              const wireColor = elecActive ? '#ffee44' : '#888844';
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
              // External view: only show one navel-to-controller wire (not per-electrode)
              if (i !== 0) return null;
              return (
                <Line key="wire-ext-navel"
                  x1={NAVEL_X} y1={NAVEL_Y_EXTERNAL}
                  x2={ELEC_CTRL_X} y2={ELEC_CTRL_Y}
                  stroke={wireColor} strokeWidth={1.2} strokeOpacity={0.75} />
              );
            })}
            {state.electrodes.map((el, i) => {
              const elecActive2 = (state.activeTool === TOOLS.ELECTRIC && state.toolActive) || electricIndepActive;
              const elecParam2 = state.activeTool === TOOLS.ELECTRIC
                ? state.toolParam2
                : (state.toolStates?.[TOOLS.ELECTRIC]?.param2 ?? 50);
              return (
                <G key={`el-${i}`}>
                  <Circle cx={el.x} cy={el.y} r={6} fill="#ffff00" fillOpacity={0.9}
                    stroke="#ffaa00" strokeWidth={1} />
                  {elecActive2 && (
                    <Circle cx={el.x} cy={el.y} r={30 + elecParam2 * 0.3}
                      fill="rgba(255,255,0,0.06)" stroke="rgba(255,255,0,0.3)" strokeWidth={0.8} />
                  )}
                </G>
              );
            })}
            {(state.activeTool === TOOLS.ELECTRIC || electricIndepActive) && (
              <G>
                <Rect x={ELEC_CTRL_X - 20} y={ELEC_CTRL_Y - 16}
                  width={40} height={32} rx={3}
                  fill="#2a2a2a" stroke="#666" strokeWidth={1.2} />
                <Circle cx={ELEC_CTRL_X - 8} cy={ELEC_CTRL_Y}
                  r={3} fill={((state.activeTool === TOOLS.ELECTRIC && state.toolActive) || electricIndepActive) ? '#ff4040' : '#664040'} />
                <Circle cx={ELEC_CTRL_X + 8} cy={ELEC_CTRL_Y}
                  r={3} fill={((state.activeTool === TOOLS.ELECTRIC && state.toolActive) || electricIndepActive) ? '#ffcc40' : '#665540'} />
                <Rect x={ELEC_CTRL_X - 16} y={ELEC_CTRL_Y + 7}
                  width={32} height={3}
                  fill={((state.activeTool === TOOLS.ELECTRIC && state.toolActive) || electricIndepActive) ? '#ffee44' : '#444'} />
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
