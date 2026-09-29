import { test, expect } from '@playwright/test';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';

test('schematic surfaces use neutral paper while signal colors remain distinct', async ({ page }) => {
  await page.goto(root);
  const body = page.locator('[data-id="cruise-control"] svg path').first();
  await expect(body).toHaveAttribute('fill', '#e8e8e5');
  await expect(page.locator('[data-id="cruise-control"] svg')).toHaveAttribute('stroke', '#0a0a0a');
});

for (const path of ['', 'cruise-control/', 'dc-motor/', 'ball-and-beam/']) {
  test(`${path || 'catalog'} shares the homepage visual language`, async ({ page }) => {
    await page.goto(root + path);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(10, 10, 10)');
    await expect(page.locator('body')).toHaveCSS('font-family', /Pretendard Variable/);
    for (const band of ['.site-header', '.site-footer']) {
      await expect(page.locator(band)).toHaveCSS('background-color', 'rgb(10, 10, 10)');
      await expect(page.locator(band)).toHaveCSS('color', 'rgb(250, 250, 250)');
    }
    await expect(page.locator(path ? '.panel' : '.sim-card').first()).toHaveCSS('border-radius', '16px');
    await expect(page.locator(path ? '#apparatus' : '.card-visual').first()).toHaveCSS('background-color', 'rgb(245, 245, 243)');
    const action = page.locator(path ? '#start-pause' : '.launch').first();
    await expect(action).toHaveCSS('background-color', 'rgb(10, 10, 10)');
    await expect(action).toHaveCSS('border-radius', '999px');
    await expect(page.locator(path ? '.mono' : '.english-name').first()).toHaveCSS('font-family', /JetBrains Mono/);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('Pretendard Variable') && font.status === 'loaded'))).toBe(true);
    expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('JetBrains Mono') && font.status === 'loaded'))).toBe(true);
    if (path) {
      const lines = await page.locator('.legend span').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node, '::before');
        return { color: style.borderTopColor, type: style.borderTopStyle };
      }));
      expect(lines[0].type).toBe('dashed');
      expect(lines[1].type).toBe('solid');
      expect(lines[0].color).not.toBe(lines[1].color);
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const footer = await page.locator('.site-footer').boundingBox();
      expect(footer.x).toBe(0);
      expect(footer.width).toBe(width);
    }
  });
}
