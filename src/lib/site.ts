// Everything the page shows comes from the one settings file and the ja/en word lists.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
// `site-config` is src/config/site.json; tests point it at a fixture to build other states (astro.config.mjs).
import config from 'site-config';
import ja from '../i18n/ja.json';
import en from '../i18n/en.json';

export type Lang = 'ja' | 'en';
export const site = config;
const words: Record<Lang, Record<string, string>> = { ja, en };

export function t(lang: Lang, key: string, vars: Record<string, string> = {}): string {
  const text = words[lang][key];
  if (text === undefined) throw new Error(`Missing ${lang} word: ${key}`);
  return text.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '');
}

export const asset = (path: string) => import.meta.env.BASE_URL.replace(/\/?$/, '/') + path;
// Every mp4 has a WebM copy next to it for browsers without H.264.
export const webm = (path: string) => path.replace(/\.mp4$/, '.webm');
export const pageUrl = (lang: Lang) => asset(lang === 'ja' ? '' : 'en/');

export const claudeCodeAvailable = () => site.claudeCode.status === 'available' && site.claudeCode.releaseUrl !== '';

// The Short and the summary contain every step, so they show only when all eight use cases can play.
export const useCaseReady = (uc: (typeof site.videos.useCases)[number]) => uc.inPublicBuild && uc.clip !== '';
export const overviewReady = () => site.videos.source !== '' && site.videos.useCases.every(useCaseReady);

// Same rule as scripts/check-content.mjs: compare the parsed host and path.
const isPrivateRepo = (value: string) => {
  try {
    const u = new URL(value);
    if (!['github.com', 'www.github.com'].includes(u.hostname.toLowerCase().replace(/\.$/, ''))) return false;
    const [owner, repo = ''] = u.pathname.split('/').filter(Boolean).map(s => decodeURIComponent(s).toLowerCase());
    return owner === 'ryo0221' && ['paobub-mvp', 'editor-platform'].includes(repo.replace(/\.git$/, ''));
  } catch { return true; } // unreadable: treat as private
};
export const isPublicPaobubUrl = (url: string) => /^https:\/\//.test(url) && !isPrivateRepo(url);

// Clip lengths recorded by the video cut (public/videos/manifest.json), keyed by file name.
const manifest = JSON.parse(readFileSync(join(process.cwd(), 'public/videos/manifest.json'), 'utf8'));
export function clipLength(lang: Lang, clip: string): string {
  const name = clip.split('/').pop()!.replace(/\.mp4$/, '');
  const seconds = manifest.clips.find((c: { name: string }) => c.name === name)?.duration;
  // check-content.mjs requires every clip in the manifest; never guess a length.
  if (typeof seconds !== 'number') throw new Error(`${name} has no length in public/videos/manifest.json`);
  return seconds < 50 ? t(lang, 'features.seconds', { n: String(Math.round(seconds)) }) : t(lang, 'features.minutes', { n: String(Math.max(1, Math.round(seconds / 60))) });
}

// Chapters of the summary video, read from its chapter captions at build time.
export function chapters(lang: Lang): { start: number; title: string }[] {
  const file = join(process.cwd(), 'public', site.videos.overview.chapters[lang]);
  const toSec = (s: string) => s.split(':').reduce((a, p) => a * 60 + parseFloat(p), 0);
  return readFileSync(file, 'utf8').split(/(?:\r?\n){2,}/).flatMap(block => {
    const m = block.match(/(\d\d:\d\d:\d\d\.\d+) --> .*\r?\n(.+)/);
    return m ? [{ start: toSec(m[1]), title: m[2].trim() }] : [];
  });
}
