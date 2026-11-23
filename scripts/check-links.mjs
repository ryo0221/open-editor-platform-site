// Opens every external link in the built pages and expects 200 (07 control-06). Run after `npm run build`.
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';

const htmlFiles = dir => readdirSync(dir, { withFileTypes: true }).flatMap(e => (e.isDirectory() ? htmlFiles(join(dir, e.name)) : e.name.endsWith('.html') ? [join(dir, e.name)] : []));
const links = new Set();
for (const file of htmlFiles(process.argv[2] ?? 'dist')) {
  for (const [, href] of readFileSync(file, 'utf8').matchAll(/href="(https?:\/\/[^"]+)"/g)) links.add(href.replace(/&amp;/g, '&'));
}
let failed = 0;
for (const url of [...links].sort()) {
  // curl follows redirects and goes through the environment's proxy settings.
  const code = execFileSync('curl', ['-s', '-o', '/dev/null', '-L', '-w', '%{http_code}', '--max-time', '20', url]).toString();
  if (code !== '200') failed++;
  console.log(`${code === '200' ? 'ok ' : 'NG '} ${code} ${url}`);
}
console.log(`${links.size - failed}/${links.size} links returned 200`);
process.exit(failed ? 1 : 0);
