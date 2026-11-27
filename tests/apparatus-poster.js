import {expect} from '@playwright/test';

// Install before navigation; chart 2D contexts are expected, device contexts are not.
export async function observeCanvases(page) {
  await page.addInitScript(() => {
    window.device2dRequests = 0;
    window.failedWebGLRequests = 0;
    const get = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function(type, ...args) {
      if (type === '2d' && (/^apparatus(?:-fallback)?$/.test(this.id) || this.closest('.apparatus-stage'))) {
        window.device2dRequests++;
      }
      const context = get.call(this, type, ...args);
      if (/webgl/.test(type) && !context) window.failedWebGLRequests++;
      return context;
    };
  });
}

export async function gateRequest(page, pattern) {
  let requested = false, release;
  const gate = new Promise(resolve => { release = resolve; });
  await page.route(pattern, async route => { requested = true; await gate; await route.continue(); });
  return {wait: () => expect.poll(() => requested).toBe(true), release};
}

export async function expectPoster(page, id, narrow) {
  const stage = page.locator('.apparatus-stage');
  const image = stage.locator('picture.apparatus-poster img');
  await expect(image).toBeVisible();
  const path = `/assets/startup-posters/${id}${narrow ? '-narrow' : ''}.webp`;
  await expect.poll(() => image.evaluate((img, path) => img.complete && img.naturalWidth > 200 &&
    img.naturalHeight > 200 && new URL(img.currentSrc).pathname.endsWith(path), path),
    {message: `browser decoded ${path}`}).toBe(true);
  // Sample the decoded production image, not a box, an alt string, or a test fixture.
  const colors = await image.evaluate(img => {
    const thumb = document.createElement('canvas'); thumb.width = thumb.height = 32;
    const ctx = thumb.getContext('2d'); ctx.drawImage(img, 0, 0, 32, 32);
    const {data} = ctx.getImageData(0, 0, 32, 32), colors = new Set();
    for (let i = 0; i < data.length; i += 4) if (data[i+3]) colors.add((data[i]<<16) | (data[i+1]<<8) | data[i+2]);
    return colors.size;
  });
  expect(colors, `nonblank apparatus pixels in ${path}`).toBeGreaterThan(16);
  await expect(stage.locator('canvas:visible')).toHaveCount(0);
  const standby = page.locator('.apparatus-stage + canvas');
  await expect(standby).toHaveCount(1); await expect(standby).toBeHidden();
  expect(await page.evaluate(() => window.device2dRequests)).toBe(0);
}

export async function expectUnavailable(page, id, lang, narrow = false) {
  const stage = page.locator('.apparatus-stage');
  await expect(stage).toHaveAttribute('data-view', 'unavailable');
  await expect(stage.getByText(lang === 'en' ? '3D view unavailable.' : '3D 화면을 불러올 수 없습니다.', {exact:true})).toBeVisible();
  await expect(stage.getByText(/^(Loading…|로딩 중…)$/)).toBeHidden();
  await expect(stage.locator('.three-apparatus,.three-view')).toHaveCount(0);
  await expectPoster(page, id, narrow);
}
