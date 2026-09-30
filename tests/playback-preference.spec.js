import {test,expect} from '@playwright/test';
import {catalog} from '../assets/catalog.js';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const local=catalog.filter(item=>item.status==='ready'&&!item.external);
expect(local).toHaveLength(16);
for(const {id} of local){
  test(`${id}: English-first accessible preference remains compact at 320px`,async({page})=>{
    await page.emulateMedia({reducedMotion:'no-preference'});
    await page.setViewportSize({width:320,height:900});
    await page.goto(`${base}${id}/?lang=en`);
    const checkbox=page.getByRole('checkbox',{name:'Smooth playback',exact:true});
    await expect(checkbox).toBeVisible();await expect(checkbox).toBeChecked();
    await expect(page.locator('.action-buttons + .playback-preference')).toHaveCount(1);
    await expect(checkbox).toHaveAccessibleDescription('When enabled, display updates follow your screen’s refresh rate. Simulation speed stays the same.');
    await expect(page.locator('#playback-preference-help')).toBeVisible();
    expect(await page.locator('.playback-preference span, .playback-preference p').evaluateAll(nodes=>nodes.every(n=>parseFloat(getComputedStyle(n).fontSize)>=12))).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await checkbox.focus();await page.keyboard.press('Space');await expect(checkbox).not.toBeChecked();
    await click(page,'[data-lang=ko]');await expect(page.getByRole('checkbox',{name:'부드러운 재생',exact:true})).not.toBeChecked();
    await click(page,'[data-lang=en]');await expect(checkbox).not.toBeChecked();
  });
}
test('dashboard does not get a simulation playback control',async({page})=>{
  await page.goto(base);await expect(page.locator('.sim-card').first()).toBeVisible();
  await expect(page.locator('.playback-preference')).toHaveCount(0);
});

const runtimes=[['cruise-control','app.js','sim'],['inverted-pendulum','pendulum-app.js','simulation'],['rotary-pendulum','experiment-app.js','simulation']];

async function controlledPlayback(page,file,state){
  // Observe real private state/history without replacing any model or frame logic.
  await page.route(`**/assets/${file}`,async route=>{
    const response=await route.fetch();const source=await response.text();
    expect(source).toContain('function frame(');
    await route.fulfill({response,body:source.replace('function frame(',`window.playbackSnapshot=()=>structuredClone({state:${state}.state,history});\nfunction frame(`)});
  });
  await page.addInitScript(()=>{
    let next=0,now=0;const callbacks=new Map();
    window.requestAnimationFrame=callback=>{callbacks.set(++next,callback);return next;};
    window.cancelAnimationFrame=id=>callbacks.delete(id);
    window.advanceFrames=(count)=>{for(let i=0;i<count;i++){now+=1000/60;const current=[...callbacks.values()];callbacks.clear();for(const callback of current)callback(now);}};
    window.resetFrameClock=()=>{now=0;};
    window.playbackDraws=0;
    const clear=CanvasRenderingContext2D.prototype.clearRect;
    CanvasRenderingContext2D.prototype.clearRect=function(...args){if(this.canvas.id==='apparatus')window.playbackDraws++;return clear.apply(this,args);};
  });
}
const click=(page,selector)=>page.locator(selector).evaluate(node=>node.click());
const snapshot=page=>page.evaluate(()=>window.playbackSnapshot());
const plots=page=>page.locator('canvas:not(#apparatus)').evaluateAll(nodes=>nodes.map(n=>n.toDataURL()));
async function frames(page,count){return page.evaluate(n=>{window.playbackDraws=0;window.advanceFrames(n);return window.playbackDraws;},count);}

test('OS changes apply until the first explicit choice; preference is page-local',async({page})=>{
  await page.emulateMedia({reducedMotion:'reduce'});
  await page.goto(`${base}cruise-control/?lang=en`);
  const checkbox=page.getByRole('checkbox',{name:'Smooth playback',exact:true});
  await expect(checkbox).not.toBeChecked();
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(checkbox).toBeChecked();
  await page.emulateMedia({reducedMotion:'reduce'});await expect(checkbox).not.toBeChecked();
  await checkbox.check();
  await page.emulateMedia({reducedMotion:'no-preference'});await page.emulateMedia({reducedMotion:'reduce'});await expect(checkbox).toBeChecked();
  await checkbox.uncheck();
  await page.emulateMedia({reducedMotion:'no-preference'});await expect(checkbox).not.toBeChecked();
  await page.reload();await expect(checkbox).toBeChecked();
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual([]);
});

for(const [id,file,state] of runtimes){
  test(`${id}: explicit smooth playback lifts only the reduced-motion draw cap`,async({page})=>{
    await page.emulateMedia({reducedMotion:'reduce'});await controlledPlayback(page,file,state);
    await page.goto(`${base}${id}/?lang=ko`);await expect(page.locator('#start-pause')).toBeEnabled();
    const checkbox=page.getByRole('checkbox',{name:'부드러운 재생',exact:true});
    await expect(checkbox).toBeVisible();await expect(checkbox).not.toBeChecked();
    await expect(checkbox).toHaveAccessibleDescription('켜면 화면 주사율에 맞춰 표시합니다. 계산 속도는 그대로입니다.');
    await click(page,'#start-pause');
    const reducedDraws=await frames(page,60);expect(reducedDraws).toBeGreaterThan(0);expect(reducedDraws).toBeLessThanOrEqual(10);
    const reduced=await snapshot(page);expect(reduced.state.t).toBeGreaterThan(.9);
    await click(page,'#start-pause');await click(page,'#reset');
    const paused=await snapshot(page),pixels=await plots(page);
    await page.evaluate(()=>{window.playbackDraws=0;});
    await click(page,'.playback-preference input');
    expect(await page.evaluate(()=>window.playbackDraws)).toBe(0);
    expect(await frames(page,60)).toBe(0);expect(await snapshot(page)).toEqual(paused);expect(await plots(page)).toEqual(pixels);
    await page.evaluate(()=>window.resetFrameClock());
    await click(page,'#start-pause');expect(await frames(page,60)).toBe(60);
    const smooth=await snapshot(page);
    expect(smooth).toEqual(reduced);
    await click(page,'#start-pause');
    const before=await snapshot(page);const graph=await plots(page);
    await click(page,'[data-lang=en]');await expect(checkbox).toHaveCount(0);
    const english=page.getByRole('checkbox',{name:'Smooth playback',exact:true});await expect(english).toBeChecked();
    await click(page,'[data-lang=ko]');await expect(checkbox).toBeChecked();
    expect(await snapshot(page)).toEqual(before);expect(await plots(page)).toEqual(graph);
    await click(page,'.playback-preference input');expect(await frames(page,60)).toBe(0);expect(await snapshot(page)).toEqual(before);expect(await plots(page)).toEqual(graph);
    await click(page,'#start-pause');expect(await frames(page,60)).toBeLessThanOrEqual(10);
    await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
    const hidden=await snapshot(page);expect(await frames(page,60)).toBe(0);expect(await snapshot(page)).toEqual(hidden);
    await click(page,'#reset');expect((await snapshot(page)).state.t).toBe(0);await expect(checkbox).not.toBeChecked();
    expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(['icar-lang']);
  });
}
