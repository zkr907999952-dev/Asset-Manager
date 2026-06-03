---
name: 60fps render snapshot architecture
description: How the zero-allocation per-frame rendering pipeline works after the 15→60fps optimization pass.
---

## The Rule
`SimulationCanvas` and `SimulationScreen` must read rendering data from `renderSnapshotRef.current` (the snapshot), NOT from `state`. The snapshot is updated in-place by `syncFromPhysics` with zero heap allocations per frame.

## Why
The old `syncFromPhysics` called `.map()` on smallNodes (66 items), largeNodes (32), smallSegs (65), largeSegs (31), periScaleSmall, periScaleLarge, beadsChain, electrodes every 2 frames. Each `.map()` allocates a new array + N new objects, causing 15+ MB/s GC pressure and dropped frames.

## Key structures
- `renderSnapshotRef: MutableRefObject<RenderSnapshot>` — exported from GameContext, contains pre-allocated typed arrays: smallNodes[66], largeNodes[32], smallSegs[65], largeSegs[31], periScaleSmall[65], periScaleLarge[31], beadsChain[], electrodes[], avgPain, avgPressure, avgSensitivity, breathVal, _breathPhase.
- Initialized once in `GameProvider` from `physicsRef.current` (the only allowed allocation).
- Updated in-place every 2 physics frames inside `syncFromPhysics`.

## syncFromPhysics behavior
- **Fast path (every call)**: loops over arrays writing x/y/health/etc values in-place into snap objects. Computes avgPain/avgPressure/avgSensitivity in a single for-loop. Advances `_breathPhase` and writes `breathVal`. Calls `setState` with scalars only (hp, heartRate, toolPos, renderVersion, etc.).
- **Slow path (every 15 calls, ~1s)**: allocates fresh copies of arrays (`.map()`) into state for `renderSmallSegs`, `renderLargeSegs` etc. This satisfies AttributePanel and CharacterView which read from state on non-simulation screens.

## PhysicsState new fields (intestineInit.ts must initialize)
- `mesenteryDisabledSet: Set<number>` — kept in sync with `mesenteryDisabled` array; used in stepPhysics instead of `new Set(mesenteryDisabled)` per frame.
- `smallMesenteryDisabledSet: Set<number>` — same for small intestine.
- Must be rebuilt whenever `mesenteryDisabled`/`smallMesenteryDisabled` arrays change (executeMesenterySelection, transplantSmallIntestine, transplantLargeIntestine, transplantAllIntestines).

## Other optimizations shipped with this pass
- `PHYSICS_ITERATIONS`: 8 → 5
- `diffuseAndUpdate`: module-level `_pressureScratch` array instead of `segs.map(s => s.pressure)`.
- `SimulationScreen` physics loop: `setInterval` → `requestAnimationFrame` + delta-time accumulator (prevents drift, syncs to display refresh).
- `HeartRateMonitor`: `Float32Array` ring buffer with write index (no `.shift()`, no spread allocation every 40ms).
- `SimulationCanvas`: `useBreathAnimation` hook removed; breathVal comes from `snap.breathVal`; avgPain/avgPressure come from snap (no reduce() calls in render).

## How to apply
When adding new per-frame rendering data (e.g., a new tool visual):
1. Add the field to `RenderSnapshot` interface in GameContext.tsx.
2. Initialize it in the `renderSnapshotRef = useRef(...)` block.
3. Update it in-place in `syncFromPhysics` fast path.
4. Read it as `snap.yourField` in SimulationCanvas.
Never add array `.map()` or spread calls to the fast path of `syncFromPhysics`.
