import {test, expect} from '@playwright/test';

const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const cases = [
  ['cruise-control', [-10, 0, 10, 20, 30, 40, 50], '차량 속도 v (−10~50 m/s)', 'Vehicle speed v (−10 to 50 m/s)'],
  ['dc-motor', [-8, -4, 0, 4, 8], '모터 축 각도 θ (−8~8 rad)', 'Motor shaft angle θ (−8 to 8 rad)'],
  ['ball-and-beam', [-1, -.5, 0, .5, 1], '공의 위치 x (−1~1 m)', 'Ball position x (−1 to 1 m)'],
];

for (const [lab, expected, ko, en] of cases) {
  test(`${lab}: rendered Y ticks survive target, gain, run and reset`, async ({page}) => {
    await page.addInitScript(() => {
      const ctx = CanvasRenderingContext2D.prototype;
      const {clearRect, fillText} = ctx;
      ctx.clearRect = function (...args) {
        if (this.canvas.id === 'response') window.yTicks = [];
        return clearRect.apply(this, args);
      };
      ctx.fillText = function (text, ...coords) {
        if (this.canvas.id === 'response' && this.textAlign === 'right') window.yTicks.push(Number(text));
        return fillText.call(this, text, ...coords);
      };
    });
    await page.route('**/three/catalog.js', route => route.abort());
    await page.goto(`${root}${lab}/?lang=ko`);
    await expect(page.locator('#start-pause')).toBeEnabled();
    const ticks = () => page.evaluate(() => window.yTicks);
    const initial = await ticks();
    await page.locator('#target').press('End');
    expect(await ticks()).toEqual(initial);
    await page.locator('#kp').press('End');
    expect(await ticks()).toEqual(initial);
    await page.locator('#start-pause').click();
    await expect.poll(() => page.locator('#sim-output').textContent().then(Number)).toBeGreaterThan(0);
    await page.locator('#start-pause').click();
    expect(await ticks()).toEqual(initial);
    await page.locator('#reset').click();
    expect(await ticks()).toEqual(expected);
    const caption = page.locator('.graph-panel .canvas-caption');
    await expect(caption).toContainText(ko);
    await expect(caption).toContainText('고정');
    await page.locator('[data-lang=en]').click();
    await expect(caption).toContainText(en);
    await expect(caption).toContainText(/fixed/i);
    expect(await ticks()).toEqual(expected);
  });
}

test('off-scale motor samples are reported, not painted along or beyond the edge', async ({page}) => {
  // Zero feedback + constant load makes the free shaft drift below -8 rad.
  await page.route('**/three/catalog.js', route => route.abort());
  await page.clock.install({time: new Date('2025-01-01T00:00:00Z')});
  await page.clock.pauseAt(new Date('2025-01-01T00:00:01Z'));
  await page.addInitScript(() => {
    const {fillText} = CanvasRenderingContext2D.prototype;
    window.timeTicks = {};
    CanvasRenderingContext2D.prototype.fillText = function (text, x, ...args) {
      if (this.canvas.id === 'response' && this.textAlign === 'center') window.timeTicks[Number(text)] = x;
      return fillText.call(this, text, x, ...args);
    };
  });
  await page.goto(`${root}dc-motor/?lang=en`);
  const note = page.locator('#response-overflow');
  for (const id of ['kp', 'kd']) await page.locator(`#${id}`).fill('0');
  await page.locator('#disturb').dispatchEvent('click');
  await page.locator('#start-pause').dispatchEvent('click');
  await page.clock.runFor(4600);
  expect(Number(await page.locator('#sim-output').textContent())).toBeLessThan(-8);
  // Read an entire bitmap column (including the margins), in a time interval
  // where the raw curve would still fit on the canvas below the plotting area.
  const [inView, outOfView] = await page.locator('#response').evaluate(canvas => [4, 4.35].map(t => {
    const x = window.timeTicks[0] + t / 15 * (window.timeTicks[15] - window.timeTicks[0]);
    const col = canvas.getContext('2d').getImageData(Math.round(x * canvas.width / canvas.clientWidth), 0, 1, canvas.height).data;
    return col.some((_, i) => i % 4 === 0 && col[i + 3] > 40 && col[i + 1] > col[i] + 50);
  }));
  expect([inView, outOfView]).toEqual([true, false]);
  await expect(note).toContainText(/below|minimum/i);
  await page.locator('[data-lang=ko]').dispatchEvent('click');
  await expect(note).toContainText(/하한|최솟값/);
  await page.locator('#kp').fill('28');
  await page.locator('#kd').fill('1.6');
  await page.clock.runFor(1500);
  expect(Math.abs(Number(await page.locator('#sim-output').textContent()))).toBeLessThan(8);
  await expect(note).toBeVisible(); // earlier excursion is still in the 15 s window
  await page.clock.runFor(15000);
  await expect(note).toBeHidden();
});
