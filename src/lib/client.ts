// Panels, the looping Short, the video player and the copy button. Nothing here talks to other servers.
type Clip = { id?: string; name?: string; title?: string; clip: string; poster: string; captions: { ja: string; en: string } };
type Data = { lang: 'ja' | 'en'; useCases: Clip[]; summary: Clip | null };

const $ = <T extends Element>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel);
const $$ = <T extends Element>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];

let opener: HTMLElement | null = null;

function openDialog(dialog: HTMLDialogElement, from: HTMLElement) {
  opener = from;
  dialog.showModal();
}

function setupDialogs() {
  for (const btn of $$<HTMLElement>('[data-open]')) {
    btn.addEventListener('click', () => openDialog($<HTMLDialogElement>(`#${btn.dataset.open}`)!, btn));
  }
  for (const dialog of $$<HTMLDialogElement>('dialog')) {
    for (const btn of $$<HTMLElement>('[data-close]', dialog)) btn.addEventListener('click', () => dialog.close());
    // Esc closes natively; either way focus goes back to the button that opened it.
    dialog.addEventListener('close', () => {
      $$<HTMLVideoElement>('video', dialog).forEach(v => v.pause());
      const target = dialog.dataset.returnTo ? $<HTMLElement>(dialog.dataset.returnTo) : opener;
      delete dialog.dataset.returnTo;
      target?.focus();
    });
    dialog.addEventListener('click', e => { if (e.target === dialog) dialog.close(); });
    for (const link of $$<HTMLAnchorElement>('[data-close-to]', dialog)) {
      link.addEventListener('click', e => {
        e.preventDefault();
        const section = $<HTMLElement>(link.dataset.closeTo!)!;
        section.setAttribute('tabindex', '-1');
        dialog.dataset.returnTo = link.dataset.closeTo!;
        dialog.close();
        section.scrollIntoView();
      });
    }
  }
}

function setupShort() {
  const video = $<HTMLVideoElement>('[data-short]');
  const toggle = $<HTMLButtonElement>('[data-short-toggle]');
  if (!video || !toggle) return;
  const error = $<HTMLElement>('[data-short-error]')!;
  const label = () => { toggle.textContent = video.paused ? toggle.dataset.play! : toggle.dataset.pause!; };
  video.addEventListener('play', label);
  video.addEventListener('pause', label);
  toggle.addEventListener('click', () => (video.paused ? video.play().catch(() => {}) : video.pause()));
  const fail = () => { error.hidden = false; toggle.parentElement!.hidden = true; };
  [...video.querySelectorAll('source')].at(-1)?.addEventListener('error', fail);
  // Every source may already have failed before this script ran.
  if (video.networkState === HTMLMediaElement.NETWORK_NO_SOURCE) fail();
  // Reduced motion (or a setting that can't be read) means no autoplay; the Play button starts it.
  const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)');
  if (reduce && !reduce.matches) video.play().catch(label);
}

function setupPlayer(data: Data) {
  const dialog = $<HTMLDialogElement>('#player');
  if (!dialog) return;
  const video = $<HTMLVideoElement>('[data-player]', dialog)!;
  const title = $<HTMLElement>('[data-player-title]', dialog)!;
  const error = $<HTMLElement>('[data-player-error]', dialog)!;
  const nav = $<HTMLElement>('[data-uc-nav]', dialog)!;
  const chaptersBox = $<HTMLElement>('[data-chapters]', dialog);
  const prev = $<HTMLButtonElement>('[data-step="-1"]', dialog)!;
  const next = $<HTMLButtonElement>('[data-step="1"]', dialog)!;
  let index = -1;

  const load = (clip: Clip) => {
    error.hidden = true;
    video.replaceChildren();
    video.poster = clip.poster;
    for (const [src, type] of [[clip.clip, 'video/mp4'], [clip.clip.replace(/\.mp4$/, '.webm'), 'video/webm']]) {
      const source = document.createElement('source');
      Object.assign(source, { src, type });
      // The last source failing means the browser could play neither.
      if (type === 'video/webm') source.addEventListener('error', () => { error.hidden = false; });
      video.append(source);
    }
    for (const lang of ['ja', 'en'] as const) {
      const track = document.createElement('track');
      Object.assign(track, { kind: 'subtitles', src: clip.captions[lang], srclang: lang, label: lang === 'ja' ? '日本語' : 'English', default: lang === data.lang });
      video.append(track);
    }
    title.textContent = clip.name ?? clip.title ?? '';
    video.load();
  };
  const showUseCase = (i: number) => {
    index = i;
    load(data.useCases[i]);
    nav.hidden = false;
    if (chaptersBox) chaptersBox.hidden = true;
    prev.disabled = i === 0;
    next.disabled = i === data.useCases.length - 1;
  };

  for (const btn of $$<HTMLElement>('[data-play-uc]')) {
    btn.addEventListener('click', () => {
      showUseCase(data.useCases.findIndex(uc => uc.id === btn.dataset.playUc));
      openDialog(dialog, btn);
    });
  }
  for (const btn of [prev, next]) {
    btn.addEventListener('click', () => {
      showUseCase(index + Number(btn.dataset.step));
      // Keep the player's return target on the card of the clip now showing.
      opener = $<HTMLElement>(`[data-play-uc="${data.useCases[index].id}"]`) ?? opener;
    });
  }
  const summaryBtn = $<HTMLElement>('[data-play-summary]');
  if (summaryBtn && data.summary) {
    summaryBtn.addEventListener('click', () => {
      index = -1;
      load(data.summary!);
      nav.hidden = true;
      if (chaptersBox) chaptersBox.hidden = false;
      openDialog(dialog, summaryBtn);
    });
  }
  for (const btn of $$<HTMLElement>('[data-seek]', dialog)) {
    btn.addEventListener('click', () => { video.currentTime = Number(btn.dataset.seek); video.play().catch(() => {}); });
  }
}

function setupCopy() {
  const btn = $<HTMLButtonElement>('[data-copy]');
  if (!btn) return;
  const original = btn.textContent;
  btn.addEventListener('click', async () => {
    await navigator.clipboard.writeText($<HTMLElement>('[data-prompt]')!.textContent ?? '');
    btn.textContent = btn.dataset.copied!;
    setTimeout(() => { btn.textContent = original; }, 2000);
  });
}

// On phones the menu drops down over the page, so picking a section closes it.
function setupMenu() {
  const menu = $<HTMLDetailsElement>('details.menu');
  if (!menu) return;
  for (const link of $$<HTMLAnchorElement>('a[href^="#"]', menu)) link.addEventListener('click', () => { menu.open = false; });
}

// The language switch keeps the section the reader is on.
function setupLangSwitch() {
  const link = $<HTMLAnchorElement>('[data-lang-switch]');
  link?.addEventListener('click', () => { link.hash = location.hash; });
}

export function setup() {
  const data: Data = JSON.parse($('#video-data')!.textContent!);
  setupDialogs();
  setupShort();
  setupPlayer(data);
  setupCopy();
  setupMenu();
  setupLangSwitch();
}
