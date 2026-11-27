import { test, expect } from '@playwright/test';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const ids = ['cruise-control', 'dc-motor', 'ball-and-beam', 'ball-and-plate', 'robot-arm', 'heat-exchanger', 'drone', 'cstr', 'rocket-landing', 'aircraft-pitch', 'pid-lti'];

for (const id of ids) {
  test(`${id}: read both controller figures without opening the model notes`, async ({ page }) => {
    await page.goto(`${root}${id}/?lang=ko`);
    const first = page.locator('[data-pid-view="standard"]'), second = page.locator('[data-pid-view="experiment"]');
    for (const [lang, width] of [['ko', 1280], ['en', 320], ['ko', 320]]) {
      await page.setViewportSize({width, height: 900});
      await page.locator(`[data-lang="${lang}"]`).click();
      await expect(page.locator('html')).toHaveAttribute('lang', lang);
      await page.evaluate(() => document.fonts.ready);
      await expect(first).toBeVisible();
      await expect(second).toBeVisible();
      const [a,b] = await Promise.all([first.boundingBox(), second.boundingBox()]);
      expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
      for (const diagram of [first, second]) {
        const rendered = await diagram.evaluate(el => {
          const visible = node => [...node.getClientRects()].some(r => r.width && r.height);
          const walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
          const words = [];
          for (let n; (n = walker.nextNode());) {
            if (n.parentElement.closest('math, title, desc, template, style, script')) continue;
            const range = document.createRange(); range.selectNodeContents(n);
            if (visible(range)) words.push(n.textContent);
          }
          return { prose: words.join(' '), math: [...el.querySelectorAll('math')].filter(visible).length };
        });
        expect(rendered.math).toBeGreaterThan(0);
        expect(rendered.prose).toMatch(lang === 'ko' ? /[가-힣]/ : /[A-Za-z]{3,}/);
        if (lang === 'en') expect(rendered.prose).not.toMatch(/[가-힣]/);
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    }
  });
}
