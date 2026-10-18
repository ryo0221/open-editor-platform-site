// Builds the test-to-criterion trace table (10 検査と受入条件の対応表) from Playwright's JSON report.
// Usage: node scripts/test-trace.mjs [test-results/results.json] > test-trace.md
import { readFileSync } from 'node:fs';

const report = JSON.parse(readFileSync(process.argv[2] ?? 'test-results/results.json', 'utf8'));
const rows = new Map();
const walk = suite => {
  for (const spec of suite.specs ?? []) {
    const id = spec.title.match(/^(test-\d+)/)?.[1];
    if (!id) continue;
    const row = rows.get(id) ?? { id, covers: [...spec.title.matchAll(/\[([^\]]+)\]/g)].map(m => m[1]), what: spec.title.replace(/^test-\d+\s*(\[[^\]]+\]\s*)*/, ''), results: {} };
    for (const t of spec.tests) {
      const r = t.results.at(-1);
      row.results[t.projectName] = t.status === 'skipped' ? '—' : r?.status === 'passed' ? '合格' : '不合格';
    }
    rows.set(id, row);
  }
  for (const child of suite.suites ?? []) walk(child);
};
report.suites.forEach(walk);
const sorted = [...rows.values()].sort((a, b) => a.id.localeCompare(b.id, 'en', { numeric: true }));
console.log('| 検査 | 確かめる条件 | 手順と期待結果 | PC（1440px） | スマホ（390px） |');
console.log('|---|---|---|---|---|');
for (const r of sorted) console.log(`| ${r.id} | ${r.covers.join('、')} | ${r.what} | ${r.results.pc ?? '—'} | ${r.results.phone ?? '—'} |`);
