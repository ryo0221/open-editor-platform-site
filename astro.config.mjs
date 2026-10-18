import { defineConfig } from 'astro/config';
import { fileURLToPath } from 'node:url';

// A static page only: no server code, no integrations that load third-party scripts.
// SITE_CONFIG lets the tests build the page from another settings file (for example, after release).
const siteConfig = process.env.SITE_CONFIG ? fileURLToPath(new URL(process.env.SITE_CONFIG, import.meta.url)) : fileURLToPath(new URL('./src/config/site.json', import.meta.url));

export default defineConfig({
  output: 'static',
  trailingSlash: 'ignore',
  vite: { resolve: { alias: { 'site-config': siteConfig } } },
});
