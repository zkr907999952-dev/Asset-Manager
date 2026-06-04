---
name: Mesentery config + editor architecture
description: How mesentery rest positions are persisted and the editor screen is structured.
---

## Mesentery config persistence
- File: `engine/mesenteryConfig.ts`
- Storage: `@react-native-async-storage/async-storage`, key `@mesentery_config_v1`
- Shape: `{ largeNodes: [{rx,ry}], smallNodes: [{rx,ry}] }`
- Loaded in `GameContext` `useEffect` (alongside dialogue init): `loadMesenteryConfig().then(cfg => { if (cfg) applyMesenteryConfig(physicsRef.current, cfg); })`
- `applyMesenteryConfig` writes directly to `physicsRef.current` nodes' `rx`/`ry` fields
- `saveMesenteryConfig` writes the config AND caller must also update `physicsRef` nodes before calling (editor does both)

## Editor screen
- ScreenName: `'mesenteryEditor'` — added to the union type in GameContext
- Entry: Settings screen → debug section → "肠系膜编辑模式" button
- Navigation back: header "← 返回设置" button calls `setScreen('settings')`
- No AppDrawer needed (editor has its own back button)

## PanResponder stale-closure fix
- `layoutRef.current` holds `{ scale, offsetX, offsetY }` and is updated every render
- PanResponder callbacks read from `layoutRef.current` (not closed-over values)
- Same pattern used for `largeNodesRef`, `smallNodesRef`, `selectedRef`

## largeNodeMesentery export
- `largeNodeMesentery(idx)` was a private fn in `physics.ts` — exported to allow editor to show per-node dead zone circles

## Workflow: confirm vs save
- Confirm: commits active drag to local `largeNodes`/`smallNodes` state, clears selection
- Cancel: discards active drag, clears selection (local state unchanged)
- Save: writes current `largeNodes`/`smallNodes` state to AsyncStorage AND applies to `physicsRef` live nodes

**Why:** Separate confirm/save means users can edit multiple nodes before committing to disk.

**How to apply:** When adding new fields to physics nodes that need persistence, add them to `MesenteryConfig` shape and bump the storage key version.
