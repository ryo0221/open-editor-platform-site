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
for (const [lang, words] of [['ja', ja], ['en', en]]) {
  for (const [key, text] of Object.entries(words)) {
    // The beta commercial-license policy (open-editor-platform BETA-COMMERCIAL-POLICY.md, Ryo 2026-11-21) is the one
    // decided offer the page may call free; prices, dates and other free claims stay out everywhere.
    const betaWords = key.startsWith('beta.') || key === 'nav.beta' || key === 'faq.a6';
    for (const re of forbidden) if (re.test(text) && !(betaWords && (String(re) === '/無料/' || String(re) === '/\\bfree\\b/i'))) fail(`word "${key}" (${lang}) matches ${re}: ${text}`);
  }
}

// control-01: the provision state comes only from the settings (05 提供状態, 2026-11 改訂).
// Availability and development are separate fields. Host integrations have more work planned (Ryo 2026-11-14,
// replacing "frozen"); no date is promised, so no 準備中 / Coming soon wording. Only the states the page has words for are allowed.
const oneOf = (value, allowed, name) => { if (!allowed.includes(value)) fail(`${name} is "${value}", expected one of ${allowed.join(', ')}`); };
const isHttpsUrl = value => { try { const u = new URL(value); return u.protocol === 'https:' && !!u.hostname; } catch { return false; } };
const cc = site.hosts?.claudeCode ?? {};
oneOf(cc.access, ['released-preview'], 'hosts.claudeCode.access');
oneOf(cc.development, ['planned'], 'hosts.claudeCode.development');
if (!/^\d+\.\d+\.\d+$/.test(cc.version ?? '')) fail(`hosts.claudeCode.version is "${cc.version}", expected x.y.z`);
if (!isHttpsUrl(cc.releaseUrl) || !String(cc.releaseUrl).endsWith(`/releases/tag/v${cc.version}`)) fail(`hosts.claudeCode.releaseUrl must be the https release page of v${cc.version}: ${cc.releaseUrl}`);
oneOf(site.hosts?.codex?.access, ['reference-only'], 'hosts.codex.access');
oneOf(site.hosts?.codex?.development, ['planned'], 'hosts.codex.development');
oneOf(site.embedding?.access, ['public-docs'], 'embedding.access');
oneOf(site.embedding?.development, ['active'], 'embedding.development');
// The page has words only for the design stage; launch words and the link come with the launch (05 state-transition).
oneOf(site.community?.stage, ['design'], 'community.stage');
if (site.community?.url) fail('community.url must stay empty while community.stage is design (the repository is private)');
// No word may bring back the retired preparing / Coming soon promises or ChatGPT (2026-10-18, 2026-11-14 Ryo).
for (const [lang, words] of [['ja', ja], ['en', en]]) {
  for (const [key, text] of Object.entries(words)) {
    if (/配布準備中|Preparing release|Coming soon|ChatGPT/.test(text) && key !== 'badge.soon' && !key.startsWith('uc.') && key !== 'features.preparing') fail(`word "${key}" (${lang}) uses a retired state: ${text}`);
  }
}

// control-06, constraint-05: links are https and never point at private repositories.
// Compare the parsed host and path, so ports, case and .git cannot slip a private repository through.
const isPrivateRepo = value => {
  try {
    const u = new URL(value);
    if (!['github.com', 'www.github.com'].includes(u.hostname.toLowerCase().replace(/\.$/, ''))) return false;
    const [owner, repo = ''] = u.pathname.split('/').filter(Boolean).map(s => decodeURIComponent(s).toLowerCase());
    return owner === 'ryo0221' && ['paobub-mvp', 'editor-platform', 'open-editor-community'].includes(repo.replace(/\.git$/, ''));
  } catch { return true; } // unreadable: treat as private
};
// Every site link is required; only the PaoBub URL may stay empty before its release.
const urls = [...Object.entries(site.links), ['hosts.claudeCode.releaseUrl', cc.releaseUrl], ...[['paobub.url', site.paobub.url]].filter(([, u]) => u)];
for (const [name, url] of urls) {
  if (!isHttpsUrl(url)) fail(`${name} is not a complete https URL: ${url}`);
  if (isPrivateRepo(url)) fail(`${name} points at a private repository: ${url}`);
}

// control-04, state-transition-06/13: video files, captions in both languages, and the recorded commit.
// The clips were recorded by running Playground steps automatically (2026-11-14 Ryo); the page has words for that source only.
oneOf(site.videos.source, ['playground'], 'videos.source');
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

// Purpose cut and editor cut (02 include-11/12, 05 state-purpose-*, 07 control-04/12, 2026-11 改訂).
// Each example lists editors that exist in the editor cut, and shows material only once its source and scope are checked.
const editorIds = new Map();
for (const group of ['basic', 'specialized']) {
  for (const e of site.editors?.[group] ?? []) {
    if (editorIds.has(e.id)) fail(`editor "${e.id}" is listed twice`);
    editorIds.set(e.id, group);
    oneOf(e.maturity, ['included', 'preview', 'experimental'], `editors.${group}.${e.id}.maturity`);
    for (const key of [`editor.${e.id}`, `editor.${e.id}.body`]) if (!(key in ja)) fail(`editor ${e.id} has no word ${key}`);
  }
}
if (!site.editors?.basic?.length || !site.editors?.specialized?.length) fail('editors.basic and editors.specialized must both list editors');
const purposeIds = (site.purposes ?? []).map(p => p.id);
if (purposeIds.length !== 8) fail(`purposes must list the eight agreed examples, found ${purposeIds.length}`);
for (const p of site.purposes ?? []) {
  if (purposeIds.indexOf(p.id) !== purposeIds.lastIndexOf(p.id)) fail(`purpose "${p.id}" is listed twice`);
  for (const key of ['title', 'case', 'focus', 'source']) if (!(`purposes.${p.id}.${key}` in ja)) fail(`purpose ${p.id} has no word purposes.${p.id}.${key}`);
  if (!p.editors?.length) fail(`purpose ${p.id} lists no editors`);
  for (const id of p.editors ?? []) if (!editorIds.has(id)) fail(`purpose ${p.id} uses editor "${id}", which is not in the editor cut`);
  if (typeof p.sourceChecked !== 'boolean') fail(`purpose ${p.id}: sourceChecked must be true or false`);
  // Material shows only after its origin and how far it can be shown are recorded (06) and approved.
  if (p.image && !p.sourceChecked) fail(`purpose ${p.id} has an image but sourceChecked is false`);
  if (p.sourceChecked) {
    if (!p.image) fail(`purpose ${p.id}: sourceChecked is true but there is no image`);
    else file(p.image, `purpose ${p.id} image`, IMAGE);
    for (const [lang, words] of [['ja', ja], ['en', en]]) if (words[`purposes.${p.id}.source`] === words['purposes.building.source'] && /確認中|Checking/.test(words[`purposes.${p.id}.source`])) fail(`purpose ${p.id}: the source note (${lang}) still says it is being checked`);
  }
}

// YouTube playlist snapshot (scripts/fetch-youtube.mjs): plain video ids and titles, thumbnails as local files.
const yt = site.youtube ?? {};
if (!yt.snapshot || !existsSync(yt.snapshot)) fail(`youtube.snapshot ${yt.snapshot} is missing`);
else {
  const snap = read(yt.snapshot);
  if (snap.playlistId !== yt.playlistId) fail(`the YouTube snapshot is for playlist "${snap.playlistId}" but the settings name "${yt.playlistId}"; run scripts/fetch-youtube.mjs`);
  for (const v of snap.videos ?? []) {
    if (!/^[A-Za-z0-9_-]{11}$/.test(v.id ?? '')) fail(`YouTube video id "${v.id}" is not a video id`);
    if (!String(v.title ?? '').trim()) fail(`YouTube video ${v.id} has no title`);
    file(v.thumb, `YouTube video ${v.id} thumbnail`, IMAGE);
  }
}

if (problems.length) {
  console.error(`Content check failed (${problems.length}):\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`Content check passed: ${Object.keys(ja).length} words in ja and en, ${site.videos.useCases.length} use cases, ${urls.length} links.`);
