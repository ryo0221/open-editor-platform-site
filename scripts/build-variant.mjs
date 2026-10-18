// Builds the page from the post-release fixture into dist-variant for the tests. A Node wrapper so it also runs on Windows.
import { execFileSync } from 'node:child_process';

execFileSync('npx', ['astro', 'build', '--outDir', 'dist-variant'], {
  stdio: 'inherit',
  shell: process.platform === 'win32',
  env: { ...process.env, SITE_CONFIG: './tests/fixtures/after-release.json' },
});
