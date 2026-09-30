import {test,expect} from '@playwright/test';
const ids=['rotary-pendulum','ball-and-plate','robot-arm','parking','heat-exchanger','drone','impedance-robot','path-tracking','suspension','cstr','aircraft-pitch'];
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const pixels=page=>page.locator('.response').evaluateAll(nodes=>nodes.map(n=>n.toDataURL()));
const ranges=page=>page.locator('input[type=range]').evaluateAll(nodes=>nodes.map(n=>[n.id,n.value]));
async function englishText(page){return page.evaluate(()=>{const walker=document.createTreeWalker(document.documentElement,NodeFilter.SHOW_TEXT);const found=[];while(walker.nextNode()){const n=walker.currentNode;if(n.parentElement.closest('script,style,noscript,.language-switch'))continue;if(/[가-힣]/.test(n.nodeValue))found.push(n.nodeValue);}for(const n of document.querySelectorAll('[aria-label],[title]'))for(const a of ['aria-label','title'])if(/[가-힣]/.test(n.getAttribute(a)||''))found.push(n.getAttribute(a));return found;});}
for(const id of ids){
 test(`${id}: static page and paused runtime`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const response=await page.goto(`${base}${id}/`);expect(response.status()).toBe(200);
  await expect(page.locator('body')).toHaveAttribute('data-experiment',id);
  await expect(page.locator('#start-pause')).toBeEnabled();
  await expect(page.locator('#sim-time')).toHaveText('0.00');await page.waitForTimeout(80);
  await expect(page.locator('#sim-time')).toHaveText('0.00');
  await expect(page.locator('details')).not.toHaveAttribute('open');
  expect(await page.locator('.loop-equation').count()).toBeGreaterThan(0);
  expect(errors).toEqual([]);
 });
 test(`${id}: run, pause, impulse, settings, reset and reversible locale`,async({page})=>{
  await page.goto(`${base}${id}/?lang=en`);await expect(page.locator('#start-pause')).toBeEnabled();
  const initial=await ranges(page);expect(initial.length).toBeGreaterThan(0);
  await page.locator('input[type=range]').first().evaluate(n=>{n.value=String(Math.min(Number(n.max),Number(n.value)+Number(n.step)));n.dispatchEvent(new Event('input',{bubbles:true}));});
  const changed=await ranges(page);expect(changed).not.toEqual(initial);
  await page.locator('#start-pause').click();await expect.poll(()=>page.locator('#sim-time').textContent()).not.toBe('0.00');
  await page.locator('[data-lang=ko]').click();await expect(page.locator('#run-status')).toHaveText('실행 중');
  await page.locator('#start-pause').click();const time=await page.locator('#sim-time').textContent();
  const before=await pixels(page);await page.locator('summary').click();await page.locator('[data-lang=en]').click();await page.waitForTimeout(80);
  await expect(page.locator('#sim-time')).toHaveText(time);expect(await pixels(page)).toEqual(before);expect(await ranges(page)).toEqual(changed);
  await expect(page.locator('details')).toHaveAttribute('open','');expect(await englishText(page)).toEqual([]);
  await page.locator('[data-lang=ko]').click();await expect(page.locator('h1')).toContainText(/[가-힣]/);await page.locator('[data-lang=en]').click();expect(await englishText(page)).toEqual([]);
  await page.locator('#disturb').click();await expect(page.locator('#simulation-message')).not.toContainText('Press Start');
  await page.locator('#reset').click();await expect(page.locator('#sim-time')).toHaveText('0.00');await expect(page.locator('#run-status')).toHaveText('Paused');expect(await ranges(page)).toEqual(changed);
  // Reset clears historical traces and is deterministic, without resetting settings.
  const resetPixels=await pixels(page);await page.locator('#start-pause').click();await page.waitForTimeout(100);await page.locator('#reset').click();expect(await pixels(page)).toEqual(resetPixels);
  expect(await page.evaluate(()=>Object.keys(localStorage))).toEqual(['icar-lang']);
 });
 test(`${id}: 320, 390 and 1280px layout and diagram bounds`,async({page})=>{
  await page.goto(`${base}${id}/?lang=en`);await expect(page.locator('#start-pause')).toBeEnabled();
  for(const width of [320,390,1280]){
   await page.setViewportSize({width,height:900});await page.waitForTimeout(40);
   expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await page.locator('.parameter label').evaluateAll(nodes=>nodes.every(n=>{const a=n.firstElementChild.getBoundingClientRect(),b=n.lastElementChild.getBoundingClientRect();return a.right<=b.left+1||a.bottom<=b.top+1;}))).toBe(true);
  }
  for(const lang of ['ko','en']){
   await page.locator(`[data-lang=${lang}]`).click();
   expect(await page.locator('.loop-diagram').evaluate(svg=>[...svg.querySelectorAll('text')].every(n=>{const b=n.getBBox();const x=Number(n.getAttribute('x'));const box=x===115?[15,215]:x===405?[260,550]:x===710?[580,840]:x===1030?[880,1180]:[420,1180];return b.x>=box[0]&&b.x+b.width<=box[1]&&b.y>=0&&b.y+b.height<=330;}))).toBe(true);
  }
  await page.setViewportSize({width:320,height:900});const region=page.locator('.loop-viewport');await region.focus();await page.keyboard.press('ArrowRight');await expect.poll(()=>region.evaluate(n=>n.scrollLeft)).toBeGreaterThan(0);
 });
 test(`${id}: disturbance changes physical response and legend matches model series`,async({page})=>{
  await controlledFrames(page);await page.goto(`${base}${id}/?lang=en`);await expect(page.locator('#start-pause')).toBeEnabled();
  const legends=await page.evaluate(async()=>{const {definition}=await import(`../assets/models/${document.body.dataset.experiment}.js`);return definition.plots.flatMap(p=>p.series.map(s=>({label:s.label[1],dash:Boolean(s.dash),color:s.color})));});
  const actual=await page.locator('.legend span').evaluateAll(ns=>ns.map(n=>({label:n.textContent,dash:n.classList.contains('target-line'),color:n.style.getPropertyValue('--series')})));expect(actual).toEqual(legends);
  await page.locator('#start-pause').click();await page.evaluate(()=>window.advanceFrames(20));await page.locator('#start-pause').click();const baseline=await pixels(page);
  await page.locator('#reset').click();await page.locator('#disturb').click();await page.locator('#start-pause').click();await page.evaluate(()=>window.advanceFrames(20));await page.locator('#start-pause').click();expect(await pixels(page)).not.toEqual(baseline);
 });
 test(`${id}: static Korean equations and project without JavaScript`,async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();await page.goto(`${base}${id}/`);
  await expect(page.locator('h1')).toContainText(/[가-힣]/);await expect(page.locator('#start-pause')).toBeDisabled();await page.locator('summary').click();await expect(page.locator('.loop-equation').first()).toBeVisible();await expect(page.getByRole('link',{name:'관련 MATLAB 프로젝트 ↗'})).toBeVisible();await context.close();
 });
}
async function controlledFrames(page){
 await page.addInitScript(()=>{let callbacks=[],now=0;window.requestAnimationFrame=callback=>{callbacks.push(callback);return callbacks.length;};window.advanceFrames=(count,step=20)=>{for(let i=0;i<count;i++){now+=step;const current=callbacks;callbacks=[];for(const callback of current)callback(now);}};});
}
test('real parking completion pauses and reset clears completion',async({page})=>{
 await controlledFrames(page);await page.goto(`${base}parking/?lang=en`);await expect(page.locator('#start-pause')).toBeEnabled();await page.locator('#start-pause').click();await page.evaluate(()=>window.advanceFrames(1200));
 await expect(page.locator('#run-status')).toHaveText('Complete');await expect(page.locator('#simulation-message')).toContainText('Goal reached');await expect(page.locator('#start-pause')).toBeDisabled();await expect(page.locator('#disturb')).toBeDisabled();
 const time=await page.locator('#sim-time').textContent();await page.evaluate(()=>window.advanceFrames(30));await expect(page.locator('#sim-time')).toHaveText(time);await page.locator('[data-lang=ko]').click();await expect(page.locator('#run-status')).toHaveText('완료');await page.locator('#reset').click();await expect(page.locator('#start-pause')).toBeEnabled();await expect(page.locator('#sim-time')).toHaveText('0.00');
});
test('real rotary balance failure latches with localized reason',async({page})=>{
 await controlledFrames(page);await page.goto(`${base}rotary-pendulum/?lang=en`);await expect(page.locator('#start-pause')).toBeEnabled();
 await page.locator('input[type=range]').evaluateAll(nodes=>{for(const n of nodes){n.value='0';n.dispatchEvent(new Event('input',{bubbles:true}));}});await page.locator('#start-pause').click();await page.evaluate(()=>window.advanceFrames(300));
 await expect(page.locator('#start-pause')).toBeDisabled();await expect(page.locator('#disturb')).toBeDisabled();await expect(page.locator('#simulation-message')).not.toHaveText('Experiment stopped. Reset to try again.');
 const time=await page.locator('#sim-time').textContent();await page.locator('[data-lang=ko]').click();await expect(page.locator('#simulation-message')).toContainText(/[가-힣]/);await page.evaluate(()=>window.advanceFrames(30));await expect(page.locator('#sim-time')).toHaveText(time);await page.locator('#reset').click();await expect(page.locator('#start-pause')).toBeEnabled();
});
test('fixed-step runtime bounds catch-up after a long animation gap',async({page})=>{
 await controlledFrames(page);await page.goto(`${base}heat-exchanger/`);await expect(page.locator('#start-pause')).toBeEnabled();await page.locator('#start-pause').click();await page.evaluate(()=>{window.advanceFrames(1);window.advanceFrames(1,10000);});expect(Number(await page.locator('#sim-time').textContent())).toBeLessThanOrEqual(.1);
});
test('module fetch failure is localized and does not pretend to run',async({page})=>{
 await page.route('**/assets/models/drone.js',route=>route.abort());await page.setViewportSize({width:320,height:844});await page.goto(`${base}drone/?lang=en`);
 await expect(page.locator('#simulation-message')).toContainText('Model unavailable');expect(await englishText(page)).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await expect(page.locator('#start-pause')).toBeDisabled();await page.locator('[data-lang=ko]').click();await expect(page.locator('#simulation-message')).toContainText('불러올 수 없습니다');
});
test('query overrides stored language; blocked storage and reduced motion work; hiding pauses',async({page})=>{
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});await page.emulateMedia({reducedMotion:'reduce'});await page.goto(`${base}heat-exchanger/`);
 await expect(page.locator('html')).toHaveAttribute('lang','ko');await page.locator('#start-pause').click();await expect.poll(()=>page.locator('#sim-time').textContent()).not.toBe('0.00');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});await expect(page.locator('#run-status')).toHaveText('일시정지');
 const time=await page.locator('#sim-time').textContent();await page.waitForTimeout(120);await expect(page.locator('#sim-time')).toHaveText(time);await page.locator('[data-lang=en]').click();await expect(page.locator('#simulation-message')).toContainText('tab was hidden');
});
test('explicit Korean query wins over persisted English',async({page})=>{await page.addInitScript(()=>localStorage.setItem('icar-lang','en'));await page.goto(`${base}drone/?lang=ko`);await expect(page.locator('html')).toHaveAttribute('lang','ko');await expect(page.locator('#start-pause')).toBeEnabled();});
