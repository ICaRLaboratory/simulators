import { test, expect } from '@playwright/test';

const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';

async function minimumType(page, selector, size) {
  const elements = page.locator(selector);
  expect(await elements.count(), selector).toBeGreaterThan(0);
  for (const element of await elements.all()) {
    const actual = await element.evaluate(el => parseFloat(getComputedStyle(el).fontSize));
    expect.soft(actual, selector).toBeGreaterThanOrEqual(size);
  }
}

test('catalog supporting text is readable', async ({ page }) => {
  await page.goto(root);
  await minimumType(page, '.card-description', 15);
  await minimumType(page, '.source-link', 13);
  await minimumType(page, '.english-name, .section-index, .card-number, .category-filters button span', 11);
  await minimumType(page, '.features span, .card-status', 12);
});

test('experiment labels and control instructions are readable', async ({ page }) => {
  await page.goto(root + 'cruise-control/');
  await minimumType(page, '.mono, .range-limits', 11);
  await minimumType(page, '.canvas-caption, .metrics span, .metrics small, .legend, .parameter p, .control-help', 12);
  await minimumType(page, '.parameter label', 13);
});

test('language switch has compact inverted states and keyboard focus', async ({ page }) => {
  await page.goto(root);
  // Exercise the CSS contract independently of localization initialization.
  await page.locator('.site-header').evaluate(header => {
    header.innerHTML = '<a class="brand"><span class="brand-label">Control Simulators</span></a><div class="language-switch"><button data-lang="ko" aria-pressed="true">한국어</button><button data-lang="en" aria-pressed="false">EN</button></div>';
  });
  for (const width of [1280, 390, 320]) {
    await page.setViewportSize({ width, height: 900 });
    for (const button of await page.locator('.language-switch button').all()) {
      const box = await button.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(28);
      expect(box.height).toBeLessThanOrEqual(34);
      expect(box.x + box.width).toBeLessThanOrEqual(width);
    }
  }
  await expect(page.locator('[data-lang="ko"]')).toHaveCSS('background-color', 'rgb(250, 250, 250)');
  await expect(page.locator('[data-lang="en"]')).toHaveCSS('color', 'rgb(167, 167, 174)');
  await page.locator('[data-lang="ko"]').focus();
  await page.keyboard.press('Tab');
  await expect(page.locator('[data-lang="en"]')).toBeFocused();
  await expect(page.locator('[data-lang="en"]')).toHaveCSS('outline-color', 'rgb(250, 250, 250)');
});

for (const width of [390, 320]) {
  test(`readable workspace remains contained at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const route of ['', 'cruise-control/', 'dc-motor/', 'ball-and-beam/', 'inverted-pendulum/']) {
      await page.goto(root + route);
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      if (route) {
        await minimumType(page, '.parameter label', 13);
        // Longer English labels must reflow rather than crowd numeric outputs.
        await page.locator('.parameter label').first().evaluate(label => {
          const text = [...label.childNodes].find(node => node.nodeType === Node.TEXT_NODE);
          if (text) text.textContent = 'Reference target position ';
        });
        for (const label of await page.locator('.parameter label').all()) {
          expect(await label.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
        }
        const loop = page.locator('.loop-viewport');
        expect(await loop.evaluate(el => el.scrollWidth > el.clientWidth)).toBe(true);
        await minimumType(page, '.loop-diagram text', 14);
      }
    }
  });
}

for (const width of [1280, 390, 320]) {
  test(`category chips fit their labels at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto(root);
    const chips = page.locator('.category-filters button');
    await expect(chips.first()).toBeVisible();
    for (const chip of await chips.all()) {
      const box = await chip.boundingBox();
      expect(box.height).toBeGreaterThanOrEqual(30);
      expect(box.height).toBeLessThanOrEqual(34);
      expect(await chip.evaluate(el => el.scrollWidth <= el.clientWidth)).toBe(true);
    }
  });
}
