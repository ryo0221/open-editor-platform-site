// Build-time content checks for the settings file, the ja/en words and the video files (07 control-01..06, 10).
// Exits non-zero on the first run with any problem, so `npm run build` stops before anything is published.
import { readFileSync, existsSync, statSync } from 'node:fs';

const read = p => JSON.parse(readFileSync(p, 'utf8'));
const site = read('src/config/site.json');
const ja = read('src/i18n/ja.json');
const en = read('src/i18n/en.json');
const problems = [];
const fail = msg => problems.push(msg);

// control-10: every word exists in both languages and is not empty.
for (const [a, b, name] of [[ja, en, 'en'], [en, ja, 'ja']]) {
  for (const key of Object.keys(a)) if (!(key in b)) fail(`word "${key}" is missing in ${name}`);
}
for (const [lang, words] of [['ja', ja], ['en', en]]) {
  for (const [key, text] of Object.entries(words)) if (!text.trim()) fail(`word "${key}" is empty in ${lang}`);
}

// control-02, constraint-09: no dates, prices or claims about things that are not decided.
const forbidden = [/\d{4}\s*年/, /\d+\s*月\s*\d+\s*日/, /[¥$€]\s*\d/, /\d\s*円/, /無料/, /\bfree\b/i, /対応済み/, /モバイル対応/, /mobile[- ]ready/i, /\b(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d/];
for (const [lang, words] of [['ja', ja], ['en', en]]) {
  for (const [key, text] of Object.entries(words)) {
    for (const re of forbidden) if (re.test(text)) fail(`word "${key}" (${lang}) matches ${re}: ${text}`);
  }
}

// control-01: the provision state comes only from the settings.
const oneOf = (value, allowed, name) => { if (!allowed.includes(value)) fail(`${name} is "${value}", expected one of ${allowed.join(', ')}`); };
oneOf(site.claudeCode.status, ['preparing', 'available'], 'claudeCode.status');
oneOf(site.claudeDesktop.status, ['preview', 'available', 'hidden'], 'claudeDesktop.status');
// The page only has Coming soon words for these; 05 state-transition-03/04 add release words first, then allow available here.
for (const k of ['chatgpt', 'codex', 'embedding']) oneOf(site[k].status, ['coming-soon'], `${k}.status`);
if (site.claudeCode.status === 'available') {
  if (!/^https:\/\//.test(site.claudeCode.releaseUrl)) fail('claudeCode.status is available but releaseUrl is not an https URL');
  if (!site.claudeCode.editors.length) fail('claudeCode.status is available but editors is empty');
}

// control-06, constraint-05: links are https and never point at private repositories.
const privateRepo = /github\.com\/ryo0221\/(paobub-mvp|editor-platform)(\.git)?(\/|$|\?|#)/i;
const urls = [...Object.entries(site.links), ['paobub.url', site.paobub.url], ['claudeCode.releaseUrl', site.claudeCode.releaseUrl]].filter(([, u]) => u);
for (const [name, url] of urls) {
  if (!/^https:\/\//.test(url)) fail(`${name} is not https: ${url}`);
  if (privateRepo.test(url)) fail(`${name} points at a private repository: ${url}`);
}

// control-04, state-transition-06/13: video files, captions in both languages, and the recorded commit.
oneOf(site.videos.source, ['browser', 'ai-host'], 'videos.source');
const LIMIT = 25 * 1024 * 1024; // Cloudflare static assets: 25 MiB per file
const file = (path, what) => {
  const full = `public/${path}`;
  if (!existsSync(full)) return fail(`${what}: ${full} does not exist`);
  if (statSync(full).size > LIMIT) fail(`${what}: ${full} is over 25 MiB`);
  if (full.endsWith('.mp4')) file(path.replace(/\.mp4$/, '.webm'), `${what} (WebM)`);
};
for (const uc of site.videos.useCases) {
  if (!uc.clip) continue;
  file(uc.clip, `use case ${uc.id}`);
  file(uc.poster, `use case ${uc.id} poster`);
  for (const lang of ['ja', 'en']) file(uc.captions[lang], `use case ${uc.id} captions (${lang})`);
  if (!(`uc.${uc.id}` in ja)) fail(`use case ${uc.id} has no name in the words`);
}
const o = site.videos.overview;
file(o.shortPoster, 'Short poster');
if (site.videos.useCases.every(uc => uc.clip && uc.inPublicBuild)) {
  for (const [p, what] of [[o.short, 'Short'], [o.summary, 'summary'], [o.summaryPoster, 'summary poster'], [o.captions.ja, 'summary captions (ja)'], [o.captions.en, 'summary captions (en)'], [o.chapters.ja, 'chapters (ja)'], [o.chapters.en, 'chapters (en)']]) file(p, what);
}
if (existsSync('public/videos/manifest.json')) {
  const manifest = read('public/videos/manifest.json');
  if (manifest.commit !== site.videos.commit) fail(`videos.commit is ${site.videos.commit} but the manifest says ${manifest.commit}`);
} else fail('public/videos/manifest.json is missing');

if (problems.length) {
  console.error(`Content check failed (${problems.length}):\n- ` + problems.join('\n- '));
  process.exit(1);
}
console.log(`Content check passed: ${Object.keys(ja).length} words in ja and en, ${site.videos.useCases.length} use cases, ${urls.length} links.`);
