/**
 * 对话文本加载器
 *
 * 程序初始化时从 assets/dialogues.xlsx 读取所有角色对话文本，
 * 覆盖 dialogues.ts 中的默认值。
 *
 * Excel 格式说明：
 *   A列（说明列）：格式为 "[trigger_key] 触发条件描述"
 *   B~G列（对话内容列）：最多6条对话备选文本，空单元格忽略
 *
 * 如需新增或修改对话，只需编辑 /chat/dialogues.xlsx，
 * 然后运行 `node chat/generate-dialogues.js` 将文件同步到 assets。
 */

import { Platform } from 'react-native';
import * as XLSX from 'xlsx';

import { DIALOGUES, type DialogueTrigger } from './dialogues';

let _initialized = false;

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
  if (_initialized) return;
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
    _initialized = true;
    console.log(`[dialogueLoader] 已从 Excel 加载 ${loaded} 条对话触发项`);
  } catch (e) {
    console.warn('[dialogueLoader] 加载 Excel 失败，使用默认对话文本:', e);
  }
}
