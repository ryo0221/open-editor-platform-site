// 07 統制と品質条件: accessibility, external loading, privacy and link safety, checked in the browser.
import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

const pages = ['/', '/en/'];

test('test-37 [control-09] no WCAG 2.2 AA violations on either page, with and without a panel open', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const axe = () => new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']).analyze();
    expect((await axe()).violations.map(v => `${v.id}: ${v.nodes.map(n => n.target).join(' ')}`)).toEqual([]);
    if (test.info().project.name === 'pc') {
      await page.locator('[data-way="embedding"] button').click();
      expect((await axe()).violations.map(v => v.id)).toEqual([]);
      await page.keyboard.press('Escape');
      await page.locator('[data-play-uc="goal"]').click();
      expect((await axe()).violations.map(v => v.id)).toEqual([]);
    }
  }
});

test('test-38 [control-09] one h1 and headings that never skip a level', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const levels = await page.locator('h1, h2, h3, h4').evaluateAll(hs => hs.map(h => Number(h.tagName[1])));
    expect(levels.filter(l => l === 1)).toHaveLength(1);
    levels.forEach((l, i) => { if (i) expect(l - levels[i - 1]).toBeLessThanOrEqual(1); });
  }
});

test('test-39 [control-07] [control-08] the page loads nothing from other origins and sets no cookies', async ({ page, context }) => {
  const outside: string[] = [];
  page.on('request', r => { if (!r.url().startsWith('http://localhost:4321/') && !r.url().startsWith('data:')) outside.push(r.url()); });
  for (const path of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1500);
    if (test.info().project.name === 'pc') {
      await page.locator('[data-play-uc="goal"]').click();
      await page.waitForTimeout(500);
      await page.keyboard.press('Escape');
    }
  }
  expect(outside).toEqual([]);
  expect(await context.cookies()).toEqual([]);
  // Fonts come from the site itself.
  const fonts = await page.evaluate(() => performance.getEntriesByType('resource').map(r => r.name).filter(n => /\.woff2?$/.test(n)));
  expect(fonts.length).toBeGreaterThan(0);
  for (const f of fonts) expect(f).toMatch(/^http:\/\/localhost:4321\//);
});

test('test-40 [control-09] every image has alternative text and every status has a text label', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    for (const alt of await page.locator('img').evaluateAll(imgs => imgs.map(i => i.getAttribute('alt')))) expect(alt?.trim()).toBeTruthy();
    for (const label of await page.locator('.status').allInnerTexts()) expect(label.trim()).not.toBe('');
  }
});

test('test-41 [control-06] external links are https, open in a new tab with noopener, and name the new tab', async ({ page }) => {
  for (const path of pages) {
    await page.goto(path, { waitUntil: 'domcontentloaded' });
    const links = await page.locator('a[href^="http"]').evaluateAll(as => as.map(a => ({ href: a.getAttribute('href')!, target: a.getAttribute('target'), rel: a.getAttribute('rel'), text: a.textContent ?? '' })));
    expect(links.length).toBeGreaterThan(5);
    for (const l of links) {
      expect(l.href).toMatch(/^https:\/\//);
      expect(l.target).toBe('_blank');
      expect(l.rel).toBe('noopener noreferrer');
      expect(l.text).toMatch(/新しいタブ|new tab/);
    }
  }
});

test('test-42 [control-09] keyboard alone reaches the main button, opens the panel and returns focus on Esc', async ({ page }) => {
  test.skip(test.info().project.name !== 'pc', 'checked at PC width');
  await page.goto('/', { waitUntil: 'domcontentloaded' });
  let found = false;
  for (let i = 0; i < 15 && !found; i++) {
    await page.keyboard.press('Tab');
    found = await page.locator('[data-cta]').evaluate(el => el === document.activeElement);
  }
  expect(found).toBe(true);
  await page.keyboard.press('Enter');
  await expect(page.locator('#panel-claude-code')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('[data-cta]')).toBeFocused();
});
