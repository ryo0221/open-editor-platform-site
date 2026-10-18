// Removes withheld media from the build output, so a use case with inPublicBuild false cannot be fetched by its URL.
// The Short and the summary contain every step, so they go too whenever any use case is withheld.
// Usage: node scripts/prune-media.mjs [outDir]   (reads SITE_CONFIG like the build)
import { readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const outDir = process.argv[2] ?? 'dist';
const site = JSON.parse(readFileSync(process.env.SITE_CONFIG ?? 'src/config/site.json', 'utf8'));
const withheld = site.videos.useCases.filter(uc => !uc.inPublicBuild);
const files = withheld.flatMap(uc => [uc.clip, uc.poster, uc.captions?.ja, uc.captions?.en]);
if (withheld.length) {
  const o = site.videos.overview;
  files.push(o.short, o.summary, o.summaryPoster, o.captions?.ja, o.captions?.en, o.chapters?.ja, o.chapters?.en, o.shortCaptions?.ja, o.shortCaptions?.en);
}
const removed = [];
for (const path of files.filter(Boolean)) {
  for (const p of path.endsWith('.mp4') ? [path, path.replace(/\.mp4$/, '.webm')] : [path]) {
    rmSync(join(outDir, p), { force: true });
    removed.push(p);
  }
}
console.log(removed.length ? `Withheld media removed from ${outDir}: ${removed.join(', ')}` : 'No withheld media');
