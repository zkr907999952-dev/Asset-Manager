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
}

export interface PhysicsState {
  smallNodes: PhysicsNode[];
  largeNodes: PhysicsNode[];
  smallSegs: SegmentProps[];
  largeSegs: SegmentProps[];
  time: number;
  peristalsisSpeed: number;
  // tool state
  toolPos: { x: number; y: number } | null;
  toolType: string | null;
  toolActive: boolean;
  toolParam1: number;
  toolParam2: number;
  // needle/enema anchor
  anchorPos: { x: number; y: number } | null;
  grabbedNode: { type: 'small' | 'large'; idx: number } | null;
  electrodes: { x: number; y: number }[];
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

  // --- Tool interaction ---
  if (state.toolPos) {
    const tp = state.toolPos;
    if (state.toolType === '金属棒' || state.toolType === '振动器') {
      const radius = state.toolType === '振动器' ? 40 + state.toolParam2 * 0.4 : 20;
      const force = state.toolType === '振动器' && state.toolActive ? 3 + state.toolParam1 * 0.04 : 1.5;
      const applyPush = (nodes: PhysicsNode[], segs: SegmentProps[]) => {
        for (let i = 0; i < nodes.length; i++) {
          const n = nodes[i];
          const d = dist(n.x, n.y, tp.x, tp.y);
          if (d < radius && d > 0.1) {
            const nx = (n.x - tp.x) / d;
            const ny = (n.y - tp.y) / d;
            n.x += nx * force * (1 - d / radius);
            n.y += ny * force * (1 - d / radius);
            if (state.toolActive && state.toolType === '振动器') {
              const seg = segs[i];
              if (seg) {
                seg.sensitivity = clamp(seg.sensitivity + 0.1, 0, 100);
                seg.pain = clamp(seg.pain + 0.03, 0, 100);
              }
            } else if (state.toolActive) {
              const seg = segs[i];
              if (seg) seg.sensitivity = clamp(seg.sensitivity + 0.02, 0, 100);
            }
          }
        }
      };
      applyPush(state.smallNodes, state.smallSegs);
      applyPush(state.largeNodes, state.largeSegs);
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

    if (state.toolType === '长柄针' && state.toolActive) {
      // Needle: pierce closest segment, deal pain + create rupture risk
      let closest = -1, closestDist = 999, closestType: 'small' | 'large' = 'small';
      const tryNodes = (nodes: PhysicsNode[], type: 'small' | 'large') => {
        nodes.forEach((n, i) => {
          const d = dist(n.x, n.y, tp.x, tp.y);
          if (d < closestDist) { closestDist = d; closest = i; closestType = type; }
        });
      };
      tryNodes(state.smallNodes, 'small');
      tryNodes(state.largeNodes, 'large');
      // Needle range scales with param1 (针长)
      const range = 12 + state.toolParam1 * 0.18;
      if (closest >= 0 && closestDist < range) {
        const segs = closestType === 'small' ? state.smallSegs : state.largeSegs;
        const idx = Math.min(closest, segs.length - 1);
        const seg = segs[idx];
        if (seg && !seg.broken) {
          // 穿刺强度 (param2) controls damage rate
          const strength = 0.04 + state.toolParam2 * 0.0035;
          seg.pain = clamp(seg.pain + strength * 12, 0, 100);
          seg.sensitivity = clamp(seg.sensitivity + strength * 4, 0, 100);
          seg.health = clamp(seg.health - strength * 2.5, 0, 100);
          // High strength can rupture
          if (state.toolParam2 > 60 && Math.random() < 0.02) {
            seg.pressure = clamp(seg.pressure + 8, 0, 100);
          }
          // Small jitter on the pierced node
          const nodes = closestType === 'small' ? state.smallNodes : state.largeNodes;
          nodes[closest].x += (Math.random() - 0.5) * 0.6;
          nodes[closest].y += (Math.random() - 0.5) * 0.6;
        }
      }
    }

    if (state.toolType === '灌肠器' && state.toolActive) {
      // Enema: pumps fluid from rectum (last large node) up through the chain,
      // raising pressure progressively. Flow rate = param1 (灌肠流量),
      // stimulation = param2 (刺激程度) drives sensitivity gain.
      const flow = state.toolParam1 * 0.004;
      const stim = state.toolParam2 * 0.0025;
      // Inject pressure starting from the sigmoid/rectum end (last segment)
      // and propagate forward (backwards through the array).
      const largeSegs = state.largeSegs;
      const N = largeSegs.length;
      for (let i = N - 1; i >= 0; i--) {
        const seg = largeSegs[i];
        if (seg.broken) continue;
        // Closer to rectum (end) = stronger fill
        const distFactor = 0.4 + (i / N) * 0.6;
        seg.pressure = clamp(seg.pressure + flow * distFactor, 0, 100);
        seg.sensitivity = clamp(seg.sensitivity + stim * distFactor, 0, 100);
        if (seg.pressure > 70) {
          seg.pain = clamp(seg.pain + stim * 0.5, 0, 100);
        }
      }
      // Some overflow into small intestine (ileocecal valve)
      const smallSegs = state.smallSegs;
      for (let i = 0; i < smallSegs.length; i++) {
        const seg = smallSegs[i];
        if (seg.broken) continue;
        const distFactor = Math.max(0, 1 - i / smallSegs.length) * 0.4;
        seg.pressure = clamp(seg.pressure + flow * distFactor * 0.5, 0, 100);
        seg.sensitivity = clamp(seg.sensitivity + stim * distFactor * 0.5, 0, 100);
      }
    }

    if (state.toolType === '电击器' && state.toolActive) {
      const voltage = state.toolParam1 * 0.01;
      for (const el of state.electrodes) {
        const radius = 30 + state.toolParam2 * 0.3;
        for (let i = 0; i < N_SMALL; i++) {
          const d = dist(state.smallNodes[i].x, state.smallNodes[i].y, el.x, el.y);
          if (d < radius) {
            const seg = state.smallSegs[i];
            seg.pain = clamp(seg.pain + voltage * 0.5, 0, 100);
            seg.sensitivity = clamp(seg.sensitivity + voltage * 0.3, 0, 100);
            // spasm
            state.smallNodes[i].x += (Math.random() - 0.5) * voltage * 5;
            state.smallNodes[i].y += (Math.random() - 0.5) * voltage * 5;
          }
        }
      }
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
