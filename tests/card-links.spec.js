import {test, expect} from '@playwright/test';
import {catalog} from '../assets/catalog.js';
import {translate} from '../assets/i18n.js';

const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';

test('sources identify the destination and its purpose on screen and by accessible name', async ({page}) => {
  await page.goto(`${base}?lang=ko`);
  for (const lang of ['ko', 'en', 'ko']) {
    await page.locator(`[data-lang=${lang}]`).click();
    for (const item of catalog.filter(item => !item.external)) {
      const card = page.locator(`[data-id="${item.id}"]`);
      const link = card.locator('.source-link');
      const purpose = [
        [/^https:\/\/www\.mathworks\.com\/help\//, '공식 문서', 'Official documentation'],
        [/^https:\/\/doi\.org\//, '참고 문헌', 'Reference'],
        [/^https:\/\/(github\.com\/|www\.mathworks\.com\/matlabcentral\/fileexchange\/)/, '관련 프로젝트', 'Related project'],
      ].find(([url]) => url.test(item.source));
      expect(purpose, `Unclassified source: ${item.source}`).toBeDefined();
      const label = `${purpose[lang === 'ko' ? 1 : 2]}: ${translate(item.sourceName, lang)}`;
      const name = `${label} · ${await card.getByRole('heading').innerText()} · ${lang === 'ko' ? '새 탭' : 'new tab'}`;
      await expect(link).toHaveText(`${label} ↗`);
      await expect(link).toHaveAccessibleName(name);
      await expect(link).toHaveAttribute('title', name);
      await expect(link).toHaveAttribute('href', item.source);
      await expect(link).toHaveAttribute('target', '_blank');
      await expect(link).toHaveAttribute('rel', /\bnoopener\b/);
    }
  }
});

test('each research card has one localized launch, not a second link to the same experiment', async ({page}) => {
  await page.goto(`${base}?lang=en`);
  for (const lang of ['en', 'ko', 'en']) {
    await page.locator(`[data-lang=${lang}]`).click();
    for (const [id, sim] of [['research-tracking', 'track'], ['research-contact', 'contact']]) {
      const card = page.locator(`[data-id="${id}"]`);
      await expect(card.getByRole('link')).toHaveCount(1);
      const launch = card.locator('[data-launch]');
      const label = lang === 'ko' ? '연구 실험 열기' : 'Open research experiment';
      await expect(launch).toHaveText(`${label} ↗`);
      await expect(launch).toHaveAccessibleName(`${await card.getByRole('heading').innerText()} · ${label} · ${lang === 'ko' ? '외부 사이트' : 'external site'}`);
      await expect(launch).toHaveAttribute('href', `https://icarlaboratory.github.io/research.html?sim=${sim}&lang=${lang}#interactive`);
    }
  }
});

for (const lang of ['ko', 'en']) {
  test(`${lang}: card actions stay at the bottom right as sources wrap`, async ({page}) => {
    await page.goto(`${base}?lang=${lang}`);
    const cards = page.locator('#catalog-grid .sim-card');
    await expect(cards).toHaveCount(catalog.length);
    await page.evaluate(() => document.fonts.ready);
    for (const width of [360, 390, 600, 780, 1024, 1280, 1440]) {
      await page.setViewportSize({width, height: 900});
      const positions = await cards.evaluateAll(nodes => nodes.map(card => {
        const box = el => el.getBoundingClientRect().toJSON();
        const body = card.querySelector('.card-body');
        const style = getComputedStyle(body);
        const source = card.querySelector('.source-link');
        return {
          id: card.dataset.id, body: box(body), action: box(card.querySelector('[data-launch]')),
          rightInset: parseFloat(style.paddingRight), bottomInset: parseFloat(style.paddingBottom),
          source: source && box(source), leftInset: parseFloat(style.paddingLeft)
        };
      }));
      for (const {id, body, action, source, leftInset, rightInset, bottomInset} of positions) {
        const context = `${id} at ${width}px`;
        expect(Math.abs(body.right - rightInset - action.right), context).toBeLessThan(1);
        expect(Math.abs(body.bottom - bottomInset - action.bottom), context).toBeLessThan(1);
        expect(action.left, context).toBeGreaterThanOrEqual(body.left + leftInset - 1);
        if (!source) continue;
        expect(Math.abs(source.left - body.left - leftInset), context).toBeLessThan(1);
        if (width <= 600) expect(source.bottom, context).toBeLessThan(action.top);
        else {
          expect(source.right, context).toBeLessThan(action.left);
          expect(source.bottom, context).toBeGreaterThan(action.top);
        }
      }
    }
  });
}
