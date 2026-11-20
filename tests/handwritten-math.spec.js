import { test, expect } from '@playwright/test';

const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
for (const id of ['inverted-pendulum', 'ball-and-beam', 'dc-motor', 'cruise-control']) {
  test(`${id}: math fits its diagram and is readable without JavaScript`, async ({ page }) => {
    await page.goto(`${base}${id}/`);
    await page.locator('summary').click();
    await expect(page.locator('.loop-equation math').first()).toBeVisible();
    expect(await page.evaluate(async () => {
      await document.fonts.ready;
      const clipped = [];
      for (const el of document.querySelectorAll('foreignObject math, .loop-equation math')) {
        const parent = el.closest('foreignObject, .loop-equation');
        if (parent.matches('.loop-equation')) parent.scrollLeft = 0;
        const box = el.getBoundingClientRect(), container = parent.getBoundingClientRect();
        // A long fraction is intentionally scrollable within its row; verify
        // the rightmost symbols can actually be brought into view.
        if (parent.matches('.loop-equation') && box.right > container.right + 1) parent.scrollLeft = parent.scrollWidth;
        const right = el.getBoundingClientRect().right;
        if (el.namespaceURI !== 'http://www.w3.org/1998/Math/MathML' || !box.height ||
            box.left < container.left - 1 || right > container.right + 1 ||
            box.top < container.top - 1 || box.bottom > container.bottom + 1) clipped.push(el.textContent);
      }
      if (document.documentElement.scrollWidth > innerWidth) clipped.push('page overflow');
      return clipped;
    })).toEqual([]);
    if (id !== 'inverted-pendulum') await expect(page.locator('#model-description math').first()).toBeVisible();
  });
}
