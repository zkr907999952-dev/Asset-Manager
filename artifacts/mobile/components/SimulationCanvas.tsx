import React, { useRef, useCallback, useState, useEffect } from 'react';
import { View, PanResponder, StyleSheet, Animated, Easing, Image, Platform, TouchableOpacity, Text } from 'react-native';

import Svg, {
  Ellipse, Circle, Line, Path, Rect, Defs, RadialGradient, LinearGradient, Stop, G,
  Image as SvgImage, ClipPath,
} from 'react-native-svg';
import { StrikeHammerAnim } from './icons/StrikeHammerAnim';
const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const AnimatedLine = Animated.createAnimatedComponent(Line);
type WaveEntry = { id: number; physX: number; physY: number; maxR: number; anim: Animated.Value };

const STRIKE_ANIM_IMAGES: Record<string, any> = {
  '拳头':  require('@/assets/images/strike_fist_anim.png'),
  '棒球棒': require('@/assets/images/strike_bat_anim.png'),
};
const STRIKE_ANIM_COMPONENTS: Record<string, React.ComponentType<{ width: number; height: number }>> = {
  '撞钟锤': StrikeHammerAnim,
};
import type { ParasiteEntity } from '../contexts/GameContext';

const INTESTINES_REF = require('@/assets/images/intestines.png');
const BELLY_EXTERNAL_IMG = require('@/assets/images/belly_external.png');
import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  SMALL_RADIUS, LARGE_RADIUS, LARGE_RUPTURE_PRESSURE,
  TOOLS, N_SMALL, N_LARGE,
  BELLY_STRIKE_TOOL_LIST, type BellyStrikeToolId,
  LETHAL_WEAPON_LIST, LETHAL_WEAPONS, type LethalWeaponId,
  BELLY_HIT_CX, BELLY_HIT_CY, BELLY_HIT_RX, BELLY_HIT_RY,
  BELLY_UPPER_LEFT, BELLY_UPPER_RIGHT, BELLY_UPPER_TOP, BELLY_UPPER_BOT,
} from '../constants/gameConfig';
import { buildSmoothPath } from '../engine/physics';
import { useGame, DEFAULT_DISPLAY_OPTIONS } from '../contexts/GameContext';
import type { CapsuleBombPhysics } from '../engine/physics';


const NAVEL_X = CANVAS_W / 2;
const NAVEL_Y_EXTERNAL = CAVITY_CY;
const NAVEL_Y_INTERNAL = CAVITY_CY;
const NAVEL_RADIUS = 28;

// Bullet hole textures (transparent PNG, black background removed)
const BULLET_HOLE_SMALL = require('../assets/images/bullet_hole_small.png'); // .22 / 9mm
const BULLET_HOLE_LARGE = require('../assets/images/bullet_hole_large.png'); // 7.62 / 12.7mm
const LARGE_CALIBER_IDS: LethalWeaponId[] = [LETHAL_WEAPONS.RIFLE_762, LETHAL_WEAPONS.SNIPER_127];

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
  // Use integer truncation (|0) instead of toFixed(1) — 5-8× faster number-to-string.
  // 1px precision is imperceptible at this simulation scale.
  return (
    `M${startX | 0},${startY | 0}` +
    ` Q${curr.x | 0},${curr.y | 0} ${midX | 0},${midY | 0}` +
    ` Q${next.x | 0},${next.y | 0} ${endX | 0},${endY | 0}`
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
    state, physicsRef, renderSnapshotRef, renderVersionRef, triggerDialogue, addElectrode,
    insertViaNavel, retractTool, setNavelPierced, setEnemaHeadIdx,
    setEnemaInSmall, setEnemaSmallHeadIdx, setEnemaTarget,
    setSiliconeTarget, setBeadsTarget, setEggTarget,
    toggleMesenteryNode, setResectionSelection,
    applyBellyStrike, applyGunshot, applyKatanaSlash,
    insertHookViaNavel, retractHook, activateHookGrab, clearExposedNodes,
    placeCapsuleBombInCavity, setCapsuleBombSwallowTarget, moveCavityBomb,
    clearExplosionPositions,
    setForcePierceMode, triggerForcePierce,
    insertViaPoint, cancelPickInsertionPoint,
  } = useGame();
  const lastDialogueTime = useRef(0);
  const isDragging = useRef(false);

  // Self-driven render loop: re-renders when physics snapshot updates via renderVersionRef.
  // This decouples SimulationCanvas from the global GameContext setState cadence.
  const [, forceRender] = useState(0);
  const lastSeenRenderVersion = useRef(-1);
  const canvasRafRef = useRef<number | null>(null);
  useEffect(() => {
    const tick = () => {
      if (renderVersionRef.current !== lastSeenRenderVersion.current) {
        lastSeenRenderVersion.current = renderVersionRef.current;
        forceRender(v => v + 1);
      }
      canvasRafRef.current = requestAnimationFrame(tick);
    };
    canvasRafRef.current = requestAnimationFrame(tick);
    return () => {
      if (canvasRafRef.current !== null) cancelAnimationFrame(canvasRafRef.current);
    };
  }, []); // intentionally empty — runs once, refs are stable

  // Weapon aiming drag state
  const gunAimDragRef = useRef<{
    active: boolean;
    aimPhysX: number;  // aim point in physics coords (offset by touchOffsetY)
    aimPhysY: number;
    fingerScreenX: number;
    fingerScreenY: number;
  }>({ active: false, aimPhysX: 0, aimPhysY: 0, fingerScreenX: 0, fingerScreenY: 0 });

  type GunAimOverlay = {
    aimPhysX: number; aimPhysY: number;
    sightType: 'iron' | 'scope';
    weaponId: LethalWeaponId;
    shockwaveRange: number;
  };
  const [gunAimOverlay, setGunAimOverlay] = useState<GunAimOverlay | null>(null);

  // Bullet holes (external view, persistent)
  const [bulletHoleAnims] = useState<Map<number, Animated.Value>>(() => new Map());

  // Exposed intestine expand throttle (used when grab tool pulls exposed nodes far from navel)
  const exposedExpandLastRef = useRef<number>(0);

  // Katana slash drag state
  const katanaDragRef = useRef<{
    active: boolean;
    startX: number; startY: number;
    endX: number; endY: number;
  }>({ active: false, startX: 0, startY: 0, endX: 0, endY: 0 });
  const [katanaSlashOverlay, setKatanaSlashOverlay] = useState<{
    x1: number; y1: number; x2: number; y2: number; halfWidth: number;
  } | null>(null);
  const katanaSweepAnim = useRef(new Animated.Value(0)).current;
  const [katanaSweepLine, setKatanaSweepLine] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);

  // Capsule bomb cavity drag state
  const capsuleBombDragRef = useRef<{
    active: boolean;
    id: number;
  }>({ active: false, id: -1 });

  // Explosion visual effect: animated rings at each bomb position
  const [explosionWaves, setExplosionWaves] = useState<WaveEntry[]>([]);
  const clearExplosionPositionsRef = useRef(clearExplosionPositions);
  clearExplosionPositionsRef.current = clearExplosionPositions;
  useEffect(() => {
    const positions = state.explosionPositions;
    if (!positions || positions.length === 0) return;
    const power = state.capsuleBombPower ?? 50;
    const baseR = 60 + power * 1.5;
    const newWaves: WaveEntry[] = positions.map(pos => {
      const id = ++waveIdRef.current;
      const anim = new Animated.Value(0);
      Animated.timing(anim, { toValue: 1, duration: 550, useNativeDriver: false })
        .start(() => setExplosionWaves(prev => prev.filter(w => w.id !== id)));
      return { id, physX: pos.x, physY: pos.y, maxR: baseR, anim };
    });
    setExplosionWaves(prev => [...prev, ...newWaves]);
    clearExplosionPositionsRef.current();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.explosionSeq]);

  // Initialize force pierce handle position when mode activates
  useEffect(() => {
    if (state.forcePierceMode) {
      const rodLen = 80 + state.toolParam1 * 1.0;
      const startDist = rodLen * 0.85;
      // Start directly above navel
      fpRef.current = { handle: { x: NAVEL_X, y: NAVEL_Y_EXTERNAL - startDist }, progress: 0, triggered: false, startDist };
      physicsRef.current.toolPos = { x: NAVEL_X, y: NAVEL_Y_EXTERNAL - startDist };
      setForcePierceProgress(0);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.forcePierceMode]);

  // Belly strike drag state
  const bellyStrikeDragRef = useRef<{
    active: boolean;
    physX: number;
    physY: number;
    screenX: number;
    screenY: number;
  }>({ active: false, physX: 0, physY: 0, screenX: 0, screenY: 0 });
  const electrodeDragRef = useRef<{ idx: number }>({ idx: -1 });
  const electrodeTapRef = useRef<{ x: number; y: number } | null>(null);
  const [strikeOverlay, setStrikeOverlay] = useState<{
    physX: number; physY: number;
    toolId: BellyStrikeToolId;
    rangePx: number;
    charging: boolean;
    rangeType: 'circle' | 'bat';
    id: number;
  } | null>(null);
  const [chargedOverlays, setChargedOverlays] = useState<Array<{
    physX: number; physY: number;
    toolId: BellyStrikeToolId;
    rangePx: number;
    charging: boolean;
    rangeType: 'circle' | 'bat';
    id: number;
  }>>([]);
  const strikeChargeAnim = useRef(new Animated.Value(0)).current;
  const strikeFlashAnim = useRef(new Animated.Value(0)).current;
  // Multiple concurrent strikes: overlayId for safe clear, waveId for per-wave anims
  const overlayIdRef = useRef(0);
  const waveIdRef = useRef(0);
  const [strikeWaves, setStrikeWaves] = useState<WaveEntry[]>([]);
  // Per-strike image animation: 0→1 (approach) → 2 (impact fade-out)
  const strikeAnimsRef = useRef<Map<number, Animated.Value>>(new Map());
  // Screen shake
  const shakeAnim = useRef(new Animated.Value(0)).current;
  // Flash color (varies with strike power)
  const [flashColor, setFlashColor] = useState('rgba(255,100,30,0.15)');

  // Force pierce mode state
  const fpRef = useRef<{ handle: { x: number; y: number }; progress: number; triggered: boolean; startDist: number }>(
    { handle: { x: NAVEL_X, y: NAVEL_Y_EXTERNAL - 80 }, progress: 0, triggered: false, startDist: 80 }
  );
  const [forcePierceProgress, setForcePierceProgress] = useState(0);

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
    applyBellyStrike,
    applyGunshot,
    applyKatanaSlash,
    insertHookViaNavel,
    retractHook,
    activateHookGrab,
    clearExposedNodes,
    placeCapsuleBombInCavity,
    setCapsuleBombSwallowTarget,
    moveCavityBomb,
    setForcePierceMode,
    triggerForcePierce,
    insertViaPoint,
    cancelPickInsertionPoint,
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
  hrRef.current.placeCapsuleBombInCavity = placeCapsuleBombInCavity;
  hrRef.current.setCapsuleBombSwallowTarget = setCapsuleBombSwallowTarget;
  hrRef.current.moveCavityBomb = moveCavityBomb;
  hrRef.current.toggleMesenteryNode = toggleMesenteryNode;
  hrRef.current.setResectionSelection = setResectionSelection;
  hrRef.current.applyBellyStrike = applyBellyStrike;
  hrRef.current.applyGunshot = applyGunshot;
  hrRef.current.applyKatanaSlash = applyKatanaSlash;
  hrRef.current.insertHookViaNavel = insertHookViaNavel;
  hrRef.current.retractHook = retractHook;
  hrRef.current.activateHookGrab = activateHookGrab;
  hrRef.current.clearExposedNodes = clearExposedNodes;
  hrRef.current.setForcePierceMode = setForcePierceMode;
  hrRef.current.triggerForcePierce = triggerForcePierce;
  hrRef.current.insertViaPoint = insertViaPoint;
  hrRef.current.cancelPickInsertionPoint = cancelPickInsertionPoint;

  // Returns true if (px, py) is inside the belly hit zone (ellipse or upper rect)
  const inBellyHitZone = (px: number, py: number): boolean => {
    const ex = (px - BELLY_HIT_CX) / BELLY_HIT_RX;
    const ey = (py - BELLY_HIT_CY) / BELLY_HIT_RY;
    if (ex * ex + ey * ey <= 1) return true;
    return px >= BELLY_UPPER_LEFT && px <= BELLY_UPPER_RIGHT
      && py >= BELLY_UPPER_TOP && py <= BELLY_UPPER_BOT;
  };

  // Clip end point of a line (x1,y1)→(x2,y2) to the belly ellipse boundary.
  // Assumes (x1,y1) is inside the ellipse. Returns the clipped end point.
  const clipEndToEllipse = (x1: number, y1: number, x2: number, y2: number): { x: number; y: number } => {
    const ux = (x1 - BELLY_HIT_CX) / BELLY_HIT_RX;
    const uy = (y1 - BELLY_HIT_CY) / BELLY_HIT_RY;
    const vx = (x2 - x1) / BELLY_HIT_RX;
    const vy = (y2 - y1) / BELLY_HIT_RY;
    const a = vx * vx + vy * vy;
    if (a < 1e-9) return { x: x2, y: y2 };
    const b = 2 * (ux * vx + uy * vy);
    const c = ux * ux + uy * uy - 1;
    const disc = b * b - 4 * a * c;
    if (disc < 0) return { x: x2, y: y2 };
    // start is inside (c<0), so we want the positive root
    const t = (-b + Math.sqrt(disc)) / (2 * a);
    if (t <= 0 || t > 1) return { x: x2, y: y2 }; // end is still inside
    return { x: x1 + t * (x2 - x1), y: y1 + t * (y2 - y1) };
  };

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
    onMoveShouldSetPanResponder: () => isDragging.current,
    onPanResponderGrant: (evt) => {
      const { state: s, toPhysicsCoords: tpc, addElectrode: ae, setEnemaHeadIdx: sehi,
              insertViaNavel: ivn, setNavelPierced: snp, triggerDialogue: td,
              toggleMesenteryNode: tmn } = hrRef.current;
      isDragging.current = true;
      const { locationX, locationY } = evt.nativeEvent;
      const touchOfsY = s.touchOffsetY ?? 0;
      const pos = tpc(locationX, locationY - touchOfsY);

      // Katana slash: if katana selected and start is inside belly hit zone
      if (s.selectedWeapon === '武士刀' && !s.resectionSelectionMode && !s.mesenterySelectionMode && !s.bellyStrikeTool) {
        if (!inBellyHitZone(pos.x, pos.y)) return;
        katanaDragRef.current = { active: true, startX: pos.x, startY: pos.y, endX: pos.x, endY: pos.y };
        setKatanaSlashOverlay({ x1: pos.x, y1: pos.y, x2: pos.x, y2: pos.y, halfWidth: s.katanaSlashWidth ?? 24 });
        return;
      }

      // Capsule bomb placement/drag
      if (s.selectedWeapon === '胶囊炸弹' && !s.resectionSelectionMode && !s.mesenterySelectionMode && !s.bellyStrikeTool) {
        const { placeCapsuleBombInCavity: placeBomb, setCapsuleBombSwallowTarget: setSwTarget } = hrRef.current;
        if (s.capsuleBombPlacementMode === 'cavity') {
          const bombs = physicsRef.current.capsuleBombs || [];
          const BOMB_PICK_R = 22;
          let pickedId = -1;
          for (const b of bombs) {
            if (b.mode !== 'cavity') continue;
            if (Math.hypot(b.cavityX - pos.x, b.cavityY - pos.y) < BOMB_PICK_R) {
              pickedId = b.id; break;
            }
          }
          if (pickedId >= 0) {
            capsuleBombDragRef.current = { active: true, id: pickedId };
          } else {
            // Always place at navel position (not at touch position)
            // Also allow tapping near navel to place
            const navelY = NAVEL_Y_EXTERNAL;
            const distToNavel = Math.hypot(pos.x - NAVEL_X, pos.y - navelY);
            const isNavelTap = distToNavel < NAVEL_RADIUS * 1.8;
            const ex = (pos.x - CAVITY_CX) / CAVITY_RX;
            const ey = (pos.y - CAVITY_CY) / CAVITY_RY;
            if (isNavelTap || ex * ex + ey * ey <= 1.0) {
              placeBomb(NAVEL_X, navelY);
            }
          }
        } else if (s.capsuleBombPlacementMode === 'swallow') {
          const bombs = physicsRef.current.capsuleBombs || [];
          const swallowBomb = bombs.find(b => b.mode === 'swallow');
          if (swallowBomb) {
            if (swallowBomb.inLarge) {
              const { idx, dist: d } = findNearestLargeNodeIdx(pos);
              if (idx >= 0 && d < 75) setSwTarget({ largeIdx: idx });
              const cecum = physicsRef.current.largeNodes[0];
              if (cecum && Math.hypot(cecum.x - pos.x, cecum.y - pos.y) < 55) setSwTarget({ inLarge: false });
            } else {
              const { idx, dist: d } = findNearestSmallNodeIdx(pos);
              if (idx >= 0 && d < 80) setSwTarget({ smallIdx: idx });
              const terminal = physicsRef.current.smallNodes[physicsRef.current.smallNodes.length - 1];
              const cecum = physicsRef.current.largeNodes[0];
              const tiD = terminal ? Math.hypot(terminal.x - pos.x, terminal.y - pos.y) : 9999;
              const cD = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
              if (Math.min(tiD, cD) < 55) setSwTarget({ inLarge: true, largeIdx: 0 });
            }
          }
        }
        return;
      }

      // Weapon aiming mode: finger down starts aiming; aim point offset by touchOffsetY
      if (s.selectedWeapon && !s.resectionSelectionMode && !s.mesenterySelectionMode && !s.bellyStrikeTool) {
        const def = LETHAL_WEAPON_LIST.find(w => w.id === s.selectedWeapon);
        if (def && !def.reserved) {
          const aimPos = tpc(locationX, locationY - touchOfsY);
          gunAimDragRef.current = { active: true, aimPhysX: aimPos.x, aimPhysY: aimPos.y, fingerScreenX: locationX, fingerScreenY: locationY };
          setGunAimOverlay({ aimPhysX: aimPos.x, aimPhysY: aimPos.y, sightType: def.sightType, weaponId: def.id, shockwaveRange: def.shockwaveRange });
          return;
        }
      }

      // Belly strike mode: capture position, show preview outline
      if (s.bellyStrikeTool && !s.resectionSelectionMode && !s.mesenterySelectionMode) {
        const toolDef = BELLY_STRIKE_TOOL_LIST.find(t => t.id === s.bellyStrikeTool);
        if (toolDef) {
          bellyStrikeDragRef.current = { active: true, physX: pos.x, physY: pos.y, screenX: locationX, screenY: locationY };
          const rangePx = toolDef.baseRangePx * (0.5 + s.bellyStrikeRange * 0.005);
          const dragId = ++overlayIdRef.current;
          setStrikeOverlay({ physX: pos.x, physY: pos.y, toolId: s.bellyStrikeTool, rangePx, charging: false, rangeType: toolDef.rangeType, id: dragId });
          return;
        }
      }

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

      // === Picking insertion point for needle/bayonet ===
      if (s.pickingInsertionPoint && (s.activeTool === TOOLS.NEEDLE || s.activeTool === TOOLS.BAYONET)) {
        const ex = (pos.x - BELLY_HIT_CX) / BELLY_HIT_RX;
        const ey = (pos.y - BELLY_HIT_CY) / BELLY_HIT_RY;
        const inLower = ex * ex + ey * ey <= 1.05;
        const inUpper = pos.x >= BELLY_UPPER_LEFT && pos.x <= BELLY_UPPER_RIGHT
          && pos.y >= BELLY_UPPER_TOP && pos.y <= BELLY_UPPER_BOT;
        if (inLower || inUpper) {
          hrRef.current.insertViaPoint(pos.x, pos.y);
        }
        return;
      }

      const navelY = isInternal ? NAVEL_Y_INTERNAL : NAVEL_Y_EXTERNAL;
      const distToNavel = Math.hypot(pos.x - NAVEL_X, pos.y - navelY);

      if (!isInternal && distToNavel < NAVEL_RADIUS) {
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
        // Hook tool insertion through pierced navel
        if (s.navelPierced && s.hookTool && !s.hookInserted) {
          hrRef.current.insertHookViaNavel();
          physicsRef.current.hookPos = { x: NAVEL_X, y: navelY - 60 };
          td('pain_low');
          return;
        }
        // Retract hook on navel tap when inserted
        if (s.hookInserted && distToNavel < NAVEL_RADIUS * 0.8) {
          hrRef.current.retractHook();
          return;
        }
      }
      // Internal view: tap near navel with metal rod/vibrator to insert when navel already pierced
      if (isInternal && distToNavel < NAVEL_RADIUS * 1.5) {
        if (s.navelPierced && (s.activeTool === TOOLS.METAL_ROD || s.activeTool === TOOLS.VIBRATOR)) {
          ivn();
          physicsRef.current.toolPos = { x: NAVEL_X, y: NAVEL_Y_INTERNAL - 40 };
          td('stirring');
          return;
        }
      }

      // Activate hook grab when tapping near hook head
      if (s.hookInserted && !s.hookGrabActive && s.hookTool) {
        const hp = physicsRef.current;
        if (hp.hookAnchor && hp.hookPos) {
          const HOOK_ROD_LEN = hp.hookRodLength || 90;
          const hdist = Math.hypot(hp.hookPos.x - hp.hookAnchor.x, hp.hookPos.y - hp.hookAnchor.y) || 1;
          const insideLen = Math.max(0, HOOK_ROD_LEN - hdist);
          const dx = (hp.hookAnchor.x - hp.hookPos.x) / hdist;
          const dy = (hp.hookAnchor.y - hp.hookPos.y) / hdist;
          const headX = hp.hookAnchor.x + dx * insideLen;
          const headY = hp.hookAnchor.y + dy * insideLen;
          if (Math.hypot(pos.x - headX, pos.y - headY) < 30) {
            hrRef.current.activateHookGrab();
            return;
          }
        }
      }

      physicsRef.current.toolPos = pos;

      if (s.activeTool === TOOLS.ELECTRIC) {
        const ELECTRODE_HIT_R = 22;
        const elecs = physicsRef.current.electrodes;
        let hitIdx = -1, hitDist = ELECTRODE_HIT_R;
        for (let ei = 0; ei < elecs.length; ei++) {
          const d = Math.hypot(elecs[ei].x - pos.x, elecs[ei].y - pos.y);
          if (d < hitDist) { hitDist = d; hitIdx = ei; }
        }
        if (hitIdx >= 0) {
          electrodeDragRef.current.idx = hitIdx;
          electrodeTapRef.current = null;
        } else {
          electrodeDragRef.current.idx = -1;
          electrodeTapRef.current = { x: pos.x, y: pos.y };
        }
        return;
      }
      if (s.activeTool === TOOLS.GRAB) {
        const grabRange = 20 + s.toolParam1 * 0.25;
        const isExternal = s.viewMode === 'external';
        const expSet = new Set(physicsRef.current.exposedSmallIndices);

        // 1. Check if touching near an existing clamp point marker (so user can re-drag it)
        const clampHitRange = Math.max(grabRange, 28);
        let hitClamp = -1, hitClampDist = clampHitRange;
        physicsRef.current.clampPoints.forEach((cp, ci) => {
          const nodes = cp.type === 'small' ? physicsRef.current.smallNodes : physicsRef.current.largeNodes;
          const n = nodes[cp.idx];
          if (!n) return;
          const d = Math.hypot(n.x - pos.x, n.y - pos.y);
          if (d < hitClampDist) { hitClampDist = d; hitClamp = ci; }
        });
        if (hitClamp >= 0) {
          physicsRef.current.activeClampIdx = hitClamp;
          // Update target to current touch
          physicsRef.current.clampPoints[hitClamp].tx = pos.x;
          physicsRef.current.clampPoints[hitClamp].ty = pos.y;
          return;
        }

        // 2. If there are pending clamp slots, next touch creates a new clamp point
        if (physicsRef.current.pendingClampCount > 0) {
          let closest = -1, closestDist = grabRange * 1.5, closestType: 'small' | 'large' = 'small';
          if (isExternal) {
            for (const i of physicsRef.current.exposedSmallIndices) {
              const n = physicsRef.current.smallNodes[i];
              if (!n) continue;
              const d = Math.hypot(n.x - pos.x, n.y - pos.y);
              if (d < closestDist) { closestDist = d; closest = i; closestType = 'small'; }
            }
          } else {
            physicsRef.current.smallNodes.forEach((n, i) => {
              if (expSet.has(i)) return;
              const d = Math.hypot(n.x - pos.x, n.y - pos.y);
              if (d < closestDist) { closestDist = d; closest = i; closestType = 'small'; }
            });
            physicsRef.current.largeNodes.forEach((n, i) => {
              const d = Math.hypot(n.x - pos.x, n.y - pos.y);
              if (d < closestDist) { closestDist = d; closest = i; closestType = 'large'; }
            });
          }
          if (closest >= 0) {
            const nodes = closestType === 'small' ? physicsRef.current.smallNodes : physicsRef.current.largeNodes;
            const n = nodes[closest];
            physicsRef.current.clampPoints.push({ type: closestType, idx: closest, tx: n.x, ty: n.y });
            physicsRef.current.activeClampIdx = physicsRef.current.clampPoints.length - 1;
            physicsRef.current.pendingClampCount = Math.max(0, physicsRef.current.pendingClampCount - 1);
            td('grab');
          }
          return;
        }

        // 3. Normal grab
        let closest = -1, closestDist = grabRange, closestType: 'small' | 'large' = 'small';
        if (isExternal) {
          // External view: only grab exposed small nodes (skip anchors for grab detection, include all for physics)
          for (const i of physicsRef.current.exposedSmallIndices) {
            const n = physicsRef.current.smallNodes[i];
            if (!n) continue;
            const d = Math.hypot(n.x - pos.x, n.y - pos.y);
            if (d < closestDist) { closestDist = d; closest = i; closestType = 'small'; }
          }
        } else {
          // Internal view: small nodes (skip exposed) + large nodes
          physicsRef.current.smallNodes.forEach((n, i) => {
            if (expSet.has(i)) return;
            const d = Math.hypot(n.x - pos.x, n.y - pos.y);
            if (d < closestDist) { closestDist = d; closest = i; closestType = 'small'; }
          });
          physicsRef.current.largeNodes.forEach((n, i) => {
            const d = Math.hypot(n.x - pos.x, n.y - pos.y);
            if (d < closestDist) { closestDist = d; closest = i; closestType = 'large'; }
          });
        }

        if (closest >= 0) {
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
      const touchOfsY = s.touchOffsetY ?? 0;
      const pos = tpc(locationX, locationY - touchOfsY);

      // Force pierce drag: handle moves freely (lever-style, no axis lock)
      if (s.forcePierceMode) {
        const DAMPING = 0.45;
        const FORCE_PIERCE_THRESHOLD = 35;
        const fp = fpRef.current;
        // Free movement in both X and Y
        fp.handle.x = fp.handle.x + (pos.x - fp.handle.x) * DAMPING;
        fp.handle.y = fp.handle.y + (pos.y - fp.handle.y) * DAMPING;
        physicsRef.current.toolPos = { x: fp.handle.x, y: fp.handle.y };
        // Depth = how far handle has moved toward navel from starting distance
        const currentDist = Math.hypot(fp.handle.x - NAVEL_X, fp.handle.y - NAVEL_Y_EXTERNAL);
        const depth = Math.max(0, fp.startDist - currentDist);
        fp.progress = Math.min(1, depth / FORCE_PIERCE_THRESHOLD);
        setForcePierceProgress(fp.progress);
        if (fp.progress >= 1 && !fp.triggered) {
          fp.triggered = true;
          hrRef.current.triggerForcePierce?.();
          setFlashColor('rgba(220,30,30,0.55)');
          strikeFlashAnim.setValue(1);
          Animated.timing(strikeFlashAnim, { toValue: 0, duration: 350, useNativeDriver: false }).start();
          shakeAnim.setValue(0);
          Animated.sequence([
            Animated.timing(shakeAnim, { toValue: 8, duration: 30, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: -7, duration: 40, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 4, duration: 30, useNativeDriver: true }),
            Animated.timing(shakeAnim, { toValue: 0, duration: 25, useNativeDriver: true }),
          ]).start();
        }
        return;
      }

      // Capsule bomb cavity bomb drag
      if (capsuleBombDragRef.current.active) {
        const { moveCavityBomb: mvBomb } = hrRef.current;
        const ex = (pos.x - CAVITY_CX) / CAVITY_RX;
        const ey = (pos.y - CAVITY_CY) / CAVITY_RY;
        if (ex * ex + ey * ey <= 1.0) mvBomb(capsuleBombDragRef.current.id, pos.x, pos.y);
        return;
      }
      // Capsule bomb swallow drag: continuously update target
      if (hrRef.current.state.selectedWeapon === '胶囊炸弹' && hrRef.current.state.capsuleBombPlacementMode === 'swallow') {
        const { setCapsuleBombSwallowTarget: setSwTarget } = hrRef.current;
        const bombs = physicsRef.current.capsuleBombs || [];
        const swallowBomb = bombs.find(b => b.mode === 'swallow');
        if (swallowBomb) {
          if (swallowBomb.inLarge) {
            const { idx, dist: d } = findNearestLargeNodeIdx(pos);
            if (idx >= 0 && d < 75) setSwTarget({ largeIdx: idx });
            const cecum = physicsRef.current.largeNodes[0];
            if (cecum && Math.hypot(cecum.x - pos.x, cecum.y - pos.y) < 55) setSwTarget({ inLarge: false });
          } else {
            const { idx, dist: d } = findNearestSmallNodeIdx(pos);
            if (idx >= 0 && d < 80) setSwTarget({ smallIdx: idx });
            const terminal = physicsRef.current.smallNodes[physicsRef.current.smallNodes.length - 1];
            const cecum = physicsRef.current.largeNodes[0];
            const tiD = terminal ? Math.hypot(terminal.x - pos.x, terminal.y - pos.y) : 9999;
            const cD = cecum ? Math.hypot(cecum.x - pos.x, cecum.y - pos.y) : 9999;
            if (Math.min(tiD, cD) < 55) setSwTarget({ inLarge: true, largeIdx: 0 });
          }
        }
      }

      // Katana slash drag: update end point, clipped to ellipse boundary
      if (katanaDragRef.current.active) {
        const { startX, startY } = katanaDragRef.current;
        const clipped = clipEndToEllipse(startX, startY, pos.x, pos.y);
        katanaDragRef.current.endX = clipped.x;
        katanaDragRef.current.endY = clipped.y;
        const { state: s2 } = hrRef.current;
        setKatanaSlashOverlay({ x1: startX, y1: startY, x2: clipped.x, y2: clipped.y, halfWidth: s2.katanaSlashWidth ?? 24 });
        return;
      }

      // Weapon aiming drag: update aim position
      if (gunAimDragRef.current.active) {
        const aimPos = tpc(locationX, locationY - touchOfsY);
        gunAimDragRef.current.aimPhysX = aimPos.x;
        gunAimDragRef.current.aimPhysY = aimPos.y;
        gunAimDragRef.current.fingerScreenX = locationX;
        gunAimDragRef.current.fingerScreenY = locationY;
        const def = LETHAL_WEAPON_LIST.find(w => w.id === s.selectedWeapon);
        if (def && !def.reserved) {
          setGunAimOverlay({ aimPhysX: aimPos.x, aimPhysY: aimPos.y, sightType: def.sightType, weaponId: def.id, shockwaveRange: def.shockwaveRange });
        }
        return;
      }

      // Belly strike drag: update overlay position
      if (bellyStrikeDragRef.current.active) {
        bellyStrikeDragRef.current.physX = pos.x;
        bellyStrikeDragRef.current.physY = pos.y;
        const toolDef = BELLY_STRIKE_TOOL_LIST.find(t => t.id === s.bellyStrikeTool);
        if (toolDef) {
          const rangePx = toolDef.baseRangePx * (0.5 + s.bellyStrikeRange * 0.005);
          setStrikeOverlay({ physX: pos.x, physY: pos.y, toolId: s.bellyStrikeTool!, rangePx, charging: false, rangeType: toolDef.rangeType, id: overlayIdRef.current });
        }
        return;
      }

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

      // Clamp point dragging: update target position while finger moves
      if (s.activeTool === TOOLS.GRAB && physicsRef.current.activeClampIdx >= 0) {
        const ci = physicsRef.current.activeClampIdx;
        const cp = physicsRef.current.clampPoints[ci];
        if (cp) {
          cp.tx = pos.x;
          cp.ty = pos.y;
        }
        return;
      }

      // Grab tool on exposed intestine: pulling far from navel exposes more nodes
      if (s.activeTool === TOOLS.GRAB && s.viewMode === 'external') {
        const gn = physicsRef.current.grabbedNode;
        if (gn && gn.type === 'small' && physicsRef.current.exposedSmallIndices.includes(gn.idx)) {
          const now = Date.now();
          if (now - exposedExpandLastRef.current > 500) {
            const distFromNavel = Math.hypot(pos.x - NAVEL_X, pos.y - NAVEL_Y_INTERNAL);
            if (distFromNavel > 80) {
              const expArr = physicsRef.current.exposedSmallIndices;
              exposedExpandLastRef.current = now;
              const maxIdx = physicsRef.current.smallNodes.length - 2;
              const minExp = expArr[0];
              const maxExp = expArr[expArr.length - 1];
              let changed = false;
              if (minExp > 1) { expArr.unshift(minExp - 1); changed = true; }
              if (maxExp < maxIdx) { expArr.push(maxExp + 1); changed = true; }
              if (changed) hrRef.current.triggerDialogue('expose_pulled');
            }
          }
        }
      }

      // Hook tool drag — dragging moves the handle (hookPos) which steers the lever
      if (physicsRef.current.hookInserted) {
        physicsRef.current.hookPos = { x: pos.x, y: pos.y };
        return;
      }

      // Electrode drag — move existing electrode
      if (s.activeTool === TOOLS.ELECTRIC) {
        const di = electrodeDragRef.current.idx;
        if (di >= 0 && di < physicsRef.current.electrodes.length) {
          physicsRef.current.electrodes[di].x = pos.x;
          physicsRef.current.electrodes[di].y = pos.y;
        } else if (electrodeTapRef.current) {
          const tp = electrodeTapRef.current;
          if (Math.hypot(pos.x - tp.x, pos.y - tp.y) > 12) {
            electrodeTapRef.current = null;
          }
        }
        physicsRef.current.toolPos = pos;
        return;
      }

      physicsRef.current.toolPos = pos;

      const now = Date.now();
      if (now - lastDialogueTime.current > 4000 && s.activeTool) {
        lastDialogueTime.current = now;
        if ((s.activeTool === TOOLS.METAL_ROD || s.activeTool === TOOLS.VIBRATOR) && physicsRef.current.toolInserted) {
          td('stirring');
        }
      }
    },
    onPanResponderRelease: () => {
      isDragging.current = false;

      // Electrode drag finalize / tap to place
      {
        const { state: s, addElectrode: ae2 } = hrRef.current;
        if (s.activeTool === TOOLS.ELECTRIC) {
          const di = electrodeDragRef.current.idx;
          electrodeDragRef.current.idx = -1;
          if (di >= 0) {
            return;
          }
          const tapPos = electrodeTapRef.current;
          electrodeTapRef.current = null;
          if (tapPos && ae2) {
            ae2(tapPos.x, tapPos.y);
          }
          return;
        }
      }

      // Capsule bomb cavity drag: drop bomb
      if (capsuleBombDragRef.current.active) {
        capsuleBombDragRef.current.active = false;
        return;
      }

      // Katana slash on release: trigger physics + effects
      if (katanaDragRef.current.active) {
        katanaDragRef.current.active = false;
        const { startX, startY, endX, endY } = katanaDragRef.current;
        setKatanaSlashOverlay(null);
        const { applyKatanaSlash: aks } = hrRef.current;
        const slashLen = Math.hypot(endX - startX, endY - startY);
        if (slashLen > 8 && aks) {
          aks(startX, startY, endX, endY);
        }
        // White flash
        setFlashColor('rgba(255,255,255,0.82)');
        strikeFlashAnim.setValue(1);
        Animated.timing(strikeFlashAnim, { toValue: 0, duration: 240, useNativeDriver: false }).start();
        // Screen shake
        shakeAnim.setValue(0);
        Animated.sequence([
          Animated.timing(shakeAnim, { toValue: 12, duration: 25, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -10, duration: 35, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 5, duration: 25, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: -3, duration: 20, useNativeDriver: true }),
          Animated.timing(shakeAnim, { toValue: 0, duration: 15, useNativeDriver: true }),
        ]).start();
        // Sweep glow line fades out
        if (slashLen > 8) {
          setKatanaSweepLine({ x1: startX, y1: startY, x2: endX, y2: endY });
          katanaSweepAnim.setValue(1);
          Animated.timing(katanaSweepAnim, { toValue: 0, duration: 350, useNativeDriver: false }).start(() => {
            setKatanaSweepLine(null);
          });
        }
        return;
      }

      // Weapon fire on release: instant fire at aim point
      if (gunAimDragRef.current.active) {
        gunAimDragRef.current.active = false;
        const { aimPhysX, aimPhysY } = gunAimDragRef.current;
        const { state: s, applyGunshot: agsh } = hrRef.current;
        setGunAimOverlay(null);
        const def = LETHAL_WEAPON_LIST.find(w => w.id === s.selectedWeapon);
        if (def && !def.reserved && agsh) {
          // Hit zone check — damage/physics only inside ellipse OR upper-belly rect
          const _dx = (aimPhysX - BELLY_HIT_CX) / BELLY_HIT_RX;
          const _dy = (aimPhysY - BELLY_HIT_CY) / BELLY_HIT_RY;
          const _inEllipse = _dx * _dx + _dy * _dy <= 1;
          const _inUpper = aimPhysX >= BELLY_UPPER_LEFT && aimPhysX <= BELLY_UPPER_RIGHT
            && aimPhysY >= BELLY_UPPER_TOP && aimPhysY <= BELLY_UPPER_BOT;
          if (_inEllipse || _inUpper) {
            agsh(aimPhysX, aimPhysY);
          }

          // Flash intensity based on weapon power (always fires)
          const fi = def.flashIntensity;
          const flashR = Math.round(255);
          const flashG = Math.round(255 * (1 - fi * 0.7));
          const flashB = Math.round(255 * (1 - fi * 0.9));
          const flashA = (0.08 + fi * 0.45).toFixed(2);
          setFlashColor(`rgba(${flashR},${flashG},${flashB},${flashA})`);
          strikeFlashAnim.setValue(1);
          Animated.timing(strikeFlashAnim, { toValue: 0, duration: fi > 0.5 ? 280 : 180, useNativeDriver: false }).start();

          // Screen shake for rifles
          if (def.shakeStrength > 0) {
            const d = def.shakeStrength;
            shakeAnim.setValue(0);
            Animated.sequence([
              Animated.timing(shakeAnim, { toValue: d, duration: 30, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: -d * 0.8, duration: 40, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: d * 0.45, duration: 30, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: -d * 0.2, duration: 24, useNativeDriver: true }),
              Animated.timing(shakeAnim, { toValue: 0, duration: 18, useNativeDriver: true }),
            ]).start();
          }

          // Expanding shockwave ring
          const maxR = def.shockwaveRange * 1.6;
          const waveId = ++waveIdRef.current;
          const waveAnim = new Animated.Value(0);
          setStrikeWaves(prev => [...prev, { id: waveId, physX: aimPhysX, physY: aimPhysY, maxR, anim: waveAnim }]);
          Animated.timing(waveAnim, {
            toValue: 1,
            duration: 350,
            useNativeDriver: false,
          }).start(() => setStrikeWaves(prev => prev.filter(w => w.id !== waveId)));
        }
        return;
      }

      // Belly strike on release: start charge animation, then apply at delayMs
      if (bellyStrikeDragRef.current.active) {
        bellyStrikeDragRef.current.active = false;
        const { physX, physY } = bellyStrikeDragRef.current;
        const { state: s, applyBellyStrike: abs } = hrRef.current;
        const toolDef = BELLY_STRIKE_TOOL_LIST.find(t => t.id === s.bellyStrikeTool);
        if (toolDef && abs) {
          const rangePx = toolDef.baseRangePx * (0.5 + s.bellyStrikeRange * 0.005);
          // Compute flash color and shake intensity based on power (approximate baseDamage)
          const toolPowerScale = ((s.bellyStrikeToolPowers ?? {})[s.bellyStrikeTool!] ?? 100) / 100;
          const forceMult = 0.3 + s.bellyStrikeForce * 0.007;
          const approxDamage = 50 * forceMult * toolDef.powerMult * toolPowerScale * ((s.bellyStrikeImpulseScale ?? 100) / 100);
          const fi = Math.min(1, approxDamage / 55);
          const cFlash = `rgba(255,${Math.round(95 - fi * 80)},${Math.round(20 - fi * 15)},${(0.12 + fi * 0.28).toFixed(2)})`;
          const shakeStrength = Math.min(16, approxDamage * 0.3);
          // Unique ID for this overlay so only it clears it
          const capturedOverlayId = ++overlayIdRef.current;
          // Move current drag overlay to chargedOverlays so it persists while charging
          setStrikeOverlay(null);
          setChargedOverlays(prev => [...prev, { physX, physY, toolId: s.bellyStrikeTool!, rangePx, charging: true, rangeType: toolDef.rangeType, id: capturedOverlayId }]);
          strikeChargeAnim.setValue(0);
          Animated.timing(strikeChargeAnim, { toValue: 1, duration: toolDef.delayMs, useNativeDriver: false }).start();
          // Strike image animation: shrink from 3× ghost → 1× impact, then punch-through fade
          const strikeAnim = new Animated.Value(0);
          strikeAnimsRef.current.set(capturedOverlayId, strikeAnim);
          Animated.sequence([
            Animated.timing(strikeAnim, {
              toValue: 1,
              duration: toolDef.delayMs,
              easing: Easing.in(Easing.cubic),
              useNativeDriver: false,
            }),
            Animated.timing(strikeAnim, {
              toValue: 2,
              duration: 110,
              easing: Easing.out(Easing.quad),
              useNativeDriver: false,
            }),
          ]).start();
          // No clearTimeout — allow multiple concurrent strikes
          setTimeout(() => {
            abs(physX, physY);
            // Flash with power-based color
            setFlashColor(cFlash);
            strikeFlashAnim.setValue(1);
            Animated.timing(strikeFlashAnim, { toValue: 0, duration: 380, useNativeDriver: false }).start();
            // Use independent setTimeout to remove overlay — animation callback is unreliable
            // when multiple concurrent strikes share strikeFlashAnim
            setTimeout(() => {
              setChargedOverlays(prev => prev.filter(o => o.id !== capturedOverlayId));
              strikeAnimsRef.current.delete(capturedOverlayId);
            }, 420);
            // Screen shake scaled by power
            if (shakeStrength > 1.5) {
              const d = shakeStrength;
              shakeAnim.setValue(0);
              Animated.sequence([
                Animated.timing(shakeAnim, { toValue: d, duration: 35, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -d * 0.7, duration: 45, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: d * 0.4, duration: 35, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: -d * 0.18, duration: 28, useNativeDriver: true }),
                Animated.timing(shakeAnim, { toValue: 0, duration: 22, useNativeDriver: true }),
              ]).start();
            }
            // Expanding shockwave ring (independent entry with own Animated.Value)
            const maxR = rangePx * 1.8;
            const waveId = ++waveIdRef.current;
            const waveAnim = new Animated.Value(0);
            setStrikeWaves(prev => [...prev, { id: waveId, physX, physY, maxR, anim: waveAnim }]);
            Animated.timing(waveAnim, {
              toValue: 1,
              duration: Math.max(300, maxR / toolDef.baseRangePx * 280),
              useNativeDriver: false,
            }).start(() => setStrikeWaves(prev => prev.filter(w => w.id !== waveId)));
          }, toolDef.delayMs);
        }
        return;
      }

      if (!physicsRef.current.toolInserted) {
        physicsRef.current.toolPos = null;
      }
      physicsRef.current.grabbedNode = null;
      physicsRef.current.activeClampIdx = -1; // stop dragging clamp, but leave it in place
    },
  })).current;

  const {
    mesenterySelectionMode, mesenterySelectedNodes,
    parasites,
    resectionSelectionMode, resectionIntestine, resectionStartSeg, resectionEndSeg,
  } = state;
  const isInternal = state.viewMode === 'internal';

  // Live tool state — read directly from physicsRef so SimulationCanvas always sees
  // the current values even between slow-path setState calls (every 15 physics frames).
  const p = physicsRef.current;
  const activeTool = p.toolType;
  const toolPos = p.toolPos;
  const toolInserted = p.toolInserted;
  const toolAnchor = p.toolAnchor;
  const toolActive = p.toolActive;
  const toolParam1 = p.toolParam1;
  const toolParam2 = p.toolParam2;
  const toolStates = p.toolStates;
  const navelPierced = p.navelPierced;
  const expansionScale = p.expansionScale;
  const enemaHeadIdx = p.enemaHeadIdx;
  const enemaInSmall = p.enemaInSmall;
  const enemaSmallHeadIdx = p.enemaSmallHeadIdx;
  const siliconeHeadIdx = p.siliconeHeadIdx;
  const siliconeInSmall = p.siliconeInSmall;
  const siliconeSmallHeadIdx = p.siliconeSmallHeadIdx;
  const beadsHeadIdx = p.beadsHeadIdx;
  const beadsInSmall = p.beadsInSmall;
  const beadsSmallHeadIdx = p.beadsSmallHeadIdx;
  const eggSmallHeadIdx = p.eggSmallHeadIdx;
  const eggInLarge = p.eggInLarge;
  const eggLargeHeadIdx = p.eggLargeHeadIdx;
  const repairMarks = p.repairMarks;
  const sutureMarks = p.sutureMarks;
  const largeRepairMarks = p.largeRepairMarks;
  const largeSutureMarks = p.largeSutureMarks;
  const smallTransplantColor = p.smallTransplantColor;
  const largeTransplantColor = p.largeTransplantColor;
  const resectedSmallRanges = p.resectedSmallRanges;
  const resectedLargeRanges = p.resectedLargeRanges;

  // Read render data from the pre-allocated snapshot (zero-alloc per frame)
  const snap = renderSnapshotRef.current;
  const renderSmallNodes = snap.smallNodes;
  const renderLargeNodes = snap.largeNodes;
  const renderSmallSegs = snap.smallSegs;
  const renderLargeSegs = snap.largeSegs;
  const periScaleSmall = snap.periScaleSmall;
  const periScaleLarge = snap.periScaleLarge;

  const dispOpts = state.displayOptions ?? DEFAULT_DISPLAY_OPTIONS;

  const avgPain = snap.avgPain;
  const avgPressure = snap.avgPressure;
  const bulge = 1 + avgPressure * 0.003;
  // expansionScale defined above from physicsRef

  const breathVal = snap.breathVal;
  const breathAmp = state.breathAmplitude;
  const inhale = (breathVal + 1) / 2;
  // Image: x=-80 centers 500px img on 340px canvas. Adjusted y downward per user feedback.
  const breathImgOffsetY = -170 - inhale * 5 * breathAmp;
  const breathImgH = 715 + inhale * 14 * breathAmp;
  const navelYBreath = NAVEL_Y_EXTERNAL - inhale * 5 * breathAmp;
  const breathOverlayScale = 1 + inhale * 0.025 * breathAmp;

  const handlePos = toolPos;
  const renderTime = renderVersionRef.current;

  const enemaVisible = (state.enabledTools ?? []).includes(TOOLS.ENEMA) || toolStates?.[TOOLS.ENEMA]?.active === true;
  const electricIndepActive = toolStates?.[TOOLS.ELECTRIC]?.active === true;

  // Tube path: from head position outward toward anus (entry point)
  // This represents the physical tube that has been inserted
  const enemaPathLarge = (() => {
    if (!enemaVisible || renderLargeNodes.length === 0) return '';
    const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, enemaHeadIdx));
    // slice from head to anus end (higher indices = toward anus)
    return buildSmoothPath(renderLargeNodes.slice(headIdx));
  })();
  // Fluid fill path: fluid emanates FROM the head toward cecum (index 0)
  // Only visible when enema is actively injecting (toolActive)
  const enemaFillPath = (() => {
    if (!enemaVisible || renderLargeNodes.length === 0) return '';
    if (enemaInSmall) return '';
    const isActive = toolActive || toolStates?.[TOOLS.ENEMA]?.active === true;
    if (!isActive) return '';
    const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, enemaHeadIdx));
    if (headIdx <= 1) return '';
    // Fill from cecum (0) to head — fluid accumulating ahead of the tip
    return buildSmoothPath(renderLargeNodes.slice(0, headIdx + 1));
  })();
  const enemaPathSmall = (() => {
    if (!enemaVisible || !enemaInSmall || renderSmallNodes.length === 0) return '';
    const smallHeadIdx = Math.max(0, Math.min(renderSmallNodes.length - 1, enemaSmallHeadIdx));
    return buildSmoothPath([...renderSmallNodes.slice(smallHeadIdx)].reverse());
  })();
  const enemaHead = enemaVisible
    ? (enemaInSmall && renderSmallNodes.length > 0
        ? renderSmallNodes[Math.max(0, Math.min(renderSmallNodes.length - 1, enemaSmallHeadIdx))]
        : renderLargeNodes[Math.max(0, Math.min(renderLargeNodes.length - 1, enemaHeadIdx))])
    : null;
  const enemaHeadInSmall = enemaVisible && enemaInSmall;

  const ELEC_CTRL_X = 36;
  const ELEC_CTRL_Y = CANVAS_H - 38;

  const rodGeo = (() => {
    if (!handlePos) return null;
    const tool = activeTool;
    if (tool === TOOLS.METAL_ROD) {
      const rodLen = 80 + toolParam1 * 1.0;
      const stirAmp = toolActive ? 2 + toolParam2 * 0.04 : 0;
      return { g: computeRodGeoFor(toolInserted, toolAnchor, handlePos, rodLen, stirAmp, renderTime), radius: 9 };
    }
    if (tool === TOOLS.VIBRATOR) {
      // Fixed length; no wobble (stirAmp=0) — vibration is a radial physics effect, not a swing
      const rodLen = 120;
      return { g: computeRodGeoFor(toolInserted, toolAnchor, handlePos, rodLen, 0, renderTime), radius: 9 };
    }
    if (tool === TOOLS.NEEDLE) {
      const rodLen = 90 + toolParam1 * 1.0;
      // Auto-activates when inserted — no manual toggle
      const stirAmp = toolInserted ? 1.5 + toolParam2 * 0.04 : 0;
      return { g: computeRodGeoFor(toolInserted, toolAnchor, handlePos, rodLen, stirAmp, renderTime), radius: 5 };
    }
    if (tool === TOOLS.BAYONET) {
      const bladeLen = 80 + toolParam1 * 1.5;
      const stirAmp = toolActive ? 3 + toolParam2 * 0.04 : 0;
      return { g: computeRodGeoFor(toolInserted, toolAnchor, handlePos, bladeLen, stirAmp, renderTime), radius: 4 };
    }
    return null;
  })();

  // Silicone rod paths — use siliconeHeadIdx (independent from enema)
  const siliconeVisible = (state.enabledTools ?? []).includes(TOOLS.SILICONE_ROD);
  const siliconePathLarge = (() => {
    if (!siliconeVisible || renderLargeNodes.length === 0) return '';
    const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, siliconeHeadIdx));
    return buildSmoothPath(renderLargeNodes.slice(headIdx));
  })();
  const siliconePathSmall = (() => {
    if (!siliconeVisible || !siliconeInSmall || renderSmallNodes.length === 0) return '';
    const smallHeadIdx = Math.max(0, Math.min(renderSmallNodes.length - 1, siliconeSmallHeadIdx));
    return buildSmoothPath([...renderSmallNodes.slice(smallHeadIdx)].reverse());
  })();
  const siliconeHead = siliconeVisible
    ? (siliconeInSmall && renderSmallNodes.length > 0
        ? renderSmallNodes[Math.max(0, Math.min(renderSmallNodes.length - 1, siliconeSmallHeadIdx))]
        : renderLargeNodes[Math.max(0, Math.min(renderLargeNodes.length - 1, siliconeHeadIdx))])
    : null;

  // Vibrating egg paths — control line runs from duodenum (node 0) to egg head
  const eggVisible = (state.enabledTools ?? []).includes(TOOLS.VIBRATING_EGG);
  const eggHeadNode = (() => {
    if (!eggVisible || renderSmallNodes.length === 0) return null;
    if (eggInLarge && renderLargeNodes.length > 0) {
      const idx = Math.max(0, Math.min(renderLargeNodes.length - 1, eggLargeHeadIdx));
      return renderLargeNodes[idx];
    }
    const idx = Math.max(0, Math.min(renderSmallNodes.length - 1, eggSmallHeadIdx));
    return renderSmallNodes[idx];
  })();
  const eggTangentAngle = (() => {
    if (!eggVisible) return 0;
    if (eggInLarge && renderLargeNodes.length > 1) {
      const idx = Math.max(0, Math.min(renderLargeNodes.length - 1, eggLargeHeadIdx));
      const prev = renderLargeNodes[Math.max(0, idx - 1)];
      const next = renderLargeNodes[Math.min(renderLargeNodes.length - 1, idx + 1)];
      return Math.atan2(next.y - prev.y, next.x - prev.x) * 180 / Math.PI;
    }
    if (renderSmallNodes.length > 1) {
      const idx = Math.max(0, Math.min(renderSmallNodes.length - 1, eggSmallHeadIdx));
      const prev = renderSmallNodes[Math.max(0, idx - 1)];
      const next = renderSmallNodes[Math.min(renderSmallNodes.length - 1, idx + 1)];
      return Math.atan2(next.y - prev.y, next.x - prev.x) * 180 / Math.PI;
    }
    return 0;
  })();
  // Control line: follows intestine path from duodenum (small node 0) to egg head
  const eggControlLinePath = (() => {
    if (!eggVisible || renderSmallNodes.length === 0) return '';
    if (!eggInLarge) {
      const idx = Math.max(0, Math.min(renderSmallNodes.length - 1, eggSmallHeadIdx));
      if (idx < 1) return '';
      return buildSmoothPath(renderSmallNodes.slice(0, idx + 1));
    }
    // In large intestine: full small intestine path + large intestine from 0 to egg
    const smallPath = buildSmoothPath(renderSmallNodes);
    const largeIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, eggLargeHeadIdx));
    if (largeIdx < 1) return smallPath;
    const largePath = buildSmoothPath(renderLargeNodes.slice(0, largeIdx + 1));
    return smallPath + ' ' + largePath;
  })();

  // Suspended tools: enabled tools that are not the current activeTool, rendered at their last position
  const suspendedTools = Object.entries(toolStates ?? {}).filter(([id, ts]) => {
    if (id === activeTool) return false;
    return (state.enabledTools ?? []).includes(id as any) && ts.pos != null;
  });

  // === PATH PRE-COMPUTATION ===
  // Build all segment path strings ONCE per render frame.
  // Avoids calling buildSmoothSegPath twice per segment (outline + fill passes).
  // Fixed-color passes (outline, highlight) are merged into single combined path strings,
  // reducing SVG element count from ~257 to ~100 per frame — the primary mobile bottleneck.
  const nSmallSegs = renderSmallSegs.length;
  const nLargeSegs = renderLargeSegs.length;
  const smallSegPaths: string[] = new Array(nSmallSegs).fill('');
  const largeSegPaths: string[] = new Array(nLargeSegs).fill('');
  const _smallParts: string[] = [];
  const _largeHighParts: string[] = [];

  for (let i = 0; i < nSmallSegs; i++) {
    const seg = renderSmallSegs[i];
    if (i >= renderSmallNodes.length - 1 || seg.broken || seg.resected) continue;
    const d = buildSmoothSegPath(renderSmallNodes, i);
    if (d) { smallSegPaths[i] = d; _smallParts.push(d); }
  }
  for (let i = 0; i < nLargeSegs; i++) {
    const seg = renderLargeSegs[i];
    if (i >= renderLargeNodes.length - 1 || seg.broken || seg.resected) continue;
    const d = buildSmoothSegPath(renderLargeNodes, i);
    if (d) { largeSegPaths[i] = d; _largeHighParts.push(d); }
  }
  // Single merged path strings for fixed-color passes (outline & highlight)
  const smallCombinedOutline = _smallParts.join(' ');
  const smallCombinedHighlight = smallCombinedOutline;
  const largeCombinedHighlight = _largeHighParts.join(' ');

  // === MOBILE: CHUNK-BASED INTESTINE RENDERING ===
  // react-native-svg creates a native view per SVG element — 96 individual Path elements
  // per frame (65 small + 31 large) saturates the React Native bridge at 10fps on device.
  // Solution: on mobile, merge segments into 8 chunks (small) + 4 chunks (large) = 12 paths.
  // Each chunk uses the average color & width of its segments; peristalsis motion is preserved
  // (node positions still move). Web keeps full per-segment rendering unchanged.
  const isMobile = Platform.OS !== 'web';
  type ChunkPath = { d: string; color: string; width: number };
  const smallChunkPaths: ChunkPath[] = [];
  const largeChunkPaths: ChunkPath[] = [];

  if (isMobile) {
    const S_CHUNKS = Math.max(1, Math.min(16, dispOpts.smallChunks));
    const sChunkSize = Math.ceil(nSmallSegs / S_CHUNKS);
    for (let c = 0; c < S_CHUNKS; c++) {
      const start = c * sChunkSize;
      const end = Math.min(start + sChunkSize, nSmallSegs);
      let chunkD = '';
      let sumH = 0, sumPa = 0, sumPr = 0, sumPeri = 0, cnt = 0;
      for (let i = start; i < end; i++) {
        const seg = renderSmallSegs[i];
        if (!smallSegPaths[i] || seg.broken || seg.resected) continue;
        chunkD += (chunkD ? ' ' : '') + smallSegPaths[i];
        sumH += seg.health; sumPa += seg.pain; sumPr += seg.pressure;
        sumPeri += dispOpts.smallPeristalsis ? (periScaleSmall?.[i] ?? 1) : 1;
        cnt++;
      }
      if (cnt > 0 && chunkD) {
        const avgH = sumH / cnt, avgPa = sumPa / cnt, avgPr = sumPr / cnt, avgPeri = sumPeri / cnt;
        smallChunkPaths.push({
          d: chunkD,
          color: dispOpts.smallColorVariation
            ? segmentColor(avgH, avgPa, avgPr, false, false, false, false, smallTransplantColor ?? undefined)
            : '#c07060',
          width: SMALL_RADIUS * avgPeri * 2 + (avgPr / 100) * SMALL_RADIUS * expansionScale,
        });
      }
    }

    const L_CHUNKS = Math.max(1, Math.min(8, dispOpts.largeChunks));
    const lChunkSize = Math.ceil(nLargeSegs / L_CHUNKS);
    for (let c = 0; c < L_CHUNKS; c++) {
      const start = c * lChunkSize;
      const end = Math.min(start + lChunkSize, nLargeSegs);
      let chunkD = '';
      let sumH = 0, sumPa = 0, sumPr = 0, sumPeri = 0, cnt = 0;
      for (let i = start; i < end; i++) {
        const seg = renderLargeSegs[i];
        if (!largeSegPaths[i] || seg.broken || seg.resected) continue;
        chunkD += (chunkD ? ' ' : '') + largeSegPaths[i];
        sumH += seg.health; sumPa += seg.pain; sumPr += seg.pressure;
        sumPeri += dispOpts.smallPeristalsis ? (periScaleLarge?.[i] ?? 1) : 1;
        cnt++;
      }
      if (cnt > 0 && chunkD) {
        const avgH = sumH / cnt, avgPa = sumPa / cnt, avgPr = sumPr / cnt, avgPeri = sumPeri / cnt;
        largeChunkPaths.push({
          d: chunkD,
          color: dispOpts.largeColorVariation
            ? segmentColor(avgH, avgPa, avgPr, false, false, false, true, largeTransplantColor ?? undefined)
            : '#b86858',
          width: LARGE_RADIUS * avgPeri * 2 + (avgPr / LARGE_RUPTURE_PRESSURE) * LARGE_RADIUS * expansionScale,
        });
      }
    }
  }


  return (
    <Animated.View
      style={[styles.container, { transform: [{ translateX: shakeAnim }] }]}
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
            {state.showBackground === 1 && (
              <SvgImage
                href={BELLY_EXTERNAL_IMG}
                x={-80} y={breathImgOffsetY}
                width={500} height={breathImgH}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            {state.showBackground === 2 && (
              <SvgImage
                href={INTESTINES_REF}
                x={CAVITY_CX - CANVAS_W * 0.9} y={CAVITY_CY - CANVAS_W * 1.32}
                width={CANVAS_W * 1.8} height={CANVAS_W * 2.4}
                preserveAspectRatio="xMidYMid meet" opacity={0.50}
              />
            )}
          </G>
        ) : (
          <G>
            {state.showBackground === 1 && (
              /* External view belly image. x=-80 centers 500px img on 340px canvas.
                 y=-189 places navel at CAVITY_CY=248: 0.609*715-189=248. */
              <SvgImage
                href={BELLY_EXTERNAL_IMG}
                x={-80} y={breathImgOffsetY}
                width={500} height={breathImgH}
                preserveAspectRatio="xMidYMid meet"
              />
            )}
            {state.showBackground === 2 && (
              <SvgImage
                href={INTESTINES_REF}
                x={CAVITY_CX - CANVAS_W * 0.9} y={CAVITY_CY - CANVAS_W * 1.32}
                width={CANVAS_W * 1.8} height={CANVAS_W * 2.4}
                preserveAspectRatio="xMidYMid meet" opacity={0.50}
              />
            )}
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
            {((activeTool === TOOLS.METAL_ROD || activeTool === TOOLS.VIBRATOR) && navelPierced) && (
              <Circle cx={NAVEL_X} cy={navelYBreath} r={NAVEL_RADIUS}
                fill="none" stroke="rgba(255,180,80,0.5)" strokeWidth={1.5} strokeDasharray="3 3" />
            )}
            {navelPierced && (
              <G>
                <Line x1={NAVEL_X} y1={navelYBreath - 14}
                  x2={NAVEL_X} y2={navelYBreath + 14}
                  stroke="#dcdcdc" strokeWidth={2.5} strokeLinecap="round" />
                <Circle cx={NAVEL_X} cy={navelYBreath - 14} r={3} fill="#f0f0f0" />
                <Circle cx={NAVEL_X} cy={navelYBreath + 14} r={3} fill="#f0f0f0" />
              </G>
            )}

            {/* Picking insertion point mode — highlight belly area */}
            {state.pickingInsertionPoint && (activeTool === TOOLS.NEEDLE || activeTool === TOOLS.BAYONET) && (
              <G>
                <Ellipse
                  cx={BELLY_HIT_CX} cy={BELLY_HIT_CY}
                  rx={BELLY_HIT_RX} ry={BELLY_HIT_RY}
                  fill="rgba(220,60,60,0.07)"
                  stroke="rgba(255,140,80,0.75)"
                  strokeWidth={1.8}
                  strokeDasharray="6 3"
                />
                <Circle cx={BELLY_HIT_CX} cy={BELLY_HIT_CY} r={4}
                  fill="rgba(255,140,80,0.4)" stroke="rgba(255,140,80,0.7)" strokeWidth={1} />
              </G>
            )}

            {/* Stab wounds — needle/bayonet non-navel insertion marks */}
            {state.stabWounds && state.stabWounds.map(wound => (
              <G key={`stab-ext-${wound.id}`}>
                <Circle cx={wound.physX} cy={wound.physY} r={7}
                  fill="rgba(100,0,0,0.50)" />
                <Circle cx={wound.physX} cy={wound.physY} r={3.5}
                  fill="rgba(15,0,0,0.90)" stroke="rgba(160,20,20,0.75)" strokeWidth={1} />
                <Line x1={wound.physX - 4} y1={wound.physY}
                  x2={wound.physX + 4} y2={wound.physY}
                  stroke="rgba(10,0,0,0.95)" strokeWidth={1.5} />
                <Line x1={wound.physX} y1={wound.physY - 4}
                  x2={wound.physX} y2={wound.physY + 4}
                  stroke="rgba(10,0,0,0.95)" strokeWidth={1.5} />
              </G>
            ))}
            {state.renderSmallSegs.filter(s => s.ruptured).slice(0, 3).map((_, i) => (
              <Ellipse key={`rup-${i}`}
                cx={CANVAS_W * (0.35 + i * 0.15)} cy={navelYBreath * (0.95 + i * 0.05)}
                rx={14 + i * 3} ry={8 + i * 2}
                fill="rgba(140,20,20,0.55)" />
            ))}

            {/* Debug: belly hit zone wireframe (blue dashed) */}
            {state.debugMode && (
              <G>
                {/* Lower zone — ellipse */}
                <Ellipse
                  cx={BELLY_HIT_CX} cy={BELLY_HIT_CY}
                  rx={BELLY_HIT_RX} ry={BELLY_HIT_RY}
                  fill="rgba(60,120,255,0.06)"
                  stroke="rgba(60,140,255,0.85)"
                  strokeWidth={1.5}
                  strokeDasharray="8 4"
                />
                {/* Upper zone — rectangle */}
                <Rect
                  x={BELLY_UPPER_LEFT} y={BELLY_UPPER_TOP}
                  width={BELLY_UPPER_RIGHT - BELLY_UPPER_LEFT}
                  height={BELLY_UPPER_BOT - BELLY_UPPER_TOP}
                  fill="rgba(60,120,255,0.06)"
                  stroke="rgba(60,140,255,0.85)"
                  strokeWidth={1.5}
                  strokeDasharray="8 4"
                />
              </G>
            )}
          </G>
        )}

        {/* ===== INTERNAL ORGANS LAYER ===== */}
        {isInternal && (
          <G clipPath="url(#cavityClip)">
            {/* Intestine anatomical background image — zoomed to fill cavity, stomach top-aligned */}
            <SvgImage
              href={INTESTINES_REF}
              x={CAVITY_CX - CANVAS_W * 0.9} y={CAVITY_CY - CANVAS_W * 1.32}
              width={CANVAS_W * 1.8} height={CANVAS_W * 2.4}
              preserveAspectRatio="xMidYMid meet" opacity={0.50} />
            <Ellipse cx={CAVITY_CX} cy={CAVITY_CY} rx={CAVITY_RX - 2} ry={CAVITY_RY - 2}
              fill="none" stroke="#3a1010" strokeWidth={4} />

            {/* ===== LARGE INTESTINE — per-segment rendering (original approach) ===== */}
            {/* Each segment rendered independently: adjacent round caps overlap at midpoints
                creating natural segment dividers without any explicit line marks. */}
            {renderLargeSegs.map((seg, i) => {
              const d = largeSegPaths[i];
              if (!d) return null;
              if (seg.broken) return null;
              const lPeriScale = dispOpts.smallPeristalsis ? (periScaleLarge?.[i] ?? 1) : 1;
              const w = LARGE_RADIUS * lPeriScale * 2 + (seg.pressure / LARGE_RUPTURE_PRESSURE) * LARGE_RADIUS * expansionScale;
              const col = dispOpts.largeColorVariation
                ? segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, seg.perforated, true, largeTransplantColor ?? undefined)
                : '#b86858';
              return (
                <G key={`lg-${i}`}>
                  <Path d={d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {dispOpts.largeHighlight && (
                    <Path d={d} stroke="rgba(255,200,175,0.22)" strokeWidth={LARGE_RADIUS * 0.65} fill="none" strokeLinecap="round" />
                  )}
                </G>
              );
            })}

            {/* Ileocecal junction — visible tube connecting terminal ileum to cecum */}
            {dispOpts.ileocecalJunction && renderSmallNodes.length > 0 && renderLargeNodes.length > 0 && (() => {
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
            {dispOpts.cecumCap && renderLargeNodes.length > 0 && (() => {
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

            {/* Large intestine perforation markers */}
            {dispOpts.perforationMarkers && renderLargeSegs.map((seg, i) =>
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
            {dispOpts.breakMarkers && renderLargeSegs.map((seg, i) => {
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

            {/* ===== SMALL INTESTINE — per-segment rendering (original approach) ===== */}
            {/* Pass 1: outline casing — per-segment, slightly wider than fill.
                Adjacent outlines' round caps overlap at each segment midpoint,
                creating the natural plicae circulares divider rings. */}
            {dispOpts.smallOutline && renderSmallSegs.map((seg, i) => {
              const d = smallSegPaths[i];
              if (!d) return null;
              if (seg.broken || seg.resected) return null;
              const sPeriScale = dispOpts.smallPeristalsis ? (periScaleSmall?.[i] ?? 1) : 1;
              const w = SMALL_RADIUS * sPeriScale * 2 + (seg.pressure / 100) * SMALL_RADIUS * expansionScale;
              return (
                <Path key={`sm-out-${i}`} d={d}
                  stroke="rgba(175, 100, 80, 0.55)"
                  strokeWidth={w + 3.5}
                  fill="none" strokeLinecap="round" strokeLinejoin="round" />
              );
            })}
            {/* Pass 2: fill + highlight — per-segment, same path, narrower */}
            {renderSmallSegs.map((seg, i) => {
              const d = smallSegPaths[i];
              if (!d) return null;
              if (seg.broken || seg.resected) return null;
              const sPeriScale = dispOpts.smallPeristalsis ? (periScaleSmall?.[i] ?? 1) : 1;
              const w = SMALL_RADIUS * sPeriScale * 2 + (seg.pressure / 100) * SMALL_RADIUS * expansionScale;
              const col = dispOpts.smallColorVariation
                ? segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, seg.perforated, false, smallTransplantColor ?? undefined)
                : '#c07060';
              return (
                <G key={`sm-${i}`}>
                  <Path d={d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                  {dispOpts.smallHighlight && (
                    <Path d={d} stroke="rgba(255,220,200,0.18)" strokeWidth={SMALL_RADIUS * 0.7} fill="none" strokeLinecap="round" />
                  )}
                </G>
              );
            })}

            {/* Rupture burst markers */}
            {dispOpts.ruptureMarkers && renderSmallSegs.map((seg, i) => {
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
            {dispOpts.ruptureMarkers && renderLargeSegs.map((seg, i) => {
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
            {dispOpts.breakMarkers && renderSmallSegs.map((seg, i) => {
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
            {dispOpts.perforationMarkers && renderSmallSegs.map((seg, i) =>
              seg.perforated && !seg.broken ? (
                <Circle key={`prf-${i}`} cx={renderSmallNodes[i]?.x ?? 0} cy={renderSmallNodes[i]?.y ?? 0}
                  r={2.5} fill="#440000" stroke="#aa3030" strokeWidth={0.8} />
              ) : null
            )}

            {/* ===== REPAIR MARKS — + cross at healed perforation sites ===== */}
            {dispOpts.repairMarks && (repairMarks ?? []).map(i => {
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
            {dispOpts.repairMarks && (largeRepairMarks ?? []).map(i => {
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
            {dispOpts.sutureMarks && (sutureMarks ?? []).map(i => {
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
            {dispOpts.sutureMarks && (largeSutureMarks ?? []).map(i => {
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
                rodGeo.g, toolInserted, toolAnchor,
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
            {state.showCollisionBoxes && activeTool === TOOLS.ELECTRIC &&
              snap.electrodes.map((el, i) => (
                <Circle key={`cb-el-${i}`} cx={el.x} cy={el.y}
                  r={30 + toolParam2 * 0.3}
                  fill="none" stroke="rgba(255,255,80,0.4)" strokeWidth={0.7} />
              ))
            }
            {state.showCollisionBoxes && activeTool === TOOLS.GRAB && handlePos && (
              <Circle cx={handlePos.x} cy={handlePos.y}
                r={20 + toolParam1 * 0.25}
                fill="none" stroke="rgba(100,255,100,0.5)" strokeWidth={0.7} />
            )}

            {/* Navel marker inside cavity */}
            <Circle cx={NAVEL_X} cy={NAVEL_Y_INTERNAL} r={4}
              fill={navelPierced ? '#883030' : '#5a2020'}
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
        {handlePos && (activeTool === TOOLS.METAL_ROD || activeTool === TOOLS.VIBRATOR) && !(activeTool === TOOLS.METAL_ROD && state.forcePierceMode) && (() => {
          if (!rodGeo) return null;
          const isVib = activeTool === TOOLS.VIBRATOR;
          const { g } = rodGeo;
          const rodColor = isVib ? '#b078ff' : '#aaaacc';
          const rodWidth = isVib ? 6 : 5;
          const splitAtNavel = !isInternal && toolInserted;
          const splitAtNavelInternal = isInternal && toolInserted;
          const nx = NAVEL_X, ny = navelYBreath;
          const inNx = NAVEL_X, inNy = NAVEL_Y_INTERNAL;
          return (
            <G key="rod">
              {isVib && toolActive && (
                <Circle cx={splitAtNavel ? nx : g.headX} cy={splitAtNavel ? ny : g.headY}
                  r={30 + toolParam2 * 0.4}
                  fill="rgba(180,120,255,0.10)"
                  stroke="rgba(180,120,255,0.5)" strokeWidth={1} strokeDasharray="4 4" />
              )}
              {/* External view: shadow of rod inside body */}
              {splitAtNavel && (
                <Line x1={nx} y1={ny} x2={g.headX} y2={g.headY}
                  stroke={rodColor} strokeWidth={rodWidth} strokeLinecap="round" opacity={0.20} />
              )}
              {/* Internal view: outside (handle-to-navel) portion is semi-transparent */}
              {splitAtNavelInternal && (
                <Line x1={g.tailX} y1={g.tailY} x2={inNx} y2={inNy}
                  stroke={rodColor} strokeWidth={rodWidth} strokeLinecap="round" opacity={0.15} />
              )}
              {/* Main rod body */}
              <Line
                x1={splitAtNavelInternal ? inNx : g.tailX}
                y1={splitAtNavelInternal ? inNy : g.tailY}
                x2={splitAtNavel ? nx : g.headX}
                y2={splitAtNavel ? ny : g.headY}
                stroke={rodColor} strokeWidth={rodWidth} strokeLinecap="round" />
              <Circle cx={g.tailX} cy={g.tailY} r={isVib ? 9 : 7}
                fill="#666688" stroke="#222" strokeWidth={1}
                opacity={splitAtNavelInternal ? 0.3 : 1} />
              {(!splitAtNavel) && (() => {
                const rodElectrified = !isVib && toolStates?.[TOOLS.METAL_ROD]?.electrified === true;
                return (
                  <G>
                    {rodElectrified && (
                      <Circle cx={g.headX} cy={g.headY}
                        r={28 + toolParam2 * 0.22}
                        fill="rgba(255,255,0,0.07)" stroke="rgba(255,230,40,0.35)" strokeWidth={1} />
                    )}
                    {rodElectrified && (
                      <Circle cx={g.headX} cy={g.headY}
                        r={10}
                        fill="rgba(255,255,120,0.18)" stroke="rgba(255,220,40,0.7)" strokeWidth={1.2} />
                    )}
                    <Circle cx={g.headX} cy={g.headY} r={isVib ? 8 : 6}
                      fill={rodElectrified ? '#ffee44' : rodColor}
                      stroke={rodElectrified ? '#ffaa00' : '#222'} strokeWidth={0.5} />
                  </G>
                );
              })()}
            </G>
          );
        })()}

        {/* Force pierce rod — lever geometry, any angle */}
        {state.forcePierceMode && !isInternal && activeTool === TOOLS.METAL_ROD && (() => {
          const fp = fpRef.current;
          const PIERCE_MAX = 40;
          const insideLen = fp.progress * PIERCE_MAX;
          const rodColor = '#aaaacc';
          const progressFrac = fp.progress;
          const r = Math.round(80 + progressFrac * 140);
          const g2 = Math.round(80 - progressFrac * 50);
          const glowCol = `rgba(${r},${g2},80,${0.3 + progressFrac * 0.55})`;
          // Direction from handle toward navel
          const hdx = NAVEL_X - fp.handle.x;
          const hdy = navelYBreath - fp.handle.y;
          const hdist = Math.max(0.01, Math.hypot(hdx, hdy));
          const dirX = hdx / hdist;
          const dirY = hdy / hdist;
          // Inside end — continues past navel in same direction
          const insideEndX = NAVEL_X + dirX * insideLen;
          const insideEndY = navelYBreath + dirY * insideLen;
          return (
            <G key="fp-rod">
              {/* Handle to navel — outside portion (any angle) */}
              <Line x1={fp.handle.x} y1={fp.handle.y} x2={NAVEL_X} y2={navelYBreath}
                stroke={rodColor} strokeWidth={5} strokeLinecap="round" />
              {/* Inside (past navel) — extends in same lever direction */}
              {insideLen > 1 && (
                <Line x1={NAVEL_X} y1={navelYBreath} x2={insideEndX} y2={insideEndY}
                  stroke={rodColor} strokeWidth={5} strokeLinecap="round" opacity={0.28} />
              )}
              {/* Handle grip */}
              <Circle cx={fp.handle.x} cy={fp.handle.y} r={7} fill="#666688" stroke="#222" strokeWidth={1} />
              {/* Navel entry glow ring */}
              <Circle cx={NAVEL_X} cy={navelYBreath} r={NAVEL_RADIUS * 0.45 + progressFrac * 9}
                fill="none" stroke={glowCol} strokeWidth={2} />
            </G>
          );
        })()}

        {/* Needle */}
        {handlePos && activeTool === TOOLS.NEEDLE && (() => {
          if (!rodGeo) return null;
          const { g } = rodGeo;
          const splitAtAnchor = !isInternal && toolInserted && toolAnchor != null;
          const splitAtAnchorInternal = isInternal && toolInserted && toolAnchor != null;
          const ax = toolAnchor ? toolAnchor.x : NAVEL_X;
          const ay = toolAnchor ? toolAnchor.y : navelYBreath;
          return (
            <G key="needle">
              {splitAtAnchor && (
                <Line x1={ax} y1={ay} x2={g.headX} y2={g.headY}
                  stroke="#cccccc" strokeWidth={2.2} strokeLinecap="round" opacity={0.12} />
              )}
              {splitAtAnchorInternal && (
                <Line x1={g.tailX} y1={g.tailY} x2={ax} y2={ay}
                  stroke="#cccccc" strokeWidth={2.2} strokeLinecap="round" opacity={0.14} />
              )}
              <Line
                x1={splitAtAnchorInternal ? ax : g.tailX}
                y1={splitAtAnchorInternal ? ay : g.tailY}
                x2={splitAtAnchor ? ax : g.headX}
                y2={splitAtAnchor ? ay : g.headY}
                stroke="#cccccc" strokeWidth={2.2} strokeLinecap="round" />
              <Circle cx={g.tailX} cy={g.tailY} r={5} fill="#888899" stroke="#222" strokeWidth={1}
                opacity={splitAtAnchorInternal ? 0.25 : 1} />
              {!splitAtAnchor && <Circle cx={g.headX} cy={g.headY} r={2} fill="#ff4040" />}
            </G>
          );
        })()}

        {/* Grab indicator */}
        {handlePos && activeTool === TOOLS.GRAB && (
          <Circle cx={handlePos.x} cy={handlePos.y}
            r={10 + toolParam1 * 0.25}
            fill={toolActive ? 'rgba(96,192,96,0.30)' : 'rgba(96,192,96,0.18)'}
            stroke="#60c060" strokeWidth={1.5} />
        )}

        {/* Clamp point markers — amber outline, distinct from grab green */}
        {activeTool === TOOLS.GRAB && physicsRef.current.clampPoints.map((cp, ci) => {
          const nodes = cp.type === 'small' ? physicsRef.current.smallNodes : physicsRef.current.largeNodes;
          const n = nodes[cp.idx];
          if (!n) return null;
          const isActive = physicsRef.current.activeClampIdx === ci;
          return (
            <G key={`clamp-${ci}`}>
              <Line x1={n.x} y1={n.y} x2={cp.tx} y2={cp.ty}
                stroke="rgba(255,180,40,0.45)" strokeWidth={1} strokeDasharray="3,3" />
              <Circle cx={n.x} cy={n.y} r={9}
                fill={isActive ? 'rgba(255,180,40,0.30)' : 'rgba(255,160,20,0.18)'}
                stroke={isActive ? '#ffcc44' : '#e0a020'}
                strokeWidth={isActive ? 2 : 1.5}
                strokeDasharray={isActive ? undefined : '4,2'} />
              <Circle cx={cp.tx} cy={cp.ty} r={4}
                fill="rgba(255,180,40,0.55)" stroke="#ffcc44" strokeWidth={1} />
            </G>
          );
        })}

        {/* Syringe */}
        {handlePos && activeTool === TOOLS.SYRINGE && (
          <G>
            <Rect x={handlePos.x - 6} y={handlePos.y - 30}
              width={12} height={30} rx={2} fill="#60c0c0" fillOpacity={0.85}
              stroke="#88aaaa" strokeWidth={0.8} />
            {toolActive && (
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
        {handlePos && activeTool === TOOLS.BAYONET && (() => {
          if (!rodGeo) return null;
          const { g } = rodGeo;
          const bladeWidth = 2 + toolParam2 * 0.06;
          const splitAtAnchor = !isInternal && toolInserted && toolAnchor != null;
          const splitAtAnchorInternal = isInternal && toolInserted && toolAnchor != null;
          const ax = toolAnchor ? toolAnchor.x : NAVEL_X;
          const ay = toolAnchor ? toolAnchor.y : navelYBreath;
          return (
            <G key="bayonet">
              {splitAtAnchor && (
                <G opacity={0.12}>
                  <Line x1={ax} y1={ay} x2={g.headX} y2={g.headY}
                    stroke="#d8d8e8" strokeWidth={bladeWidth + 1.5} strokeLinecap="round" />
                  <Line x1={ax} y1={ay} x2={g.headX} y2={g.headY}
                    stroke="#f0f0ff" strokeWidth={bladeWidth * 0.5} strokeLinecap="round" />
                </G>
              )}
              {splitAtAnchorInternal && (
                <G opacity={0.15}>
                  <Line x1={g.tailX} y1={g.tailY} x2={ax} y2={ay}
                    stroke="#d8d8e8" strokeWidth={bladeWidth + 1.5} strokeLinecap="round" />
                  <Line x1={g.tailX} y1={g.tailY} x2={ax} y2={ay}
                    stroke="#f0f0ff" strokeWidth={bladeWidth * 0.5} strokeLinecap="round" />
                </G>
              )}
              <Line
                x1={splitAtAnchorInternal ? ax : g.tailX}
                y1={splitAtAnchorInternal ? ay : g.tailY}
                x2={splitAtAnchor ? ax : g.headX}
                y2={splitAtAnchor ? ay : g.headY}
                stroke="#d8d8e8" strokeWidth={bladeWidth + 1.5} strokeLinecap="round" />
              <Line
                x1={splitAtAnchorInternal ? ax : g.tailX}
                y1={splitAtAnchorInternal ? ay : g.tailY}
                x2={splitAtAnchor ? ax : g.headX}
                y2={splitAtAnchor ? ay : g.headY}
                stroke="#f0f0ff" strokeWidth={bladeWidth * 0.5} strokeLinecap="round" />
              <Circle cx={g.tailX} cy={g.tailY} r={7} fill="#555566" stroke="#222" strokeWidth={1}
                opacity={splitAtAnchorInternal ? 0.25 : 1} />
              {!splitAtAnchor && (
                <>
                  <Circle cx={g.headX} cy={g.headY} r={3} fill="#ff3030" stroke="#cc0000" strokeWidth={0.8} />
                  {toolActive && (
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
              strokeWidth={18 + toolParam1 * 0.10}
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
              strokeWidth={14 + toolParam1 * 0.08}
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
              r={8 + toolParam1 * 0.06}
              fill="rgba(80,20,160,0.92)" stroke="rgba(160,100,255,0.9)" strokeWidth={1.5} />
            {toolActive && (
              <Circle cx={siliconeHead.x} cy={siliconeHead.y}
                r={12 + toolParam1 * 0.07}
                fill="none" stroke="rgba(180,130,255,0.38)" strokeWidth={1} />
            )}
          </G>
        )}

        {/* Anal beads (拉珠) — independent beadsHeadIdx + external chain physics */}
        {activeTool === TOOLS.ANAL_BEADS && (() => {
          const BEAD_R = (i: number) => Math.min(3 + i * 0.65, 16.0);
          const headIdx = Math.max(0, Math.min(renderLargeNodes.length - 1, beadsHeadIdx));
          const internalCount = beadsInSmall
            ? Math.min(40, renderLargeNodes.length)
            : Math.min(40, Math.max(0, renderLargeNodes.length - headIdx));
          const externalCount = Math.max(0, 40 - internalCount);
          const chain = snap.beadsChain ?? [];

          // Small-intestine beads — FRONT of chain (smallest beads, indices 0+)
          // Computed first so we know the offset for large-intestine bead indices
          const sBeads: { x: number; y: number; r: number }[] = [];
          if (beadsInSmall && renderSmallNodes.length > 0) {
            const sHead = Math.max(0, Math.min(renderSmallNodes.length - 1, beadsSmallHeadIdx));
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
        {eggVisible && eggHeadNode && toolActive && (() => {
          const vib = toolParam1 / 100;
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
          const isActive = toolActive;
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

        {/* 胶囊炸弹 — cavity bombs (orange pill shapes) + swallowed bomb along intestine */}
        {(() => {
          const bombs = physicsRef.current.capsuleBombs;
          if (!bombs || bombs.length === 0) return null;
          return (
            <G>
              {bombs.map(bomb => {
                if (bomb.mode === 'cavity') {
                  const cx = bomb.cavityX;
                  const cy = bomb.cavityY;
                  return (
                    <G key={bomb.id} transform={`translate(${cx},${cy})`}>
                      <Ellipse cx={0} cy={0} rx={10} ry={6} fill="#cc4400" stroke="#ff6600" strokeWidth={1.2} />
                      <Ellipse cx={-2} cy={0} rx={8} ry={5} fill="#ff6600" stroke="none" />
                      <Line x1={0} y1={-5.5} x2={0} y2={5.5} stroke="rgba(255,200,100,0.35)" strokeWidth={0.8} />
                      <Ellipse cx={-3} cy={-2} rx={2.5} ry={1.5} fill="rgba(255,200,150,0.55)" />
                      <Rect x={6} y={-3} width={4} height={6} rx={1} fill="#ffcc00" stroke="#aa8800" strokeWidth={0.8} />
                    </G>
                  );
                } else {
                  const node = bomb.inLarge
                    ? physicsRef.current.largeNodes[bomb.largeIdx]
                    : physicsRef.current.smallNodes[bomb.smallIdx];
                  if (!node) return null;
                  const { x, y } = node;
                  return (
                    <G key={bomb.id} transform={`translate(${x},${y})`}>
                      <Ellipse cx={0} cy={0} rx={8} ry={5} fill="#cc4400" stroke="#ff6600" strokeWidth={1} />
                      <Ellipse cx={-1.5} cy={0} rx={6.5} ry={4} fill="#ff6600" stroke="none" />
                      <Line x1={0} y1={-4.5} x2={0} y2={4.5} stroke="rgba(255,200,100,0.35)" strokeWidth={0.7} />
                      <Ellipse cx={-2.5} cy={-1.8} rx={2} ry={1.2} fill="rgba(255,200,150,0.5)" />
                      <Circle cx={5} cy={-2} r={1.8} fill="#ffcc00" stroke="#aa8800" strokeWidth={0.7} />
                    </G>
                  );
                }
              })}
            </G>
          );
        })()}

        {/* Enema tube (inserted section from head to anus) */}
        {activeTool === TOOLS.ENEMA && enemaPathLarge !== '' && (
          <G>
            <Path d={enemaPathLarge} stroke="rgba(60,110,200,0.55)" strokeWidth={5}
              fill="none" strokeLinecap="round" />
            <Path d={enemaPathLarge} stroke="rgba(160,210,255,0.45)" strokeWidth={2}
              fill="none" strokeLinecap="round" />
          </G>
        )}
        {/* Enema fluid fill (fluid accumulating ahead of head toward cecum) */}
        {activeTool === TOOLS.ENEMA && enemaFillPath !== '' && (
          <G>
            <Path d={enemaFillPath} stroke="rgba(100,200,255,0.55)" strokeWidth={7}
              fill="none" strokeLinecap="round" />
            <Path d={enemaFillPath} stroke="rgba(200,240,255,0.4)" strokeWidth={3}
              fill="none" strokeLinecap="round" />
          </G>
        )}
        {activeTool === TOOLS.ENEMA && enemaPathSmall !== '' && (
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
            {(toolActive || toolStates?.[TOOLS.ENEMA]?.active) && (
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

        {/* === HOOK TOOL (小肠露出) rendering === */}
        {(() => {
          const hp = physicsRef.current;
          if (!hp.hookInserted || !hp.hookAnchor || !hp.hookPos) return null;
          const anchor = hp.hookAnchor;
          const handle = hp.hookPos;
          const HOOK_ROD_LEN = hp.hookRodLength || 90;
          const hdist = Math.hypot(handle.x - anchor.x, handle.y - anchor.y) || 1;
          const insideLen = Math.max(0, HOOK_ROD_LEN - hdist);
          if (insideLen < 0.5) return null;
          const dx = (anchor.x - handle.x) / hdist;
          const dy = (anchor.y - handle.y) / hdist;
          const headX = anchor.x + dx * insideLen;
          const headY = anchor.y + dy * insideLen;
          const hookColor = hp.hookToolType === '手指勾肠' ? '#e8c098'
            : hp.hookToolType === '铁钩' ? '#c8d0d8'
            : hp.hookToolType === '长柄夹' ? '#909090'
            : '#dde0e8';
          const hasPending = hp.hookedPendingIndices && hp.hookedPendingIndices.length > 0;
          return (
            <G>
              {/* External handle rod */}
              <Line x1={handle.x} y1={handle.y} x2={anchor.x} y2={anchor.y}
                stroke={hookColor} strokeWidth={3} strokeOpacity={0.75} strokeLinecap="round" />
              {/* Internal lever inside cavity */}
              <Line x1={anchor.x} y1={anchor.y} x2={headX} y2={headY}
                stroke={hookColor} strokeWidth={3} strokeOpacity={0.85} strokeLinecap="round" />
              {/* Anchor point at navel */}
              <Circle cx={anchor.x} cy={anchor.y} r={4}
                fill="rgba(255,200,120,0.7)" stroke={hookColor} strokeWidth={1} />
              {/* Hook head */}
              <Circle cx={headX} cy={headY} r={hp.hookGrabActive ? 7 : 5}
                fill={hp.hookGrabActive ? 'rgba(255,140,80,0.8)' : `${hookColor}cc`}
                stroke={hp.hookGrabActive ? '#ff8844' : hookColor}
                strokeWidth={1.5} />
              {hp.hookGrabActive && !hasPending && hp.hookedSmallSegIdx < 0 && (
                <Circle cx={headX} cy={headY} r={12}
                  fill="none" stroke="rgba(255,140,80,0.4)" strokeWidth={1.5} strokeDasharray="3 2" />
              )}
              {/* Hooked-but-pending nodes: subtle orange glow to show what's grabbed */}
              {hasPending && hp.hookedPendingIndices.map((pi) => {
                const n = renderSmallNodes[pi];
                if (!n) return null;
                return (
                  <Circle key={`pend-${pi}`} cx={n.x} cy={n.y} r={SMALL_RADIUS + 3}
                    fill="none" stroke="rgba(255,160,50,0.5)" strokeWidth={2} />
                );
              })}
            </G>
          );
        })()}

        {/* === EXPOSED SMALL INTESTINE segments (outside body) — same style as internal === */}
        {(() => {
          const expIdx = physicsRef.current.exposedSmallIndices;
          if (expIdx.length === 0) return null;
          return (
            <G>
              {/* Pass 1: outline casing — matches internal small intestine style */}
              {expIdx.map(i => {
                const d = smallSegPaths[i];
                if (!d) return null;
                const seg = renderSmallSegs[i];
                if (!seg || seg.broken || seg.resected) return null;
                const sPeriScale = periScaleSmall?.[i] ?? 1;
                const w = SMALL_RADIUS * sPeriScale * 2 + (seg.pressure / 100) * SMALL_RADIUS * expansionScale;
                return (
                  <Path key={`exp-out-${i}`} d={d}
                    stroke="rgba(175, 100, 80, 0.55)"
                    strokeWidth={w + 3.5}
                    fill="none" strokeLinecap="round" strokeLinejoin="round" />
                );
              })}
              {/* Pass 2: fill + highlight — exact same segmentColor as internal */}
              {expIdx.map(i => {
                const d = smallSegPaths[i];
                if (!d) return null;
                const seg = renderSmallSegs[i];
                if (!seg || seg.broken || seg.resected) return null;
                const sPeriScale = periScaleSmall?.[i] ?? 1;
                const w = SMALL_RADIUS * sPeriScale * 2 + (seg.pressure / 100) * SMALL_RADIUS * expansionScale;
                const col = segmentColor(seg.health, seg.pain, seg.pressure, seg.ruptured, seg.broken, seg.perforated, false, smallTransplantColor ?? undefined);
                return (
                  <G key={`exp-${i}`}>
                    <Path d={d} stroke={col} strokeWidth={w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                    <Path d={d} stroke="rgba(255,220,200,0.18)" strokeWidth={SMALL_RADIUS * 0.7} fill="none" strokeLinecap="round" />
                  </G>
                );
              })}
            </G>
          );
        })()}

        {/* Electrodes + wires + controller */}
        {(snap.electrodes.length > 0 || activeTool === TOOLS.ELECTRIC || electricIndepActive) && (() => {
          const nextMode = (physicsRef.current as any).electricMode ?? 'external';
          const nextIsExternal = nextMode === 'external';
          const elecActive = (activeTool === TOOLS.ELECTRIC && toolActive) || electricIndepActive;
          const elecParam2 = activeTool === TOOLS.ELECTRIC
            ? toolParam2
            : (toolStates?.[TOOLS.ELECTRIC]?.param2 ?? 50);
          return (
            <G>
              {/* Wires — per electrode mode + per view opacity */}
              {snap.electrodes.map((el, i) => {
                const elIsExternal = el.mode === 'external';
                const wc = elecActive ? (elIsExternal ? '#50c8ff' : '#ffee44') : (elIsExternal ? '#336688' : '#888844');
                if (elIsExternal) {
                  // External pad → controller. Visible outside, dim inside (pad is on skin).
                  const wireOp = isInternal ? 0.2 : 0.8;
                  return (
                    <Line key={`wire-${i}`}
                      x1={el.x} y1={el.y}
                      x2={ELEC_CTRL_X} y2={ELEC_CTRL_Y}
                      stroke={wc} strokeWidth={1.2} strokeOpacity={wireOp}
                      strokeDasharray="4,3" />
                  );
                }
                // Internal electrode wires
                if (isInternal) {
                  // electrode→navel: same rule as electrode body (inside cavity = normal).
                  // navel→controller: body-exterior segment = dim (exits cavity).
                  return (
                    <G key={`wire-${i}`}>
                      <Line x1={el.x} y1={el.y} x2={NAVEL_X} y2={NAVEL_Y_INTERNAL}
                        stroke={wc} strokeWidth={1} strokeOpacity={0.88} />
                      <Line x1={NAVEL_X} y1={NAVEL_Y_INTERNAL}
                        x2={ELEC_CTRL_X} y2={ELEC_CTRL_Y}
                        stroke={wc} strokeWidth={1} strokeOpacity={0.18} />
                    </G>
                  );
                }
                // External view:
                // electrode→navel: same rule as electrode body (inside belly = dim).
                // navel→controller: body-exterior segment = normal (only once, shared entry point).
                return (
                  <G key={`wire-${i}`}>
                    <Line x1={el.x} y1={el.y} x2={NAVEL_X} y2={NAVEL_Y_EXTERNAL}
                      stroke={wc} strokeWidth={1} strokeOpacity={0.22} />
                    {i === 0 && (
                      <Line x1={NAVEL_X} y1={NAVEL_Y_EXTERNAL}
                        x2={ELEC_CTRL_X} y2={ELEC_CTRL_Y}
                        stroke={wc} strokeWidth={1.2} strokeOpacity={0.88} />
                    )}
                  </G>
                );
              })}
              {/* Electrode bodies — per electrode mode + per view opacity */}
              {snap.electrodes.map((el, i) => {
                const elIsExternal = el.mode === 'external';
                if (elIsExternal) {
                  // External pad: fully visible outside, dim inside (pad is on skin, not in cavity).
                  const bodyOp = isInternal ? 0.22 : 1.0;
                  const pw = 18, ph = 12;
                  return (
                    <G key={`el-${i}`} opacity={bodyOp}>
                      <Rect x={el.x - pw / 2} y={el.y - ph / 2}
                        width={pw} height={ph} rx={4}
                        fill={elecActive ? '#1a3a4a' : '#122030'}
                        stroke={elecActive ? '#50c8ff' : '#336688'}
                        strokeWidth={1.2} />
                      <Line x1={el.x - 4} y1={el.y} x2={el.x + 4} y2={el.y}
                        stroke={elecActive ? '#80e8ff' : '#44aacc'} strokeWidth={1} />
                      <Line x1={el.x} y1={el.y - 4} x2={el.x} y2={el.y + 4}
                        stroke={elecActive ? '#80e8ff' : '#44aacc'} strokeWidth={1} />
                      <Rect x={el.x - pw / 2 + 2} y={el.y - ph / 2 + 2}
                        width={pw - 4} height={3} rx={1}
                        fill={elecActive ? 'rgba(80,200,255,0.25)' : 'rgba(80,200,255,0.08)'} />
                      {elecActive && (
                        <Circle cx={el.x} cy={el.y} r={30 + elecParam2 * 0.15}
                          fill="rgba(80,200,255,0.04)" stroke="rgba(80,200,255,0.25)" strokeWidth={0.8} />
                      )}
                    </G>
                  );
                }
                // Internal electrode: dim outside (inside belly viewed through skin), normal inside.
                const bodyOp = isInternal ? 1.0 : 0.28;
                return (
                  <G key={`el-${i}`} opacity={bodyOp}>
                    <Circle cx={el.x} cy={el.y} r={6} fill="#ffff00" fillOpacity={0.9}
                      stroke="#ffaa00" strokeWidth={1} />
                    {elecActive && (
                      <Circle cx={el.x} cy={el.y} r={30 + elecParam2 * 0.3}
                        fill="rgba(255,255,0,0.06)" stroke="rgba(255,255,0,0.3)" strokeWidth={0.8} />
                    )}
                  </G>
                );
              })}
              {/* Controller box — indicator reflects next-electrode mode */}
              {(activeTool === TOOLS.ELECTRIC || electricIndepActive) && (
                <G>
                  <Rect x={ELEC_CTRL_X - 20} y={ELEC_CTRL_Y - 16}
                    width={40} height={32} rx={3}
                    fill="#2a2a2a" stroke={nextIsExternal ? '#336688' : '#666'} strokeWidth={1.2} />
                  <Rect x={ELEC_CTRL_X - 20} y={ELEC_CTRL_Y - 16}
                    width={40} height={4} rx={2}
                    fill={nextIsExternal ? (elecActive ? '#50c8ff' : '#224455') : (elecActive ? '#ffcc00' : '#443300')} />
                  <Circle cx={ELEC_CTRL_X - 8} cy={ELEC_CTRL_Y}
                    r={3} fill={elecActive ? '#ff4040' : '#664040'} />
                  <Circle cx={ELEC_CTRL_X + 8} cy={ELEC_CTRL_Y}
                    r={3} fill={elecActive ? (nextIsExternal ? '#50c8ff' : '#ffcc40') : '#665540'} />
                  <Rect x={ELEC_CTRL_X - 16} y={ELEC_CTRL_Y + 7}
                    width={32} height={3}
                    fill={elecActive ? (nextIsExternal ? '#50c8ff' : '#ffee44') : '#444'} />
                </G>
              )}
            </G>
          );
        })()}
        {/* Expanding shockwave rings — one per concurrent strike */}
        {strikeWaves.map(wave => {
          const { id, physX, physY, maxR, anim } = wave;
          const animR = anim.interpolate({ inputRange: [0, 1], outputRange: [2, maxR] });
          const animR2 = anim.interpolate({ inputRange: [0, 1], outputRange: [2, maxR * 0.65] });
          const animOp = anim.interpolate({ inputRange: [0, 0.15, 0.7, 1], outputRange: [0, 0.9, 0.5, 0] });
          const animOp2 = anim.interpolate({ inputRange: [0, 0.1, 0.5, 1], outputRange: [0, 0.4, 0.15, 0] });
          const animSW = anim.interpolate({ inputRange: [0, 0.3, 1], outputRange: [6, 3, 1] });
          return (
            <G key={id}>
              <AnimatedCircle cx={physX} cy={physY} r={animR2}
                fill="rgba(255,130,40,1)" opacity={animOp2} />
              <AnimatedCircle cx={physX} cy={physY} r={animR}
                fill="none"
                stroke="rgba(255,160,60,1)"
                strokeWidth={animSW}
                opacity={animOp} />
            </G>
          );
        })}

        {/* Capsule bomb explosion rings */}
        {explosionWaves.map(wave => {
          const { id, physX, physY, maxR, anim } = wave;
          const animR1 = anim.interpolate({ inputRange: [0, 1], outputRange: [4, maxR] });
          const animR2 = anim.interpolate({ inputRange: [0, 1], outputRange: [4, maxR * 0.55] });
          const animR3 = anim.interpolate({ inputRange: [0, 1], outputRange: [4, maxR * 0.28] });
          const animOp1 = anim.interpolate({ inputRange: [0, 0.1, 0.65, 1], outputRange: [0, 1, 0.55, 0] });
          const animOp2 = anim.interpolate({ inputRange: [0, 0.08, 0.45, 1], outputRange: [0, 0.85, 0.3, 0] });
          const animOp3 = anim.interpolate({ inputRange: [0, 0.06, 0.3, 1], outputRange: [0, 0.7, 0.0, 0] });
          const animSW = anim.interpolate({ inputRange: [0, 0.2, 1], outputRange: [8, 4, 1.5] });
          return (
            <G key={id}>
              {/* Bright inner fireball */}
              <AnimatedCircle cx={physX} cy={physY} r={animR3}
                fill="rgba(255,240,100,1)" opacity={animOp3} />
              {/* Mid orange bloom */}
              <AnimatedCircle cx={physX} cy={physY} r={animR2}
                fill="rgba(255,100,20,1)" opacity={animOp2} />
              {/* Outer shockwave ring */}
              <AnimatedCircle cx={physX} cy={physY} r={animR1}
                fill="none"
                stroke="rgba(255,60,0,1)"
                strokeWidth={animSW}
                opacity={animOp1} />
            </G>
          );
        })}

        {/* Belly strike range overlays: chargedOverlays (persistent) + current drag overlay */}
        {[...chargedOverlays, ...(strikeOverlay ? [strikeOverlay] : [])].map(overlay => {
          const { physX, physY, rangePx, charging, rangeType, id } = overlay;
          const strokeColor = charging ? '#ff8844' : '#ff884488';
          const fillColor = charging ? 'rgba(255,136,68,0.12)' : 'rgba(255,136,68,0.06)';
          if (rangeType === 'circle') {
            return (
              <G key={id}>
                <Circle cx={physX} cy={physY} r={rangePx}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={charging ? 2.5 : 1.5}
                  strokeDasharray={charging ? '0' : '5,4'} />
                <Circle cx={physX} cy={physY} r={3}
                  fill={strokeColor} />
              </G>
            );
          } else {
            // Bat silhouette: physX = barrel tip (large end, drag point) on LEFT; handle/knob extend RIGHT
            const hLen = rangePx * 0.55;      // handle length
            const bLen = rangePx * 1.65;      // barrel length
            const knobR = rangePx * 0.135;    // knob endcap radius
            const handleR = rangePx * 0.09;   // narrow grip radius
            const barrelR = rangePx * 0.34;   // barrel radius
            // physX is barrel tip on LEFT; taper junction and knob extend to the RIGHT
            const taperJunctionX = physX + bLen;
            const knobCx = physX + bLen + hLen - knobR;
            // Control points: barrel side near physX, taper side near taperJunction
            const barrelCtrlX = physX + bLen - rangePx * 0.95;
            const taperCtrlX  = physX + bLen - rangePx * 0.38;
            const batPath = [
              // Start at top of barrel tip (drag point, LEFT)
              `M ${physX} ${physY - barrelR}`,
              // Left barrel cap — CCW arc (left semicircle): top → bottom
              `A ${barrelR} ${barrelR} 0 0 0 ${physX} ${physY + barrelR}`,
              // Bottom taper bezier → handle bottom going RIGHT
              `C ${barrelCtrlX} ${physY + barrelR * 0.92} ${taperCtrlX} ${physY + handleR * 2.2} ${taperJunctionX} ${physY + handleR}`,
              // Handle bottom going right to knob
              `L ${knobCx} ${physY + handleR}`,
              `L ${knobCx} ${physY + knobR}`,
              // Right knob cap — CW arc (right semicircle): bottom → top
              `A ${knobR} ${knobR} 0 0 1 ${knobCx} ${physY - knobR}`,
              `L ${knobCx} ${physY - handleR}`,
              // Handle top going left back to taper junction
              `L ${taperJunctionX} ${physY - handleR}`,
              // Top taper bezier back to barrel tip
              `C ${taperCtrlX} ${physY - handleR * 2.2} ${barrelCtrlX} ${physY - barrelR * 0.92} ${physX} ${physY - barrelR}`,
              `Z`,
            ].join(' ');
            // Debug: physics sample circles (9 points, matches updated applyBellyStrikePhysics)
            const debugSamples = state.debugMode ? (() => {
              const totalLen = hLen + bLen;
              const physHandleR = rangePx * 0.13;
              const physBarrelR = rangePx * 0.34;
              const N = 9;
              return Array.from({ length: N }, (_, k) => {
                const t = k / (N - 1);               // 0=barrel tip (physX), 1=knob (right)
                const sx = physX + t * totalLen;      // matches physics: barrel at physX, knob right
                const tFlipped = 1 - t;
                const tp = tFlipped < 0.22 ? 0 : (tFlipped - 0.22) / 0.78;
                const localR = physHandleR + (physBarrelR - physHandleR) * (tp * tp * (3 - 2 * tp));
                return <Circle key={`ds-${id}-${k}`} cx={sx} cy={physY} r={localR} fill="rgba(255,200,0,0.12)" stroke="#ffcc00" strokeWidth={0.8} strokeDasharray="3,2" />;
              });
            })() : null;
            return (
              <G key={id}>
                {debugSamples}
                <Path
                  d={batPath}
                  fill={fillColor}
                  stroke={strokeColor}
                  strokeWidth={charging ? 2.5 : 1.5}
                  strokeLinejoin="round"
                  strokeDasharray={charging ? '0' : '6,4'}
                />
                {/* Drag origin dot at barrel tip */}
                <Circle cx={physX} cy={physY} r={3} fill={strokeColor} />
              </G>
            );
          }
        })}

        {/* Katana slash scars — persistent red cuts */}
        {state.slashScars && state.slashScars.map((scar) => (
          <G key={`ks-${scar.id}`}>
            <Line
              x1={scar.physX1} y1={scar.physY1} x2={scar.physX2} y2={scar.physY2}
              stroke="rgba(160,0,0,0.50)" strokeWidth={5} strokeLinecap="round" />
            <Line
              x1={scar.physX1} y1={scar.physY1} x2={scar.physX2} y2={scar.physY2}
              stroke="rgba(230,20,20,0.85)" strokeWidth={1.5} strokeLinecap="round" />
          </G>
        ))}

        {/* Katana sweep glow line — fades out after slash */}
        {katanaSweepLine && (() => {
          const opacityGlow = katanaSweepAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.35] });
          const opacityCore = katanaSweepAnim.interpolate({ inputRange: [0, 1], outputRange: [0, 0.95] });
          return (
            <G>
              <AnimatedLine
                x1={katanaSweepLine.x1} y1={katanaSweepLine.y1}
                x2={katanaSweepLine.x2} y2={katanaSweepLine.y2}
                stroke="rgba(255,255,255,1)" strokeWidth={12} strokeLinecap="round"
                opacity={opacityGlow} />
              <AnimatedLine
                x1={katanaSweepLine.x1} y1={katanaSweepLine.y1}
                x2={katanaSweepLine.x2} y2={katanaSweepLine.y2}
                stroke="rgba(255,240,200,1)" strokeWidth={2.5} strokeLinecap="round"
                opacity={opacityCore} />
            </G>
          );
        })()}

        {/* Katana slash overlay during drag — center line + range band */}
        {katanaSlashOverlay && (() => {
          const { x1, y1, x2, y2, halfWidth } = katanaSlashOverlay;
          const dx = x2 - x1, dy = y2 - y1;
          const len = Math.hypot(dx, dy) || 1;
          const nx = -dy / len * halfWidth, ny = dx / len * halfWidth;
          const bandPath = [
            `M ${(x1 + nx).toFixed(1)} ${(y1 + ny).toFixed(1)}`,
            `L ${(x2 + nx).toFixed(1)} ${(y2 + ny).toFixed(1)}`,
            `L ${(x2 - nx).toFixed(1)} ${(y2 - ny).toFixed(1)}`,
            `L ${(x1 - nx).toFixed(1)} ${(y1 - ny).toFixed(1)}`,
            'Z',
          ].join(' ');
          return (
            <G>
              <Path d={bandPath} fill="rgba(220,60,160,0.10)" stroke="rgba(220,60,160,0.50)"
                strokeWidth={1.2} strokeDasharray="5,4" />
              <Line x1={x1} y1={y1} x2={x2} y2={y2}
                stroke="rgba(255,80,200,0.85)" strokeWidth={1.8} strokeLinecap="round" strokeDasharray="6,3" />
              <Circle cx={x1} cy={y1} r={4} fill="rgba(255,80,200,0.9)" />
              <Circle cx={x2} cy={y2} r={3} fill="rgba(255,80,200,0.7)" />
            </G>
          );
        })()}

        {/* Bullet holes on external view — AI-generated textures */}
        {!isInternal && state.bulletHoles && state.bulletHoles.map((hole) => {
          const hr = hole.radius;
          const hx = hole.physX;
          const hy = hole.physY;
          const isLarge = hole.weaponId && LARGE_CALIBER_IDS.includes(hole.weaponId);
          const holeImg = isLarge ? BULLET_HOLE_LARGE : BULLET_HOLE_SMALL;
          // Image display size: large caliber wounds are visibly bigger
          // radius: .22≈6.2  9mm≈7.1  7.62≈8.7  12.7≈10.9
          const size = hr * (isLarge ? 11 : 9);
          const half = size / 2;
          return (
            <G key={`bh-${hole.id}`}>
              <SvgImage
                x={hx - half}
                y={hy - half}
                width={size}
                height={size}
                href={holeImg}
                preserveAspectRatio="xMidYMid meet"
              />
            </G>
          );
        })}

        {/* Weapon aim sight overlay */}
        {gunAimOverlay && (() => {
          const { aimPhysX, aimPhysY, sightType, weaponId } = gunAimOverlay;

          // Per-weapon sight colors and sizes
          const sightColors: Record<string, { primary: string; ring: string; dot: string }> = {
            '.22手枪':            { primary: 'rgba(255,70,70,0.92)',  ring: 'rgba(255,60,60,0.35)',  dot: 'rgba(255,60,60,0.95)' },
            '9MM手枪':            { primary: 'rgba(255,165,30,0.92)', ring: 'rgba(255,145,20,0.38)', dot: 'rgba(255,155,20,0.95)' },
            '7.62mm步枪':         { primary: 'rgba(60,230,180,0.95)', ring: 'rgba(40,210,160,0.45)', dot: 'rgba(50,230,180,1)'    },
            '12.7mm反器材狙击枪': { primary: 'rgba(255,220,40,0.97)', ring: 'rgba(240,200,30,0.50)', dot: 'rgba(255,220,40,1)'    },
          };
          const col = sightColors[weaponId] ?? sightColors['.22手枪'];

          if (sightType === 'iron') {
            // Iron sight: clean crosshair + concentric rings, no hardware notch/post
            const arm = 40;   // crosshair arm length
            const gap = 10;   // center gap
            return (
              <G>
                {/* Outer faint ring */}
                <Circle cx={aimPhysX} cy={aimPhysY} r={50}
                  fill="none" stroke={col.ring} strokeWidth={1.2} />
                {/* Inner ring */}
                <Circle cx={aimPhysX} cy={aimPhysY} r={28}
                  fill="none" stroke={col.ring} strokeWidth={0.8} />
                {/* Crosshair arms */}
                <Line x1={aimPhysX - arm - gap} y1={aimPhysY} x2={aimPhysX - gap} y2={aimPhysY}
                  stroke={col.primary} strokeWidth={1.8} />
                <Line x1={aimPhysX + gap} y1={aimPhysY} x2={aimPhysX + arm + gap} y2={aimPhysY}
                  stroke={col.primary} strokeWidth={1.8} />
                <Line x1={aimPhysX} y1={aimPhysY - arm - gap} x2={aimPhysX} y2={aimPhysY - gap}
                  stroke={col.primary} strokeWidth={1.8} />
                <Line x1={aimPhysX} y1={aimPhysY + gap} x2={aimPhysX} y2={aimPhysY + arm + gap}
                  stroke={col.primary} strokeWidth={1.8} />
                {/* Center dot */}
                <Circle cx={aimPhysX} cy={aimPhysY} r={3}
                  fill={col.dot} />
              </G>
            );
          } else {
            // Scope sight — 7.62mm medium, 12.7mm large
            const scopeR = weaponId === '12.7mm反器材狙击枪' ? 90 : 68;
            const mdSpacing = weaponId === '12.7mm反器材狙击枪' ? 20 : 16;
            const mdOffsets = [-mdSpacing * 2, -mdSpacing, mdSpacing, mdSpacing * 2];
            const lineW = weaponId === '12.7mm反器材狙击枪' ? 1.6 : 1.3;
            const elevOffsets = weaponId === '12.7mm反器材狙击枪' ? [20, 38, 56] : [16, 30, 44];
            return (
              <G>
                {/* Scope tube shadow ring */}
                <Circle cx={aimPhysX} cy={aimPhysY} r={scopeR + 4}
                  fill="rgba(0,0,0,0.28)" stroke="rgba(10,10,10,0.85)" strokeWidth={3.5} />
                {/* Scope lens inner fill */}
                <Circle cx={aimPhysX} cy={aimPhysY} r={scopeR}
                  fill="rgba(0,6,4,0.22)" stroke={col.ring} strokeWidth={1.5} />
                {/* Second inner ring */}
                <Circle cx={aimPhysX} cy={aimPhysY} r={scopeR * 0.55}
                  fill="none" stroke={col.ring} strokeWidth={0.7} strokeDasharray="4,6" />
                {/* Horizontal crosshair */}
                <Line x1={aimPhysX - scopeR + 4} y1={aimPhysY} x2={aimPhysX - 10} y2={aimPhysY}
                  stroke={col.primary} strokeWidth={lineW} />
                <Line x1={aimPhysX + 10} y1={aimPhysY} x2={aimPhysX + scopeR - 4} y2={aimPhysY}
                  stroke={col.primary} strokeWidth={lineW} />
                {/* Vertical crosshair */}
                <Line x1={aimPhysX} y1={aimPhysY - scopeR + 4} x2={aimPhysX} y2={aimPhysY - 10}
                  stroke={col.primary} strokeWidth={lineW} />
                <Line x1={aimPhysX} y1={aimPhysY + 10} x2={aimPhysX} y2={aimPhysY + scopeR - 4}
                  stroke={col.primary} strokeWidth={lineW} />
                {/* Mil dots — horizontal */}
                {mdOffsets.map(offset => (
                  <Circle key={`mdh-${offset}`} cx={aimPhysX + offset} cy={aimPhysY} r={2.2}
                    fill={col.primary} />
                ))}
                {/* Mil dots — vertical */}
                {mdOffsets.map(offset => (
                  <Circle key={`mdv-${offset}`} cx={aimPhysX} cy={aimPhysY + offset} r={2.2}
                    fill={col.primary} />
                ))}
                {/* Center dot */}
                <Circle cx={aimPhysX} cy={aimPhysY} r={3.5}
                  fill={col.dot} />
                {/* Elevation stadia lines below center */}
                {elevOffsets.map((yOff, i) => {
                  const hw = 9 - i * 2;
                  return (
                    <Line key={`elev-${i}`}
                      x1={aimPhysX - hw} y1={aimPhysY + yOff + 12}
                      x2={aimPhysX + hw} y2={aimPhysY + yOff + 12}
                      stroke={col.primary} strokeWidth={lineW * 0.85} strokeOpacity={0.75} />
                  );
                })}
              </G>
            );
          }
        })()}
      </Svg>

      {/* Strike image animations — tool rushes from large ghost → impact size → fade */}
      {canvasLayout && chargedOverlays.map(overlay => {
        const anim = strikeAnimsRef.current.get(overlay.id);
        if (!anim) return null;

        const sc = Math.min(canvasLayout.width / CANVAS_W, canvasLayout.height / CANVAS_H);
        const ofX = (canvasLayout.width - CANVAS_W * sc) / 2;
        const ofY = (canvasLayout.height - CANVAS_H * sc) / 2;
        const { physX, physY, rangePx, toolId, rangeType } = overlay;

        // Phase 0→1: shrink from 3× to 1× and become opaque
        // Phase 1→2: slight punch-through expand (1× → 1.15×) and fade to 0
        const scaleInterp = anim.interpolate({
          inputRange: [0, 1, 2],
          outputRange: [3.0, 1.0, 1.18],
        });
        const opacityInterp = anim.interpolate({
          inputRange: [0, 0.05, 1, 2],
          outputRange: [0, 0.25, 0.90, 0],
        });

        // Final display size (matches the hit range silhouette)
        let centerSX: number, centerSY: number, imgW: number, imgH: number;
        if (rangeType === 'circle') {
          centerSX = ofX + physX * sc;
          centerSY = ofY + physY * sc;
          imgW = rangePx * 2.6 * sc;
          imgH = imgW;
        } else {
          // Bat: barrel at physX (left), extends right by totalLen
          const totalLen = rangePx * 2.2;
          centerSX = ofX + (physX + totalLen / 2) * sc;
          centerSY = ofY + physY * sc;
          imgW = totalLen * sc * 1.8;
          imgH = imgW * 0.75;  // 4:3 image aspect ratio
        }

        const animImg = STRIKE_ANIM_IMAGES[toolId];
        const AnimComp = STRIKE_ANIM_COMPONENTS[toolId];
        if (!animImg && !AnimComp) return null;

        return (
          <Animated.View
            key={`sa-${overlay.id}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: centerSX - imgW / 2,
              top: centerSY - imgH / 2,
              width: imgW,
              height: imgH,
              transform: [{ scale: scaleInterp as any }],
              opacity: opacityInterp as any,
            }}
          >
            {animImg ? (
              <Image source={animImg} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            ) : (
              <AnimComp width={imgW} height={imgH} />
            )}
          </Animated.View>
        );
      })}

      {/* Preload strike animation images so they're cached before first use */}
      <View pointerEvents="none" style={{ position: 'absolute', width: 0, height: 0, overflow: 'hidden' }}>
        {Object.values(STRIKE_ANIM_IMAGES).map((src, i) => (
          <Image key={i} source={src} style={{ width: 1, height: 1 }} />
        ))}
      </View>

      {/* Flash overlay on strike impact — always rendered, opacity animated */}
      <Animated.View
        pointerEvents="none"
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: flashColor,
          opacity: strikeFlashAnim,
        }}
      />

      {/* Picking insertion point instruction — shown when needle/bayonet selected, before insertion */}
      {state.pickingInsertionPoint && !isInternal &&
        (state.activeTool === TOOLS.NEEDLE || state.activeTool === TOOLS.BAYONET) && (
        <View style={{
          position: 'absolute', bottom: 20, alignSelf: 'center',
          backgroundColor: 'rgba(40,10,10,0.88)',
          paddingHorizontal: 16, paddingVertical: 9,
          borderRadius: 8, borderWidth: 1,
          borderColor: 'rgba(200,80,80,0.55)',
        }}>
          <Text style={{ color: '#ffcccc', fontSize: 13, fontWeight: 'bold', letterSpacing: 0.5, textAlign: 'center' }}>
            点击腹部选择刺入位置
          </Text>
        </View>
      )}

      {/* Force pierce button — shown in external view when navel not yet pierced + metal rod selected */}
      {!state.navelPierced && state.activeTool === TOOLS.METAL_ROD && !isInternal && !state.forcePierceMode && (
        <TouchableOpacity
          style={{
            position: 'absolute', bottom: 20, alignSelf: 'center',
            backgroundColor: 'rgba(160,18,18,0.88)',
            paddingHorizontal: 18, paddingVertical: 9,
            borderRadius: 8, borderWidth: 1,
            borderColor: 'rgba(255,70,70,0.55)',
          }}
          onPress={() => setForcePierceMode(true)}
        >
          <Text style={{ color: '#ffdddd', fontSize: 13, fontWeight: 'bold', letterSpacing: 1 }}>强行穿脐</Text>
        </TouchableOpacity>
      )}

      {/* Force pierce active: progress bar + cancel */}
      {state.forcePierceMode && !isInternal && (
        <View style={{ position: 'absolute', bottom: 14, alignSelf: 'center', alignItems: 'center' }}>
          <Text style={{ color: '#ffaaaa', fontSize: 11, marginBottom: 5 }}>向下拖拽强制刺穿</Text>
          <View style={{ width: 130, height: 7, backgroundColor: '#330000', borderRadius: 4, overflow: 'hidden' }}>
            <View style={{ width: forcePierceProgress * 130, height: 7,
              backgroundColor: `rgb(${Math.round(180 + forcePierceProgress * 75)},${Math.round(30 - forcePierceProgress * 20)},30)`,
              borderRadius: 4 }} />
          </View>
          <TouchableOpacity
            style={{ marginTop: 6 }}
            onPress={() => { setForcePierceMode(false); setForcePierceProgress(0); }}
          >
            <Text style={{ color: '#777', fontSize: 11 }}>取消</Text>
          </TouchableOpacity>
        </View>
      )}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0404',
  },
});
