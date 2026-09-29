import { test, expect } from '@playwright/test';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
for (const kind of ['cruise-control', 'dc-motor', 'ball-and-beam']) {
  test(`${kind}: readable, keyboard-scrollable control diagram`, async ({ page }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    for (const width of [1280, 390, 320]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${root}${kind}/`);
      const panel = page.getByRole('region', { name: '제어 구조', exact: true });
      await expect(panel).toBeVisible();
      const details = panel.locator('details');
      await expect(details).not.toHaveAttribute('open', '');
      await expect(panel.locator('.loop-details')).toBeHidden();
      await panel.getByText('모델·제어식', { exact: true }).click();
      await expect(panel.locator('.loop-details')).toBeVisible();
      await panel.getByText('모델·제어식', { exact: true }).click();
      await expect(panel.getByRole('img')).toHaveAccessibleName(/음의 피드백 제어/);
      await expect(panel).toContainText('Kp e + I − Kd dy/dt');
      await expect(page.locator('#start-pause')).toBeEnabled();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const viewport = panel.locator('.loop-viewport');
      await viewport.focus();
      await expect(viewport).toBeFocused();
      if (width < 720) {
        await page.keyboard.press('ArrowRight');
        await expect.poll(() => viewport.evaluate(el => el.scrollLeft)).toBeGreaterThan(0);
      }
      const readable = await panel.locator('svg text').evaluateAll(labels => labels.every(label => {
        const box = label.getBBox(), svg = label.ownerSVGElement;
        return box.x >= 0 && box.x + box.width <= svg.viewBox.baseVal.width &&
          parseFloat(getComputedStyle(label).fontSize) * svg.getBoundingClientRect().width / svg.viewBox.baseVal.width >= 14;
      }));
      expect(readable).toBe(true);
      await expect(page.getByRole('link', { name: /관련 MATLAB 프로젝트/ })).toHaveAttribute('href', /MathWorks-Teaching-Resources/);
    }
    expect(errors).toEqual([]);
  });
}
test('control structure is available without JavaScript', async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto(`${root}ball-and-beam/`);
  await expect(page.getByRole('region', { name: '제어 구조', exact: true })).toContainText('+0.6 m/s');
  await context.close();
});
