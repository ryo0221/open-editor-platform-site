// One test per acceptance criterion in 03 訪問者のストーリー, plus the 07 controls that a browser can check.
// Each title starts with its test ID and the criteria it covers; scripts/test-trace.mjs builds the trace table from them.
import { test, expect, type Page } from '@playwright/test';

const VARIANT = 'http://localhost:4322'; // built from tests/fixtures/after-release.json
const pcOnly = () => test.skip(test.info().project.name !== 'pc', 'checked at PC width');
const phoneOnly = () => test.skip(test.info().project.name !== 'phone', 'checked at phone width');

async function open(page: Page, path = '/') {
  await page.goto(path, { waitUntil: 'domcontentloaded' });
}

test.describe('story-01 初めて来て、何ができるかをつかむ', () => {
  test('test-01 [story-01.criterion-01] the first screen shows the value, both buttons and the Coming soon line', async ({ page }) => {
    pcOnly();
    await open(page);
    for (const text of ['AI と人のためのオープンソース編集基盤', 'AIと作り、Editorで仕上げる。', 'スライド、文書、図表を、編集できる成果物に。', 'Claude Code 版：配布準備中', '実際の操作を見る', 'ChatGPT・Codex・独自プロダクト向けも準備中（Coming soon）']) {
      await expect(page.getByText(text, { exact: true }).first()).toBeInViewport();
    }
  });

  test('test-02 [story-01.criterion-02] the three values each have a heading and a short explanation', async ({ page }) => {
    pcOnly();
    await open(page);
    const cards = page.locator('#values .card');
    await expect(cards).toHaveCount(3);
    await expect(cards.locator('h3')).toHaveText(['人が直接触れる編集面', 'ネイティブ形式で保存', 'オープンソース']);
    for (const card of await cards.all()) await expect(card.locator('p')).not.toBeEmpty();
  });

  test('test-03 [story-01.criterion-03] only editors checked on the released plugin are listed', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('[data-editors]')).toHaveCount(0);
    await open(page, VARIANT + '/');
    await expect(page.locator('[data-editors]')).toHaveText('Claude Code 版で使える Editor：Document、Slide、Whiteboard');
    await expect(page.locator('body')).not.toContainText('Office');
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
    await expect.poll(() => short.evaluate((v: HTMLVideoElement) => !v.paused && v.currentTime > 0)).toBe(true);
    await expect(page.getByText('AI ホスト（Claude Code）との実演・ブラウザ操作は自動実行・架空データ').first()).toBeVisible();
    await expect(page.getByText('撮影：公開版 421ec42')).toBeVisible();
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

  test('test-06 [story-02.criterion-03] "See it in action" moves to the features with the Short and eight cards', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.getByRole('link', { name: '実際の操作を見る' }).click();
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
    // The Short and the summary contain every step, so both give way to a still image.
    await expect(page.locator('[data-short]')).toHaveCount(0);
    await expect(page.locator('[data-short-frame] img')).toBeVisible();
    await expect(page.locator('[data-play-summary]')).toHaveCount(0);
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
    await page.getByText('費用はかかりますか？').click();
    await expect(page.getByText('拡張そのもののログインや API キーは不要です。', { exact: false })).toBeVisible();
  });
});

test.describe('story-03 Claude Code 版の今の状態を知り、配布を待つ', () => {
  test('test-11 [story-03.criterion-01] the main button says Preparing release and is not a download', async ({ page }) => {
    pcOnly();
    await open(page);
    const cta = page.locator('[data-cta]');
    await expect(cta).toHaveText('Claude Code 版：配布準備中');
    await expect(cta).toHaveJSProperty('tagName', 'BUTTON');
    await expect(page.locator('a[download], a[href$=".zip"], a[href*="/releases/"]')).toHaveCount(0);
  });

  test('test-12 [story-03.criterion-02] the main button and the Claude Code card open the status panel', async ({ page }) => {
    pcOnly();
    await open(page);
    const panel = page.locator('#panel-claude-code');
    for (const opener of [page.locator('[data-cta]'), page.locator('[data-way="claudeCode"] button')]) {
      await opener.click();
      await expect(panel).toBeVisible();
      await expect(panel).toContainText('配布物と動作確認を準備しています。提供時期は未定です。配布が始まったら、GitHub の Releases でお知らせします。');
      await page.keyboard.press('Escape');
      await expect(panel).toBeHidden();
      await expect(opener).toBeFocused();
    }
  });

  test('test-13 [story-03.criterion-03] the GitHub link opens the plugins repository in a new tab', async ({ page, context }) => {
    pcOnly();
    await open(page);
    await page.locator('[data-cta]').click();
    const link = page.locator('[data-watch]');
    await expect(link).toHaveAttribute('href', 'https://github.com/ryo0221/editor-platform-plugins');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    await context.route('https://github.com/**', route => route.fulfill({ body: 'stub' }));
    const [popup] = await Promise.all([context.waitForEvent('page'), link.click()]);
    expect(popup.url()).toBe('https://github.com/ryo0221/editor-platform-plugins');
  });
});

test.describe('story-04 Claude Code 版を入れて最初の成果物を作る（配布開始後）', () => {
  test('test-14 [story-04.criterion-01] after release the main button downloads from the release page', async ({ page }) => {
    pcOnly();
    await open(page, VARIANT + '/');
    const cta = page.locator('[data-cta]');
    await expect(cta).toHaveText(/Claude Code 版をダウンロード/);
    await expect(cta).toHaveAttribute('href', 'https://github.com/ryo0221/editor-platform-plugins/releases');
  });

  test('test-15 [story-04.criterion-02] the steps run in order; before release only the notice and faded names show', async ({ page }) => {
    pcOnly();
    const steps = ['ダウンロード', 'インストールと権限の確認', 'Claude Code に依頼する', 'Editor で編集する', '保存して開き直す'];
    await open(page);
    await expect(page.locator('#start .band-preparing')).toHaveText('Claude Code 版は配布準備中です。配布が始まったら、ここに手順と対象環境を表示します。');
    await expect(page.locator('#start .steps.is-preparing li')).toHaveText(steps);
    await expect(page.locator('[data-copy]')).toHaveCount(0);
    await open(page, VARIANT + '/');
    await expect(page.locator('#start .steps li')).toHaveText(steps);
    await expect(page.locator('#start .steps')).not.toHaveClass(/is-preparing/);
    await expect(page.locator('#start')).toContainText('（検査用の値）対象環境の説明');
  });

  test('test-16 [story-04.criterion-03] the example prompt can be copied and the page says how to tell it worked', async ({ page, context }) => {
    pcOnly();
    await context.grantPermissions(['clipboard-read', 'clipboard-write']);
    await open(page, VARIANT + '/');
    const copy = page.locator('[data-copy]');
    await copy.click();
    await expect(copy).toHaveText('コピーしました');
    expect(await page.evaluate(() => navigator.clipboard.readText())).toBe('新製品の紹介スライドを 5 枚作って、Editor で開いて');
    await expect(page.locator('[data-verify]')).toHaveText('手元のブラウザで Editor が開き、作られたスライドが表示されれば、正しく入っています。');
  });

  test('test-17 [story-04.criterion-04] the Claude Desktop extension has its own box in both states', async ({ page }) => {
    pcOnly();
    for (const base of ['', VARIANT]) {
      await open(page, base + '/');
      await expect(page.locator('[data-desktop]')).toHaveText('Claude Desktop 版（.mcpb）：別の形式の統合プレビュー。設定画面から入れます。');
    }
  });
});

test.describe('story-05 ChatGPT や Codex で使えるかを知る', () => {
  test('test-18 [story-05.criterion-01] ChatGPT and Codex cards say Coming soon in the same card system', async ({ page }) => {
    pcOnly();
    await open(page);
    for (const id of ['chatgpt', 'codex']) {
      const card = page.locator(`[data-way="${id}"]`);
      await expect(card).toHaveClass(/card/);
      await expect(card.locator('.status')).toHaveText('Coming soon／準備中');
    }
  });

  test('test-19 [story-05.criterion-02] the plan panels say timing, method and pricing are not decided, with no URLs or dates', async ({ page }) => {
    pcOnly();
    await open(page);
    for (const [id, name] of [['chatgpt', 'ChatGPT'], ['codex', 'Codex']]) {
      await page.locator(`[data-way="${id}"] button`).click();
      const panel = page.locator(`#panel-${id}`);
      await expect(panel).toContainText(`${name} から Open Editor Platform を使えるようにする予定です。提供時期・接続方式・料金は未定です。`);
      await expect(panel.locator('a')).toHaveCount(0);
      expect(await panel.innerText()).not.toMatch(/\d{4}|\d+月|https?:/);
      await page.keyboard.press('Escape');
    }
  });
});

test.describe('story-06 自分のプロダクトへの組み込みを検討する', () => {
  test('test-20 [story-06.criterion-01] the embedding panel separates what is coming from what is available now', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('[data-way="embedding"] button').click();
    const panel = page.locator('#panel-embedding');
    await expect(panel.locator('.band-soon')).toHaveText('準備中：案内付きの組み込み導線（手順・サンプル・相談の窓口）');
    await expect(panel.locator('.band-now')).toHaveText('今できること：公開済みのソースと開発者資料を読む');
  });

  test('test-21 [story-06.criterion-02] developer guide and license links go to the core repository documents', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('[data-way="embedding"] button').click();
    const panel = page.locator('#panel-embedding');
    await expect(panel.getByRole('link', { name: /開発者ガイド/ })).toHaveAttribute('href', 'https://github.com/ryo0221/open-editor-platform/blob/main/docs/developer-guide.md');
    await expect(panel.getByRole('link', { name: /^ライセンス/ })).toHaveAttribute('href', 'https://github.com/ryo0221/open-editor-platform/blob/main/LICENSE');
    await expect(panel.getByRole('link', { name: /商用ライセンス/ })).toHaveAttribute('href', 'https://github.com/ryo0221/open-editor-platform/blob/main/COMMERCIAL-LICENSING.md');
  });

  test('test-22 [story-06.criterion-03] the PaoBub example link moves to the PaoBub section', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('[data-way="embedding"] button').click();
    await page.getByRole('link', { name: '実例：PaoBub を見る' }).click();
    await expect(page.locator('#panel-embedding')).toBeHidden();
    await expect(page.locator('#paobub-h')).toBeInViewport();
    await expect(page.locator('#paobub')).toBeFocused();
  });
});

test.describe('story-07 PaoBub を知る', () => {
  test('test-23 [story-07.criterion-01] the PaoBub nav link shows what it is, that it embeds the platform, and Coming soon', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.locator('.nav-wide').getByRole('link', { name: 'PaoBub' }).click();
    const section = page.locator('#paobub');
    await expect(page.locator('#paobub-h')).toBeInViewport();
    await expect(section).toContainText('Built with Open Editor Platform');
    await expect(section).toContainText('仕様・画面・ワークフローを、人が確かめながら AI と対話して作る道具。');
    await expect(section.locator('.status')).toHaveText('準備中');
  });

  test('test-24 [story-07.criterion-02] there is no external link for PaoBub and no link to private repositories anywhere', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('#paobub a')).toHaveCount(0);
    for (const href of await page.locator('a[href]').evaluateAll(as => as.map(a => (a as HTMLAnchorElement).href))) {
      expect(href).not.toMatch(/github\.com\/ryo0221\/(paobub-mvp|editor-platform)(\/|$)/);
    }
  });

  test('test-25 [story-07.criterion-03] with a public PaoBub URL in the settings, the section links to it', async ({ page }) => {
    pcOnly();
    await open(page, VARIANT + '/');
    const link = page.locator('[data-paobub-link]');
    await expect(link).toHaveAttribute('href', 'https://example.com/paobub');
    await expect(link).toHaveAttribute('target', '_blank');
    await expect(page.locator('#paobub .status')).toHaveCount(0);
  });
});

test.describe('story-08 不安な点を FAQ で確かめる', () => {
  test('test-26 [story-08.criterion-01] the FAQ covers scope, data, updates, permissions, the AI host and cost', async ({ page }) => {
    pcOnly();
    await open(page);
    await expect(page.locator('#faq summary')).toHaveText(['何ができて、何ができませんか？', 'データはどこに保存されますか？バックアップは？', '更新・削除はどうしますか？', 'どんな権限が必要ですか？', 'AI ホストにはどんな内容が渡りますか？', '費用はかかりますか？']);
  });

  test('test-27 [story-08.criterion-02] the answers separate the plugin sign-in from the Claude Code plan and avoid "never sent to AI"', async ({ page }) => {
    pcOnly();
    await open(page);
    await page.getByText('費用はかかりますか？').click();
    const cost = page.locator('#faq details').nth(5);
    await expect(cost).toContainText('拡張そのもののログインや API キーは不要です。');
    await expect(cost).toContainText('Claude Code 自体の利用には、Claude Code の契約が別に必要です。');
    await page.getByText('AI ホストにはどんな内容が渡りますか？').click();
    await expect(page.locator('#faq details').nth(4)).toContainText('AI に一切送られないわけではありません');
    expect(await page.locator('#faq').innerText()).not.toMatch(/送られません。|never sent/);
  });

  test('test-28 [story-08.criterion-03] questions open and close with Tab and Enter, with a visible focus ring', async ({ page }) => {
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
  test('test-29 [story-09.criterion-01] the footer links the repositories, guide, license and issues, with no email address', async ({ page }) => {
    pcOnly();
    await open(page);
    const footer = page.locator('footer');
    for (const href of ['https://github.com/ryo0221/open-editor-platform', 'https://github.com/ryo0221/editor-platform-plugins', 'https://github.com/ryo0221/open-editor-platform/blob/main/docs/developer-guide.md', 'https://github.com/ryo0221/open-editor-platform/blob/main/LICENSE']) {
      await expect(footer.locator(`a[href="${href}"]`)).toHaveCount(1);
    }
    await expect(page.locator('a[href^="mailto:"]')).toHaveCount(0);
    expect(await page.locator('body').innerText()).not.toMatch(/[\w.+-]+@[\w-]+\.[\w.]+/);
  });

  test('test-30 [story-09.criterion-02] issues go to the site repository for the page and to core or plugins for the product', async ({ page }) => {
    pcOnly();
    await open(page);
    const footer = page.locator('footer');
    await expect(footer).toContainText('LP の不具合は site、製品の不具合は本体・plugins の Issue へ。');
    await expect(footer.getByRole('link', { name: /LP の不具合/ })).toHaveAttribute('href', 'https://github.com/ryo0221/open-editor-platform-site/issues');
    await expect(footer.getByRole('link', { name: /製品の不具合（本体）/ })).toHaveAttribute('href', 'https://github.com/ryo0221/open-editor-platform/issues');
    await expect(footer.getByRole('link', { name: /製品の不具合（plugins）/ })).toHaveAttribute('href', 'https://github.com/ryo0221/editor-platform-plugins/issues');
  });
});

test.describe('story-10 英語で読む', () => {
  test('test-31 [story-10.criterion-01] the language switch opens the English page with the same sections, states and links', async ({ page }) => {
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
    await expect(page.locator('[data-cta]')).toHaveText('Claude Code plugin: Preparing release');
    expect(await shape()).toEqual(ja);
  });

  test('test-32 [story-10.criterion-02] the English page uses the agreed terms and no Japanese outside marked parts', async ({ page }) => {
    pcOnly();
    await open(page, '/en/');
    await expect(page.locator('[data-way="claudeCode"] .status')).toHaveText('Preparing release');
    await expect(page.locator('[data-way="chatgpt"] .status')).toHaveText('Coming soon');
    await expect(page.locator('[data-desktop]')).toContainText('Claude Desktop extension (.mcpb)');
    const text = await page.evaluate(() => {
      const clone = document.body.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('[lang="ja"], script').forEach(el => el.remove());
      return clone.innerText;
    });
    expect(text).not.toMatch(/[぀-ヿ一-鿿]/);
  });

  test('test-33 [story-10.criterion-03] the English address opens the English page directly', async ({ page }) => {
    pcOnly();
    await open(page, '/en/');
    await expect(page.locator('html')).toHaveAttribute('lang', 'en');
    await expect(page.locator('h1')).toHaveText('Build with AI. Finish in a real editor.');
  });
});

test.describe('story-11 スマートフォンで読む', () => {
  test('test-34 [story-11.criterion-01] at phone width nothing overflows and controls are large enough to press', async ({ page }) => {
    phoneOnly();
    for (const path of ['/', '/en/']) {
      await open(page, path);
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(390);
      const small = await page.locator('main button:visible, main a.btn:visible, summary:visible').evaluateAll(els => els.filter(e => e.getBoundingClientRect().height < 36).length);
      expect(small).toBe(0);
      expect(await page.evaluate(() => parseFloat(getComputedStyle(document.body).fontSize))).toBeGreaterThanOrEqual(16);
    }
  });

  test('test-35 [story-11.criterion-02] the four cards stack vertically and each states its status in text', async ({ page }) => {
    phoneOnly();
    await open(page);
    const boxes = await page.locator('[data-way]').evaluateAll(els => els.map(e => e.getBoundingClientRect()));
    for (let i = 1; i < boxes.length; i++) expect(boxes[i].top).toBeGreaterThan(boxes[i - 1].bottom - 1);
    await expect(page.locator('[data-way] .status')).toHaveText(['配布準備中', 'Coming soon／準備中', 'Coming soon／準備中', 'Coming soon／準備中']);
  });

  test('test-36 [story-11.criterion-03] nothing claims the editor itself is mobile-ready', async ({ page }) => {
    phoneOnly();
    for (const path of ['/', '/en/']) {
      await open(page, path);
      expect(await page.locator('body').innerText()).not.toMatch(/モバイル対応|スマートフォン対応|mobile[- ]?(ready|friendly|support)/i);
    }
  });
});
