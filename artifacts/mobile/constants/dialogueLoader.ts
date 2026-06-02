/**
 * 角色对话加载器
 *
 * ─── 如何修改对话文本 ───────────────────────────────────────────────
 *  1. 用 Excel 打开  artifacts/mobile/assets/dialogues.xlsx  并编辑
 *  2. 保存文件后刷新/重启游戏，新对话立即生效
 *  （程序每次启动时会从该文件重新读取，无需修改任何代码）
 *
 * ─── Excel 格式说明 ─────────────────────────────────────────────────
 *  A列（说明列）：[trigger_key] + 该对话的触发条件描述，仅供人工阅读
 *  B~G列（对话列）：同一触发下最多 6 条备选文本，触发时随机选一条显示
 *                  空单元格自动忽略，填了几条就从几条里随机
 *
 * ─── 新增触发类型 ───────────────────────────────────────────────────
 *  1. 在 constants/dialogues.ts 的 DialogueTrigger 联合类型中追加新 key
 *  2. 在 dialogues.ts 的 DIALOGUES 对象中为该 key 添加默认值（作为
 *     Excel 未读取到时的兜底文本）
 *  3. 在 assets/dialogues.xlsx 新增一行：
 *       A列：[新key] 触发条件描述
 *       B~G列：对话备选文本
 *  4. 在游戏逻辑中调用 triggerDialogue('新key') 即可
 *
 * ─── 运行原理 ───────────────────────────────────────────────────────
 *  GameProvider 挂载时调用 initDialoguesFromExcel()，异步解析 Excel
 *  并将结果写入 constants/dialogues.ts 导出的 DIALOGUES 对象。
 *  之后 getRandomDialogue(trigger) 的随机选取逻辑不变。
 *  若 Excel 读取失败，自动回退到 dialogues.ts 中的硬编码默认值。
 */

import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

import { DIALOGUES, type DialogueTrigger } from './dialogues';

async function loadWorkbook(): Promise<XLSX.WorkBook> {
  if (Platform.OS === 'web') {
    const uri = require('../assets/dialogues.xlsx') as string;
    const response = await fetch(uri);
    const buffer = await response.arrayBuffer();
    return XLSX.read(new Uint8Array(buffer), { type: 'array' });
  } else {
    const { Asset } = await import('expo-asset');
    const FileSystem = await import('expo-file-system/legacy');
    const asset = Asset.fromModule(require('../assets/dialogues.xlsx') as number);
    await asset.downloadAsync();
    if (!asset.localUri) throw new Error('asset.localUri is null');
    const base64 = await FileSystem.readAsStringAsync(asset.localUri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return XLSX.read(base64, { type: 'base64' });
  }
}

export async function initDialoguesFromExcel(): Promise<void> {
  try {
    const wb = await loadWorkbook();
    const ws = wb.Sheets[wb.SheetNames[0]];
    const rows: string[][] = XLSX.utils.sheet_to_json(ws, {
      header: 1,
      defval: '',
    });

    let loaded = 0;
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row || row.length === 0) continue;
      const desc = String(row[0] ?? '').trim();
      // A列格式：[trigger_key] 描述文字
      const match = desc.match(/^\[(\w+)\]/);
      if (!match) continue;
      const key = match[1] as DialogueTrigger;
      if (!(key in DIALOGUES)) continue;
      const lines = (row.slice(1) as string[])
        .map(s => String(s ?? '').trim())
        .filter(s => s.length > 0);
      if (lines.length > 0) {
        DIALOGUES[key] = lines;
        loaded++;
      }
    }
    console.log(`[dialogueLoader] 已从 Excel 加载 ${loaded} 条对话触发项`);
  } catch (e) {
    console.warn('[dialogueLoader] 加载 Excel 失败，使用默认对话文本:', e);
  }
}
