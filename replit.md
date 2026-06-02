# 玉腹模拟器

腹部交互模拟器游戏，基于 Expo + React Native (Web)，包含物理引擎、多工具交互、药物系统等。

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — 启动移动端游戏（Expo Web）
- `node chat/generate-dialogues.js` — 从 Excel 重新生成对话文本并同步到 assets

## 角色对话集中管理

所有角色对话文本统一存放在 `/chat/dialogues.xlsx`，程序启动时自动读取。

**Excel 格式：**
- A列（说明列）：格式为 `[trigger_key] 触发条件的详细说明`
- B~G列（对话内容列）：最多6条同一触发下的随机备选对话，空单元格自动忽略
- 触发时系统随机从非空单元格中选一条显示

**修改对话流程：**
1. 用 Excel 打开 `/chat/dialogues.xlsx` 编辑
2. 在项目根目录运行：`node chat/generate-dialogues.js`
3. 脚本会自动把 Excel 同步到 `artifacts/mobile/assets/dialogues.xlsx`
4. 重启游戏即可生效（程序初始化时会重新读取 Excel）

**新增对话触发类型流程：**
1. 在 `artifacts/mobile/constants/dialogues.ts` 的 `DialogueTrigger` 类型中添加新 key，并在 `DIALOGUES` 对象中添加默认值
2. 在 `/chat/dialogues.xlsx` 中新增一行，A列格式为 `[新key] 触发条件说明`，B~G列填写备选对话
3. 运行 `node chat/generate-dialogues.js` 同步

## Stack

- pnpm workspaces, Expo 54, React Native (Web), TypeScript
- 物理引擎：自定义 (`engine/physics.ts`, `engine/intestineInit.ts`)
- 对话系统：xlsx + expo-asset，运行时读取 `/chat/dialogues.xlsx`

## Where things live

- `/chat/dialogues.xlsx` — 角色对话主文件（所有文本的唯一来源）
- `artifacts/mobile/assets/dialogues.xlsx` — 由脚本同步，供 app 运行时读取
- `artifacts/mobile/constants/dialogues.ts` — 对话类型定义 + 默认值（fallback）
- `artifacts/mobile/constants/dialogueLoader.ts` — Excel 运行时加载器
- `artifacts/mobile/contexts/GameContext.tsx` — 游戏主 context，含 `triggerDialogue`

## Architecture decisions

- 对话文本从代码中剥离，集中到 Excel 管理，避免改文本需要改代码
- 加载器在 GameProvider 挂载时异步初始化，加载失败自动 fallback 到 dialogues.ts 中的默认值
- Web 平台使用 fetch 加载 xlsx，Native 平台使用 expo-file-system 读取
- Metro 配置已添加 `xlsx` 扩展名支持

## User preferences

_Populate as you build — explicit user instructions worth remembering across sessions._

## Gotchas

- 修改对话后**必须**运行 `node chat/generate-dialogues.js` 才能同步到 assets，仅修改 Excel 不会自动生效
- 运行生成脚本需要 `NODE_PATH=./artifacts/mobile/node_modules`（已在 `chat/package.json` 的 scripts 中配置）
- `expo-asset` 和 `expo-file-system` 版本须与 expo@54 匹配（`~12.x` 和 `~19.x`）
