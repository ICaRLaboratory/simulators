import {test, expect} from '@playwright/test';
import {observeCanvases, gateRequest, expectPoster, expectUnavailable} from './apparatus-poster.js';
const metrics = page => page.locator('.metrics output').allTextContents();
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const ids = ['cruise-control','dc-motor','ball-and-beam','inverted-pendulum','rotary-pendulum','ball-and-plate','robot-arm','parking','heat-exchanger','drone','impedance-robot','path-tracking','suspension','cstr','aircraft-pitch','rocket-landing'];
test.use({launchOptions:{executablePath:process.env.CHROMIUM_PATH,
  args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
const plotPixels = async page => {
  const plots = page.locator('.graph-panel canvas');
  expect(await plots.count()).toBeGreaterThan(0);
  return plots.evaluateAll(nodes => nodes.map(n => n.toDataURL()));
};
async function playAndPause(page) {
  const time = page.locator('#sim-time'), start = page.locator('#start-pause');
  const before = Number(await time.textContent()), pixels = await plotPixels(page);
  await start.click();
  await expect.poll(async () => Number(await time.textContent())).toBeGreaterThan(before + .2);
  await start.click();
  const paused = await time.textContent();
  await page.waitForTimeout(120);
  await expect(time).toHaveText(paused);
  expect((await plotPixels(page)).some((current,i) => current !== pixels[i]), 'response traces advance').toBe(true);
}
// Occlusion/opacity can leave a loaded image with a nonempty DOM rectangle but no pixels on screen.
async function expectFirstPaint(page, id, narrow) {
  await expectPoster(page,id,narrow);
  const image = page.locator('picture.apparatus-poster img');
  const shown = await image.screenshot({animations:'disabled'});
  const without = await image.screenshot({animations:'disabled',style:'picture.apparatus-poster img { opacity:0 !important; }'});
  expect(shown.equals(without), 'poster contributes pixels before the entry script runs').toBe(false);
}
for (const id of ids) {
  test(`${id}: real Three.js apparatus, unchanged playback and camera-only interaction`, async ({page}) => {
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await observeCanvases(page);
    const entry = await gateRequest(page, /\/assets\/(app|pendulum-app|experiment-app)\.js$/);
    const catalog = await gateRequest(page, '**/assets/three/catalog.js');
    const stage = page.locator('.apparatus-stage'), loading = stage.locator('.apparatus-loading');
    let initialMetrics;
    try {
      // Commit, not DOMContentLoaded: the deferred entry module is deliberately withheld.
      await page.goto(root+id+'/?lang=ko',{waitUntil:'commit'});
      await entry.wait();
      await expect(stage).toHaveAttribute('data-view','poster');
      await expectFirstPaint(page,id,false);
      await expect(loading).toBeVisible(); await expect(loading).toHaveText('로딩 중…',{useInnerText:true});
      await expect(page.locator('#start-pause')).toBeDisabled();
      entry.release();
      await catalog.wait();
      await expect(page.locator('#start-pause')).toBeEnabled();
      await expectPoster(page,id,false);
      await page.locator('[data-lang="en"]').click(); await expect(loading).toHaveText('Loading…');
      await page.locator('[data-lang="ko"]').click(); await expect(loading).toHaveText('로딩 중…',{useInnerText:true});
      initialMetrics = await metrics(page);
      await expect(page.locator('#sim-time')).toHaveText('0.00');
    } finally { entry.release(); catalog.release(); }
    const canvas=stage.locator('#apparatus[data-renderer="three"]');
    await expect(stage).toHaveAttribute('data-view','three');
    await expect(canvas).toBeVisible();
    await expect(stage.locator('picture.apparatus-poster')).toHaveCount(1);
    await expect(stage.locator('picture.apparatus-poster img')).toBeHidden();
    await expect(loading).toHaveCount(1); await expect(loading).toBeHidden();
    await expect(page.locator('.apparatus-stage + canvas')).toHaveCount(1);
    await expect(page.locator('.apparatus-stage + canvas')).toBeHidden();
    expect(await canvas.evaluate(n=>{const gl=n.getContext('webgl2');return gl instanceof WebGL2RenderingContext&&!gl.isContextLost();})).toBe(true);
    expect(await page.evaluate(()=>window.device2dRequests)).toBe(0);
    expect(await metrics(page)).toEqual(initialMetrics);
    await expect(page.locator('#sim-time')).toHaveText('0.00');
    const initial=await page.locator('#sim-time').textContent();
    const before=await canvas.evaluate(n=>n.toDataURL());
    await canvas.focus();await page.keyboard.press('ArrowRight');
    await expect.poll(()=>canvas.evaluate((n,before)=>n.toDataURL()!==before,before)).toBe(true);
    expect(await page.locator('#sim-time').textContent()).toBe(initial);
    await page.getByRole('button',{name:'시점 초기화',exact:true}).click();
    await page.locator('#start-pause').click();
    await expect.poll(async()=>Number(await page.locator('#sim-time').textContent())).toBeGreaterThan(0);
    await page.locator('#start-pause').click();
    const paused=await page.locator('#sim-time').textContent();
    await page.waitForTimeout(120);
    expect(await page.locator('#sim-time').textContent()).toBe(paused);
    await page.locator('#reset').click();
    expect(await page.locator('#sim-time').textContent()).toBe(initial);
    expect(await page.locator('canvas:not([data-renderer="three"]):visible').count()).toBeGreaterThan(0);
    expect(await page.evaluate(()=>window.device2dRequests)).toBe(0);
    expect(errors).toEqual([]);
  });
  test(`${id}: narrow English viewport retains the complete view and controls`, async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await observeCanvases(page);
    const entry = await gateRequest(page,/\/assets\/(app|pendulum-app|experiment-app)\.js$/);
    try {
      await page.goto(root+id+'/?lang=en',{waitUntil:'commit'});
      await entry.wait();
      await expectFirstPaint(page,id,true);
    } finally { entry.release(); }
    await expect(page.locator('#apparatus')).toHaveAttribute('data-renderer','three');
    await expect(page.getByRole('button',{name:'Reset view',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const geometry=await page.locator('.three-apparatus').evaluate(host=>{
      const box=host.getBoundingClientRect();return [...host.querySelectorAll('canvas,button,p:not([hidden])')].map(n=>{const r=n.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1;});});
    expect(geometry.every(Boolean)).toBe(true);
  });
}
for (const id of ['cruise-control','inverted-pendulum','impedance-robot']) {
  test(`${id}: a lost live WebGL context returns to a static poster without resetting the experiment`, async ({page}) => {
    const errors=[]; page.on('pageerror', error => errors.push(error.message));
    await observeCanvases(page);
    await page.goto(root+id+'/?lang=en');
    const canvas=page.locator('.apparatus-stage[data-view="three"] #apparatus[data-renderer="three"]');
    await expect(canvas).toBeVisible();
    await page.evaluate(()=>document.fonts.ready);
    const range=page.locator('#parameter-controls input[type="range"]').first();
    const initialSetting=await range.inputValue();
    await range.press(initialSetting===await range.getAttribute('max') ? 'ArrowLeft' : 'ArrowRight');
    expect(await range.inputValue()).not.toBe(initialSetting);
    await playAndPause(page);
    const paused=await metrics(page), setting=await range.inputValue(), plots=await plotPixels(page);
    // Trigger the browser's actual loss path, not a synthetic DOM event.
    await canvas.evaluate(n=>{
      const gl=n.getContext('webgl2');
      if (!gl || gl.isContextLost()) throw new Error('expected a live WebGL2 context');
      gl.getExtension('WEBGL_lose_context').loseContext();
    });
    await expectUnavailable(page,id,'en');
    expect(await metrics(page)).toEqual(paused);
    const after=await plotPixels(page);expect(after).toHaveLength(plots.length);
    expect(after.every((pixels,i)=>pixels===plots[i]), 'paused plots survive context loss').toBe(true);
    await expect(range).toHaveValue(setting);
    await page.locator('[data-lang="ko"]').click();
    await expectUnavailable(page,id,'ko');
    await playAndPause(page);
    await page.locator('#reset').click();
    await expect(page.locator('#sim-time')).toHaveText('0.00');
    await expect(range).toHaveValue(setting);
    await expectUnavailable(page,id,'ko');
    expect(errors).toEqual([]);
  });
}
for (const dpr of [1, 2]) {
  test.describe(`inverted-pendulum at DPR ${dpr}`, () => {
    test.use({deviceScaleFactor:dpr});
    test('paused plots follow desktop-mobile-desktop resize without changing the experiment', async ({page}) => {
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.setViewportSize({width:1280,height:900});
      await page.goto(root+'inverted-pendulum/?lang=en');
      const canvas=page.locator('#apparatus');
      await expect(canvas).toHaveAttribute('data-renderer','three');
      await page.evaluate(()=>document.fonts.ready);
      expect(await page.evaluate(()=>devicePixelRatio)).toBe(dpr);
      await page.locator('#target').focus();await page.keyboard.press('ArrowRight');
      await page.locator('#kx').focus();await page.keyboard.press('ArrowRight');
      await page.locator('#start-pause').click();
      await expect.poll(async()=>Number(await page.locator('#sim-time').textContent())).toBeGreaterThan(0.2);
      await page.locator('#start-pause').click();
      await expect(page.locator('#run-status')).toHaveText('Paused');

      const readExperiment=()=>page.evaluate(()=>({
        metrics:[...document.querySelectorAll('.metrics output')].map(n=>[n.id,n.textContent]),
        controls:[...document.querySelectorAll('.controls input,.controls button,.controls output')]
          .map(n=>[n.id,n.value,n.textContent,n.disabled]),
      }));
      const paused=await readExperiment();
      const defaultView=await canvas.evaluate(n=>n.toDataURL());
      await canvas.focus();await page.keyboard.press('ArrowRight');await page.keyboard.press('+');
      expect(await canvas.evaluate(n=>n.toDataURL())).not.toBe(defaultView);
      const plots=page.locator('#response,#angle-response');
      await expect(plots).toHaveCount(2);
      const assertBuffers=async()=>{
        await expect.poll(()=>plots.evaluateAll(nodes=>nodes.map(n=>{
          const rect=n.getBoundingClientRect(), scale=Math.min(devicePixelRatio||1,2), transform=n.getContext('2d').getTransform();
          return {id:n.id,css:[rect.width,rect.height],actual:[n.width,n.height,transform.a,transform.d],
            expected:[Math.round(rect.width*scale),Math.round(rect.height*scale),scale,scale]};
        }).filter(row=>row.css.some(value=>value<=0)||row.actual.some((value,i)=>value!==row.expected[i]))),
        {message:'Both paused plots must redraw at their CSS size and capped device pixel ratio'}).toEqual([]);
      };
      const readPixels=()=>page.locator('#apparatus,#response,#angle-response')
        .evaluateAll(nodes=>nodes.map(n=>({id:n.id,pixels:n.toDataURL()})));
      await assertBuffers();
      const desktopPixels=await readPixels();
      const desktopWidths=await plots.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
      for (const viewport of [{width:390,height:844},{width:1280,height:900}]) {
        await page.setViewportSize(viewport);
        await assertBuffers();
        const widths=await plots.evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().width));
        if (viewport.width===390) widths.forEach((width,i)=>expect(width).toBeLessThan(desktopWidths[i]));
        else expect(widths).toEqual(desktopWidths);
        await expect(canvas).toHaveAttribute('data-renderer','three');
        await expect(canvas).toBeVisible();
        await expect(page.locator('picture.apparatus-poster img')).toBeHidden();
        await expect(page.locator('.apparatus-stage + canvas')).toBeHidden();
        await expect(page.locator('.three-apparatus')).toHaveCount(1);
        expect(await canvas.evaluate(n=>{
          const context=n.getContext('webgl2');return context instanceof WebGL2RenderingContext&&!context.isContextLost();
        })).toBe(true);
        await expect(page.locator('#run-status')).toHaveText('Paused');
        expect(await readExperiment()).toEqual(paused);
      }
      // Returning to the same size preserves both accumulated traces and the nondefault camera.
      await expect.poll(readPixels).toEqual(desktopPixels);
      expect(errors).toEqual([]);
    });
  });
}
const withoutWebGL = test.extend({
  browser: async ({playwright}, use) => {
    const browser = await playwright.chromium.launch({executablePath:process.env.CHROMIUM_PATH,args:['--disable-webgl']});
    try { await use(browser); } finally { await browser.close(); }
  },
});
withoutWebGL.describe('WebGL disabled in Chromium', () => {
  for (const id of ids) for (const delayed of [false,true]) {
    withoutWebGL(`${id}: final unavailable state after ${delayed?'delayed':'normal'} scene loading`,async({page})=>{
      const errors=[]; page.on('pageerror',error=>errors.push(error.message));
      await observeCanvases(page);
      const catalog=delayed && await gateRequest(page,'**/assets/three/catalog.js');
      let paused;
      try {
        await page.goto(root+id+'/?lang=en',{waitUntil:'domcontentloaded'});
        await expect(page.locator('#start-pause')).toBeEnabled();
        if (catalog) {
          await catalog.wait();
          await expect(page.locator('.apparatus-stage')).toHaveAttribute('data-view','poster');
          await expect(page.locator('.apparatus-loading')).toBeVisible();
          await expect(page.locator('.apparatus-loading')).toHaveText('Loading…');
          await expectPoster(page,id,false);
          await playAndPause(page);
          paused=await metrics(page);
          expect(await page.evaluate(()=>window.failedWebGLRequests)).toBe(0);
        }
      } finally { if (catalog) catalog.release(); }
      // Enabled controls (and even the correct poster) are not evidence of terminal failure.
      await expect.poll(()=>page.evaluate(()=>window.failedWebGLRequests)).toBeGreaterThan(0);
      await expectUnavailable(page,id,'en');
      if (paused) expect(await metrics(page)).toEqual(paused);
      else await expect(page.locator('#sim-time')).toHaveText('0.00');
      await playAndPause(page);
      await expectUnavailable(page,id,'en');
      expect(errors).toEqual([]);
    });
  }
});
