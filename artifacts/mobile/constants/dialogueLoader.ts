/**
 * 角色对话加载器
 *
 * ─── 如何修改对话文本 ───────────────────────────────────────────────
 *  1. 用 Excel 打开  artifacts/mobile/assets/dialogues.xlsx  并编辑
 *  2. 保存文件，然后重启 Expo（Ctrl+C 后重新 pnpm run dev）
 *     → 启动时会自动运行 scripts/build-dialogues.js 将 xlsx 转为 JSON
 *     → 手机端 Expo Go 和 Web 调试器都会读到最新文本
 *
 * ─── Excel 格式说明 ─────────────────────────────────────────────────
 *  A列（说明列）：[trigger_key] + 该对话的触发条件描述，仅供人工阅读
 *  B~G列（对话列）：同一触发下最多 6 条备选文本，触发时随机选一条显示
 *                  空单元格自动忽略，填了几条就从几条里随机
 *
 * ─── 运行原理 ───────────────────────────────────────────────────────
 *  scripts/build-dialogues.js 在 expo 启动前把 xlsx 转成
 *  constants/dialogues-data.json（纯 JSON 代码文件，不是 asset）。
 *  Metro 把 JSON 当代码处理，两端都能正常热更新，不存在 asset 缓存问题。
 *  若 JSON 文件缺失，自动回退到 dialogues.ts 中的硬编码默认值。
 */

import { DIALOGUES, type DialogueTrigger } from './dialogues';

export async function initDialoguesFromExcel(): Promise<void> {
  try {
    // 直接 import 预生成的 JSON（由 scripts/build-dialogues.js 在启动前生成）
    // JSON 被 Metro 当作代码模块处理，手机端不存在 asset 缓存问题
    const data = require('./dialogues-data.json') as Record<string, string[]>;

    let loaded = 0;
    for (const [key, lines] of Object.entries(data)) {
      if (key in DIALOGUES && Array.isArray(lines) && lines.length > 0) {
        (DIALOGUES as Record<string, string[]>)[key] = lines;
        loaded++;
      }
    }
    console.log(`[dialogueLoader] 已从 JSON 加载 ${loaded} 条对话触发项`);
  } catch (e) {
    console.warn('[dialogueLoader] 加载 dialogues-data.json 失败，使用默认对话文本:', e);
  }
}
