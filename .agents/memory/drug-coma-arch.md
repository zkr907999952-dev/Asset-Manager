---
name: Drug/Coma System Architecture
description: How stimulant/sedative drugs, overdose coma, and heart rate modifiers are wired into GameContext.
---

# Drug / Coma System

## Key refs in GameContext
- `drugRef` — mutable ref holding heartRateModifier, breathModifier, peristalsisModifier, painModifier, stimulantLog[], sedativeLog[] (timestamps). NOT in React state (mutated directly for performance).
- `comaStateRef` — mirrors `state.comaState` for synchronous reads inside callbacks (avoids stale closure).

## State fields added to GameUIState
- `comaState: 'none' | 'tachycardia' | 'bradycardia'`
- `heartRateModifier: number` (mirrors drugRef for rendering)
- `peristalsisModifier: number` (used by SimulationScreen physics loop)

## syncFromPhysics behavior
- Reads `drugRef.current` for raw modifier values.
- If comaStateRef is 'tachycardia' → HR forced 175–195; if 'bradycardia' → HR forced 25–35.
- painModifier is subtracted from raw pain before HP/HR calculation.

## Overdose rules
- Stimulant: >10 doses in 20s → tachycardia coma (unless currently in bradycardia coma, where it cures instead).
- Sedative: >10 doses in 20s → bradycardia coma (unless currently in tachycardia coma, where it cures instead).
- Recovery: first aid (performFirstAid), opposite drug, or strong pain/electric shock (clearComaByShock called from SimulationScreen checkDialogueTriggers when avgPain > 65 or elec voltage > 55).

## triggerDialogue during coma
- Normal triggers return early (12% chance of 'coma_disturbed' instead).
- Overdose and coma-specific triggers ('overdose_tachycardia', 'overdose_bradycardia', 'coma_disturbed') always fire.

**Why:** Keeping drug state in a ref avoids React re-render storms on every dose. ComaStateRef solves the stale closure problem in useCallback without adding deps.
