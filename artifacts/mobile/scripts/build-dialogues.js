/**
 * 把 assets/dialogues.xlsx 转换成 constants/dialogues-data.json
 * 在 expo 启动前运行，确保手机端和 web 端都能读到最新对话文本。
 *
 * 运行方式：node scripts/build-dialogues.js
 */

const path = require('path');
const fs = require('fs');
const XLSX = require('xlsx');

const ROOT = path.resolve(__dirname, '..');
const XLSX_PATH = path.join(ROOT, 'assets', 'dialogues.xlsx');
const OUT_PATH = path.join(ROOT, 'constants', 'dialogues-data.json');

try {
  if (!fs.existsSync(XLSX_PATH)) {
    console.warn('[build-dialogues] dialogues.xlsx 不存在，跳过生成');
    process.exit(0);
  }

  const wb = XLSX.readFile(XLSX_PATH);
  const ws = wb.Sheets[wb.SheetNames[0]];
  const rows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  const result = {};
  let count = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.length === 0) continue;
    const desc = String(row[0] ?? '').trim();
    const match = desc.match(/^\[(\w+)\]/);
    if (!match) continue;
    const key = match[1];
    const lines = row
      .slice(1)
      .map(s => String(s ?? '').trim())
      .filter(s => s.length > 0);
    if (lines.length > 0) {
      result[key] = lines;
      count++;
    }
  }

  fs.writeFileSync(OUT_PATH, JSON.stringify(result, null, 2), 'utf-8');
  console.log(`[build-dialogues] 已生成 dialogues-data.json，共 ${count} 条触发项`);
} catch (e) {
  console.error('[build-dialogues] 转换失败:', e.message);
  process.exit(1);
}
