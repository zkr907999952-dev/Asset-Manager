import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  N_SMALL, N_LARGE, SMALL_SEG_LENGTH, LARGE_SEG_LENGTH,
  SMALL_RADIUS, LARGE_RADIUS,
  PHYSICS_ITERATIONS, DAMPING, MESENTERY_STIFFNESS, SEGMENT_STIFFNESS,
  PERISTALSIS_BASE_SPEED, PERISTALSIS_AMPLITUDE,
  PERISTALSIS_WAVE_AMPLITUDE_DEFAULT, PERISTALSIS_WAVE_SPEED_DEFAULT,
  PRESSURE_DECAY_RATE,
  LARGE_RUPTURE_PRESSURE, EXPANSION_SCALE_DEFAULT,
} from '../constants/gameConfig';

export interface PhysicsNode {
  x: number; y: number;
  px: number; py: number;
  rx: number; ry: number; // rest position
  pinned: boolean;
}

export interface SegmentProps {
  health: number;      // 0-100
  sensitivity: number; // 0-100
  pain: number;        // 0-100
  pressure: number;    // 0-100
  ruptured: boolean;
  broken: boolean;
  perforated: boolean; // needle puncture mark — leaks pressure slowly
}

export interface PhysicsState {
  smallNodes: PhysicsNode[];
  largeNodes: PhysicsNode[];
  smallSegs: SegmentProps[];
  largeSegs: SegmentProps[];
  time: number;
  peristalsisSpeed: number;
  peristalsisBase: number;
  // Peristalsis wave expansion per node (scale factor, 1.0 = no expansion)
  periScaleSmall: number[];
  periScaleLarge: number[];
  peristalsisWaveAmplitude: number;
  peristalsisWaveSpeed: number;
  // tool state
  toolPos: { x: number; y: number } | null;
  toolType: string | null;
  toolActive: boolean;
  toolParam1: number;
  toolParam2: number;
  // Lever-mode insertion (rod / vibrator / needle when inserted via navel)
  toolAnchor: { x: number; y: number } | null;
  toolInserted: boolean;
  // Navel pierced
  navelPierced: boolean;
  // Grab tool
  grabbedNode: { type: 'small' | 'large'; idx: number } | null;
  // Electric
  electrodes: { x: number; y: number }[];
  // Enema tube head
  enemaHeadIdx: number;
  enemaInSmall: boolean;
  enemaSmallHeadIdx: number;
  expansionScale: number;
  pressureDiffusionRate: number;
  toolStates: Record<string, { active: boolean; param1: number; param2: number; pos?: { x: number; y: number } | null }>;
  relaxFrames: number;
  laxativeFrames: number;
  hpBonus: number;
  transfusionFrames: number;
  repairMarks: number[];
  sutureMarks: number[];
  largeRepairMarks: number[];
  largeSutureMarks: number[];
  mesenteryDisabled: number[];
  smallMesenteryDisabled: number[];
  smallTransplantColor: { r: number; g: number; b: number } | null;
  largeTransplantColor: { r: number; g: number; b: number } | null;
  // === Silicone rod — completely independent state ===
  siliconeHeadIdx: number;
  siliconeInSmall: boolean;
  siliconeSmallHeadIdx: number;
  // === Anal beads — completely independent state ===
  beadsHeadIdx: number;
  beadsInSmall: boolean;
  beadsSmallHeadIdx: number;
  beadsChain: { x: number; y: number; vx: number; vy: number }[];
}

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function dist(ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax, dy = by - ay;
  return Math.sqrt(dx * dx + dy * dy);
}

function insideCavity(x: number, y: number, margin = 0): boolean {
  const dx = (x - CAVITY_CX) / (CAVITY_RX - margin);
  const dy = (y - CAVITY_CY) / (CAVITY_RY - margin);
  return dx * dx + dy * dy < 1;
}

// Soft spring push: nudges nodes back without zeroing velocity.
// This prevents the "straight-line" physics collapse that occurs when
// hard-clamping resets px/py and destroys the Verlet velocity.
function softCavityPush(node: PhysicsNode, margin: number) {
  const dx = node.x - CAVITY_CX;
  const dy = node.y - CAVITY_CY;
  // Expand boundary by 24 px to create a gentler soft zone
  const softRX = CAVITY_RX - margin + 24;
  const softRY = CAVITY_RY - margin + 24;
  const nx = dx / softRX;
  const ny = dy / softRY;
  const r = Math.sqrt(nx * nx + ny * ny);
  if (r > 1) {
    const excess = r - 1;
    // Progressive spring: stronger when further outside
    const k = Math.min(0.85, 0.2 + excess * 1.8);
    node.x -= (nx / r) * excess * softRX * k;
    node.y -= (ny / r) * excess * softRY * k;
    // Only hard-clamp AND zero velocity if extremely far outside
    const dx2 = node.x - CAVITY_CX;
    const dy2 = node.y - CAVITY_CY;
    const r2 = Math.sqrt((dx2 / softRX) ** 2 + (dy2 / softRY) ** 2);
    if (r2 > 1.6) {
      node.x = CAVITY_CX + (dx2 / r2) * (softRX - 1);
      node.y = CAVITY_CY + (dy2 / r2) * (softRY - 1);
      node.px = node.x;
      node.py = node.y;
    }
  }
}

// Emergency hard clamp — only for final cleanup, never used in constraint loops
function clampToCavity(node: PhysicsNode, margin: number) {
  const dx = node.x - CAVITY_CX;
  const dy = node.y - CAVITY_CY;
  const softRX = CAVITY_RX - margin + 24;
  const softRY = CAVITY_RY - margin + 24;
  const nx = dx / softRX;
  const ny = dy / softRY;
  const r = Math.sqrt(nx * nx + ny * ny);
  if (r > 1.4) {
    node.x = CAVITY_CX + (nx / r) * (softRX - 1);
    node.y = CAVITY_CY + (ny / r) * (softRY - 1);
    node.px = node.x;
    node.py = node.y;
  }
}

function applyElectricPhysics(state: PhysicsState, param1: number, param2: number) {
  const voltage = param1 * 0.01;
  const radius = 30 + param2 * 0.3;
  for (const el of state.electrodes) {
    for (let i = 0; i < N_SMALL; i++) {
      const d = dist(state.smallNodes[i].x, state.smallNodes[i].y, el.x, el.y);
      if (d < radius) {
        const f = 1 - d / radius;
        const seg = state.smallSegs[i];
        if (seg && !seg.broken) {
          seg.pain = clamp(seg.pain + voltage * 6.0 * f, 0, 100);
          seg.sensitivity = clamp(seg.sensitivity + voltage * 4.0 * f, 0, 100);
          seg.health = clamp(seg.health - voltage * 0.6 * f, 0, 100);
        }
        const spasm = voltage * 42 * Math.sin(state.time * 1.5 + i * 0.8);
        state.smallNodes[i].x += spasm * 0.7 + (Math.random() - 0.5) * voltage * 18;
        state.smallNodes[i].y += spasm + (Math.random() - 0.5) * voltage * 18;
      }
    }
    for (let i = 0; i < state.largeNodes.length; i++) {
      const d = dist(state.largeNodes[i].x, state.largeNodes[i].y, el.x, el.y);
      if (d < radius) {
        const f = 1 - d / radius;
        const seg = state.largeSegs[i];
        if (seg && !seg.broken) {
          seg.pain = clamp(seg.pain + voltage * 4.5 * f, 0, 100);
          seg.sensitivity = clamp(seg.sensitivity + voltage * 3.0 * f, 0, 100);
        }
        const spasm = voltage * 34 * Math.sin(state.time * 1.5 + i * 0.6);
        state.largeNodes[i].x += spasm * 0.6 + (Math.random() - 0.5) * voltage * 14;
        state.largeNodes[i].y += spasm + (Math.random() - 0.5) * voltage * 14;
      }
    }
  }
}

// Per-node mesentery stiffness + dead zone for large intestine (N_LARGE=32)
// Indices: 0(cecum,unpinned), 9(hepatic flex), 15(splenic flex), 23-26(sigmoid), 27-30(rectum bends), 31(anus,pinned)
function largeNodeMesentery(idx: number): { stiffness: number; deadZone: number } {
  // Cecum (unpinned): very strong spring so it rebounds after being dragged
  if (idx === 0) return { stiffness: 0.38, deadZone: 0 };
  // Rectum bends + approach to anus: maximum stiffness, zero dead zone
  if (idx >= 27) return { stiffness: 0.45, deadZone: 0 };
  // Sigmoid colon: high stiffness, small dead zone
  if (idx >= 22 && idx <= 26) return { stiffness: 0.15, deadZone: 1.0 };
  // Splenic (right) flexure neighborhood
  if (idx >= 14 && idx <= 16) return { stiffness: 0.22, deadZone: 1.5 };
  // Hepatic (left) flexure neighborhood
  if (idx >= 8 && idx <= 10) return { stiffness: 0.22, deadZone: 1.5 };
  // All other large intestine nodes (ascending, transverse, descending)
  return { stiffness: 0.038, deadZone: 4.5 };
}

export function stepPhysics(state: PhysicsState) {
  // Guard: ensure new fields exist on legacy state objects
  if (!state.toolStates) (state as any).toolStates = {};
  if (state.pressureDiffusionRate === undefined) (state as any).pressureDiffusionRate = 0.004;
  if (!state.periScaleSmall || state.periScaleSmall.length !== N_SMALL)
    (state as any).periScaleSmall = new Array(N_SMALL).fill(1);
  if (!state.periScaleLarge || state.periScaleLarge.length !== N_LARGE)
    (state as any).periScaleLarge = new Array(N_LARGE).fill(1);
  if (state.peristalsisWaveAmplitude === undefined) (state as any).peristalsisWaveAmplitude = PERISTALSIS_WAVE_AMPLITUDE_DEFAULT;
  if (state.peristalsisWaveSpeed === undefined) (state as any).peristalsisWaveSpeed = PERISTALSIS_WAVE_SPEED_DEFAULT;
  if (state.relaxFrames === undefined) (state as any).relaxFrames = 0;
  if (state.laxativeFrames === undefined) (state as any).laxativeFrames = 0;
  if (state.hpBonus === undefined) (state as any).hpBonus = 0;
  if (state.transfusionFrames === undefined) (state as any).transfusionFrames = 0;
  if (!state.repairMarks) (state as any).repairMarks = [];
  if (!state.sutureMarks) (state as any).sutureMarks = [];
  if (!state.largeRepairMarks) (state as any).largeRepairMarks = [];
  if (!state.largeSutureMarks) (state as any).largeSutureMarks = [];
  if (!state.mesenteryDisabled) (state as any).mesenteryDisabled = [];
  if (!state.smallMesenteryDisabled) (state as any).smallMesenteryDisabled = [];
  if (state.smallTransplantColor === undefined) (state as any).smallTransplantColor = null;
  if (state.largeTransplantColor === undefined) (state as any).largeTransplantColor = null;

  const relaxMultiplier = state.relaxFrames > 0 ? 0.15 : 1.0;
  if (state.relaxFrames > 0) state.relaxFrames--;
  const laxativeActive = state.laxativeFrames > 0;
  if (laxativeActive) state.laxativeFrames--;
  if (state.transfusionFrames > 0) {
    state.transfusionFrames--;
    state.hpBonus = Math.min(100, state.hpBonus + 0.05);
  }

  state.time += 1;
  const t = state.time;
  state.peristalsisSpeed = state.peristalsisBase;
  const periSpeed = state.peristalsisSpeed * PERISTALSIS_BASE_SPEED;

  // --- Compute per-node peristalsis wave expansion scale ---
  // Small intestine: 7 peaks (dense, reflecting high motility of jejunum/ileum)
  // Large intestine: 3 peaks
  // Amplitude boosted by pain (irritation → hypermotility) and sensitivity
  // Amplitude reduced by high pressure (distension limits further expansion)
  const waveAmp = state.peristalsisWaveAmplitude * (laxativeActive ? 1.8 : 1.0);
  const waveSpeed = state.peristalsisWaveSpeed;
  for (let i = 0; i < N_SMALL; i++) {
    const seg = state.smallSegs[Math.min(i, state.smallSegs.length - 1)];
    const pressureRatio = seg ? clamp(seg.pressure / 100, 0, 1) : 0;
    const painBoost = seg ? clamp(seg.pain / 100, 0, 1) * 0.8 : 0;
    const sensBoost = seg ? clamp(seg.sensitivity / 100, 0, 1) * 0.5 : 0;
    const stimMultiplier = 1 + painBoost + sensBoost;
    const effectiveAmp = waveAmp * stimMultiplier * Math.max(0, 1 - pressureRatio * 0.85);
    const phase = (i / N_SMALL) * Math.PI * 14 - t * periSpeed * waveSpeed * 0.055;
    state.periScaleSmall[i] = 1 + effectiveAmp * Math.max(0, Math.sin(phase));
  }
  for (let i = 0; i < N_LARGE; i++) {
    const seg = state.largeSegs[Math.min(i, state.largeSegs.length - 1)];
    const pressureRatio = seg ? clamp(seg.pressure / LARGE_RUPTURE_PRESSURE, 0, 1) : 0;
    const painBoost = seg ? clamp(seg.pain / 100, 0, 1) * 0.5 : 0;
    const stimMultiplier = 1 + painBoost;
    const effectiveAmp = waveAmp * 0.8 * stimMultiplier * Math.max(0, 1 - pressureRatio * 0.85);
    const phase = (i / N_LARGE) * Math.PI * 6 - t * periSpeed * waveSpeed * 0.038;
    state.periScaleLarge[i] = 1 + effectiveAmp * Math.max(0, Math.sin(phase));
  }

  // --- Verlet integration with per-node mesentery ---
  const integrateSmallNodes = (nodes: PhysicsNode[], margin: number) => {
    for (let idx = 0; idx < nodes.length; idx++) {
      const n = nodes[idx];
      if (n.pinned) continue;
      const vx = (n.x - n.px) * DAMPING;
      const vy = (n.y - n.py) * DAMPING;
      n.px = n.x; n.py = n.y;
      n.x += vx;
      n.y += vy;
      // Small intestine: uniform mesentery with small dead zone
      const smallMesDis = (state.smallMesenteryDisabled ?? []).includes(idx);
      if (!smallMesDis) {
        const dx = n.rx - n.x, dy = n.ry - n.y;
        const disp = Math.sqrt(dx * dx + dy * dy);
        const deadZone = 5.0;
        if (disp > deadZone) {
          const factor = (disp - deadZone) / disp;
          n.x += dx * MESENTERY_STIFFNESS * relaxMultiplier * factor;
          n.y += dy * MESENTERY_STIFFNESS * relaxMultiplier * factor;
        }
      }
      softCavityPush(n, margin);
    }
  };
  const integrateLargeNodes = (nodes: PhysicsNode[], margin: number) => {
    for (let idx = 0; idx < nodes.length; idx++) {
      const n = nodes[idx];
      if (n.pinned) continue;
      const vx = (n.x - n.px) * DAMPING;
      const vy = (n.y - n.py) * DAMPING;
      n.px = n.x; n.py = n.y;
      n.x += vx;
      n.y += vy;
      // Per-node mesentery with dead zone for large intestine
      const mesDis = (state.mesenteryDisabled ?? []).includes(idx);
      const { stiffness: rawStiff, deadZone } = mesDis ? { stiffness: 0, deadZone: 999 } : largeNodeMesentery(idx);
      const stiffness = rawStiff * relaxMultiplier;
      const dx = n.rx - n.x, dy = n.ry - n.y;
      const disp = Math.sqrt(dx * dx + dy * dy);
      if (!mesDis && disp > deadZone) {
        const factor = deadZone > 0 ? (disp - deadZone) / disp : 1;
        n.x += dx * stiffness * factor;
        n.y += dy * stiffness * factor;
      }
      softCavityPush(n, margin);
    }
  };
  integrateSmallNodes(state.smallNodes, 8);
  integrateLargeNodes(state.largeNodes, 2);

  // --- Peristalsis wave forces on small intestine ---
  for (let i = 0; i < N_SMALL; i++) {
    const n = state.smallNodes[i];
    if (n.pinned) continue;
    const phase = (i / N_SMALL) * Math.PI * 2 - t * periSpeed * 0.04;
    const fx = Math.cos(phase) * PERISTALSIS_AMPLITUDE * 0.3;
    const fy = Math.sin(phase) * PERISTALSIS_AMPLITUDE * 0.5;
    n.x += fx * 0.4;
    n.y += fy * 0.4;
  }
  for (let i = 0; i < N_LARGE; i++) {
    const n = state.largeNodes[i];
    if (n.pinned) continue;
    const phase = (i / N_LARGE) * Math.PI * 2 - t * periSpeed * 0.025;
    n.x += Math.cos(phase) * 0.3;
    n.y += Math.sin(phase) * 0.3;
  }

  // --- Constraint satisfaction ---
  const satisfyChain = (
    nodes: PhysicsNode[], segLen: number, breakBroken: boolean,
    segs: SegmentProps[], cavMargin: number,
  ) => {
    for (let iter = 0; iter < PHYSICS_ITERATIONS; iter++) {
      for (let i = 0; i < nodes.length - 1; i++) {
        if (breakBroken && segs[i] && segs[i].broken) continue;
        const a = nodes[i], b = nodes[i + 1];
        if (a.pinned && b.pinned) continue;
        const dx = b.x - a.x, dy = b.y - a.y;
        const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
        const diff = (d - segLen) / d * SEGMENT_STIFFNESS * 0.5;
        if (!a.pinned) { a.x += dx * diff; a.y += dy * diff; }
        if (!b.pinned) { b.x -= dx * diff; b.y -= dy * diff; }
      }
      // Use soft push in constraint loop — never zero velocity here
      for (const n of nodes) {
        if (!n.pinned) softCavityPush(n, cavMargin);
      }
    }
    const maxStretch = segLen * 2.5;
    for (let i = 0; i < nodes.length - 1; i++) {
      const a = nodes[i], b = nodes[i + 1];
      if (a.pinned && b.pinned) continue;
      const dx = b.x - a.x, dy = b.y - a.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 0.001;
      if (d > maxStretch) {
        const corr = (d - maxStretch) / d * 0.9;
        if (!a.pinned) { a.x += dx * corr * 0.5; a.y += dy * corr * 0.5; }
        if (!b.pinned) { b.x -= dx * corr * 0.5; b.y -= dy * corr * 0.5; }
      }
    }
  };
  satisfyChain(state.smallNodes, SMALL_SEG_LENGTH, true, state.smallSegs, 8);
  satisfyChain(state.largeNodes, LARGE_SEG_LENGTH, true, state.largeSegs, 2);

  // --- Separation constraint between small and large intestine ---
  for (let si = 0; si < state.smallNodes.length; si++) {
    const sn = state.smallNodes[si];
    const sSeg = state.smallSegs[Math.min(si, state.smallSegs.length - 1)];
    const sPeriScale = state.periScaleSmall[si] ?? 1;
    // Peristalsis wave scales the base radius; pressure expansion adds on top
    const sExpR = SMALL_RADIUS * sPeriScale * (1 + (sSeg.pressure / 100) * state.expansionScale * 0.45);

    for (let li = 0; li < state.largeNodes.length; li++) {
      const ln = state.largeNodes[li];
      const lSeg = state.largeSegs[Math.min(li, state.largeSegs.length - 1)];
      const lPeriScale = state.periScaleLarge[li] ?? 1;
      const lExpR = LARGE_RADIUS * lPeriScale * (1 + (lSeg.pressure / LARGE_RUPTURE_PRESSURE) * state.expansionScale * 0.45);

      const dx = sn.x - ln.x, dy = sn.y - ln.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const minDist = sExpR + lExpR;
      if (d < minDist && d > 0.01) {
        const push = (minDist - d) / d * 0.55;
        sn.x += dx * push * 0.6;
        sn.y += dy * push * 0.6;
      }
    }
  }

  // --- Ileocecal junction spring ---
  {
    const terminalIleum = state.smallNodes[N_SMALL - 1];
    const cecum = state.largeNodes[0];
    if (terminalIleum && cecum && !terminalIleum.pinned) {
      const jDx = cecum.x - terminalIleum.x;
      const jDy = cecum.y - terminalIleum.y;
      const jDist = Math.sqrt(jDx * jDx + jDy * jDy);
      const restDist = 22;
      if (jDist > 0.01) {
        const springF = (jDist - restDist) / jDist * 0.07;
        terminalIleum.x += jDx * springF;
        terminalIleum.y += jDy * springF;
      }
    }
  }

  // --- Compute lever rod geometry ---
  const computeRodGeometry = (rodLen: number, autoStirAmp = 0): { head: { x: number; y: number }; segments: { x: number; y: number }[]; insideLen: number } => {
    const tp = state.toolPos!;
    if (state.toolInserted && state.toolAnchor) {
      const a = state.toolAnchor;
      const handleDist = dist(tp.x, tp.y, a.x, a.y);
      const insideLen = Math.max(0, rodLen - handleDist);
      if (insideLen < 0.5) {
        return { head: a, segments: [a], insideLen: 0 };
      }
      let dx = a.x - tp.x, dy = a.y - tp.y;
      const dmag = Math.sqrt(dx * dx + dy * dy) || 1;
      dx /= dmag; dy /= dmag;
      let ox = 0, oy = 0;
      if (autoStirAmp > 0) {
        const stir = Math.sin(state.time * 0.25) * autoStirAmp;
        ox = -dy * stir;
        oy = dx * stir;
      }
      const head = { x: a.x + dx * insideLen + ox, y: a.y + dy * insideLen + oy };
      const segments: { x: number; y: number }[] = [];
      const samples = 6;
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        segments.push({ x: a.x + dx * insideLen * t + ox * t, y: a.y + dy * insideLen * t + oy * t });
      }
      return { head, segments, insideLen };
    }
    const head = tp;
    let stir = 0;
    if (autoStirAmp > 0) stir = Math.sin(state.time * 0.25) * autoStirAmp;
    const segments: { x: number; y: number }[] = [];
    const samples = 8;
    for (let i = 0; i <= samples; i++) {
      const tt = i / samples;
      segments.push({ x: tp.x + stir * (1 - tt), y: tp.y - rodLen * tt });
    }
    return { head, segments, insideLen: rodLen };
  };

  const applyRodCollision = (rodSegments: { x: number; y: number }[], rodRadius: number) => {
    const allNodes = [state.smallNodes, state.largeNodes];
    for (const nodes of allNodes) {
      for (const n of nodes) {
        for (const seg of rodSegments) {
          const d = dist(n.x, n.y, seg.x, seg.y);
          if (d < rodRadius && d > 0.01) {
            const push = (rodRadius - d) / d * 0.7;
            n.x += (n.x - seg.x) * push;
            n.y += (n.y - seg.y) * push;
          }
        }
      }
    }
  };

  // --- Tool interaction ---
  if (state.toolPos) {
    const tp = state.toolPos;

    if (state.toolType === '金属棒' || state.toolType === '振动器') {
      const isVib = state.toolType === '振动器';
      const rodLen = 80 + state.toolParam1 * (isVib ? 1.2 : 1.0);
      const stirAmp = state.toolActive ? (isVib ? 4 : 2 + state.toolParam2 * 0.04) : 0;
      const { head, segments } = computeRodGeometry(rodLen, stirAmp);
      const rodRadius = 9;
      applyRodCollision(segments, rodRadius);

      if (state.toolActive) {
        const zone = isVib ? 30 + state.toolParam2 * 0.4 : 18;
        const sensRate = isVib ? 0.18 : 0.04;
        const painRate = isVib ? 0.025 : 0.01;
        const applyZone = (nodes: PhysicsNode[], segs: SegmentProps[]) => {
          for (let i = 0; i < nodes.length; i++) {
            const d = dist(nodes[i].x, nodes[i].y, head.x, head.y);
            if (d < zone) {
              const f = 1 - d / zone;
              const seg = segs[i];
              if (seg && !seg.broken) {
                seg.sensitivity = clamp(seg.sensitivity + sensRate * f, 0, 100);
                seg.pain = clamp(seg.pain + painRate * f, 0, 100);
              }
            }
          }
        };
        applyZone(state.smallNodes, state.smallSegs);
        applyZone(state.largeNodes, state.largeSegs);
      }
    }

    if (state.toolType === '抓握' && state.grabbedNode) {
      const { type, idx } = state.grabbedNode;
      const nodes = type === 'small' ? state.smallNodes : state.largeNodes;
      const segs = type === 'small' ? state.smallSegs : state.largeSegs;
      const n = nodes[idx];
      if (n) {
        const cavMargin = type === 'small' ? 12 : 6;
        let tx = tp.x, ty = tp.y;
        const tdx = tx - CAVITY_CX, tdy = ty - CAVITY_CY;
        const tnx = tdx / (CAVITY_RX - cavMargin), tny = tdy / (CAVITY_RY - cavMargin);
        const tr = Math.sqrt(tnx * tnx + tny * tny);
        if (tr > 1) {
          tx = CAVITY_CX + (tdx / tr) * (CAVITY_RX - cavMargin - 1);
          ty = CAVITY_CY + (tdy / tr) * (CAVITY_RY - cavMargin - 1);
        }
        const dx = tx - n.x, dy = ty - n.y;
        const grabForce = 0.3 + state.toolParam2 * 0.005;
        n.x += dx * grabForce;
        n.y += dy * grabForce;
        if (state.toolActive) {
          const seg = segs[idx];
          if (seg) {
            seg.pressure = clamp(seg.pressure + 0.15, 0, 100);
            seg.sensitivity = clamp(seg.sensitivity + 0.05, 0, 100);
          }
        }
      }
    }

    if (state.toolType === '注射器' && state.toolActive) {
      const SYRINGE_RANGE = 55;
      const rate = state.toolParam1 * 0.012;
      const stimRate = state.toolParam2 * 0.006;
      for (let i = 0; i < N_SMALL; i++) {
        const d = dist(state.smallNodes[i].x, state.smallNodes[i].y, tp.x, tp.y);
        if (d < SYRINGE_RANGE) {
          const f = 1 - d / SYRINGE_RANGE;
          const seg = state.smallSegs[i];
          if (seg && !seg.broken) {
            seg.pressure = clamp(seg.pressure + rate * f, 0, 100);
            seg.pain = clamp(seg.pain + stimRate * 0.5 * f, 0, 100);
            seg.sensitivity = clamp(seg.sensitivity + stimRate * f, 0, 100);
            seg.health = clamp(seg.health - rate * 0.015 * f, 0, 100);
          }
        }
      }
      for (let i = 0; i < N_LARGE; i++) {
        const d = dist(state.largeNodes[i].x, state.largeNodes[i].y, tp.x, tp.y);
        if (d < SYRINGE_RANGE * 0.7) {
          const f = 1 - d / (SYRINGE_RANGE * 0.7);
          const seg = state.largeSegs[i];
          if (seg && !seg.broken) {
            seg.pressure = clamp(seg.pressure + rate * f * 0.6, 0, LARGE_RUPTURE_PRESSURE);
            seg.sensitivity = clamp(seg.sensitivity + stimRate * f * 0.5, 0, 100);
          }
        }
      }
    }

    if (state.toolType === '长柄针') {
      const rodLen = 90 + state.toolParam1 * 1.0;
      const stirAmp = state.toolActive ? 1.5 + state.toolParam2 * 0.04 : 0;
      const { head, segments } = computeRodGeometry(rodLen, stirAmp);
      applyRodCollision(segments, 5);
      if (state.toolActive) {
        const strength = 0.05 + state.toolParam2 * 0.004;
        const stirSpeed = Math.abs(Math.sin(state.time * 0.25)) * stirAmp;
        const range = 14;
        const applyPierce = (nodes: PhysicsNode[], segs: SegmentProps[]) => {
          for (let i = 0; i < nodes.length; i++) {
            const d = dist(nodes[i].x, nodes[i].y, head.x, head.y);
            if (d < range) {
              const seg = segs[i];
              if (seg && !seg.broken) {
                seg.pain = clamp(seg.pain + strength * (5 + stirSpeed * 6), 0, 100);
                seg.sensitivity = clamp(seg.sensitivity + strength * (2 + stirSpeed * 3), 0, 100);
                seg.health = clamp(seg.health - strength * 0.8, 0, 100);
                if (state.toolParam2 > 40 && !seg.perforated && Math.random() < 0.03) {
                  seg.perforated = true;
                }
              }
            }
          }
        };
        applyPierce(state.smallNodes, state.smallSegs);
        applyPierce(state.largeNodes, state.largeSegs);
      }
    }

    if (state.toolType === '灌肠器') {
      const headIdx = clamp(state.enemaHeadIdx, 0, state.largeNodes.length - 1);
      const headNode = state.largeNodes[headIdx];
      if (headNode && !state.enemaInSmall) {
        const tubePush = 0.3;
        for (let i = Math.max(0, headIdx - 2); i <= Math.min(state.largeNodes.length - 1, headIdx + 2); i++) {
          const n = state.largeNodes[i];
          if (n.pinned) continue;
          const wobble = Math.sin(state.time * 0.15 + i) * tubePush;
          n.x += wobble;
          n.y += wobble * 0.5;
        }
      }
      if (state.toolActive) {
        const flow = 0.1 + state.toolParam1 * 0.025;
        const stim = state.toolParam2 * 0.005;
        if (!state.enemaInSmall) {
          const N = state.largeSegs.length;
          for (let i = 0; i < N; i++) {
            const seg = state.largeSegs[i];
            if (seg.broken) continue;
            const d = Math.abs(i - headIdx);
            const falloff = Math.max(0, 1 - d / 5);
            if (falloff > 0) {
              seg.pressure = clamp(seg.pressure + flow * falloff, 0, 100);
              seg.sensitivity = clamp(seg.sensitivity + stim * falloff, 0, 100);
              if (seg.pressure > 60) {
                seg.pain = clamp(seg.pain + stim * 0.6, 0, 100);
              }
            }
          }
        } else {
          for (let i = 0; i < state.largeSegs.length; i++) {
            const seg = state.largeSegs[i];
            if (seg.broken) continue;
            seg.pressure = clamp(seg.pressure + flow * 0.4, 0, 100);
            seg.sensitivity = clamp(seg.sensitivity + stim * 0.3, 0, 100);
          }
          const smallHead = clamp(state.enemaSmallHeadIdx, 0, N_SMALL - 1);
          for (let i = 0; i < state.smallSegs.length; i++) {
            const seg = state.smallSegs[i];
            if (seg.broken) continue;
            const d = Math.abs(i - smallHead);
            const falloff = Math.max(0, 1 - d / 4);
            if (falloff > 0) {
              seg.pressure = clamp(seg.pressure + flow * 1.1 * falloff, 0, 100);
              seg.sensitivity = clamp(seg.sensitivity + stim * 1.3 * falloff, 0, 100);
              if (seg.pressure > 50) {
                seg.pain = clamp(seg.pain + stim * 0.8 * falloff, 0, 100);
              }
            }
          }
          for (let i = Math.max(0, smallHead - 2); i <= Math.min(N_SMALL - 1, smallHead + 2); i++) {
            const n = state.smallNodes[i];
            if (n.pinned) continue;
            const wobble = Math.sin(state.time * 0.18 + i) * 0.35;
            n.x += wobble;
            n.y += wobble * 0.5;
          }
        }
        const periBoost = state.enemaInSmall ? 0.035 : 0.025;
        state.peristalsisSpeed = Math.max(state.peristalsisSpeed, 1 + state.toolParam2 * periBoost);
      }
    }

    if (state.toolType === '电击器' && state.toolActive) {
      applyElectricPhysics(state, state.toolParam1, state.toolParam2);
    }

    if (state.toolType === '刺刀') {
      const bladeLen = 80 + state.toolParam1 * 1.5;
      const bladeWidth = Math.max(4, 4 + state.toolParam2 * 0.12);
      const stirAmp = state.toolActive ? 3 + state.toolParam2 * 0.04 : 0;
      const { head, segments } = computeRodGeometry(bladeLen, stirAmp);
      applyRodCollision(segments, Math.max(3, bladeWidth * 0.4));

      // Bayonet can pierce navel directly when active and near navel
      if (!state.navelPierced && state.toolActive) {
        const navelDist = dist(tp.x, tp.y, CAVITY_CX, CAVITY_CY);
        if (navelDist < 30) {
          state.navelPierced = true;
        }
      }

      if (state.toolActive) {
        const tipRange = 10;
        const applyBayonet = (nodes: PhysicsNode[], segs: SegmentProps[]) => {
          for (let i = 0; i < nodes.length; i++) {
            const dTip = dist(nodes[i].x, nodes[i].y, head.x, head.y);
            if (dTip < tipRange) {
              const f = 1 - dTip / tipRange;
              const seg = segs[i];
              if (seg && !seg.broken) {
                seg.pain = clamp(seg.pain + 0.9 * f, 0, 100);
                seg.health = clamp(seg.health - 0.8 * f, 0, 100);
                seg.sensitivity = clamp(seg.sensitivity + 0.3 * f, 0, 100);
                if (!seg.perforated && Math.random() < 0.04 + state.toolParam2 * 0.0005) {
                  seg.perforated = true;
                }
              }
            }
            for (let si = 0; si < segments.length - 1; si++) {
              const s = segments[si];
              const dBody = dist(nodes[i].x, nodes[i].y, s.x, s.y);
              if (dBody < bladeWidth * 0.55 && dBody > 0.1) {
                const f = 1 - dBody / (bladeWidth * 0.55);
                const seg = segs[i];
                if (seg && !seg.broken) {
                  seg.pain = clamp(seg.pain + 0.12 * f, 0, 100);
                  seg.sensitivity = clamp(seg.sensitivity + 0.06 * f, 0, 100);
                  seg.health = clamp(seg.health - 0.05 * f, 0, 100);
                }
              }
            }
          }
        };
        applyBayonet(state.smallNodes, state.smallSegs);
        applyBayonet(state.largeNodes, state.largeSegs);
      }
    }

    // === 长硅胶棒 — fully independent state, no sharing with enema ===
    if (state.toolType === '长硅胶棒') {
      const rodDiam = SMALL_RADIUS * 2 + state.toolParam1 * 0.3;
      const largeDiam = LARGE_RADIUS * 2;
      const smallDiam = SMALL_RADIUS * 2;
      const speedFactor = 0.5 + (state.toolParam2 ?? 50) * 0.01;
      const headIdx = clamp(state.siliconeHeadIdx, 0, N_LARGE - 1);

      // Physical wobble at head — rod pushes the intestine wall
      for (let i = Math.max(0, headIdx - 1); i <= Math.min(N_LARGE - 1, headIdx + 1); i++) {
        const n = state.largeNodes[i];
        if (n && !n.pinned) {
          n.x += Math.sin(state.time * 0.13 + i * 0.7) * 0.32 * speedFactor;
          n.y += Math.cos(state.time * 0.10 + i * 0.5) * 0.16 * speedFactor;
        }
      }
      if (state.siliconeInSmall) {
        const sHead = clamp(state.siliconeSmallHeadIdx, 0, N_SMALL - 1);
        for (let i = Math.max(0, sHead - 1); i <= Math.min(N_SMALL - 1, sHead + 1); i++) {
          const n = state.smallNodes[i];
          if (n && !n.pinned) {
            n.x += Math.sin(state.time * 0.16 + i * 0.9) * 0.28 * speedFactor;
            n.y += Math.cos(state.time * 0.13 + i * 0.6) * 0.14 * speedFactor;
          }
        }
      }

      if (state.toolActive) {
        const stim = speedFactor * 0.0035;
        if (!state.siliconeInSmall) {
          const largeExp = Math.max(0, rodDiam - largeDiam) / largeDiam;
          // All segments the rod passes through (head to anus) get stimulated
          for (let i = headIdx; i < state.largeSegs.length; i++) {
            const seg = state.largeSegs[i];
            if (!seg || seg.broken) continue;
            const distFromHead = i - headIdx;
            const falloff = Math.max(0.08, 1.0 - distFromHead * 0.035);
            const pressureAdd = largeExp > 0
              ? largeExp * 3.5 * falloff
              : 0.25 * falloff;
            seg.pressure = clamp(seg.pressure + pressureAdd, 0, LARGE_RUPTURE_PRESSURE);
            seg.sensitivity = clamp(seg.sensitivity + stim * (1 + largeExp * 2.5) * falloff, 0, 100);
            if (seg.pressure > 110) {
              seg.pain = clamp(seg.pain + stim * (largeExp + 0.2) * falloff, 0, 100);
            }
          }
        } else {
          // In small intestine — more sensitive, easier rupture
          const smallHead = clamp(state.siliconeSmallHeadIdx, 0, N_SMALL - 1);
          const smallExp = Math.max(0, rodDiam - smallDiam) / smallDiam;
          for (let i = smallHead; i < state.smallSegs.length; i++) {
            const seg = state.smallSegs[i];
            if (!seg || seg.broken) continue;
            const distFromHead = i - smallHead;
            const falloff = Math.max(0.12, 1.0 - distFromHead * 0.06);
            const pressureAdd = smallExp > 0
              ? smallExp * 7 * falloff
              : 1.0 * falloff;
            seg.pressure = clamp(seg.pressure + pressureAdd, 0, 100);
            seg.sensitivity = clamp(seg.sensitivity + stim * (2.8 + smallExp * 4.5) * falloff, 0, 100);
            if (seg.pressure > 50) {
              seg.pain = clamp(seg.pain + stim * (0.6 + smallExp * 1.8) * falloff, 0, 100);
            }
            if (seg.pressure >= 100 && !seg.ruptured && Math.random() < 0.012 * (1 + smallExp * 2)) {
              seg.ruptured = true;
            }
          }
          // Large intestine still stimulated (rod passes through all of it)
          const largeExp = Math.max(0, rodDiam - largeDiam) / largeDiam;
          for (let i = 0; i < state.largeSegs.length; i++) {
            const seg = state.largeSegs[i];
            if (!seg || seg.broken) continue;
            const pressureAdd = largeExp > 0 ? largeExp * 1.8 : 0.12;
            seg.pressure = clamp(seg.pressure + pressureAdd, 0, LARGE_RUPTURE_PRESSURE);
            seg.sensitivity = clamp(seg.sensitivity + stim * 0.9, 0, 100);
          }
        }
        state.peristalsisSpeed = Math.max(state.peristalsisSpeed, 1 + (state.toolParam2 ?? 50) * 0.012);
      }
    }

    // === 拉珠 — fully independent state, no sharing with enema or silicone ===
    if (state.toolType === '拉珠') {
      const BEAD_RADII: number[] = [];
      for (let i = 0; i < 20; i++) BEAD_RADII.push(3 + i * 0.65);
      const speedFactor = 0.5 + (state.toolParam2 ?? 50) * 0.01;
      const headIdx = clamp(state.beadsHeadIdx, 0, N_LARGE - 1);

      if (state.toolActive) {
        if (!state.beadsInSmall) {
          const internalCount = Math.min(20, Math.max(0, N_LARGE - headIdx));
          for (let i = 0; i < internalCount; i++) {
            const segIdx = headIdx + i;
            if (segIdx >= state.largeSegs.length) break;
            const seg = state.largeSegs[segIdx];
            if (!seg || seg.broken) continue;
            const ballDiam = BEAD_RADII[i] * 2;
            const largeDiam = LARGE_RADIUS * 2;
            const expansion = Math.max(0, ballDiam - largeDiam) / largeDiam;
            const stim = speedFactor * 0.006 * (1 + i * 0.04);
            seg.pressure = clamp(seg.pressure + (expansion > 0 ? expansion * 4.5 : 0.35), 0, LARGE_RUPTURE_PRESSURE);
            seg.sensitivity = clamp(seg.sensitivity + stim * (1 + expansion * 2.5), 0, 100);
            if (seg.pressure > 110) {
              seg.pain = clamp(seg.pain + stim * (expansion + 0.2), 0, 100);
            }
          }
          // Wobble at head
          for (let i = Math.max(0, headIdx - 1); i <= Math.min(N_LARGE - 1, headIdx + 1); i++) {
            const n = state.largeNodes[i];
            if (n && !n.pinned) {
              n.x += Math.sin(state.time * 0.14 + i) * 0.25 * speedFactor;
              n.y += Math.cos(state.time * 0.11 + i) * 0.12 * speedFactor;
            }
          }
        } else {
          const smallHead = clamp(state.beadsSmallHeadIdx, 0, N_SMALL - 1);
          const smallInternal = Math.min(10, Math.max(0, N_SMALL - smallHead));
          for (let i = 0; i < smallInternal; i++) {
            const segIdx = smallHead + i;
            if (segIdx >= state.smallSegs.length) break;
            const seg = state.smallSegs[segIdx];
            if (!seg || seg.broken) continue;
            const ballDiam = BEAD_RADII[Math.min(i, 14)] * 2;
            const smallDiam = SMALL_RADIUS * 2;
            const expansion = Math.max(0, ballDiam - smallDiam) / smallDiam;
            const stim = speedFactor * 0.009 * (1 + i * 0.06);
            seg.pressure = clamp(seg.pressure + (expansion > 0 ? expansion * 8 : 1.0), 0, 100);
            seg.sensitivity = clamp(seg.sensitivity + stim * (2.5 + expansion * 4), 0, 100);
            if (seg.pressure > 45) {
              seg.pain = clamp(seg.pain + stim * (0.6 + expansion * 1.2), 0, 100);
            }
            if (seg.pressure >= 100 && !seg.ruptured && Math.random() < 0.018) {
              seg.ruptured = true;
            }
          }
          for (let i = 0; i < state.largeSegs.length; i++) {
            const seg = state.largeSegs[i];
            if (!seg || seg.broken) continue;
            const ballDiam = BEAD_RADII[Math.min(i, 19)] * 2;
            const exp = Math.max(0, ballDiam - LARGE_RADIUS * 2) / (LARGE_RADIUS * 2);
            seg.pressure = clamp(seg.pressure + (exp > 0 ? exp * 2 : 0.18), 0, LARGE_RUPTURE_PRESSURE);
            seg.sensitivity = clamp(seg.sensitivity + speedFactor * 0.005, 0, 100);
          }
        }
        state.peristalsisSpeed = Math.max(state.peristalsisSpeed, 1 + (state.toolParam2 ?? 50) * 0.013);
      }

      // External chain physics — runs every tick (independent of toolActive)
      const anusNode = state.largeNodes[N_LARGE - 1];
      const internalCount = state.beadsInSmall
        ? Math.min(20, N_LARGE)
        : Math.min(20, Math.max(0, N_LARGE - headIdx));
      const externalCount = Math.max(0, 20 - internalCount);

      if (externalCount > 0 && anusNode) {
        // Grow chain array if needed
        while (state.beadsChain.length < 20) {
          const j = state.beadsChain.length;
          state.beadsChain.push({ x: anusNode.x, y: anusNode.y + (j + 1) * 14, vx: 0, vy: 0 });
        }
        const chain = state.beadsChain;
        // Gravity + damping
        for (let i = 0; i < externalCount; i++) {
          chain[i].vy += 0.38;
          chain[i].vx *= 0.87;
          chain[i].vy *= 0.87;
          chain[i].x += chain[i].vx;
          chain[i].y += chain[i].vy;
        }
        // Distance constraints (4 iterations)
        for (let iter = 0; iter < 4; iter++) {
          // Anchor: first external ball attached to anus
          const gIdx0 = internalCount;
          const rFirst = BEAD_RADII[gIdx0] ?? 3;
          const rAnchor = internalCount > 0 ? (BEAD_RADII[internalCount - 1] ?? 3) : 3;
          const targetD0 = rFirst + rAnchor + 3;
          const dx0 = chain[0].x - anusNode.x;
          const dy0 = chain[0].y - anusNode.y;
          const d0 = Math.hypot(dx0, dy0) || 1;
          if (d0 > targetD0) {
            const corr = (d0 - targetD0) / d0;
            chain[0].x -= dx0 * corr;
            chain[0].y -= dy0 * corr;
            chain[0].vx -= dx0 * corr * 0.08;
            chain[0].vy -= dy0 * corr * 0.08;
          }
          // Constraints between consecutive external balls
          for (let i = 1; i < externalCount; i++) {
            const gA = internalCount + i - 1;
            const gB = internalCount + i;
            const rA = BEAD_RADII[Math.min(gA, 19)] ?? 3;
            const rB = BEAD_RADII[Math.min(gB, 19)] ?? 3;
            const tDist = rA + rB + 3;
            const dx = chain[i].x - chain[i - 1].x;
            const dy = chain[i].y - chain[i - 1].y;
            const d = Math.hypot(dx, dy) || 1;
            if (d > tDist) {
              const corr = (d - tDist) / d * 0.5;
              chain[i].x -= dx * corr;
              chain[i].y -= dy * corr;
              chain[i - 1].x += dx * corr;
              chain[i - 1].y += dy * corr;
            }
          }
        }
      }
    }
  }

  // === SECONDARY TOOL PHYSICS: tools that persist independently ===
  const ENEMA_KEY = '灌肠器';
  if (state.toolType !== ENEMA_KEY && state.toolStates[ENEMA_KEY]?.active) {
    const ts = state.toolStates[ENEMA_KEY];
    const flow = 0.1 + ts.param1 * 0.025;
    const stim = ts.param2 * 0.005;
    const headIdx = clamp(state.enemaHeadIdx, 0, state.largeNodes.length - 1);
    if (!state.enemaInSmall) {
      const N = state.largeSegs.length;
      for (let i = 0; i < N; i++) {
        const seg = state.largeSegs[i];
        if (seg.broken) continue;
        const d = Math.abs(i - headIdx);
        const falloff = Math.max(0, 1 - d / 5);
        if (falloff > 0) {
          seg.pressure = clamp(seg.pressure + flow * falloff, 0, 100);
          seg.sensitivity = clamp(seg.sensitivity + stim * falloff, 0, 100);
          if (seg.pressure > 60) seg.pain = clamp(seg.pain + stim * 0.6, 0, 100);
        }
      }
    } else {
      for (let i = 0; i < state.largeSegs.length; i++) {
        const seg = state.largeSegs[i];
        if (!seg.broken) {
          seg.pressure = clamp(seg.pressure + flow * 0.4, 0, 100);
          seg.sensitivity = clamp(seg.sensitivity + stim * 0.3, 0, 100);
        }
      }
      const smallHead = clamp(state.enemaSmallHeadIdx, 0, N_SMALL - 1);
      for (let i = 0; i < state.smallSegs.length; i++) {
        const seg = state.smallSegs[i];
        if (seg.broken) continue;
        const falloff = Math.max(0, 1 - Math.abs(i - smallHead) / 4);
        if (falloff > 0) {
          seg.pressure = clamp(seg.pressure + flow * 1.1 * falloff, 0, 100);
          seg.sensitivity = clamp(seg.sensitivity + stim * 1.3 * falloff, 0, 100);
          if (seg.pressure > 50) seg.pain = clamp(seg.pain + stim * 0.8 * falloff, 0, 100);
        }
      }
      const periBoost = state.enemaInSmall ? 0.035 : 0.025;
      state.peristalsisSpeed = Math.max(state.peristalsisSpeed, 1 + ts.param2 * periBoost);
    }
  }

  const ELEC_KEY = '电击器';
  if (state.toolType !== ELEC_KEY && state.toolStates[ELEC_KEY]?.active && state.electrodes.length > 0) {
    const ts = state.toolStates[ELEC_KEY];
    applyElectricPhysics(state, ts.param1, ts.param2);
  }

  // --- Perforation leakage ---
  for (const seg of state.smallSegs) {
    if (seg.perforated && !seg.broken) {
      seg.pressure = clamp(seg.pressure - 0.05, 0, 100);
      seg.pain = clamp(seg.pain + 0.02, 0, 100);
    }
  }
  for (const seg of state.largeSegs) {
    if (seg.perforated && !seg.broken) {
      seg.pressure = clamp(seg.pressure - 0.05, 0, 100);
      seg.pain = clamp(seg.pain + 0.02, 0, 100);
    }
  }

  // --- Pressure diffusion & effects ---
  const diffuseAndUpdate = (segs: SegmentProps[], nodes: PhysicsNode[], maxPressure: number) => {
    const n = segs.length;
    const prevPressures = segs.map(s => s.pressure);
    for (let i = 0; i < n; i++) {
      const seg = segs[i];
      if (seg.broken) continue;
      // diffuse to neighbors (only across intact connections)
      if (i > 0 && !segs[i - 1].broken) {
        const diff = (prevPressures[i] - prevPressures[i - 1]) * state.pressureDiffusionRate;
        seg.pressure -= diff;
        segs[i - 1].pressure += diff;
      }
      if (i < n - 1 && !segs[i + 1].broken) {
        const diff = (prevPressures[i] - prevPressures[i + 1]) * state.pressureDiffusionRate;
        seg.pressure -= diff;
        segs[i + 1].pressure += diff;
      }
      seg.pressure = clamp(seg.pressure - PRESSURE_DECAY_RATE, 0, maxPressure);
      seg.pain = clamp(seg.pain - 0.005, 0, 100);
      seg.sensitivity = clamp(seg.sensitivity - 0.002, 0, 100);

      // === RUPTURE: pressure exceeds max — BURST EVENT ===
      if (seg.pressure >= maxPressure && !seg.ruptured) {
        seg.ruptured = true;
        // Explosive decompression: instantly drop pressure to near zero
        seg.pressure = clamp(seg.pressure * 0.05, 0, maxPressure);
        // Massive pain spike from sudden tearing
        seg.pain = clamp(seg.pain + 65, 0, 100);
        // Pleasure spike from intense stimulation
        seg.sensitivity = clamp(seg.sensitivity + 35, 0, 100);
        seg.health = clamp(seg.health - 40, 0, 100);
        // Pressure wave to neighbors — burst splashes adjacent segments
        if (i > 0 && !segs[i - 1].broken) {
          segs[i - 1].pain = clamp(segs[i - 1].pain + 25, 0, 100);
          segs[i - 1].pressure = clamp(segs[i - 1].pressure * 0.6, 0, maxPressure);
        }
        if (i < n - 1 && !segs[i + 1].broken) {
          segs[i + 1].pain = clamp(segs[i + 1].pain + 25, 0, 100);
          segs[i + 1].pressure = clamp(segs[i + 1].pressure * 0.6, 0, maxPressure);
        }
        // Physical burst: push nodes away from each other
        if (nodes[i] && nodes[i + 1] && !nodes[i].pinned) {
          const bDx = nodes[i + 1].x - nodes[i].x;
          const bDy = nodes[i + 1].y - nodes[i].y;
          const bD = Math.sqrt(bDx * bDx + bDy * bDy) || 1;
          const burstForce = 6;
          nodes[i].x -= (bDx / bD) * burstForce;
          nodes[i].y -= (bDy / bD) * burstForce;
        }
      }
      // Ongoing ruptured segment: slow continued pressure drain
      if (seg.ruptured && !seg.broken) {
        seg.pressure = clamp(seg.pressure - 1.2, 0, maxPressure);
        // Ruptured segments continue to hurt
        seg.pain = clamp(seg.pain + 0.04, 0, 100);
      }

      // Pain and sensitivity rise as pressure approaches capacity
      if (seg.pressure > maxPressure * 0.8) {
        seg.pain = clamp(seg.pain + 0.05, 0, 100);
      }
      if (seg.pressure > maxPressure * 0.4) {
        seg.sensitivity = clamp(seg.sensitivity + 0.03, 0, 100);
      }

      // === BREAK: health depletes — SEVERING EVENT ===
      if (seg.health <= 0 && !seg.broken) {
        seg.broken = true;
        seg.pain = 100;
        // Intense pleasure spike from the severing sensation
        seg.sensitivity = clamp(seg.sensitivity + 45, 0, 100);
        // Complete pressure release at break point — severed ends decompress instantly
        seg.pressure = 0;
        if (i > 0) {
          segs[i - 1].pressure = 0;
          segs[i - 1].pain = clamp(segs[i - 1].pain + 30, 0, 100);
          segs[i - 1].sensitivity = clamp(segs[i - 1].sensitivity + 20, 0, 100);
        }
        if (i < n - 1) {
          segs[i + 1].pressure = 0;
          segs[i + 1].pain = clamp(segs[i + 1].pain + 30, 0, 100);
          segs[i + 1].sensitivity = clamp(segs[i + 1].sensitivity + 20, 0, 100);
        }
        // Physical severing: push adjacent nodes apart dramatically
        if (nodes[i] && nodes[i + 1]) {
          const sDx = nodes[i + 1].x - nodes[i].x;
          const sDy = nodes[i + 1].y - nodes[i].y;
          const sD = Math.sqrt(sDx * sDx + sDy * sDy) || 1;
          const severForce = 12;
          if (!nodes[i].pinned) {
            nodes[i].x -= (sDx / sD) * severForce;
            nodes[i].y -= (sDy / sD) * severForce;
          }
          if (!nodes[i + 1].pinned) {
            nodes[i + 1].x += (sDx / sD) * severForce;
            nodes[i + 1].y += (sDy / sD) * severForce;
          }
        }
      }

      seg.pressure = clamp(seg.pressure, 0, maxPressure);
      seg.pain = clamp(seg.pain, 0, 100);
      seg.sensitivity = clamp(seg.sensitivity, 0, 100);
      seg.health = clamp(seg.health, 0, 100);
    }
  };
  diffuseAndUpdate(state.smallSegs, state.smallNodes, 100);
  diffuseAndUpdate(state.largeSegs, state.largeNodes, LARGE_RUPTURE_PRESSURE);

  // --- Final hard clamp ---
  for (const n of state.smallNodes) { if (!n.pinned) clampToCavity(n, 8); }
  for (const n of state.largeNodes) { if (!n.pinned) clampToCavity(n, 2); }
}

export function buildSmoothPath(nodes: { x: number; y: number }[]): string {
  if (nodes.length < 2) return '';
  let d = `M ${nodes[0].x.toFixed(1)} ${nodes[0].y.toFixed(1)}`;
  for (let i = 0; i < nodes.length - 1; i++) {
    const mx = ((nodes[i].x + nodes[i + 1].x) / 2).toFixed(1);
    const my = ((nodes[i].y + nodes[i + 1].y) / 2).toFixed(1);
    d += ` Q ${nodes[i].x.toFixed(1)} ${nodes[i].y.toFixed(1)} ${mx} ${my}`;
  }
  const last = nodes[nodes.length - 1];
  d += ` L ${last.x.toFixed(1)} ${last.y.toFixed(1)}`;
  return d;
}

export function getSegmentColor(seg: SegmentProps, baseColor: string, damagedColor: string): string {
  const healthRatio = seg.health / 100;
  if (healthRatio > 0.6) return baseColor;
  const r = Math.round(0xe8 + (0xcc - 0xe8) * (1 - healthRatio / 0.6));
  const g = Math.round(0x8a * (healthRatio / 0.6));
  const b = Math.round(0x8a * (healthRatio / 0.6));
  return `rgb(${r},${g},${b})`;
}
