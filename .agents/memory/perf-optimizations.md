---
name: Performance optimizations
description: All performance bottlenecks addressed in the intestine physics simulation; key patterns to maintain.
---

## Key rules to maintain after these changes

**physics.ts — stepPhysics guard checks are GONE**
The 20+ `if (state.xxx === undefined)` guards were removed. All fields are initialized in `createInitialPhysicsState()` (intestineInit.ts). If new PhysicsState fields are added, they MUST be added to `createInitialPhysicsState()` — adding them only to the interface will crash.

**physics.ts — mesenteryDisabled uses Set**
At the top of `stepPhysics`, local Sets are created:
```ts
const largeMesDisSet = new Set(state.mesenteryDisabled);
const smallMesDisSet = new Set(state.smallMesenteryDisabled);
```
The integrate functions use `.has(idx)` not `.includes(idx)`. Don't revert to array includes.

**physics.ts — collision alternates by frame**
Cross-intestine collision runs on even frames (`t % 2 === 0`), self-collision on odd frames (`t % 2 !== 0`). Effective rate: 15fps each instead of 30fps. This halves collision CPU cost; the physics still converges correctly.

**SimulationScreen.tsx — physics loop deps**
Physics loop `useEffect` only depends on `[state.physicsFps]`. peristalsisSpeed and peristalsisModifier are tracked via refs (`peristalsisSpeedRef`, `peristalsisModifierRef`) with separate `useEffect` syncs. Do NOT add state values back to the physics loop deps.

**GameContext.tsx — merged animation timer**
Three tools (长硅胶棒, 拉珠, 吞入跳蛋) share ONE 80ms setInterval. Each section checks its own tool type and accumulates into `upd: UpdType`. A single `setState` fires per tick only if `upd` has keys. Don't split these back into separate intervals.

**GameContext.tsx — renderVersion**
`syncFromPhysics` increments `prev.renderVersion + 1` in the setState call. SimulationCanvas uses `state.renderVersion ?? 0` as the `renderTime` value passed to `SuspendedToolOverlay`. This replaces `Date.now() / 33` which changed every render.

## Round 2 — deep physics sqrt/allocation optimizations

**softCavityPush: r² early-exit (physics.ts)**
Added `const r2 = nx*nx + ny*ny; if (r2 <= 1) return;` before `Math.sqrt`. Most nodes are inside the cavity at any given frame, so ~90% of calls now return without touching sqrt. Also replaced the second sqrt (extreme-case clamp) with squared comparison (`r2b > 2.56` ≡ `r > 1.6`). Net: saves ~880 sqrt calls per physics tick.

**O(N²) collision: AABB pre-check + squared distance (physics.ts)**
Both collision blocks (small-vs-large even frames, small-self odd frames) now:
1. Check `|dx| > threshold || |dy| > threshold` BEFORE accessing lSeg/bSeg arrays — skips ~80% of pairs with just 4 comparisons.
2. Use `d² < minDist²` to gate the expensive `Math.sqrt` — only pays for it when nodes actually overlap.
Thresholds: 68px (small-large), 48px (small-self). These are generous upper bounds on max possible minDist.

**BEAD_RADII: module-level constant (physics.ts)**
`_BEAD_RADII` is built once at module load. Inside stepPhysics the local `const BEAD_RADII = _BEAD_RADII` is just an alias — no allocation, no push loop.

**satisfyChain: cavity push every other iteration (physics.ts)**
Changed `for (const n of nodes) softCavityPush(...)` to fire only when `iter % 2 === 0`. With PHYSICS_ITERATIONS=5, pushes happen on iters 0,2,4 (3× instead of 5×) — 40% fewer calls with no visible stability loss.

**buildSmoothSegPath: integer truncation (SimulationCanvas.tsx)**
Replaced `.toFixed(1)` with `| 0` bitwise truncation for all 6 coordinates per segment. `toFixed` is 5-8× slower than integer conversion; 1px precision is imperceptible at simulation scale. 96 segments × 6 coords = 576 string conversions per render frame improved.

**Why overall:**
All changes target the 33ms budget per physics tick. O(N²) sqrt was the largest cost; softCavityPush second. Allocations (BEAD_RADII) cause GC pressure even if individually small. String toFixed is a hidden cost in the render path.

**How to apply when adding new physics features:**
- Any per-node loop: check if most nodes will be inside cavity → add early-exit with r² first
- Any per-pair O(N²) loop: always add AABB fast-reject before computing expensive values; use d² not d for gate check
- Any array constant used in stepPhysics: declare at module level, not inside the function
- Any SVG path string building: use `| 0` not `.toFixed(n)` for integer-precision coordinates
