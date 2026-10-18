// Removes withheld media from the build output, so a use case with inPublicBuild false cannot be fetched by its URL.
// The Short and the summary contain every step, so they go too whenever any use case is withheld.
// Usage: node scripts/prune-media.mjs [outDir]   (reads SITE_CONFIG like the build)
import { readFileSync, rmSync } from 'node:fs';
import { relative, resolve } from 'node:path';

const outDir = process.argv[2] ?? 'dist';
const site = JSON.parse(readFileSync(process.env.SITE_CONFIG ?? 'src/config/site.json', 'utf8'));
const withheld = site.videos.useCases.filter(uc => !uc.inPublicBuild);
const files = withheld.flatMap(uc => [uc.clip, uc.poster, uc.captions?.ja, uc.captions?.en]);
if (withheld.length) {
  const o = site.videos.overview;
  files.push(o.short, o.summary, o.summaryPoster, o.captions?.ja, o.captions?.en, o.chapters?.ja, o.chapters?.en, o.shortCaptions?.ja, o.shortCaptions?.en);
}
// Files a public use case still points at stay, even if a withheld one shares them.
const kept = new Set(site.videos.useCases.filter(uc => uc.inPublicBuild).flatMap(uc => [uc.clip, uc.poster, uc.captions?.ja, uc.captions?.en]).filter(Boolean));
const removed = [];
for (const path of files.filter(p => p && !kept.has(p))) {
  for (const p of path.endsWith('.mp4') ? [path, path.replace(/\.mp4$/, '.webm')] : [path]) {
    // Never delete outside the build directory, whatever the settings say.
    const target = resolve(outDir, p), rel = relative(resolve(outDir), target);
    if (!rel || rel.startsWith('..') || resolve(rel) === rel) throw new Error(`refusing to remove ${p}: outside ${outDir}`);
    rmSync(target, { force: true });
    removed.push(p);
  }
}
console.log(removed.length ? `Withheld media removed from ${outDir}: ${removed.join(', ')}` : 'No withheld media');
