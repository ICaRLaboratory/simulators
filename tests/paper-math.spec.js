import { test, expect } from '@playwright/test';
import { catalog } from '../assets/catalog.js';

const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const local = catalog.filter(item => !item.href.startsWith('https:'));
const regions = '.loop-equation, .pid-model .eq';

for (const item of local) {
  test(`${item.id}: typeset equations survive locale changes and narrow screens`, async ({ page }) => {
    await page.goto(base + item.href + '?lang=ko', {waitUntil: 'domcontentloaded'});
    // Only the equation content is under test, not WebGL playback.
    const first = page.locator(regions).first();
    await first.locator('xpath=ancestor::details[1]/summary').click();
    for (const [width, lang] of [[1280, 'ko'], [320, 'en'], [390, 'ko']]) {
      await page.setViewportSize({width, height: 900});
      await page.locator(`[data-lang=${lang}]`).click();
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await expect(first.locator('math').first()).toBeVisible();
      const problems = await page.locator(regions).evaluateAll(async rows => {
        await document.fonts.ready;
        const failures = [];
        for (const row of rows.filter(el => el.getClientRects().length)) {
          const maths = [...row.querySelectorAll('math')], rect = row.getBoundingClientRect();
          if (!maths.length || rect.left < -1 || rect.right > innerWidth + 1) failures.push('missing or offscreen row');
          if (row.scrollWidth > row.clientWidth + 1 && !['auto','scroll'].includes(getComputedStyle(row).overflowX)) failures.push('content clipped');
          for (const m of maths) {
            if (m.namespaceURI !== 'http://www.w3.org/1998/Math/MathML' || m.querySelector('merror') || !getComputedStyle(m).fontFamily.includes('STIX2')) failures.push('wrong layout/font');
            const box = m.getBoundingClientRect();
            if (box.height < 10 || box.width < 2) failures.push('empty math');
          }
        }
        if (![...document.fonts].some(f => f.family === 'STIX2' && f.status === 'loaded')) failures.push('math font not loaded');
        return failures;
      });
      expect(problems).toEqual([]);
    }
  });
}

test('without JavaScript the DDC certificate is a two-by-two matrix and transfer function a stacked fraction', async ({ browser }) => {
  const ctx = await browser.newContext({javaScriptEnabled: false, viewport: {width: 390, height: 844}});
  try {
    const page = await ctx.newPage();
    await page.goto(base + 'ddc-lti/');
    await page.locator('details.pid-model summary').click();
    const matrix = page.locator('.pid-model mtable').filter({has: page.locator('mtr:nth-child(2) > mtd:nth-child(2)')}).first();
    await expect(matrix.locator('mtr')).toHaveCount(2);
    const frac = page.locator('#plant-equation mfrac').first();
    const [top, bottom] = await Promise.all([frac.locator(':scope > :first-child').boundingBox(), frac.locator(':scope > :last-child').boundingBox()]);
    expect(top.y + top.height / 2).toBeLessThan(bottom.y);
  } finally { await ctx.close(); }
});
