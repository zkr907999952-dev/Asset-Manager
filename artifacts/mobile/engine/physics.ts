import {
  CANVAS_W, CANVAS_H, CAVITY_CX, CAVITY_CY, CAVITY_RX, CAVITY_RY,
  N_SMALL, N_LARGE, SMALL_SEG_LENGTH, LARGE_SEG_LENGTH,
  PHYSICS_ITERATIONS, DAMPING, MESENTERY_STIFFNESS, SEGMENT_STIFFNESS,
  PERISTALSIS_BASE_SPEED, PERISTALSIS_AMPLITUDE,
  PRESSURE_DIFFUSION_RATE, PRESSURE_DECAY_RATE,
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
  // peristalsisSpeed is the live speed (may be boosted by enema); the user-set
  // base is kept separately so physics can reset/raise it each step.
  peristalsisBase: number;
  // tool state
  toolPos: { x: number; y: number } | null;     // handle / drag end
  toolType: string | null;
  toolActive: boolean;
  toolParam1: number;
  toolParam2: number;
  // Lever-mode insertion (rod / vibrator / needle when inserted via navel)
  toolAnchor: { x: number; y: number } | null;  // pivot point (navel) when inserted
  toolInserted: boolean;
  // Navel pierced (once true, rod/vibrator can be inserted via navel)
  navelPierced: boolean;
  // Grab tool
  grabbedNode: { type: 'small' | 'large'; idx: number } | null;
  // Electric
  electrodes: { x: number; y: number }[];
  // Enema tube head — index into largeNodes (anus = last, head moves toward 0)
  enemaHeadIdx: number;
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

function clampToCavity(node: PhysicsNode, margin: number) {
  const dx = node.x - CAVITY_CX;
  const dy = node.y - CAVITY_CY;
  const nx = dx / (CAVITY_RX - margin);
  const ny = dy / (CAVITY_RY - margin);
  const r = Math.sqrt(nx * nx + ny * ny);
  if (r > 1) {
    node.x = CAVITY_CX + (dx / r) * (CAVITY_RX - margin - 1);
    node.y = CAVITY_CY + (dy / r) * (CAVITY_RY - margin - 1);
  }
}

export function stepPhysics(state: PhysicsState) {
  state.time += 1;
  const t = state.time;
  // Reset live speed to base each step; tools (e.g. enema) may raise it below.
  state.peristalsisSpeed = state.peristalsisBase;
  const periSpeed = state.peristalsisSpeed * PERISTALSIS_BASE_SPEED;

  // --- Verlet integration ---
  const integrateNodes = (nodes: PhysicsNode[], margin: number) => {
    for (const n of nodes) {
      if (n.pinned) continue;
      const vx = (n.x - n.px) * DAMPING;
      const vy = (n.y - n.py) * DAMPING;
      n.px = n.x; n.py = n.y;
      n.x += vx;
      n.y += vy;
      // mesentery spring
      n.x += (n.rx - n.x) * MESENTERY_STIFFNESS;
      n.y += (n.ry - n.y) * MESENTERY_STIFFNESS;
      clampToCavity(n, margin);
    }
  };
  integrateNodes(state.smallNodes, 8);
  integrateNodes(state.largeNodes, 2);

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
  // peristalsis on large intestine (slower)
  for (let i = 0; i < N_LARGE; i++) {
    const n = state.largeNodes[i];
    if (n.pinned) continue;
    const phase = (i / N_LARGE) * Math.PI * 2 - t * periSpeed * 0.025;
    n.x += Math.cos(phase) * 0.3;
    n.y += Math.sin(phase) * 0.3;
  }

  // --- Constraint satisfaction ---
  const satisfyChain = (nodes: PhysicsNode[], segLen: number, breakBroken: boolean, segs: SegmentProps[]) => {
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
    }
  };
  satisfyChain(state.smallNodes, SMALL_SEG_LENGTH, true, state.smallSegs);
  satisfyChain(state.largeNodes, LARGE_SEG_LENGTH, true, state.largeSegs);

  // --- Separation constraint between small and large intestine ---
  for (const sn of state.smallNodes) {
    for (const ln of state.largeNodes) {
      const dx = sn.x - ln.x, dy = sn.y - ln.y;
      const d = Math.sqrt(dx * dx + dy * dy);
      const minDist = 10;
      if (d < minDist && d > 0.01) {
        const push = (minDist - d) / d * 0.3;
        sn.x += dx * push * 0.5;
        sn.y += dy * push * 0.5;
      }
    }
  }

  // --- Compute lever rod geometry (rod / vibrator / needle when inserted) ---
  // Returns array of points along the rod inside the cavity (for collision)
  // plus the head position. When not inserted, head = toolPos and tail extends
  // back away from cavity center.
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
      // Auto-stir: small orthogonal oscillation of the head
      let ox = 0, oy = 0;
      if (autoStirAmp > 0) {
        const stir = Math.sin(state.time * 0.25) * autoStirAmp;
        ox = -dy * stir;
        oy = dx * stir;
      }
      const head = { x: a.x + dx * insideLen + ox, y: a.y + dy * insideLen + oy };
      // Sample points along the inside portion of the rod
      const segments: { x: number; y: number }[] = [];
      const samples = 6;
      for (let i = 1; i <= samples; i++) {
        const t = i / samples;
        segments.push({ x: a.x + dx * insideLen * t + ox * t, y: a.y + dy * insideLen * t + oy * t });
      }
      return { head, segments, insideLen };
    }
    // Free mode: rod extends upward from head (= toolPos). Tail at toolPos - (0, rodLen).
    // Sample the entire rod length so collision matches render.
    const head = tp;
    let stir = 0;
    if (autoStirAmp > 0) stir = Math.sin(state.time * 0.25) * autoStirAmp;
    const segments: { x: number; y: number }[] = [];
    const samples = 8;
    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      segments.push({ x: tp.x + stir * (1 - t), y: tp.y - rodLen * t });
    }
    return { head, segments, insideLen: rodLen };
  };

  // Rod-style collision: push intestine nodes away from any rod sample point
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

    // === METAL ROD / VIBRATOR (lever or free mode) ===
    if (state.toolType === '金属棒' || state.toolType === '振动器') {
      const isVib = state.toolType === '振动器';
      // rodLen from param1 (杆长 / 震动强度 acts as the rod length proxy for vibrator wand)
      const rodLen = 80 + state.toolParam1 * (isVib ? 1.2 : 1.0);
      // auto-stir: only metal rod auto-stirs when active; vibrator always oscillates at high amp when active
      const stirAmp = state.toolActive ? (isVib ? 4 : 2 + state.toolParam2 * 0.04) : 0;
      const { head, segments } = computeRodGeometry(rodLen, stirAmp);
      const rodRadius = 9;
      applyRodCollision(segments, rodRadius);

      if (state.toolActive) {
        // Sensitivity / vibration zone around head
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
        const dx = tp.x - n.x, dy = tp.y - n.y;
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
      let closestSmall = -1, closestDist = 999;
      for (let i = 0; i < N_SMALL; i++) {
        const d = dist(state.smallNodes[i].x, state.smallNodes[i].y, tp.x, tp.y);
        if (d < closestDist) { closestDist = d; closestSmall = i; }
      }
      if (closestSmall >= 0 && closestDist < 30) {
        const seg = state.smallSegs[closestSmall];
        const rate = state.toolParam1 * 0.003;
        seg.pressure = clamp(seg.pressure + rate, 0, 100);
        seg.pain = clamp(seg.pain + 0.01, 0, 100);
      }
    }

    // === NEEDLE (lever mode when inserted, or free probe) ===
    if (state.toolType === '长柄针') {
      const rodLen = 90 + state.toolParam1 * 1.0;   // 针长
      // Auto wobble proportional to active state — "搅动越激烈刺激越快"
      const stirAmp = state.toolActive ? 1.5 + state.toolParam2 * 0.04 : 0;
      const { head, segments } = computeRodGeometry(rodLen, stirAmp);
      applyRodCollision(segments, 5);
      if (state.toolActive) {
        // Damage segments near head
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
                // First strong pierce flags perforation
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

    // === ENEMA: tube travels through large intestine from anus to enemaHeadIdx ===
    if (state.toolType === '灌肠器') {
      const headIdx = clamp(state.enemaHeadIdx, 0, state.largeNodes.length - 1);
      const headNode = state.largeNodes[headIdx];
      // Tube exerts gentle push on intestine where head is (deformation)
      if (headNode) {
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
        const flow = 0.1 + state.toolParam1 * 0.012;
        const stim = state.toolParam2 * 0.005;
        // Pressure surges fastest at the head segment, falls off with distance
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
        // Boost peristalsis dynamically through stim (handled at state level)
        state.peristalsisSpeed = Math.max(state.peristalsisSpeed, 1 + state.toolParam2 * 0.025);
      }
    }

    if (state.toolType === '电击器' && state.toolActive) {
      const voltage = state.toolParam1 * 0.01;
      const radius = 30 + state.toolParam2 * 0.3;
      for (const el of state.electrodes) {
        // Small intestine
        for (let i = 0; i < N_SMALL; i++) {
          const d = dist(state.smallNodes[i].x, state.smallNodes[i].y, el.x, el.y);
          if (d < radius) {
            const seg = state.smallSegs[i];
            seg.pain = clamp(seg.pain + voltage * 0.5, 0, 100);
            seg.sensitivity = clamp(seg.sensitivity + voltage * 0.3, 0, 100);
            state.smallNodes[i].x += (Math.random() - 0.5) * voltage * 5;
            state.smallNodes[i].y += (Math.random() - 0.5) * voltage * 5;
          }
        }
        // Large intestine + abdominal wall (no nodes — wall shock is purely cosmetic in render)
        for (let i = 0; i < state.largeNodes.length; i++) {
          const d = dist(state.largeNodes[i].x, state.largeNodes[i].y, el.x, el.y);
          if (d < radius) {
            const seg = state.largeSegs[i];
            if (seg) {
              seg.pain = clamp(seg.pain + voltage * 0.4, 0, 100);
              seg.sensitivity = clamp(seg.sensitivity + voltage * 0.25, 0, 100);
            }
            state.largeNodes[i].x += (Math.random() - 0.5) * voltage * 4;
            state.largeNodes[i].y += (Math.random() - 0.5) * voltage * 4;
          }
        }
      }
    }
  }

  // --- Perforation leakage: perforated segments slowly lose pressure but accumulate pain ---
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
  const diffuseAndUpdate = (segs: SegmentProps[]) => {
    const n = segs.length;
    const prevPressures = segs.map(s => s.pressure);
    for (let i = 0; i < n; i++) {
      const seg = segs[i];
      if (seg.broken) continue;
      // diffuse to neighbors
      if (i > 0 && !segs[i - 1].broken) {
        const diff = (prevPressures[i] - prevPressures[i - 1]) * PRESSURE_DIFFUSION_RATE;
        seg.pressure -= diff;
        segs[i - 1].pressure += diff;
      }
      if (i < n - 1 && !segs[i + 1].broken) {
        const diff = (prevPressures[i] - prevPressures[i + 1]) * PRESSURE_DIFFUSION_RATE;
        seg.pressure -= diff;
        segs[i + 1].pressure += diff;
      }
      // natural decay
      seg.pressure = clamp(seg.pressure - PRESSURE_DECAY_RATE, 0, 100);
      seg.pain = clamp(seg.pain - 0.005, 0, 100);
      seg.sensitivity = clamp(seg.sensitivity - 0.002, 0, 100);

      // pressure effects
      if (seg.pressure >= 100 && !seg.ruptured) {
        seg.ruptured = true;
        seg.pain = clamp(seg.pain + 40, 0, 100);
        seg.health = clamp(seg.health - 30, 0, 100);
      }
      if (seg.ruptured) {
        seg.pressure = clamp(seg.pressure - 1, 0, 100);
      }
      // health→damage
      if (seg.pressure > 80) {
        seg.pain = clamp(seg.pain + 0.05, 0, 100);
      }
      if (seg.pressure > 40) {
        seg.sensitivity = clamp(seg.sensitivity + 0.03, 0, 100);
      }
      // health check
      if (seg.health <= 0 && !seg.broken) {
        seg.broken = true;
        seg.pain = 100;
        if (i > 0) segs[i - 1].pressure = clamp(segs[i - 1].pressure * 0.3, 0, 100);
        if (i < n - 1) segs[i + 1].pressure = clamp(segs[i + 1].pressure * 0.3, 0, 100);
      }
      seg.pressure = clamp(seg.pressure, 0, 100);
      seg.pain = clamp(seg.pain, 0, 100);
      seg.sensitivity = clamp(seg.sensitivity, 0, 100);
      seg.health = clamp(seg.health, 0, 100);
    }
  };
  diffuseAndUpdate(state.smallSegs);
  diffuseAndUpdate(state.largeSegs);
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
