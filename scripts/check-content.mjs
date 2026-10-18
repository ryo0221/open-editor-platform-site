// Build-time content checks for the settings file, the ja/en words and the video files (07 control-01..06, 10).
// Exits non-zero on the first run with any problem, so `npm run build` stops before anything is published.
import { readFileSync, existsSync, statSync } from 'node:fs';
import { isAbsolute, normalize } from 'node:path';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
// SITE_CONFIG selects another settings file, as in the build (astro.config.mjs).
const site = read(process.env.SITE_CONFIG ?? 'src/config/site.json');
const ja = read('src/i18n/ja.json');
const en = read('src/i18n/en.json');
const problems = [];
const fail = msg => problems.push(msg);

// control-10: every word exists in both languages and is not empty.
for (const [a, b, name] of [[ja, en, 'en'], [en, ja, 'ja']]) {
  for (const key of Object.keys(a)) if (!(key in b)) fail(`word "${key}" is missing in ${name}`);
}
// t() fills {name} placeholders; both languages must use the same names or a value goes missing.
const holders = text => [...String(text).matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
for (const key of Object.keys(ja)) if (key in en && holders(ja[key]) !== holders(en[key])) fail(`word "${key}" uses {${holders(ja[key])}} in ja but {${holders(en[key])}} in en`);
for (const [lang, words] of [['ja', ja], ['en', en]]) {
  for (const [key, text] of Object.entries(words)) if (!text.trim()) fail(`word "${key}" is empty in ${lang}`);
}

// control-02, constraint-09: no dates, prices or claims about things that are not decided.
const forbidden = [/\d{4}\s*年/, /\b\d{4}[-/.]\d{1,2}[-/.]\d{1,2}\b/, /\b\d{1,2}\/\d{1,2}\/\d{2,4}\b/, /\d+\s*月\s*\d+\s*日/, /[¥$€£₩₹]\s*\d/, /\b(USD|EUR|JPY|GBP)\s*\d/i, /\d\s*(dollars?|euros?|pounds?|yen|USD|EUR|JPY|GBP)\b/i, /\d\s*円/, /無料/, /\bfree\b/i, /対応済み/, /モバイル対応/, /mobile[- ]ready/i, /\b(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b\.?\s+\d/i, /\b\d{1,2}(st|nd|rd|th)?\s+(of\s+)?(January|February|March|April|May|June|July|August|September|October|November|December|Jan|Feb|Mar|Apr|Jun|Jul|Aug|Sept|Sep|Oct|Nov|Dec)\b\.?\b/i, /\b(19|20)\d{2}\b/];
// The release requirements are free text rendered on the page, so they get the same scan as the words.
const requirements = Object.fromEntries(Object.entries(site.claudeCode.requirements ?? {}).map(([lang, text]) => [`claudeCode.requirements.${lang}`, text]));
for (const [lang, words] of [['ja', ja], ['en', en], ['settings', requirements]]) {
  for (const [key, text] of Object.entries(words)) {
    for (const re of forbidden) if (re.test(text)) fail(`word "${key}" (${lang}) matches ${re}: ${text}`);
  }
}

// control-01: the provision state comes only from the settings.
const oneOf = (value, allowed, name) => { if (!allowed.includes(value)) fail(`${name} is "${value}", expected one of ${allowed.join(', ')}`); };
oneOf(site.claudeCode.status, ['preparing', 'available'], 'claudeCode.status');
// Only the preview words exist for Claude Desktop; 05 state-transition-05 adds words before it can become available.
oneOf(site.claudeDesktop.status, ['preview', 'hidden'], 'claudeDesktop.status');
// The page only has Coming soon words for these; 05 state-transition-03/04 add release words first, then allow available here.
for (const k of ['codex', 'embedding']) oneOf(site[k].status, ['coming-soon'], `${k}.status`);
const isHttpsUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname; } catch { return false; } };
// Editors are listed only once they are checked on the released plugin (story-04).
if (site.claudeCode.status !== 'available' && site.claudeCode.editors.length) fail('claudeCode.editors must stay empty until claudeCode.status is available');
if (site.claudeCode.status === 'available') {
  if (!isHttpsUrl(site.claudeCode.releaseUrl)) fail('claudeCode.status is available but releaseUrl is not an https URL');
  if (!site.claudeCode.editors.length) fail('claudeCode.status is available but editors is empty');
  // The preparing notice promises the requirements at release, so both languages need them.
  for (const lang of ['ja', 'en']) if (!site.claudeCode.requirements[lang]?.trim()) fail(`claudeCode.status is available but requirements.${lang} is empty`);
}

// control-06, constraint-05: links are https and never point at private repositories.
// Compare the parsed host and path, so ports, case and .git cannot slip a private repository through.
const isPrivateRepo = value => {
  try {
    const u = new URL(value);
    if (!['github.com', 'www.github.com'].includes(u.hostname.toLowerCase().replace(/\.$/, ''))) return false;
    const [owner, repo = ''] = u.pathname.split('/').filter(Boolean).map(s => decodeURIComponent(s).toLowerCase());
    return owner === 'ryo0221' && ['paobub-mvp', 'editor-platform'].includes(repo.replace(/\.git$/, ''));
  } catch { return true; } // unreadable: treat as private
};
// Every site link is required; only the PaoBub and release URLs may stay empty before their release.
const urls = [...Object.entries(site.links), ...[['paobub.url', site.paobub.url], ['claudeCode.releaseUrl', site.claudeCode.releaseUrl]].filter(([, u]) => u)];
for (const [name, url] of urls) {
  if (!isHttpsUrl(url)) fail(`${name} is not a complete https URL: ${url}`);
  if (isPrivateRepo(url)) fail(`${name} points at a private repository: ${url}`);
}

// control-04, state-transition-06/13: video files, captions in both languages, and the recorded commit.
oneOf(site.videos.source, ['browser', 'ai-host'], 'videos.source');
const LIMIT = 25 * 1024 * 1024; // Cloudflare static assets: 25 MiB per file
const VIDEO = /\.mp4$/, IMAGE = /\.(jpe?g|png|webp|avif)$/, CAPTIONS = /\.vtt$/;
const file = (path, what, kind) => {
  if (!path) return fail(`${what}: the path is empty`);
  // Each field has one role; a poster in a captions field would build but never load.
  if (!kind.test(path)) return fail(`${what}: ${path} is not a ${kind === VIDEO ? '.mp4 video' : kind === IMAGE ? 'image' : '.vtt captions file'}`);
  if (isAbsolute(path) || normalize(path).split(/[\\/]/).includes('..')) return fail(`${what}: ${path} must stay inside public/`);
  // Paths go into URLs as written and prune-media.mjs compares them as text, so allow only plain, already-normalized names.
  if (!/^[A-Za-z0-9._-]+(\/[A-Za-z0-9._-]+)*$/.test(path) || path.split('/').includes('.')) return fail(`${what}: ${path} may use only letters, digits, ".", "_", "-" and single "/" between names`);
  const full = `public/${path}`;
  if (!existsSync(full) || !statSync(full).isFile()) return fail(`${what}: ${full} is not a file`);
  if (statSync(full).size > LIMIT) fail(`${what}: ${full} is over 25 MiB`);
  if (full.endsWith('.mp4')) file(path.replace(/\.mp4$/, '.webm'), `${what} (WebM)`, /\.webm$/);
  if (full.endsWith('.vtt')) cueTimes(full, what);
};
// Browsers drop a cue whose end is not after its start.
const cueTimes = (full, what) => {
  const sec = t => t.split(':').reduce((a, p) => a * 60 + parseFloat(p), 0);
  for (const [, a, b] of readFileSync(full, 'utf8').matchAll(/^(\S+) --> (\S+)/gm)) if (!(sec(b) > sec(a))) fail(`${what}: the cue ${a} --> ${b} in ${full} ends before it starts`);
};
// Ids must be unique: the player looks a card's clip up by id.
const ids = site.videos.useCases.map(uc => uc.id);
for (const id of new Set(ids.filter((id, i) => ids.indexOf(id) !== i))) fail(`use case id "${id}" is used more than once`);
for (const uc of site.videos.useCases) {
  // A string such as "false" would count as true in the page and in prune-media.mjs.
  if (typeof uc.inPublicBuild !== 'boolean') fail(`use case ${uc.id}: inPublicBuild must be true or false, not ${JSON.stringify(uc.inPublicBuild)}`);
  if (!uc.clip) continue;
  file(uc.clip, `use case ${uc.id}`, VIDEO);
  file(uc.poster, `use case ${uc.id} poster`, IMAGE);
  for (const lang of ['ja', 'en']) file(uc.captions[lang], `use case ${uc.id} captions (${lang})`, CAPTIONS);
  if (!(`uc.${uc.id}` in ja)) fail(`use case ${uc.id} has no name in the words`);
}
const o = site.videos.overview;
file(o.shortPoster, 'Short poster', IMAGE);
// The hero image is fixed in Page.astro rather than in the settings, but it must exist too.
file('posters/hero.jpg', 'hero image', IMAGE);
if (site.videos.useCases.every(uc => uc.clip && uc.inPublicBuild)) {
  for (const [p, what, kind] of [[o.short, 'Short', VIDEO], [o.summary, 'summary', VIDEO], [o.summaryPoster, 'summary poster', IMAGE], [o.shortCaptions.ja, 'Short captions (ja)', CAPTIONS], [o.shortCaptions.en, 'Short captions (en)', CAPTIONS], [o.captions.ja, 'summary captions (ja)', CAPTIONS], [o.captions.en, 'summary captions (en)', CAPTIONS], [o.chapters.ja, 'chapters (ja)', CAPTIONS], [o.chapters.en, 'chapters (en)', CAPTIONS]]) file(p, what, kind);
}
if (existsSync('public/videos/manifest.json')) {
  const manifest = read('public/videos/manifest.json');
  if (manifest.commit !== site.videos.commit) fail(`videos.commit is ${site.videos.commit} but the manifest says ${manifest.commit}`);
  // The Watch buttons show each clip's length from the manifest, so every playable clip needs an entry.
  for (const uc of site.videos.useCases.filter(uc => uc.clip && uc.inPublicBuild === true)) {
    const name = uc.clip.split('/').pop().replace(/\.mp4$/, '');
    if (typeof manifest.clips?.find(c => c.name === name)?.duration !== 'number') fail(`use case ${uc.id}: ${name} has no length in public/videos/manifest.json`);
  }
} else fail('public/videos/manifest.json is missing');

if (problems.length) {
  console.error(`Content check failed (${problems.length}):\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`Content check passed: ${Object.keys(ja).length} words in ja and en, ${site.videos.useCases.length} use cases, ${urls.length} links.`);
