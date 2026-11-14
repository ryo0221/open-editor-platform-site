// One test per acceptance criterion in 03 訪問者のストーリー (2026-11 改訂案), plus the 07 controls that a browser can check.
// Each title starts with its test ID and the criteria it covers; scripts/test-trace.mjs builds the trace table from them.
import { test, expect, type Page } from '@playwright/test';

const VARIANT = 'http://localhost:4322'; // built from tests/fixtures/variant.json (a public PaoBub URL, the Geo clip withheld)
const pcOnly = () => test.skip(test.info().project.name !== 'pc', 'checked at PC width');
const phoneOnly = () => test.skip(test.info().project.name !== 'phone', 'checked at phone width');
const RELEASE = 'https://github.com/ryo0221/editor-platform-plugins/releases/tag/v0.1.5';
const CORE = 'https://github.com/ryo0221/open-editor-platform';
const DOC = (path: string) => `${CORE}/blob/main/${path}`;

async function open(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

test.describe('story-01 初めて来て、何ができるかをつかむ', () => {
  test('test-01 [story-01.criterion-01] the first screen shows the value, license and stage, the example and workflow buttons, the source link, the docs link and the community line', async ({ page }) => {
    pcOnly();
    await open(page);
    for (const text of ['AI と人のためのオープンソース編集基盤（AGPLv3・開発プレビュー）', 'AIと作り、Editorで仕上げる。', '文書、スライド、データ、地図、デザインを、開き直して直せる成果物に。', '目的から事例を見る', '制作の流れを動画で見る']) {
      await expect(page.getByText(text, { exact: true }).first()).toBeInViewport();
    }
    for (const name of [/^ソースを見る（GitHub）/, /^組み込み・拡張の資料/]) await expect(page.locator('#top').getByRole('link', { name })).toBeInViewport();
    await expect(page.locator('#top')).toContainText('作品と道具を共有するコミュニティを構想・設計しています。');
    await expect(page.locator('[data-cta]')).toHaveAttribute('href', '#purposes');
    await expect(page.locator('[data-flow]')).toHaveAttribute('href', '#features');
    await expect(page.locator('[data-source]')).toHaveAttribute('href', CORE);
    await expect(page.locator('[data-docs]')).toHaveAttribute('href', DOC('docs/developer-guide.md'));
    // The page no longer leads with a plugin download.
    await expect(page.locator('#top a[href*="/releases/"], a[download]')).toHaveCount(0);
  });

  test('test-02 [story-01.criterion-02] the three values each have a heading and a short explanation, with license and stage', async ({ page }) => {
    pcOnly();
    await open(page);
    const cards = page.locator('#values .card');
    await expect(cards).toHaveCount(3);
    await expect(cards.locator('h3')).toHaveText(['人が直接触れる編集面', 'ネイティブ形式で保存', 'オープンソース（AGPLv3）']);
    for (const card of await cards.all()) await expect(card.locator('p')).not.toBeEmpty();
    await expect(cards.nth(2)).toContainText('開発プレビュー');
  });

  test('test-03 [story-01.criterion-03] the old three-way scope list is gone; maturity is shown per editor instead', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('[data-domains], [data-editors]')).toHaveCount(0);
    await expect(page.locator('#editors [data-maturity]')).toHaveCount(16);
    await expect(page.locator('#editors').getByRole('link', { name: /実装状況と制限/ })).toHaveAttribute('href', DOC('docs/status.md'));
  });

});

test.describe('story-02 一つの業務の流れを動画で確かめる', () => {
  test('test-04 [story-02.criterion-01] the Short loops silently with the material notes', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('#features').scrollIntoViewIfNeeded();
    const short = page.locator('[data-short]');
    await expect(short).toHaveJSProperty('muted', true);
    await expect(short).toHaveJSProperty('loop', true);
    // The silent Short carries captions in the page's language, shown by default.
    await expect(short.locator('track[kind="captions"][srclang="ja"][default]')).toHaveAttribute('src', /story-short\.ja\.vtt$/);
    await expect.poll(() => short.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)).toBe(true);
    await expect(page.getByText('Playground 上の操作を自動実行した例・架空データ').first()).toBeVisible();
    await expect(page.getByText('撮影：公開版 421ec42（いまの版とは画面が違うことがあります）')).toBeVisible();
    await expect(page.locator('#features')).toContainText('AI と人の制作フローを想定し、Playground 上の操作を自動実行して撮りました。');
    expect(await page.locator('body').innerText()).not.toMatch(/AI ホスト（Claude Code）との実演|Claude Code での実演/);
    // Each clip says what it is on its own: captions mark the AI and person steps as automated, in both languages.
    for (const name of ['uc-1-goal', 'uc-2-workflow', 'uc-3-ideas', 'uc-4-data', 'uc-5-geo', 'uc-6-proposal', 'uc-7-design-doc', 'uc-8-mock', 'story-summary']) {
      for (const lang of ['ja', 'en']) {
        const vtt = await (await page.request.get(`/videos/${name}.${lang}.vtt`)).text();
        const cues = vtt.split(/\n/).filter(l => l && !/^(WEBVTT|\d+|\S+ --> \S+)$/.test(l));
        expect(cues.filter(c => /^(AI |A person |AI が|人が)/.test(c)), `${name}.${lang}`).toEqual([]);
        expect(cues.some(c => /自動操作|automated/i.test(c)), `${name}.${lang}`).toBe(true);
      }
    }
    // The burned-in label was replaced (manifest records the edit; the frames themselves are checked by eye in 10).
    const manifest = await (await page.request.get('/videos/manifest.json')).json();
    expect(manifest.label).toBe('playground-demo');
  });

  test('test-05 [story-02.criterion-02] a use-case clip opens with captions, steps to the next one, and closes back to its card', async ({ page }) => {
    pcOnly();
    await open(page);
    const watch = page.locator('[data-play-uc="geo"]');
    await watch.click();
    const player = page.locator('#player');
    await expect(player).toBeVisible();
    await expect(player.locator('[data-player-title]')).toHaveText('地図で確かめる');
    const video = player.locator('video');
    await expect(video).toHaveAttribute('controls', '');
    await expect(video.locator('track')).toHaveCount(2);
    await expect(video.locator('track[srclang="ja"]')).toHaveJSProperty('default', true);
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.readyState)).toBeGreaterThan(0);
    await video.evaluate(async (v: HTMLVideoElement) => { await v.play(); v.currentTime = 5; v.pause(); });
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => Math.round(v.currentTime))).toBe(5);
    await player.getByRole('button', { name: '次のユースケース' }).click();
    await expect(player.locator('[data-player-title]')).toHaveText('企画書にまとめる');
    await player.getByRole('button', { name: '閉じる' }).click();
    await expect(player).toBeHidden();
    await expect(page.locator('[data-play-uc="proposal"]')).toBeFocused();
  });

  test('test-06 [story-02.criterion-03] "Watch a workflow" moves to the features with the Short and eight cards', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.getByRole('link', { name: '制作の流れを動画で見る' }).click();
    await expect(page).toHaveURL(/#features$/);
    await expect(page.locator('#features-h')).toBeInViewport();
    await expect(page.locator('[data-uc]')).toHaveCount(8);
  });

  test('test-07 [story-02.criterion-04] [story-02.exception-02] a use case not in the public build shows Coming soon and nothing playable', async ({ page }) => {
    pcOnly();
    await open(page, VARIANT + '/');
    const card = page.locator('[data-uc="geo"]');
    await expect(card.getByText('動画は準備中です')).toBeVisible();
    await expect(card.locator('.status')).toHaveText('準備中');
    await expect(card.getByText('既存店と候補地を地図で確かめる場面を見せる予定です。')).toBeVisible();
    await expect(card.locator('button, video')).toHaveCount(0);
    await expect(page.locator('[data-play-uc="goal"]')).toContainText('見る（13 秒）');
    await expect(page.locator('[data-play-uc="proposal"]')).toContainText('見る（1 分）');
    // The Short and the summary contain every step, so both give way to a still image.
    await expect(page.locator('[data-short]')).toHaveCount(0);
    await expect(page.locator('[data-short-frame] img')).toBeVisible();
    await expect(page.locator('[data-play-summary]')).toHaveCount(0);
    // Withheld media is not in the build, so it cannot be fetched by URL either.
    for (const path of ['videos/uc-5-geo.mp4', 'videos/uc-5-geo.webm', 'videos/story-summary.mp4', 'videos/story-short.webm']) {
      expect((await page.request.get(`${VARIANT}/${path}`)).status(), path).toBe(404);
    }
    expect((await page.request.get(`${VARIANT}/videos/uc-1-goal.mp4`)).status()).toBe(200);
    await expect(page.locator('[data-play-uc="mock"]')).toBeVisible();
  });

  test('test-08 [story-02.criterion-05] with reduced motion the Short waits for the Play button', async ({ browser }) => {
    pcOnly();
    const page = await browser.newPage({ reducedMotion: 'reduce' });
    await open(page, 'http://localhost:4321/');
    const short = page.locator('[data-short]');
    await page.waitForTimeout(1000);
    await expect(short).toHaveJSProperty('paused', true);
    const toggle = page.locator('[data-short-toggle]');
    await expect(toggle).toHaveText('再生する');
    await toggle.click();
    await expect.poll(() => short.evaluate((v: HTMLVideoElement) => !v.paused)).toBe(true);
    await expect(toggle).toHaveText('一時停止する');
    await page.close();
  });

  test('test-09 [story-02.criterion-06] the summary opens with chapters that jump to each use case', async ({ page }) => {
    pcOnly();
    await open(page);
    const button = page.getByRole('button', { name: 'まとめを見る（約 5 分）' });
    await button.click();
    const player = page.locator('#player');
    await expect(player.locator('[data-player-title]')).toHaveText('まとめ動画');
    const chapters = player.locator('[data-seek]');
    await expect(chapters).toHaveCount(9);
    // The summary has chapters, not use-case steps: the previous/next buttons must not show.
    await expect(player.locator('[data-uc-nav]')).toBeHidden();
    await expect(player.getByRole('button', { name: '前のユースケース' })).toBeHidden();
    await expect(player.getByRole('button', { name: '次のユースケース' })).toBeHidden();
    await expect(chapters.nth(5)).toHaveText('5. 地図で確かめる');
    const video = player.locator('video');
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.duration)).toBeLessThanOrEqual(600);
    await chapters.nth(5).click();
    const start = Number(await chapters.nth(5).getAttribute('data-seek'));
    await expect.poll(() => video.evaluate((v: HTMLVideoElement) => v.currentTime)).toBeGreaterThanOrEqual(start);
    await page.keyboard.press('Escape');
    await expect(button).toBeFocused();
  });

  test('test-10 [story-02.exception-01] when videos cannot load, the still and the notice stay and the page keeps working', async ({ page }) => {
    pcOnly();
    await page.route(/\.(mp4|webm)$/, route => route.abort());
    await open(page);
    await expect(page.getByText('動画を読み込めませんでした。ページを再読み込みしてください。').first()).toBeVisible();
    await expect(page.locator('[data-short]')).toHaveAttribute('poster', /story-short\.jpg$/);
    await page.getByText('ライセンスと費用は？').click();
    await expect(page.locator('[data-faq="6"]')).toContainText('AGPLv3 で公開しています。');
  });
});

test.describe('story-03 手元で試し、ソースを読む', () => {
  test('test-11 [story-03.criterion-01] "View the source" opens the core repository in a new tab', async ({ page, context }) => {
    pcOnly();
    await open(page);
    const link = page.locator('[data-source]');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await context.route('https://github.com/**', route => route.fulfill({ body: 'stub' }));
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    expect(popup.url()).toBe(CORE);
  });

  test('test-12 [story-03.criterion-02] the Playground card says it is public, saves in the browser, and links the run steps', async ({ page }) => {
    pcOnly();
    await open(page);
    const card = page.locator('[data-way="playground"]');
    await expect(card.locator('.status')).toHaveText('公開済み');
    await expect(card).toContainText('成果物はそのブラウザの中に保存されます。');
    await expect(card.getByRole('link', { name: /起動の手順（README）/ })).toHaveAttribute('href', `${CORE}#run`);
  });
});

test.describe('story-04 AI ホストとの連携の今の状態を知る', () => {
  test('test-13 [story-04.criterion-01] the host card says development is frozen, and no retired state or ChatGPT appears', async ({ page }) => {
    pcOnly();
    for (const [path, words] of [['/', /配布準備中|Coming soon／準備中|準備中（Coming soon）|ChatGPT/], ['/en/', /Preparing release|Coming soon: |ChatGPT/]] as const) {
      await open(page, path);
      const text = await page.locator('body').innerText();
      expect(text).not.toMatch(words);
    }
    await open(page);
    const card = page.locator('[data-way="hosts"]');
    await expect(card.locator('h3')).toHaveText('AI ホストとの連携（参考）');
    await expect(card.locator('.status')).toHaveText('開発凍結');
    await expect(page.locator('[data-way="codex"], [data-way="claudeCode"], [data-way="chatgpt"]')).toHaveCount(0);
  });

  test('test-14 [story-04.criterion-02] the panel separates availability from development for Claude Code and Codex', async ({ page }) => {
    pcOnly();
    await open(page);
    const opener = page.locator('[data-way="hosts"] button');
    await opener.click();
    const panel = page.locator('#panel-hosts');
    await expect(panel).toBeVisible();
    await expect(panel.locator('thead th')).toHaveText(['AI ホストとの連携（参考）', '入手・利用', '開発']);
    await expect(panel.locator('[data-host="claudeCode"] td')).toHaveText(['既存プレビュー版 v0.1.5 の配布あり', '新規開発・本体への追随を凍結']);
    await expect(panel.locator('[data-host="codex"] td')).toHaveText(['参考実装あり・一般配布なし', '新規開発・本体への追随を凍結']);
    await page.keyboard.press('Escape');
    await expect(panel).toBeHidden();
    await expect(opener).toBeFocused();
  });

  test('test-15 [story-04.criterion-03] the checked environment is labelled as the release-time check and the release page is linked', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('[data-way="hosts"] button').click();
    const panel = page.locator('#panel-hosts');
    await expect(panel.locator('[data-checked]')).toHaveText('v0.1.5 の公開時の確認環境：Windows 11 と WSL2（Ubuntu 22.04）、Claude Code 2.1.303。後続の Claude Code の版は確かめていません。同梱の本体は古い公開版で、いまの Open Editor Platform とは機能が違います。');
    const link = panel.locator('[data-release]');
    await expect(link).toHaveAttribute('href', RELEASE);
    await expect(link).toHaveAttribute('target', '_blank');
  });

  test('test-16 [story-04.criterion-04] the panel says the public API stays available and links the embedding docs', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('[data-way="hosts"] button').click();
    const api = page.locator('#panel-hosts [data-api]');
    await expect(api).toContainText('ほかのアプリや AI ホストからは、公開 API を使って呼び出せます。');
    await expect(api.getByRole('link', { name: /組み込みの資料/ })).toHaveAttribute('href', DOC('docs/embedding.md'));
    expect(await api.innerText()).not.toContain('凍結');
  });
});

test.describe('story-05 コミュニティの構想を知る', () => {
  test('test-17 [story-05.criterion-01] the community nav link shows the stage, the cycle and that there is no launch date', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('.nav-wide').getByRole('link', { name: 'コミュニティ' }).click();
    await expect(page.locator('#community-h')).toBeInViewport();
    const section = page.locator('#community');
    await expect(section.locator('[data-community-stage]')).toHaveText('構想・設計中');
    await expect(section.locator('.steps li')).toHaveText(['公開する', '見つける', 'Editor で開いて使う', '改良する', '元の作品と作者を残して、また公開する']);
    await expect(section.locator('[data-community-note]')).toHaveText('サービスはまだ公開していません。公開時期は未定です。公開したら、このページから案内します。');
  });

  test('test-18 [story-05.criterion-02] nothing links to the community repository or a community service', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('#community a')).toHaveCount(0);
    for (const href of await page.locator('a[href]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href))) {
      expect(href).not.toMatch(/open-editor-community/);
    }
  });
});

test.describe('story-06 自分のプロダクトへの組み込みを検討する', () => {
  test('test-19 [story-06.criterion-01] the embedding card and panel say the docs are public and development continues', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('[data-way="embedding"] .status')).toHaveText('公開済みの範囲を案内');
    await page.locator('[data-way="embedding"] button').click();
    const panel = page.locator('#panel-embedding');
    await expect(panel.locator('.states td')).toHaveText(['公開済みの範囲を資料で案内', '本体の開発対象として継続']);
  });

  test('test-20 [story-06.criterion-02] the panel links the guide, embedding, Host and license docs, and says the commercial license is not offered', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('[data-way="embedding"] button').click();
    const panel = page.locator('#panel-embedding');
    for (const [name, href] of [[/開発者ガイド/, DOC('docs/developer-guide.md')], [/埋め込みの資料/, DOC('docs/embedding.md')], [/Host への組み込み/, DOC('docs/host-integration.md')], [/^ライセンス（AGPLv3）/, DOC('LICENSE')], [/商用ライセンス（別契約・まだ提供していません）/, DOC('COMMERCIAL-LICENSING.md')]] as const) {
      await expect(panel.getByRole('link', { name })).toHaveAttribute('href', href);
    }
  });

  test('test-21 [story-06.criterion-03] the PaoBub example link moves to the PaoBub section', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('[data-way="embedding"] button').click();
    await page.getByRole('link', { name: '実例：PaoBub を見る' }).click();
    await expect(page.locator('#panel-embedding')).toBeHidden();
    await expect(page).toHaveURL(/#paobub$/);
    await expect(page.locator('#paobub-h')).toBeInViewport();
    await expect(page.locator('#paobub')).toBeFocused();
  });
});

test.describe('story-07 PaoBub を知る', () => {
  test('test-22 [story-07.criterion-01] the PaoBub nav link shows what it is, that it embeds the platform, and Coming soon', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('.nav-wide').getByRole('link', { name: 'PaoBub' }).click();
    const section = page.locator('#paobub');
    await expect(page.locator('#paobub-h')).toBeInViewport();
    await expect(section).toContainText('Built with Open Editor Platform');
    await expect(section).toContainText('仕様・画面・ワークフローを、人が確かめながら AI と対話して作る道具。');
    await expect(section.locator('.status')).toHaveText('準備中');
    await expect(section.locator('a')).toHaveCount(0);
  });

  test('test-23 [story-07.criterion-02] there is no external link for PaoBub and no link to private repositories anywhere', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('#paobub a')).toHaveCount(0);
    for (const href of await page.locator('a[href]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href))) {
      expect(href).not.toMatch(/github\.com\/ryo0221\/(paobub-mvp|editor-platform|open-editor-community)(\/|$)/);
    }
  });

  test('test-24 [story-07.criterion-03] with a public PaoBub URL in the settings, the section links to it', async ({ page }) => {
    pcOnly();
    await open(page, VARIANT + '/');
    const link = page.locator('[data-paobub-link]');
    await expect(link).toHaveAttribute('href', 'https://example.com/paobub');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(page.locator('#paobub .status')).toHaveCount(0);
  });
});

test.describe('story-08 不安な点を FAQ で確かめる', () => {
  test('test-25 [story-08.criterion-01] the FAQ covers the platform, embedding, the Playground, AI, host integrations, license and the community', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('#faq summary')).toHaveText(['Open Editor Platform とは何ですか？', '自分のアプリに組み込めますか？', 'Playground はどう試しますか？データはどこに保存されますか？', 'AI に内容は送られますか？', 'Claude Code や Codex で使えますか？', 'ライセンスと費用は？', 'コミュニティにはいつ参加できますか？']);
    for (const [n, href] of [[1, DOC('docs/status.md')], [2, DOC('docs/embedding.md')], [3, `${CORE}#run`], [5, RELEASE], [6, DOC('LICENSE-GUIDE.md')]] as const) {
      await expect(page.locator(`[data-faq="${n}"] a`)).toHaveAttribute('href', href);
    }
  });

  test('test-26 [story-08.criterion-02] plugin-only conditions stay in the plugin answer; the platform answers describe the platform', async ({ page }) => {
    pcOnly();
    await open(page);
    const faq = page.locator('#faq');
    const text = await faq.evaluate(el => el.textContent ?? '');
    // The old plugin conditions must not read as properties of the whole platform.
    expect(text).not.toMatch(/\.local\/share|Claude Code の契約|1 台の端末で 1 人|保存していない編集中の内容は渡りません|拡張そのもの/);
    expect(text).not.toMatch(/送られません。|never sent/);
    await expect(page.locator('[data-faq="3"]')).toContainText('そのブラウザの IndexedDB に残ります');
    await expect(page.locator('[data-faq="4"]')).toContainText('何がどこへ送られるかは、組み込む側のアプリや連携の作り方で決まります');
    await expect(page.locator('[data-faq="5"]')).toContainText('その版の保存先、導入方法、権限、確かめた環境は、版ごとの資料に載っています。');
    await expect(page.locator('[data-faq="6"]')).toContainText('AGPL の条件によらない利用のための別契約（商用ライセンス）は、まだ提供していません');
    await expect(page.locator('.faq-note')).toHaveCount(0);
  });

  test('test-27 [story-08.criterion-03] questions open and close with Tab and Enter, with a visible focus ring', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('#faq-h').scrollIntoViewIfNeeded();
    const first = page.locator('#faq summary').first();
    await first.focus();
    await page.keyboard.press('Tab');
    const second = page.locator('#faq summary').nth(1);
    await expect(second).toBeFocused();
    expect(await second.evaluate(el => getComputedStyle(el).outlineStyle)).toBe('solid');
    await page.keyboard.press('Enter');
    await expect(page.locator('#faq details').nth(1)).toHaveAttribute('open', '');
    await page.keyboard.press('Enter');
    await expect(page.locator('#faq details').nth(1)).not.toHaveAttribute('open', '');
  });
});

test.describe('story-09 ソースを読み、不具合や要望を伝える', () => {
  test('test-28 [story-09.criterion-01] the footer links the core, status, guide, license and the frozen plugins, with no email address', async ({ page }) => {
    pcOnly();
    await open(page);
    const footer = page.locator('footer');
    for (const href of [CORE, DOC('docs/status.md'), DOC('docs/developer-guide.md'), DOC('LICENSE'), 'https://github.com/ryo0221/editor-platform-plugins']) {
      await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(footer.getByRole('link', { name: /GitHub（plugins・開発凍結）/ })).toBeVisible();
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  test('test-29 [story-09.criterion-02] issues go to the site repository for the page and to the core for the product', async ({ page }) => {
    pcOnly();
    await open(page);
    const footer = page.locator('footer');
    await expect(footer).toContainText('LP の不具合は site、製品の不具合は本体の Issue へ。');
    await expect(footer.getByRole('link', { name: /LP の不具合/ })).toHaveAttribute('href', 'https://github.com/ryo0221/open-editor-platform-site/issues');
    await expect(footer.getByRole('link', { name: /製品の不具合（本体）/ })).toHaveAttribute('href', 'https://github.com/ryo0221/open-editor-platform/issues');
    await expect(footer.locator('a[href$="editor-platform-plugins/issues"]')).toHaveCount(0);
  });
});

test.describe('story-10 英語で読む', () => {
  test('test-30 [story-10.criterion-01] the language switch opens the English page with the same sections, states and links', async ({ page }) => {
    pcOnly();
    await open(page);
    const shape = () => page.evaluate(() => ({
      sections: [...document.querySelectorAll('main section[id]')].map(s => s.id),
      statuses: [...document.querySelectorAll('.status')].map(s => s.className),
      links: [...document.querySelectorAll('a[href^="https://"]')].map(a => a.getAttribute('href')),
      cards: document.querySelectorAll('[data-uc]').length,
    }));
    const ja = await shape();
    await page.goto('/#faq');
    await page.locator('[data-lang-switch]').click();
    await expect(page).toHaveURL(/\/en\/#faq$/);
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('[data-cta]')).toHaveText('See examples by goal');
    expect(await shape()).toEqual(ja);
  });

  test('test-31 [story-10.criterion-02] the English page uses the agreed terms and no Japanese outside marked parts', async ({ page }) => {
    pcOnly();
    await open(page, '/en/');
    await expect(page.locator('[data-way="hosts"] .status')).toHaveText('Development frozen');
    await expect(page.locator('[data-community-stage]')).toHaveText('In design');
    await expect(page.locator('[data-editor="graph"] [data-maturity]')).toHaveText('In the public build, Preview');
    await expect(page.locator('[data-purpose="watch"] .purpose-case')).toHaveText('The mechanical watch “SK-01”');
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[lang="ja"], script').forEach(el => el.remove());
      return clone.innerText;
    });
    expect(text).not.toMatch(/[぀-ヿ一-鿿]/);
  });

  test('test-32 [story-10.criterion-03] the English address opens the English page directly', async ({ page }) => {
    pcOnly();
    await open(page, '/en/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText('Build with AI. Finish in a real editor.');
  });
});

test.describe('story-11 スマートフォンで読む', () => {
  test('test-33 [story-11.criterion-01] at phone width nothing overflows and controls are large enough to press', async ({ page }) => {
    phoneOnly();
    for (const path of ['/', '/en/']) {
      await open(page, path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      const small = await page.locator('main button:visible, main a.btn:visible, summary:visible').evaluateAll(els => els.filter(e => e.getBoundingClientRect().height < 36).length);
      expect(small).toBe(0);
      expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThanOrEqual(16);
    }
  });

  test('test-34 [story-11.criterion-02] the three cards stack vertically and each states its status in text', async ({ page }) => {
    phoneOnly();
    await open(page);
    const boxes = await page.locator('[data-way]').evaluateAll(els => els.map(e => e.getBoundingClientRect()));
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThan(boxes[i - 1].bottom - 1);
    await expect(page.locator('[data-way] .status')).toHaveText(['公開済み', '公開済みの範囲を案内', '開発凍結']);
  });

  test('test-35 [story-11.criterion-01] picking a section in the phone menu closes the menu', async ({ page }) => {
    phoneOnly();
    await open(page);
    const menu = page.locator('details.menu');
    await menu.locator('summary').click();
    await menu.getByRole('link', { name: 'コミュニティ' }).click();
    await expect(menu).not.toHaveAttribute('open', '');
    await expect(page.locator('#community-h')).toBeInViewport();
  });

  test('test-36 [story-11.criterion-03] nothing claims the editor itself is mobile-ready', async ({ page }) => {
    phoneOnly();
    for (const path of ['/', '/en/']) {
      await open(page, path);
      expect(await page.locator('body').innerText()).not.toMatch(/モバイル対応|スマートフォン対応|mobile[- ]?(ready|friendly|support)/i);
    }
  });
});

test.describe('story-12 目的から事例を探す', () => {
  test('test-44 [story-12.criterion-01] the purpose cut comes first and shows the eight agreed examples with their focus', async ({ page }) => {
    pcOnly();
    await open(page);
    const order = await page.evaluate(() => [...document.querySelectorAll('main section[id]')].map(s => s.id));
    expect(order.indexOf('purposes')).toBeLessThan(order.indexOf('editors'));
    expect(order.indexOf('editors')).toBeLessThan(order.indexOf('features'));
    const cards = page.locator('[data-purpose]');
    await expect(cards.locator('h3')).toHaveText(['建築をつくる', '工事を計画する', 'クルマをデザインする', '時計をつくる', '回路基板を設計する', '漫画をつくる', '小説を書く', '物語の世界を再現する']);
    await expect(cards.locator('.purpose-case')).toHaveText(['スカイツリーを題材にした BIM モデル', 'オフィスビルの工事現場のデジタルツイン', 'オープンカー「凪」', '機械式時計「SK-01」', 'センサー拡張基板と回路図', '漫画制作プロジェクト', '『関ケ原 — 静かな決断』', '『ガリヴァー旅行記』のデジタルツイン']);
    await expect(page.locator('[data-purpose="watch"]')).toContainText('部品、組立・分解、歯車と機構の動き');
  });

  test('test-45 [story-12.criterion-02] an example whose material is not checked shows that, with no image and no café-video note', async ({ page }) => {
    pcOnly();
    // The variant build leaves every example unchecked.
    await open(page, VARIANT + '/');
    await expect(page.locator('[data-purpose][data-state="checking"]')).toHaveCount(8);
    // and an unchecked example's image is not shipped at all.
    expect((await page.request.get(`${VARIANT}/purposes/novel.jpg`)).status()).toBe(404);
    for (const card of await page.locator('[data-purpose][data-state="checking"]').all()) {
      await expect(card.locator('img')).toHaveCount(0);
      await expect(card.locator('[data-purpose-source]')).toHaveText('この事例の画像と、どこまで公開版で確かめられるかを確認してから載せます。');
      // The café recording note belongs to the café clips only.
      await expect(card).not.toContainText('421ec42');
      await expect(card).not.toContainText('Playground 上の操作を自動実行');
    }
  });
});

test.describe('story-12b 確認済みの事例', () => {
  test('test-48 [story-12.criterion-02] a checked example shows its image and says where it comes from and that the public build does not include it', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('[data-purpose][data-state="ready"]')).toHaveCount(8);
    for (const id of ['building', 'construction', 'car', 'watch', 'pcb', 'comic', 'novel', 'gulliver']) {
      const card = page.locator(`[data-purpose="${id}"]`);
      const img = card.locator('img');
      await expect(img).toHaveAttribute('src', new RegExp(`purposes/${id}\\.jpg$`));
      expect(await img.evaluate(el => el.complete && el.naturalWidth > 0)).toBe(true);
      await expect(img).toHaveAttribute('alt', /.+：.+/);
      const note = card.locator('[data-purpose-source]');
      await expect(note).toContainText('開発版');
      await expect(note).toContainText('この見本は公開版には含まれていません。');
      await expect(note).not.toContainText('確認');
      await expect(card).not.toContainText('421ec42');
    }
    for (const id of ['comic', 'novel']) await expect(page.locator(`[data-purpose="${id}"] [data-purpose-source]`)).toContainText('画像生成');
    await expect(page.locator('[data-purpose="gulliver"] [data-purpose-source]')).toContainText('パブリックドメイン');
  });
});

test.describe('story-13 事例から Editor を知る', () => {
  test('test-46 [story-13.criterion-01] each example links to the editors it uses, and the link lands on that editor', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('[data-purpose="building"] .purpose-editors a')).toHaveText(['BIM', 'CAD']);
    await expect(page.locator('[data-purpose="novel"] .purpose-editors a')).toHaveText(['小説', 'Document']);
    await page.locator('[data-purpose="watch"] .purpose-editors a', { hasText: 'CAD' }).click();
    await expect(page).toHaveURL(/#editor-cad$/);
    await expect(page.locator('#editor-cad')).toBeInViewport();
  });

  test('test-47 [story-13.criterion-02] editors are split into basic and specialized, each with its own maturity', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('[data-editor-group] h3')).toHaveText(['基本 Editor', '専用 Editor']);
    await expect(page.locator('[data-editor-group="basic"] [data-editor] strong')).toHaveText(['Document', 'Slide', 'Whiteboard', 'Design', 'Structured Data', 'Structured Graph', 'Geo', 'React UI', 'Animation', 'Review / File Viewer']);
    await expect(page.locator('[data-editor-group="specialized"] [data-editor] strong')).toHaveText(['BIM', 'CAD', 'Character', '漫画', '小説', '空想地図']);
    // Basic is not the same as stable: Structured Graph is a basic editor and still a Preview.
    await expect(page.locator('[data-editor="graph"] [data-maturity]')).toHaveText('公開版に収録・Preview');
    // Specialized is not the same as experimental: Ryo accepted every specialized editor on 2026-11-14.
    for (const id of ['bim', 'cad', 'character', 'comic', 'novel', 'fictionMap']) await expect(page.locator(`[data-editor="${id}"] [data-maturity]`)).toHaveText('公開版に収録');
    await expect(page.locator('#editors')).not.toContainText('試験的');
    // The editor cut is laid out as cards, two columns on a PC (guards against a stray rule swallowing the styles).
    await expect(page.locator('[data-editor-group="basic"] .editor-list')).toHaveCSS('display', 'grid');
    await expect(page.locator('[data-editor-group="basic"] .editor-list')).toHaveCSS('list-style-type', 'none');
    await expect(page.locator('#community .steps')).toHaveCSS('list-style-type', 'none');
  });
});
