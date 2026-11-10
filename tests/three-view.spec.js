import {test, expect} from '@playwright/test';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test.use({launchOptions: {executablePath: process.env.CHROMIUM_PATH,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader']}});

async function fixture(page, compactControls = false) {
  await page.route('**/assets/three/view.js',async route=>{
    const response=await route.fetch(),source=await response.text();
    const marker='return {update, render, resize: render, dispose, setLanguage, canvas, element};';
    expect(source).toContain(marker);
    await route.fulfill({response,body:source.replace(marker,`window.viewCamera=camera;window.viewScene=scene;${marker}`)});
  });
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
    const readings=[{id:'position',anchor:block,label:{ko:'위치',en:'Position'},value:'0.00 m',side:'left'}];
    window.fixtureReadings=readings;
    const model = {root, camera:{position:[4,3,6],target:[0,0,0],span:4},
      legend:{ko:'청록: 실제 위치',en:'Teal: actual position'},
      readouts(){return readings;},
      update(s){block.position.x=s.x;readings[0].value=s.x.toFixed(2)+' m'; window.viewUpdates++;}};
    window.viewUpdates=0; window.viewContextLost=false;
    window.fixtureView = createView(host,model,{label:'Fixture apparatus',lang:'ko',compactControls,onContextLost(){window.viewContextLost=true;}});
    window.fixtureView?.update(Object.freeze({x:0}),Object.freeze({}));
  }, {base:root, compactControls});
}

async function faultedAdapter(page, fault = 'render') {
  await page.goto(root);
  await page.addStyleTag({url:root+'assets/three/view.css'});
  return page.evaluate(async ({base,fault})=>{
    const T=await import(base+'assets/vendor/three.js');
    const {upgradeApparatus}=await import(base+'assets/three/apparatus.js');
    const canvas=document.createElement('canvas');canvas.id='fault-device';
    canvas.style.cssText='display:block;width:600px;height:250px';
    canvas.setAttribute('aria-label','Original apparatus');document.body.prepend(canvas);
    canvas.getContext('2d').fillRect(0,0,20,20);
    window.originalCanvas=canvas;window.originalPixels=canvas.toDataURL();window.adapterFallback=false;
    const group=new T.Group();group.add(new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial({color:0x087f74})));
    const fromScene=T.PMREMGenerator.prototype.fromScene;
    T.PMREMGenerator.prototype.fromScene=function(...args){
      const renderer=this._renderer,render=renderer.render;window.faultRenderer=renderer;
      renderer.render=function(){
        window.pmremFault={cube:renderer.getRenderTarget()?.isWebGLCubeRenderTarget,face:renderer.getActiveCubeFace()};
        renderer.render=render;
        if(fault==='context-loss')renderer.getContext().getExtension('WEBGL_lose_context').loseContext();
        throw new Error('Injected PMREM render failure after cubemap binding');
      };
      try{return fromScene.apply(this,args);}finally{renderer.render=render;}
    };
    try{
      window.adapter=upgradeApparatus(canvas,{root:group,update(){},camera:{position:[4,3,5],target:[0,0,0],span:4}},
        {onFallback(){window.adapterFallback=true;}});
    }finally{T.PMREMGenerator.prototype.fromScene=fromScene;}
    window.adapter?.update({},{});
    return {created:!!window.adapter,fault:window.pmremFault,originalVisible:getComputedStyle(canvas).display!=='none',
      originalIdentity:document.getElementById('fault-device')===canvas};
  },{base:root,fault});
}

async function minimumReadoutFixture(page, compactControls) {
  await fixture(page,compactControls);
  await page.evaluate(()=>{
    document.documentElement.style.fontSize='32px';
    const viewport=document.querySelector('#view-fixture .three-viewport');
    viewport.style.cssText='flex:none;width:140px;height:85px';
    const metrics=document.createElement('dl');metrics.id='readout-metrics';
    metrics.innerHTML='<dt>Position</dt><dd>0.50 m</dd>';
    document.getElementById('view-fixture').after(metrics);window.originalMetrics=metrics;
    window.fixtureView.setLanguage('en');window.fixtureView.update({x:.5},{});
  });
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).fontSize==='32px');
  await page.evaluate(()=>window.fixtureView.render());
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

test('studio environment changes real reflected pixels and uses perspective rather than a toy isometric view',async({page})=>{
  await fixture(page);
  expect(await page.evaluate(()=>window.viewCamera.isPerspectiveCamera)).toBe(true);
  expect(await page.evaluate(()=>!!window.viewScene.environment?.isTexture)).toBe(true);
  const changed=await page.evaluate(()=>{
    const view=window.fixtureView,environment=window.viewScene.environment;
    const before=view.canvas.toDataURL();window.viewScene.environment=null;view.render();
    const different=before!==view.canvas.toDataURL();window.viewScene.environment=environment;view.render();
    return different;
  });
  expect(changed).toBe(true);
});

test('compact mode can retain an essential model-assumption label without clipping',async({page})=>{
  await page.setViewportSize({width:280,height:900});await fixture(page,true);
  await page.evaluate(()=>{
    const entry=window.fixtureReadings[0];entry.retainLabel=true;
    entry.label={ko:'수평면 · 말단 질량',en:'Horizontal plane · payload'};
    window.fixtureView.setLanguage('en');window.fixtureView.render();
  });
  await page.evaluate(()=>document.fonts.ready);
  await page.evaluate(()=>window.fixtureView.render());
  const label=page.locator('#view-fixture .three-readout__label');
  await expect(label).toBeVisible();await expect(label).toHaveText('Horizontal plane · payload');
  expect(await label.evaluate(el=>{
    const range=document.createRange();range.selectNodeContents(el);
    const box=el.closest('.three-readout').getBoundingClientRect();
    return [...range.getClientRects()].every(r=>r.left>=box.left&&r.right<=box.right&&r.top>=box.top&&r.bottom<=box.bottom);
  })).toBe(true);
  await page.evaluate(()=>window.fixtureView.setLanguage('ko'));
  await expect(label).toBeVisible();await expect(label).toHaveText('수평면 · 말단 질량');
});

test('reduced-motion global durations cannot leave a resized readout hidden',async({page})=>{
  await fixture(page,true);
  await page.waitForFunction(()=>getComputedStyle(document.querySelector('#view-fixture .three-readout')).position==='absolute');
  await page.evaluate(()=>{
    window.fixtureReadings[0].side='right';window.fixtureReadings[0].retainLabel=true;
    window.fixtureView.render();window.beforeReadoutResize=window.viewUpdates;
  });
  await page.addStyleTag({content:'*,*::before,*::after{transition-duration:.01ms!important}'});
  await expect(page.locator('#view-fixture .three-readout')).toHaveCSS('transition-property','none');
  await page.evaluate(()=>{
    document.querySelector('#view-fixture .three-viewport').style.cssText='flex:none;width:144px;height:200px';
    window.fixtureView.setLanguage('en');
    window.fixtureView.render();
    window.readoutVisibleAfterResize=!document.querySelector('#view-fixture .three-readout').hidden;
  });
  expect(await page.evaluate(()=>window.readoutVisibleAfterResize)).toBe(true);
  await page.waitForFunction(()=>document.querySelector('#view-fixture canvas').width===144);
  await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
  await expect(page.locator('#view-fixture .three-readout')).toBeVisible();
  expect(await page.evaluate(()=>window.viewUpdates===window.beforeReadoutResize)).toBe(true);
});

for(const compact of [true,false])test(`retained labels suppress overflow and recover at root32 (compact=${compact})`,async({page})=>{
  await minimumReadoutFixture(page,compact);
  const readout=page.locator('#view-fixture .three-readout');
  await page.evaluate(()=>{
    const entry=window.fixtureReadings[0];entry.retainLabel=true;
    entry.label={ko:'수평면 · 말단 질량',en:'Horizontal plane · payload'};
    window.retainedReadout=document.querySelector('#view-fixture .three-readout');
  });
  for(const lang of ['ko','en']){
    await page.evaluate(lang=>{
      document.querySelector('#view-fixture .three-viewport').style.cssText='flex:none;width:140px;height:85px';
      window.fixtureReadings[0].value='0.50 m';window.fixtureView.setLanguage(lang);window.fixtureView.render();
    },lang);
    await expect(readout).toBeHidden();
    await page.evaluate(()=>{
      document.querySelector('#view-fixture .three-viewport').style.cssText='flex:none;width:280px;height:200px';
      window.fixtureView.render();
    });
    await expect(readout).toBeVisible();await expect(readout.locator('.three-readout__label')).toBeVisible();
    expect(await readout.evaluate(node=>node===window.retainedReadout)).toBe(true);
    await page.evaluate(()=>{window.fixtureReadings[0].value='1'.repeat(100);window.fixtureView.render();});
    await expect(readout).toBeHidden();
    await page.evaluate(()=>{window.fixtureReadings[0].value='0.50 m';window.fixtureView.render();});
    await expect(readout).toBeVisible();
    expect(await page.locator('#readout-metrics').evaluate(el=>el===window.originalMetrics&&el.textContent==='Position0.50 m')).toBe(true);
  }
});

test('PMREM failure after cubemap binding preserves direct-lit adapter pixels and the original 2D canvas',async({page})=>{
  const result=await faultedAdapter(page);
  expect(result.fault).toEqual({cube:true,face:0});
  expect(result.created).toBe(true);expect(result.originalVisible).toBe(false);
  const pixels=await page.evaluate(()=>{
    window.adapter.render();
    const canvas=document.getElementById('fault-device'),copy=document.createElement('canvas');
    copy.width=canvas.width;copy.height=canvas.height;
    const context=copy.getContext('2d');context.drawImage(canvas,0,0);
    const data=context.getImageData(0,0,copy.width,copy.height).data;
    let nonblack=0,teal=0;
    for(let i=0;i<data.length;i+=4){
      if(data[i]+data[i+1]+data[i+2]>0)nonblack++;
      if(data[i+1]>data[i]*1.2&&data[i+1]>data[i+2]*1.01)teal++;
    }
    return {nonblack,teal,defaultTarget:window.faultRenderer.getRenderTarget()===null,
      originalIdentity:document.getElementById('fault-device-fallback')===window.originalCanvas};
  });
  expect(pixels.nonblack,'the default framebuffer must not stay blank').toBeGreaterThan(1000);
  expect(pixels.teal,'the directly lit apparatus, not only its background, must render').toBeGreaterThan(100);
  expect(pixels.defaultTarget).toBe(true);expect(pixels.originalIdentity).toBe(true);
  await expect(page.locator('#fault-device-fallback')).toBeHidden();
  await page.evaluate(()=>window.faultRenderer.getContext().getExtension('WEBGL_lose_context').loseContext());
  await expect.poll(()=>page.evaluate(()=>window.adapterFallback)).toBe(true);
  await expect(page.locator('#fault-device')).toBeVisible();
  expect(await page.evaluate(()=>document.getElementById('fault-device')===window.originalCanvas&&
    !window.originalCanvas.hasAttribute('aria-hidden')&&window.originalCanvas.toDataURL()===window.originalPixels)).toBe(true);
  expect(await page.evaluate(()=>window.adapter.update({},{}))).toBe(false);
});

test('PMREM render failure restores the caller render target, cube face, mipmap, clear flags and XR state',async({page})=>{
  await page.goto(root);
  const result=await page.evaluate(async base=>{
    const T=await import(base+'assets/vendor/three.js');
    const {studioEnvironment}=await import(base+'assets/three/lighting.js');
    const renderer=new T.WebGLRenderer(),target=new T.WebGLCubeRenderTarget(32);
    renderer.setRenderTarget(target,3,1);
    renderer.autoClear=false;renderer.autoClearColor=false;renderer.autoClearDepth=false;renderer.autoClearStencil=false;
    renderer.xr.enabled=true;
    const render=renderer.render;let failedAfterBinding=false,error;
    renderer.render=()=>{
      failedAfterBinding=renderer.getRenderTarget()!==target&&renderer.getRenderTarget()?.isWebGLCubeRenderTarget;
      throw new Error('Injected PMREM render failure after cubemap binding');
    };
    try{studioEnvironment(renderer);}catch(failure){error=failure.message;}finally{renderer.render=render;}
    const state={sameTarget:renderer.getRenderTarget()===target,face:renderer.getActiveCubeFace(),mipmap:renderer.getActiveMipmapLevel(),
      clear:renderer.autoClear,color:renderer.autoClearColor,depth:renderer.autoClearDepth,stencil:renderer.autoClearStencil,xr:renderer.xr.enabled};
    renderer.setRenderTarget(null);target.dispose();renderer.dispose();renderer.forceContextLoss();
    return {failedAfterBinding,error,state};
  },root);
  expect(result.failedAfterBinding).toBe(true);
  expect(result.error).toBe('Injected PMREM render failure after cubemap binding');
  expect(result.state).toEqual({sameTarget:true,face:3,mipmap:1,clear:false,color:false,depth:false,stencil:false,xr:true});
});

test('context lost inside PMREM never hides or replaces the original 2D canvas',async({page})=>{
  const result=await faultedAdapter(page,'context-loss');
  expect(result.fault).toEqual({cube:true,face:0});
  expect(result.created).toBe(false);
  expect(result.originalVisible).toBe(true);expect(result.originalIdentity).toBe(true);
  await expect(page.locator('#fault-device')).toBeVisible();
  await expect(page.locator('.three-apparatus')).toHaveCount(0);
  expect(await page.evaluate(()=>document.getElementById('fault-device')===window.originalCanvas&&
    !window.originalCanvas.hasAttribute('aria-hidden')&&window.originalCanvas.toDataURL()===window.originalPixels)).toBe(true);
  expect(await page.locator('#fault-device').evaluate(canvas=>!!canvas.getContext('2d'))).toBe(true);
});

test('anchored readouts expose actual values, follow geometry, localize and preserve model state on orbit',async({page})=>{
  await fixture(page);
  const label=page.locator('#view-fixture .three-readout[data-readout="position"]');
  await expect(label).toContainText('위치');await expect(label).toContainText('0.00 m');
  await page.evaluate(()=>window.firstReadout=document.querySelector('#view-fixture .three-readout'));
  const leader=page.locator('#view-fixture .three-leader');
  const before=await leader.getAttribute('x1');
  await page.evaluate(()=>window.fixtureView.update(Object.freeze({x:.5}),Object.freeze({})));
  await expect(label).toContainText('0.50 m');
  expect(await leader.getAttribute('x1')).not.toBe(before);
  expect(await page.evaluate(()=>window.firstReadout===document.querySelector('#view-fixture .three-readout'))).toBe(true);
  await page.evaluate(()=>window.fixtureView.setLanguage('en'));
  await expect(label).toContainText('Position');
  const updates=await page.evaluate(()=>window.viewUpdates);
  await page.locator('#view-fixture canvas').focus();await page.keyboard.press('ArrowRight');
  expect(await page.evaluate(()=>window.viewUpdates)).toBe(updates);
  const fits=await label.evaluate(node=>{
    const a=node.getBoundingClientRect(),b=node.closest('.three-viewport').getBoundingClientRect();
    return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;
  });
  expect(fits).toBe(true);
});

test('readout text stays inside its label at narrow widths with enlarged text',async({page})=>{
  await page.setViewportSize({width:320,height:900});await fixture(page);
  await page.evaluate(()=>{document.documentElement.style.fontSize='32px';window.fixtureView.setLanguage('en');window.fixtureView.update({x:.5},{});});
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>getComputedStyle(document.documentElement).fontSize==='32px');
  const fits=await page.locator('#view-fixture .three-readout').evaluate(node=>{
    const box=node.getBoundingClientRect();
    return [...node.children].every(child=>{
      if(getComputedStyle(child).display==='none')return true;
      const range=document.createRange();range.selectNodeContents(child);const text=range.getBoundingClientRect();
      return text.left>=box.left&&text.right<=box.right&&text.bottom<=box.bottom;
    });
  });
  expect(fits).toBe(true);
});

for(const compact of [true,false])test(`minimum 140x85 readout fits real text ranges at root32 (compact=${compact})`,async({page})=>{
  await minimumReadoutFixture(page,compact);
  const readout=page.locator('#view-fixture .three-readout');
  await expect(readout).toBeVisible();await expect(readout.locator('.three-readout__value')).toHaveText('0.50 m');
  const bounds=await readout.evaluate(node=>{
    const box=node.getBoundingClientRect(),viewport=node.closest('.three-viewport').getBoundingClientRect();
    const within=(a,b)=>a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;
    const children=[...node.children].filter(child=>getComputedStyle(child).display!=='none');
    return {width:viewport.width,height:viewport.height,boxFits:within(box,viewport),
      textFits:children.every(child=>{
        const range=document.createRange();range.selectNodeContents(child);
        return [...range.getClientRects()].every(text=>within(text,box)&&within(text,viewport));
      }),fontSize:parseFloat(getComputedStyle(node.querySelector('.three-readout__value')).fontSize),
      expectedFontSize:parseFloat(getComputedStyle(document.documentElement).fontSize)*.8125};
  });
  expect(bounds.width).toBe(140);expect(bounds.height).toBe(85);
  expect(bounds.boxFits).toBe(true);expect(bounds.textFits).toBe(true);
  expect(bounds.fontSize).toBe(bounds.expectedFontSize);
  await expect(page.locator('#view-fixture .three-readouts')).toHaveAttribute('aria-hidden','true');
  await expect(page.getByRole('definition')).toHaveText('0.50 m');
  expect(await page.evaluate(()=>document.getElementById('readout-metrics')===window.originalMetrics)).toBe(true);
});

test('readouts suppress measured overflow including the first row without hiding primary metrics',async({page})=>{
  await minimumReadoutFixture(page,true);
  const readout=page.locator('#view-fixture .three-readout'),leader=page.locator('#view-fixture .three-leader');
  await page.evaluate(()=>{
    window.originalReadout=document.querySelector('#view-fixture .three-readout');
    const value='123456789012345678901234567890 m';
    window.fixtureReadings[0].value=value;window.originalMetrics.querySelector('dd').textContent=value;
    window.fixtureView.render();
  });
  await expect(readout).toBeHidden();await expect(leader).toBeHidden();
  await expect(page.getByRole('definition')).toHaveText('123456789012345678901234567890 m');
  await page.evaluate(()=>{
    document.querySelector('#view-fixture .three-viewport').style.width='400px';
    window.fixtureReadings[0].value='0.50 m';window.originalMetrics.querySelector('dd').textContent='0.50 m';
    window.fixtureView.render();
  });
  await expect(readout).toBeHidden();await expect(leader).toBeHidden();
  await expect(page.getByRole('definition')).toHaveText('0.50 m');
  await page.evaluate(()=>{
    document.querySelector('#view-fixture .three-viewport').style.width='140px';window.fixtureView.render();
  });
  await expect(readout).toBeVisible();await expect(leader).toBeVisible();
  expect(await page.evaluate(()=>document.querySelector('#view-fixture .three-readout')===window.originalReadout&&
    document.getElementById('readout-metrics')===window.originalMetrics)).toBe(true);
  for(const [width,height] of [[139,85],[140,84]]){
    await page.evaluate(({width,height})=>{
      const viewport=document.querySelector('#view-fixture .three-viewport');
      viewport.style.width=width+'px';viewport.style.height=height+'px';window.fixtureView.render();
    },{width,height});
    await expect(readout).toHaveCount(0);await expect(leader).toHaveCount(0);
    await expect(page.getByRole('definition')).toHaveText('0.50 m');
  }
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
