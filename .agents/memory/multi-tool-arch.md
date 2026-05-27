---
name: Multi-tool coexistence architecture
description: How per-tool persistent state (toolStates) and pressureDiffusionRate are structured; critical initialization requirement.
---

## Rule
Any new field added to `PhysicsState` in `engine/physics.ts` **must also be initialized** in `createInitialPhysicsState()` in `engine/intestineInit.ts`. Forgetting this causes an immediate runtime crash: "Cannot read properties of undefined" inside `stepPhysics`.

## Architecture: toolStates
`toolStates: Record<string, { active: boolean; param1: number; param2: number }>` lives on both `PhysicsState` and `GameUIState`. Initialized via `createDefaultToolStates()` from `gameConfig.ts`.

- `setActiveTool(tool)` loads that tool's persisted `{ active, param1, param2 }` into the flat `toolActive/toolParam1/toolParam2` fields. Does NOT reset them.
- `setToolActive/Param1/Param2` write to BOTH the flat fields AND `toolStates[activeTool]`.
- `setToolState(toolId, patch)` used by ConsoleScreen to set per-tool defaults without selecting that tool.

## Secondary physics
Enema and electric can run even when not the `activeTool` — checked in `stepPhysics` after the main tool block by reading `state.toolStates['灌肠器']?.active` etc.

## pressureDiffusionRate
Default `0.004` (lowered from old `0.008`). Replaces the old compile-time `PRESSURE_DIFFUSION_RATE` constant. Used inside `diffuseAndUpdate` as `state.pressureDiffusionRate`. Exposed as a settings slider (`setPressureDiffusionRate`).

## Why
Defensive guard `if (!state.toolStates) (state as any).toolStates = {}` added at top of `stepPhysics` as belt-and-suspenders for legacy state objects.
