// Builds the page from the post-release fixture into dist-variant for the tests. A Node wrapper so it also runs on Windows.
import { execFileSync } from 'node:child_process';

const opts = { stdio: 'inherit', shell: process.platform === 'win32', env: { ...process.env, SITE_CONFIG: './tests/fixtures/after-release.json' } };
execFileSync('npx', ['astro', 'build', '--outDir', 'dist-variant'], opts);
execFileSync('node', ['scripts/prune-media.mjs', 'dist-variant'], opts);
