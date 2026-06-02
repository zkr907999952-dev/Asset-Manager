# 玉腹模拟器

腹部交互模拟器游戏，基于 Expo + React Native (Web)，包含物理引擎、多工具交互、药物系统等。

## Run & Operate

- `pnpm --filter @workspace/mobile run dev` — 启动移动端游戏（Expo Web）

## 角色对话集中管理

**唯一的对话文件：** `artifacts/mobile/assets/dialogues.xlsx`

**修改对话只需两步：**
1. 用 Excel 打开 `artifacts/mobile/assets/dialogues.xlsx` 编辑并保存
2. 刷新/重启游戏生效

**Excel 格式：**
- A列：`[trigger_key] 触发条件说明`（仅供阅读，程序用 `[key]` 前缀识别触发类型）
- B~G列：最多6条备选对话文本，触发时随机选一条，空单元格自动忽略

**新增触发类型：**
1. 在 `constants/dialogues.ts` 的 `DialogueTrigger` 类型和 `DIALOGUES` 对象中追加新 key（默认兜底文本）
2. 在 `assets/dialogues.xlsx` 新增一行，格式同上
3. 在游戏逻辑中调用 `triggerDialogue('新key')`，刷新游戏即可

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
