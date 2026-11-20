import {test,expect} from '@playwright/test';

const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
test.use({launchOptions:{executablePath:process.env.CHROMIUM_PATH,
  args:['--use-angle=swiftshader','--enable-unsafe-swiftshader','--disable-accelerated-2d-canvas']}});

async function instrument(page,gpu=true){
 await page.addInitScript(()=>{
  const native=requestAnimationFrame.bind(window);window.exp11Native=()=>new Promise(resolve=>native(resolve));
  let id=0,now=0;const callbacks=new Map();
  window.requestAnimationFrame=f=>{callbacks.set(++id,f);return id;};window.cancelAnimationFrame=i=>callbacks.delete(i);
  window.exp11Tick=()=>{now+=100;const batch=[...callbacks.values()];callbacks.clear();batch.forEach(f=>f(now));};
  window.exp11CanvasLabels=[];const text=CanvasRenderingContext2D.prototype.fillText;
  CanvasRenderingContext2D.prototype.fillText=function(value,...args){if(this.canvas.id==='apparatus')window.exp11CanvasLabels.push(String(value));return text.call(this,value,...args);};
 });
 await page.route('**/assets/experiment-app.js',async route=>{
  const response=await route.fetch(),source=await response.text(),marker='function frame(now)';
  expect(source.split(marker)).toHaveLength(2);
  await route.fulfill({response,body:source.replace(marker,`window.exp11Snapshot=()=>structuredClone({state:simulation.state,params:simulation.params,observed:simulation.observe()});\n ${marker}`)});
 });
 if(gpu)await page.route('**/assets/three/view.js',async route=>{
  const response=await route.fetch(),source=await response.text(),marker='renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));';
  expect(source.split(marker)).toHaveLength(2);
  await route.fulfill({response,body:source.replace(marker,`
   const originalRender=renderer.render;
   renderer.render=function(scene,camera){
    const result=originalRender.call(this,scene,camera),probe=scene.getObjectByName('EndEffector_Link');
    if(probe){
     const marker=scene.getObjectByName('reference-tip'),ndc=marker.getWorldPosition(new T.Vector3()).project(camera);
     const gl=renderer.getContext(),size=25,data=new Uint8Array(size*size*4);
     gl.readPixels(Math.round((ndc.x+1)*gl.drawingBufferWidth/2)-12,Math.round((ndc.y+1)*gl.drawingBufferHeight/2)-12,
       size,size,gl.RGBA,gl.UNSIGNED_BYTE,data);
     let redPixels=0;for(let i=0;i<data.length;i+=4)if(data[i]>170 && data[i+1]<80 && data[i+2]<90)redPixels++;
     window.exp11GPU={redPixels,probe:probe.getWorldPosition(new T.Vector3()).toArray(),
     camera:camera.matrixWorld.toArray(),projection:camera.projectionMatrix.toArray(),
     triangles:renderer.info.render.triangles,calls:renderer.info.render.calls,
     reference:scene.getObjectByName('reference-tip').getWorldPosition(new T.Vector3()).toArray(),
     reaction:scene.getObjectByName('contact-reaction').visible,
     wall:new T.Box3().setFromObject(scene.getObjectByName('contact-wall')).min.x};}
    return result;
   };${marker}`)});
 });
}
async function frames(page,count){
 await page.evaluate(async count=>{for(let n=0;n<count;n++){window.exp11Tick();if(n%4===0)await window.exp11Native();}await window.exp11Native();},count);
}
for(const width of [390,1280])test(`Gen3 real GPU reset, approach and contact at ${width}px`,async({page},testInfo)=>{
 test.setTimeout(60000);const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await instrument(page);
 await page.goto(`${base}impedance-robot/?lang=en`);
 await page.waitForFunction(()=>window.exp11GPU?.triangles>0,null,{polling:100});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const snapshots=[];let initialCamera,initialProjection,previousPixels;
 for(const [phase,count] of [['reset',0],['approach',14],['contact',25]]){
  if(phase==='approach')await page.locator('#start-pause').click();
  await frames(page,count);await page.locator('.three-view').scrollIntoViewIfNeeded();
  const {snapshot,gpu,pixels}=await page.evaluate(()=>({snapshot:window.exp11Snapshot(),gpu:window.exp11GPU,pixels:document.querySelector('[data-renderer="three"] canvas')?.toDataURL()}));
  // Use the same JS engine: Node/Chromium libm differ at the last bit in initial IK.
  const reference=await page.evaluate(async({url,steps})=>{const {Simulation}=await import(url),sim=new Simulation();for(let i=0;i<steps;i++)sim.step(.005);return {state:sim.state,observed:sim.observe()};},{url:new URL('assets/models/impedance-robot.js',base).href,steps:Math.round(snapshot.state.t/.005)});
  expect(snapshot.state).toEqual(reference.state);expect(snapshot.observed).toEqual(reference.observed);
  expect(gpu.triangles).toBeGreaterThan(0);expect(gpu.calls).toBeGreaterThan(0);expect(gpu.wall).toBeCloseTo(snapshot.observed.wall,7);
  expect(gpu.probe[0]).toBeCloseTo(snapshot.observed.x,12);expect(gpu.probe[1]).toBeCloseTo(snapshot.observed.z,12);expect(gpu.probe[2]).toBeCloseTo(-.00135,5);
  expect(gpu.reference[0]).toBeCloseTo(snapshot.observed.target,12);expect(gpu.reference[1]).toBeCloseTo(.43372431,7);
  expect(gpu.reaction).toBe(snapshot.observed.force>0);
  expect(gpu.redPixels,'red reference visible in the real framebuffer, even inside the blue wall').toBeGreaterThan(12);
  initialCamera??=gpu.camera;initialProjection??=gpu.projection;expect(gpu.camera).toEqual(initialCamera);expect(gpu.projection).toEqual(initialProjection);
  expect(pixels?.length).toBeGreaterThan(5000);if(previousPixels)expect(pixels).not.toBe(previousPixels);previousPixels=pixels;
  await expect(page.locator('#metric-x')).toHaveText(snapshot.observed.x.toFixed(3));await expect(page.locator('#metric-force')).toHaveText(snapshot.observed.force.toFixed(2));
  const {x,wall,target,force,penetration}=snapshot.observed;
  await expect(page.locator('#metric-penetration')).toHaveText(penetration.toFixed(2));
  if(phase==='reset'){expect(wall-x).toBeCloseTo(.1,12);expect(target).toBeCloseTo(x,12);expect(force).toBe(0);}
  if(phase==='approach'){expect(x).toBeGreaterThan(wall-.1);expect(x).toBeLessThan(wall);expect(target).toBeGreaterThan(x);expect(force).toBe(0);}
  if(phase==='contact'){expect(x).toBeGreaterThan(wall);expect(target).toBeGreaterThan(x);expect(force).toBeGreaterThan(0);expect(gpu.probe[0]-gpu.wall).toBeCloseTo(penetration/1000,7);}
  await page.locator('.three-view').screenshot({path:testInfo.outputPath(`${width}-${phase}.png`)});snapshots.push({phase,snapshot,gpu});
 }
 await page.locator('#start-pause').click();const before=await page.evaluate(()=>window.exp11Snapshot());await frames(page,3);expect(await page.evaluate(()=>window.exp11Snapshot())).toEqual(before);
 await page.locator('#reset').click();await expect(page.locator('#metric-x')).toHaveText(snapshots[0].snapshot.observed.x.toFixed(3));
 expect(await page.evaluate(()=>window.exp11Snapshot())).toEqual(snapshots[0].snapshot);
 await testInfo.attach('real-render-evidence',{body:JSON.stringify(snapshots,null,2),contentType:'application/json'});
 expect(errors).toEqual([]);
});
for(const [width,lang] of [[320,'ko'],[1280,'en']])test(`Gen3 asynchronous 2D fallback ${width}px ${lang}`,async({page},testInfo)=>{
 const warnings=[];page.on('console',message=>{if(message.type()==='warning')warnings.push(message.text());});
 await page.setViewportSize({width,height:900});await page.emulateMedia({reducedMotion:'reduce'});await instrument(page,false);
 let attempted=false;await page.route('**/assets/three/view.js',route=>{attempted=true;return route.abort();});
 await page.goto(`${base}impedance-robot/?lang=${lang}`);await expect.poll(()=>attempted).toBe(true);
 await expect(page.locator('#start-pause')).toBeEnabled();await expect(page.locator('.three-view')).toHaveCount(0);
 await expect.poll(()=>warnings.some(message=>message.includes('3D view unavailable'))).toBe(true);
 await expect(page.locator('#apparatus')).toBeVisible();
 expect(await page.locator('#apparatus').evaluate(canvas=>Boolean(canvas.getContext('2d')))).toBe(true);
 const box=await page.locator('#apparatus').boundingBox();expect(box.height).toBeGreaterThanOrEqual(400);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 expect(await page.evaluate(()=>window.exp11CanvasLabels)).toContain(lang==='en'?'Red: reference position':'빨강: 목표 위치');
 await page.locator('#start-pause').click();await frames(page,6);await page.locator('#start-pause').click();
 expect((await page.evaluate(()=>window.exp11Snapshot())).state.t).toBeGreaterThan(.4);
 await page.locator('#apparatus').screenshot({path:testInfo.outputPath(`${width}-fallback-${lang}.png`)});
});

test('non-impedance robot views do not request Gen3 geometry',async({page})=>{
 const requests=[];
 page.on('request',r=>{if(/\/(gen3-(?:scene|meshes)\.js|vendor\/kinova\/mesh-data\.js)$/.test(new URL(r.url()).pathname))requests.push(r.url());});
 for(const id of ['robot-arm','parking','path-tracking']){
  await page.goto(`${base}${id}/?lang=en`);
  await expect(page.locator('#apparatus')).toHaveAttribute('data-renderer','three');
 }
 expect(requests).toEqual([]);
 await page.goto(`${base}impedance-robot/?lang=en`);
 await expect(page.locator('#apparatus')).toHaveAttribute('data-renderer','three');
 expect(requests.some(url=>url.endsWith('/vendor/kinova/mesh-data.js'))).toBe(true);
});
