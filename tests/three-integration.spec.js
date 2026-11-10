import {test, expect} from '@playwright/test';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const ids = ['cruise-control','dc-motor','ball-and-beam','inverted-pendulum','rotary-pendulum','ball-and-plate','robot-arm','parking','heat-exchanger','drone','impedance-robot','path-tracking','suspension','cstr','aircraft-pitch','rocket-landing'];
test.use({launchOptions:{executablePath:process.env.CHROMIUM_PATH,
  args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
for (const id of ids) {
  test(`${id}: real Three.js apparatus, unchanged playback and camera-only interaction`, async ({page}) => {
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.goto(root+id+'/?lang=ko');
    const canvas=page.locator('#apparatus');
    await expect(canvas).toHaveAttribute('data-renderer','three');
    const initial=await page.locator('#sim-time').textContent();
    const before=await canvas.evaluate(n=>n.toDataURL());
    await canvas.focus();await page.keyboard.press('ArrowRight');
    expect(await canvas.evaluate(n=>n.toDataURL())).not.toBe(before);
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
    expect(errors).toEqual([]);
  });
  test(`${id}: narrow English viewport retains the complete view and controls`, async ({page}) => {
    await page.setViewportSize({width:390,height:844});
    await page.goto(root+id+'/?lang=en');
    await expect(page.locator('#apparatus')).toHaveAttribute('data-renderer','three');
    await expect(page.getByRole('button',{name:'Reset view',exact:true})).toBeVisible();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const geometry=await page.locator('.three-apparatus').evaluate(host=>{
      const box=host.getBoundingClientRect();return [...host.querySelectorAll('canvas,button,p:not([hidden])')].map(n=>{const r=n.getBoundingClientRect();return r.left>=box.left-1&&r.right<=box.right+1&&r.top>=box.top-1&&r.bottom<=box.bottom+1;});});
    expect(geometry.every(Boolean)).toBe(true);
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
        await expect(page.locator('#apparatus-fallback')).toBeHidden();
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
for (const id of ids) for (const delayed of [false,true]) {
  test(`${id}: missing WebGL preserves 2D playback after ${delayed?'delayed':'normal'} module loading`,async({page})=>{
    const errors=[];page.on('pageerror',error=>errors.push(error.message));
    await page.addInitScript(()=>{
      window.__webglAttempts=0;
      const original=HTMLCanvasElement.prototype.getContext;
      HTMLCanvasElement.prototype.getContext=function(type,...args){
        if (/webgl/.test(type)) { window.__webglAttempts++;return null; }
        return original.call(this,type,...args);
      };
    });
    let releaseModule, responseReady=false;
    const moduleGate=new Promise(resolve=>{releaseModule=resolve;});
    if (delayed) await page.route('**/assets/three/catalog.js',async route=>{
      const response=await route.fetch();responseReady=true;
      await moduleGate;await route.fulfill({response});
    });
    const playAndPause=async()=>{
      const before=Number(await page.locator('#sim-time').textContent());
      await page.locator('#start-pause').click();
      await expect.poll(async()=>Number(await page.locator('#sim-time').textContent())).toBeGreaterThan(before);
      await page.locator('#start-pause').click();
      const paused=await page.locator('#sim-time').textContent();
      await page.waitForTimeout(120);
      expect(await page.locator('#sim-time').textContent()).toBe(paused);
    };
    try {
      await page.goto(root+id+'/?lang=en',{waitUntil:'domcontentloaded'});
      await expect(page.locator('#start-pause')).toBeEnabled();
      const originalCanvas=await page.locator('#apparatus').elementHandle();
      if (delayed) {
        await expect.poll(()=>responseReady).toBe(true);
        expect(await page.evaluate(()=>window.__webglAttempts)).toBe(0);
        await expect(page.locator('#apparatus')).toBeVisible();
        await playAndPause();
        expect(await page.evaluate(()=>window.__webglAttempts)).toBe(0);
      }
      const beforeUpgrade=await page.locator('#sim-time').textContent();
      releaseModule();
      // Controls alone can be ready before import() even reaches the WebGL upgrade.
      await expect.poll(()=>page.evaluate(()=>window.__webglAttempts)).toBeGreaterThan(0);
      await expect(page.locator('#apparatus')).toHaveAttribute('data-renderer','canvas2d');
      await expect(page.locator('#apparatus')).toBeVisible();
      await expect(page.locator('.three-apparatus')).toHaveCount(0);
      await expect(page.locator('#apparatus-fallback,[data-renderer="three"]')).toHaveCount(0);
      expect(await originalCanvas.evaluate(n=>n===document.getElementById('apparatus')&&n.isConnected&&!!n.getContext('2d'))).toBe(true);
      expect(await page.locator('#sim-time').textContent()).toBe(beforeUpgrade);
      await playAndPause();
      expect(errors).toEqual([]);
    } finally { releaseModule(); }
  });
}
