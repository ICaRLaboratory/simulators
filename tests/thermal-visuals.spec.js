import {test,expect} from '@playwright/test';
const root=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
test.use({deviceScaleFactor:1,launchOptions:{executablePath:process.env.CHROMIUM_PATH,
  args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-accelerated-2d-canvas']}});

async function observeView(page){
  // Test-only observation of the real view; no replacement renderer, camera or plant.
  await page.route('**/assets/three/view.js',async route=>{
    const response=await route.fetch();
    const source=(await response.text())
      .replace('model.update(state, params, extras);','window.__thermalInput=structuredClone({state,params}); model.update(state, params, extras);')
      .replace('return {update, render, resize:', 'window.__thermalView={model,camera,update,render,canvas}; return {update, render, resize:');
    await route.fulfill({response,body:source});
  });
}
async function ready(page,id,width){
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setViewportSize({width,height:900});await observeView(page);
  await page.goto(root+id+'/?lang=en');
  await expect(page.locator('#apparatus')).toHaveAttribute('data-renderer','three');
  await page.waitForFunction(()=>window.__thermalView&&window.__thermalInput);
  await page.evaluate(()=>document.fonts.ready);
  await page.locator('.three-viewport').scrollIntoViewIfNeeded();
  return errors;
}
async function sampleTrajectory(page,id,pose){
  return page.evaluate(async({id,pose,root})=>{
    const {Simulation}=await import(`${root}assets/models/${id}.js`);
    const T=await import(`${root}assets/vendor/three.js`);
    const sim=new Simulation();
    if(id==='heat-exchanger'&&pose==='hot'){
      Object.assign(sim.params,{target:75,flow:.1});for(let i=0;i<240;i++)sim.step(.5);
    }
    if(id==='cstr'){
      sim.params.target=pose==='cold'?60:100;
      if(pose==='cold')for(let i=0;i<240;i++)sim.step(.5);
      else for(let i=0;i<1200&&sim.state.temperature<383.15&&!sim.state.failed;i++)sim.step(.1);
    }
    const view=window.__thermalView;
    view.update(Object.freeze({...sim.state}),Object.freeze({...sim.params}));
    view.model.root.updateMatrixWorld(true);
    const bounds=name=>{
      const box=new T.Box2(),v=new T.Vector3();
      view.model.root.getObjectByName(name).traverseVisible(n=>{
        const a=n.geometry?.attributes.position;if(!a)return;
        for(let i=0;i<a.count;i++){
          v.fromBufferAttribute(a,i).applyMatrix4(n.matrixWorld).project(view.camera);
          box.expandByPoint(new T.Vector2((v.x+1)*view.canvas.width/2,(1-v.y)*view.canvas.height/2));
        }
      });return {min:box.min.toArray(),max:box.max.toArray()};
    };
    const gl=view.canvas.getContext('webgl2'),pixels=new Uint8Array(view.canvas.width*view.canvas.height*4);
    gl.readPixels(0,0,view.canvas.width,view.canvas.height,gl.RGBA,gl.UNSIGNED_BYTE,pixels);
    window.__thermalPixels??={};window.__thermalPixels[pose]={pixels,width:view.canvas.width,height:view.canvas.height};
    return {state:sim.state,params:sim.params,
      vessel:bounds(id==='cstr'?'reactor-fluid':'mixed-fluid'),
      steel:bounds(id==='cstr'?'reactor-top-head':'channel-head-1'),
      drawingBuffer:[gl.drawingBufferWidth,gl.drawingBufferHeight],webgl:!gl.isContextLost()};
  },{id,pose,root});
}
async function pixelChange(page,rect,inset=0){
  return page.evaluate(({rect,inset})=>{
    const {cold:a,hot:b}=window.__thermalPixels;let count=0,changed=0,sum=0;
    const dx=(rect.max[0]-rect.min[0])*inset,dy=(rect.max[1]-rect.min[1])*inset;
    for(let y=Math.ceil(rect.min[1]+dy);y<Math.floor(rect.max[1]-dy);y++)
      for(let x=Math.ceil(rect.min[0]+dx);x<Math.floor(rect.max[0]-dx);x++){
        const k=((a.height-1-y)*a.width+x)*4;
        const delta=[0,1,2].map(i=>Math.abs(a.pixels[k+i]-b.pixels[k+i]));
        count++;if(Math.max(...delta)>30)changed++;sum+=delta.reduce((s,n)=>s+n,0)/3;
      }
    return {count,changed,fraction:changed/count,meanChannelDelta:sum/count};
  },{rect,inset});
}

test('CSTR: explicitly analytical heating and zero-heat snapshots keep signed jacket direction and fixed fill',async({page},info)=>{
  const errors=await ready(page,'cstr',390);
  for(const [name,temperature,coolant,concentration] of [['jacket-heating',310,330,.5],['zero-heat',330,330,0]]){
    const observed=await page.evaluate(async({temperature,coolant,concentration,root})=>{
      const {Simulation}=await import(`${root}assets/models/cstr.js`);
      const T=await import(`${root}assets/vendor/three.js`);
      const sim=new Simulation(),v=window.__thermalView;
      // Deliberately analytical, not represented as a controller trajectory.
      v.update(Object.freeze({...sim.state,temperature,coolant,concentration}),Object.freeze({...sim.params}));
      v.model.root.updateMatrixWorld(true);
      const cue=v.model.root.getObjectByName('jacket-heat');
      const start=cue.localToWorld(new T.Vector3(0,0,0)),end=cue.localToWorld(new T.Vector3(0,1,0));
      return {jacket:cue.visible,direction:end.x-start.x,
        reaction:v.model.root.getObjectByName('reaction-heat-right').visible,
        fill:v.model.root.getObjectByName('reactor-fluid').scale.toArray(),
        surface:v.model.root.getObjectByName('fluid-surface').position.y};
    },{temperature,coolant,concentration,root});
    if(name==='jacket-heating'){expect(observed.jacket).toBe(true);expect(observed.direction).toBeLessThan(0);}
    else {expect(observed.jacket).toBe(false);expect(observed.reaction).toBe(false);}
    expect(observed.fill).toEqual([1,1,1]);expect(observed.surface).toBe(1.93);
    await page.locator('.three-viewport').screenshot({path:info.outputPath(`analytical-${name}.png`)});
  }
  expect(errors).toEqual([]);
});

for(const id of ['heat-exchanger','cstr'])for(const width of [1280,390]){
  test(`${id} ${width}: real cold/hot vessel pixels change, not just labels; steel stays readable`,async({page},info)=>{
    const errors=await ready(page,id,width);
    const cold=await sampleTrajectory(page,id,'cold');
    await page.locator('.three-viewport').screenshot({path:info.outputPath('cold.png')});
    const hot=await sampleTrajectory(page,id,'hot');
    await page.locator('.three-viewport').screenshot({path:info.outputPath('hot.png')});
    const fluid=await pixelChange(page,hot.vessel,.08),steel=await pixelChange(page,hot.steel,.28);
    await info.attach('real-trajectories-and-pixels',{body:JSON.stringify({cold,hot,fluid,steel},null,2),contentType:'application/json'});
    expect(cold.webgl&&hot.webgl).toBe(true);
    expect(cold.state.failed||hot.state.failed).toBe(false);
    expect(fluid.count).toBeGreaterThan(800);
    expect(fluid.fraction).toBeGreaterThan(.45);
    expect(fluid.meanChannelDelta).toBeGreaterThan(18);
    expect(steel.fraction).toBeLessThan(.05);
    expect(steel.meanChannelDelta).toBeLessThan(2);
    await expect(page.locator('.three-legend')).toContainText(/false-color fluid/i);
    expect(errors).toEqual([]);
  });
  test(`${id} ${width}: actual Pause, camera-only actions and Reset preserve thermal state`,async({page})=>{
    const errors=await ready(page,id,width);
    const canvas=page.locator('#apparatus');
    const initial=await page.evaluate(()=>window.__thermalInput);
    await page.locator('#start-pause').click();
    await expect.poll(()=>page.evaluate(()=>window.__thermalInput.state.t)).toBeGreaterThan(.1);
    await page.locator('#start-pause').click();
    await expect(page.locator('#run-status')).toHaveText('Paused');
    const paused=await page.evaluate(()=>window.__thermalInput);
    const pixels=await canvas.evaluate(n=>n.toDataURL());
    await page.waitForTimeout(100);
    expect(await canvas.evaluate(n=>n.toDataURL())).toBe(pixels);
    await canvas.focus();await page.keyboard.press('ArrowRight');
    expect(await canvas.evaluate(n=>n.toDataURL())).not.toBe(pixels);
    expect(await page.evaluate(()=>window.__thermalInput)).toEqual(paused);
    await page.getByRole('button',{name:'Reset view',exact:true}).click();
    expect(await canvas.evaluate(n=>n.toDataURL())).toBe(pixels);
    expect(await page.evaluate(()=>window.__thermalInput)).toEqual(paused);
    await page.locator('#reset').click();
    expect(await page.evaluate(()=>window.__thermalInput)).toEqual(initial);
    await page.getByRole('button',{name:'한국어',exact:true}).click();
    await expect(page.locator('.three-legend')).toContainText('의사색');
    const fit=await page.locator('.three-apparatus').evaluate(host=>{
      const r=host.getBoundingClientRect();return [...host.querySelectorAll('canvas,button,p:not([hidden])')].every(n=>{
        const b=n.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.bottom<=r.bottom+1&&b.top>=r.top-1;
      });
    });expect(fit).toBe(true);expect(errors).toEqual([]);
  });
}
