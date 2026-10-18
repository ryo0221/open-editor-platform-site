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

export const isPublicPaobubUrl = (url: string) => /^https:\/\//.test(url) && !/github\.com\/ryo0221\/(paobub-mvp|editor-platform)(\/|$)/.test(url);

// Chapters of the summary video, read from its chapter captions at build time.
export function chapters(lang: Lang): { start: number; title: string }[] {
  const file = join(process.cwd(), 'public', site.videos.overview.chapters[lang]);
  const toSec = (s: string) => s.split(':').reduce((a, p) => a * 60 + parseFloat(p), 0);
  return readFileSync(file, 'utf8').split(/\n\n+/).flatMap(block => {
    const m = block.match(/(\d\d:\d\d:\d\d\.\d+) --> .*\n(.+)/);
    return m ? [{ start: toSec(m[1]), title: m[2].trim() }] : [];
  });
}
