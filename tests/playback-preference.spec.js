import {test,expect} from '@playwright/test';
import {catalog} from '../assets/catalog.js';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const local=catalog.filter(item=>item.status==='ready'&&!item.external);
expect(local).toHaveLength(16);
const click=(page,selector)=>page.locator(selector).evaluate(node=>node.click());
const snapshot=page=>page.evaluate(()=>window.playbackSnapshot());
const plots=page=>page.locator('canvas:not(#apparatus)').evaluateAll(nodes=>nodes.map(n=>n.toDataURL()));
const preference='.playback-preference, #playback-preference-help, input[type=checkbox]';
for(const {id} of local){
  test(`${id}: Start is the only playback intent, without checkbox or help`,async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});
    await page.setViewportSize({width:320,height:900});
    await page.goto(`${base}${id}/?lang=en`);
    await expect(page.locator('#start-pause')).toBeEnabled();
    for(const lang of ['en','ko']){
      await click(page,`[data-lang=${lang}]`);
      await expect(page.locator(preference)).toHaveCount(0);
      await expect(page.getByText(/Smooth playback|부드러운 재생|display updates follow|켜면 화면 주사율/)).toHaveCount(0);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    }
  });
}
test('dashboard does not get a simulation playback control',async({page})=>{
  await page.goto(base);await expect(page.locator('.sim-card').first()).toBeVisible();
  await expect(page.locator('.playback-preference')).toHaveCount(0);
});
const runtimes=[['cruise-control','app.js','sim'],['inverted-pendulum','pendulum-app.js','simulation'],['rotary-pendulum','experiment-app.js','simulation']];
async function controlledPlayback(page,file,state){
  // Observe real private state/history without replacing model or frame logic.
  await page.route(`**/assets/${file}`,async route=>{
    const response=await route.fetch();const source=await response.text();
    expect(source).toContain('function frame(');
    await route.fulfill({response,body:source.replace('function frame(',`window.playbackSnapshot=()=>structuredClone({state:${state}.state,history});\nfunction frame(`)});
  });
  await page.addInitScript(()=>{
    let next=0,now=0;const callbacks=new Map();
    window.requestAnimationFrame=callback=>{callbacks.set(++next,callback);return next;};
    window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.advanceFrames=(count,interval=1000/60)=>{for(let i=0;i<count;i++){now+=interval;const current=[...callbacks.values()];callbacks.clear();for(const callback of current)callback(now);}};
    window.resetFrameClock=()=>{now=0;};
    window.playbackDraws=0;
    const clear=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='apparatus')window.playbackDraws++;return clear.apply(this,args);};
  });
}
async function frames(page,count,interval=1000/60){return page.evaluate(({count,interval})=>{window.playbackDraws=0;window.advanceFrames(count,interval);return window.playbackDraws;},{count,interval});}
async function hidden(page,value){await page.evaluate(value=>{Object.defineProperty(document,'hidden',{configurable:true,value});document.dispatchEvent(new Event('visibilitychange'));},value);}
for(const [id,file,state] of runtimes){
  test(`${id}: Start/resume draws every RAF in both OS modes with identical physics`,async({page})=>{
    await controlledPlayback(page,file,state);
    await page.goto(`${base}${id}/?lang=ko`);await expect(page.locator('#start-pause')).toBeEnabled();
    let baseline;
    for(const motion of ['no-preference','reduce']){
      await page.emulateMedia({reducedMotion:motion});
      await click(page,'#reset');await page.evaluate(()=>window.resetFrameClock());
      const initial=await snapshot(page);
      expect(initial.state.t).toBe(0);expect(await frames(page,60)).toBe(0);expect(await snapshot(page)).toEqual(initial);
      await page.evaluate(()=>window.resetFrameClock());
      await click(page,'#start-pause');expect(await frames(page,120,1000/120)).toBe(120);
      const started=await snapshot(page);expect(started.state.t).toBeGreaterThan(.9);
      await click(page,'#start-pause');
      const paused=await snapshot(page),pixels=await plots(page);
      expect(await frames(page,60)).toBe(0);expect(await snapshot(page)).toEqual(paused);
      await click(page,'[data-lang=en]');await click(page,'[data-lang=ko]');
      expect(await snapshot(page)).toEqual(paused);expect(await plots(page)).toEqual(pixels);
      await click(page,'#start-pause');expect(await frames(page,60)).toBe(60);
      const resumed=await snapshot(page);
      // Live OS changes must not reintroduce a display cap or change state.
      await page.emulateMedia({reducedMotion:motion==='reduce'?'no-preference':'reduce'});
      expect(await snapshot(page)).toEqual(resumed);
      expect(await frames(page,60)).toBe(60);
      const switched=await snapshot(page);
      // A long delayed RAF still integrates at most the existing 0.1s budget.
      expect(await frames(page,1,5000)).toBe(1);
      const delayed=await snapshot(page);
      expect(delayed.state.t-switched.state.t).toBeGreaterThan(0);
      expect(delayed.state.t-switched.state.t).toBeLessThanOrEqual(.100001);
      const trace={started,resumed,switched,delayed};
      if(baseline)expect(trace).toEqual(baseline);else baseline=trace;
      await hidden(page,true);const stopped=await snapshot(page);
      expect(await frames(page,60)).toBe(0);expect(await snapshot(page)).toEqual(stopped);
      await hidden(page,false);expect(await frames(page,60)).toBe(0);expect(await snapshot(page)).toEqual(stopped);
      await click(page,'#start-pause');expect(await frames(page,60)).toBe(60);
      await click(page,'#reset');const reset=await snapshot(page);
      expect(reset).toEqual(initial);expect(await frames(page,60)).toBe(0);expect(await snapshot(page)).toEqual(reset);
    }
    expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(['icar-lang']);
  });
}
