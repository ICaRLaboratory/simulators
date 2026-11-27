import { test, expect } from '@playwright/test';

const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const ids = ['inverted-pendulum', 'ball-and-beam', 'dc-motor', 'cruise-control'];

async function geometry(page) {
  return page.evaluate(async () => {
    await document.fonts.ready;
    const issues = [];

    const bounds = el => el.getBoundingClientRect();
    const fits = (a, b) => a.left >= b.left - 1 && a.right <= b.right + 1 &&
      a.top >= b.top - 1 && a.bottom <= b.bottom + 1;
    for (const svg of document.querySelectorAll('.loop-diagram')) {
      const labels = [];
      for (const el of svg.querySelectorAll('text, foreignObject > div > *')) {
        const box = bounds(el), owner = el.closest('foreignObject');
        if (!box.height) continue; // Inactive locale.
        if (!fits(box, bounds(owner || svg)) || !fits(box, bounds(svg))) issues.push(`label clipped: ${el.textContent}`);
        if (owner && !fits(bounds(owner), bounds(svg))) issues.push(`container outside diagram: ${el.textContent}`);
        for (const [name, rect] of labels) {
          if (Math.min(box.right, rect.right) - Math.max(box.left, rect.left) > 1 &&
              Math.min(box.bottom, rect.bottom) - Math.max(box.top, rect.top) > 1) issues.push(`overlap: ${name} / ${el.textContent}`);
        }
        labels.push([el.textContent, box]);
      }
      // A wrapping term's grid box can fit while its words or math overflow it.
      for (const region of svg.querySelectorAll('foreignObject')) {
        const rects = [...region.querySelectorAll('math, math *')].map(bounds);
        const walker = document.createTreeWalker(region, NodeFilter.SHOW_TEXT);
        for (let node; (node = walker.nextNode());) {
          if (!node.textContent.trim() || node.parentElement.closest('math')) continue;
          const range = document.createRange(); range.selectNodeContents(node);
          rects.push(...range.getClientRects());
        }
        if (rects.some(r => r.width && r.height && !fits(r, bounds(region)))) issues.push(`content clipped: ${region.textContent}`);
      }
    }
    for (const el of document.querySelectorAll('.loop-notes math, .model-notes math')) {
      const parent = el.closest('p');
      parent.scrollLeft = 0;
      const box = bounds(el), container = bounds(parent);
      const copy = el.closest('.hw-copy');
      if (copy && copy.lang !== document.documentElement.lang && !box.height) continue;
      // Scroll only an indivisible equation's row, and check both ends.
      if (box.right > container.right + 1) parent.scrollLeft = parent.scrollWidth;
      if (!box.height || el.namespaceURI !== 'http://www.w3.org/1998/Math/MathML' ||
          box.left < container.left - 1 || bounds(el).right > container.right + 1 ||
          box.top < container.top - 1 || box.bottom > container.bottom + 1) issues.push(`equation clipped: ${el.textContent}`);
      parent.scrollLeft = 0;
    }
    if (!document.fonts.check('16px STIX2') || document.documentElement.scrollWidth > innerWidth) issues.push('font or page overflow');
    return issues;
  });
}

for (const id of ids) {
  test.describe(`${id} without JavaScript`, () => {
    test.use({ javaScriptEnabled: false, viewport: { width: 320, height: 800 } });
    test('Korean diagram, disclosure and inline math are readable', async ({ page }) => {
      await page.goto(`${base}${id}/`);
      await expect(page.locator('.control-loop .loop-diagram')).toHaveCount(id === 'inverted-pendulum' ? 1 : 2);
      await page.locator('summary').click();
      await expect(page.locator('html')).toHaveAttribute('lang', 'ko');
      await expect(page.locator('.loop-notes p:not(.loop-equation) math:visible').first()).toBeVisible();
      await expect(page.locator('.hw-copy[lang="en"]:visible')).toHaveCount(0);
      expect(await geometry(page)).toEqual([]);
    });
  });

  test(`${id}: switch languages with the notes open at desktop and phone widths`, async ({ page }) => {
    await page.goto(`${base}${id}/?lang=ko`);
    await expect(page.locator('#start-pause')).toBeEnabled();
    await page.locator('summary').click();
    for (const width of [1280, 320]) {
      await page.setViewportSize({ width, height: 900 });
      for (const lang of ['ko', 'en', 'ko']) {
        await page.locator(`[data-lang=${lang}]`).click();
        await expect(page.locator('html')).toHaveAttribute('lang', lang);
        await expect(page.locator('details')).toHaveAttribute('open', '');
        await expect(page.locator(`.hw-copy:not([lang=${lang}]):visible`)).toHaveCount(0);
        const english = lang === 'en';
        const copy = await page.locator('.loop-details').innerText();
        expect(copy).toMatch(english ? /[A-Za-z]{3}/ : /[가-힣]/);
        if (english) expect(copy).not.toMatch(/[가-힣]/);
        if (id === 'inverted-pendulum') {
          await expect(page.locator('.loop-labels foreignObject').filter({hasText: english ? 'Signed gains' : '부호 포함 이득'}).locator('math')).toHaveText(['x−r', 'r−x']);
          await expect(page.locator('.loop-notes p:not(.loop-equation) math').first()).toHaveText('θ');
        } else {
          await expect(page.locator(`.loop-controller .hw-copy[lang=${lang}]`).filter({hasText: 'anti-windup'}).locator('math')).toHaveText('I←I+ΔI');
          await expect(page.locator('#model-description math').first()).toBeVisible();
        }
        expect(await geometry(page), `${id}, ${width}px ${lang}`).toEqual([]);
      }
    }
  });
}
