// Response headers for the built site. Preview builds (any branch but main) are kept out of search results.
import { writeFileSync } from 'node:fs';

const branch = process.env.WORKERS_CI_BRANCH ?? '';
const preview = branch !== 'main';
const rules = [
  '/*',
  '  X-Content-Type-Options: nosniff',
  '  Referrer-Policy: strict-origin-when-cross-origin',
  "  Content-Security-Policy: default-src 'self'; img-src 'self' data:; media-src 'self'; style-src 'self' 'unsafe-inline'; script-src 'self' 'unsafe-inline'; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'",
  ...(preview ? ['  X-Robots-Tag: noindex'] : []),
];
writeFileSync('dist/_headers', rules.join('\n') + '\n');
console.log(`_headers written (${preview ? 'preview, noindex' : 'production'})`);
