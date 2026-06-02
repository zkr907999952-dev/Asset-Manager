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

**Why:**
- Guard checks: 30× per second × 20 checks = 600 unnecessary evaluations/sec eliminated.
- Set vs includes: O(n) → O(1) per node per frame in mesentery loops.
- Collision alternation: ~4257 sqrt() calls/frame → ~2128/frame.
- Physics loop deps: prevented interval destroy/recreate on every peristalsis speed change.
- Merged timers: 3 OS timer handles → 1; batched setState eliminates redundant re-renders.
- renderVersion: stable value prevents SuspendedToolOverlay from seeing prop change every render.
