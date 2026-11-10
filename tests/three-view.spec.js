import {test, expect} from '@playwright/test';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test.use({launchOptions: {executablePath: process.env.CHROMIUM_PATH,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}});

async function fixture(page, compactControls = false) {
  await page.goto(root);
  const response = await page.request.get(root + 'assets/three/view.js');
  expect(response.ok(), 'shared Three.js view module must exist').toBe(true);
  await page.evaluate(async ({base, compactControls}) => {
    const T = await import(base + 'assets/vendor/three.js');
    const {createView} = await import(base + 'assets/three/view.js');
    const host = document.createElement('div'); host.id = 'view-fixture';
    host.style.cssText = 'width:600px;max-width:100%;height:360px;position:relative';
    document.body.prepend(host);
    const root = new T.Group();
    const block = new T.Mesh(new T.BoxGeometry(1, 1, 1), new T.MeshStandardMaterial({color:0x087f74}));
    root.add(block);
    const model = {root, camera:{position:[4,3,6],target:[0,0,0],span:4},
      legend:{ko:'청록: 실제 위치',en:'Teal: actual position'},
      update(s){block.position.x=s.x; window.viewUpdates++;}};
    window.viewUpdates=0; window.viewContextLost=false;
    window.fixtureView = createView(host,model,{label:'Fixture apparatus',lang:'ko',compactControls,onContextLost(){window.viewContextLost=true;}});
    window.fixtureView?.update(Object.freeze({x:0}),Object.freeze({}));
  }, {base:root, compactControls});
}

test('compact reset keeps a native 44px icon button and localized accessible name', async ({page}) => {
  await fixture(page, true);
  const button=page.getByRole('button',{name:'시점 초기화',exact:true});
  await expect(button.locator('svg')).toBeVisible();
  expect(await button.textContent()).toBe('');
  await page.evaluate(()=>window.fixtureView.setLanguage('en'));
  const english=page.getByRole('button',{name:'Reset view',exact:true});
  await expect(english.locator('svg')).toBeVisible();
  const box=await english.boundingBox();
  expect(box.width).toBeGreaterThanOrEqual(44);expect(box.height).toBeGreaterThanOrEqual(44);
});

test('real WebGL view renders and camera controls never advance the model', async ({page}) => {
  await fixture(page);
  const canvas = page.locator('#view-fixture canvas[data-renderer="three"]');
  await expect(canvas).toBeVisible();
  expect(await canvas.evaluate(n=>n.getContext('webgl2') instanceof WebGL2RenderingContext)).toBe(true);
  const before = await canvas.evaluate(n=>n.toDataURL());
  const updates = await page.evaluate(()=>window.viewUpdates);
  await canvas.focus(); await page.keyboard.press('ArrowRight');
  expect(await canvas.evaluate(n=>n.toDataURL())).not.toBe(before);
  expect(await page.evaluate(()=>window.viewUpdates)).toBe(updates);
  await page.getByRole('button',{name:'시점 초기화',exact:true}).click();
  expect(await canvas.evaluate(n=>n.toDataURL())).toBe(before);
  await page.evaluate(()=>window.fixtureView.setLanguage('en'));
  await expect(page.getByRole('button',{name:'Reset view',exact:true})).toBeVisible();
  await expect(page.locator('#view-fixture')).toContainText('Teal: actual position');
  await page.evaluate(()=>window.fixtureView.dispose());
  await expect(canvas).toHaveCount(0);
});

test('WebGL absence leaves the caller in control of its 2D fallback', async ({page}) => {
  await page.addInitScript(()=>{const old=HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext=function(type,...args){return /webgl/.test(type)?null:old.call(this,type,...args);};});
  await fixture(page);
  expect(await page.evaluate(()=>window.fixtureView)).toBeNull();
  await expect(page.locator('#view-fixture canvas')).toHaveCount(0);
  await expect(page.locator('#view-fixture button')).toHaveCount(0);
});

test('native touch orbit changes the camera without advancing the paused model', async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await fixture(page);
  const canvas=page.locator('#view-fixture canvas');
  await canvas.scrollIntoViewIfNeeded();
  const box=await canvas.boundingBox();
  const before=await canvas.evaluate(n=>n.toDataURL());
  const updates=await page.evaluate(()=>window.viewUpdates);
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTouchEmulationEnabled',{enabled:true});
  const point={id:1,x:box.x+box.width*.4,y:box.y+box.height*.5,radiusX:2,radiusY:2,force:1};
  await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[point]});
  for(let i=1;i<=5;i++)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{...point,x:point.x+i*12,y:point.y-i*4}]});
  await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]});
  expect(await canvas.evaluate(n=>n.toDataURL())).not.toBe(before);
  expect(await page.evaluate(()=>window.viewUpdates)).toBe(updates);
  await cdp.detach();
});

test('context loss notifies the caller without mutating simulation state', async ({page}) => {
  await fixture(page);
  const updates = await page.evaluate(()=>window.viewUpdates);
  await page.evaluate(()=>window.fixtureView.canvas.getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect.poll(()=>page.evaluate(()=>window.viewContextLost)).toBe(true);
  expect(await page.evaluate(()=>window.viewUpdates)).toBe(updates);
});

test('apparatus adapter replaces only the device canvas and restores it after GPU loss', async ({page}) => {
  await page.goto(root);
  expect((await page.request.get(root + 'assets/three/apparatus.js')).ok(), 'apparatus adapter must exist').toBe(true);
  await page.evaluate(async base => {
    const T=await import(base+'assets/vendor/three.js');
    const {upgradeApparatus}=await import(base+'assets/three/apparatus.js');
    const canvas=document.createElement('canvas'); canvas.id='device-fixture';
    canvas.style.cssText='width:600px;height:250px';
    document.body.prepend(canvas); canvas.getContext('2d').fillRect(0,0,20,20);
    const root=new T.Group(); root.add(new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0x087f74})));
    window.adapterFallback=false;
    window.adapter=upgradeApparatus(canvas,{root,update(){},camera:{position:[4,3,5],target:[0,0,0],span:4}},{onFallback(){window.adapterFallback=true;}});
    window.adapter.update({},{});
  },root);
  const canvas=page.locator('#device-fixture');
  await expect(canvas).toHaveAttribute('data-renderer','three');
  await page.evaluate(()=>{document.querySelector('#device-fixture-fallback').setAttribute('aria-label','English apparatus description');window.adapter.setLanguage('en');});
  await expect(canvas).toHaveAttribute('aria-label',/English apparatus description/);
  await page.evaluate(()=>document.querySelector('#device-fixture').getContext('webgl2').getExtension('WEBGL_lose_context').loseContext());
  await expect.poll(()=>page.evaluate(()=>window.adapterFallback)).toBe(true);
  await expect(canvas).toHaveAttribute('data-renderer','canvas2d');
  await expect(canvas).toBeVisible();
  expect(await page.evaluate(()=>window.adapter.update({},{}))).toBe(false);
  expect(await canvas.evaluate(n=>!!n.getContext('2d'))).toBe(true);
});
