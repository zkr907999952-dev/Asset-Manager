---
name: Game colors hook and palette structure
description: All game-specific color tokens live in colors.light; useColors() always returns that since no dark key is defined.
---

# Rule
`constants/colors.ts` defines only a `light` palette with all game-specific tokens (`hp`, `pleasure`, `hpBg`, `pleasureBg`, `toolColor`, `toolActive`, `electricColor`, `needleColor`, `grabColor`, `syringeColor`, `enemaColor`, `drawerBg`, `drawerBorder`, `headerBg`, `overlay`, `cavityBg`, `cavityBorder`, `intestineSmall`, `intestineLarge`, etc.)

`useColors()` returns `colors.light` merged with `radius` regardless of the system color scheme, because no `dark` key exists in the colors object.

**Why:** The game intentionally uses a dark medical aesthetic defined in the `light` key. Adding a `dark` key would enable OS dark-mode switching — avoid unless explicitly requested.

**How to apply:** When adding new color tokens, always add them to `colors.light` and update this list if significantly new categories are added.
