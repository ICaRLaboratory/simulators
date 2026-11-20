import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const path=(page,key,plot='output')=>page.locator(`#mpc-${plot}-plot path[data-series="${key}"]`).getAttribute('d');
const set=(page,id,value)=>page.locator(`#mpc-${id}`).evaluate((e,v)=>{e.value=v;e.dispatchEvent(new Event('input',{bubbles:true}));},String(value));

test('MPC settings change the closed loop; the time cursor inspects a plan without changing the run',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  expect((await page.goto(`${base}mpc-lti/?lang=ko`)).status()).toBe(200);
  const y=await path(page,'y');
  const pidOverlay=page.locator('#compare-pid, [data-pid], path[data-series="pid"]');
  await expect(pidOverlay).toHaveCount(0);
  await expect(page.locator('#mpc-input-plot path[data-series="u"]')).toBeVisible();
  const pred=await path(page,'prediction');await page.locator('#mpc-time').focus();await page.keyboard.press('ArrowRight');
  expect(await path(page,'prediction')).not.toBe(pred);expect(await path(page,'y')).toBe(y);
  await set(page,'horizon',4);const short=await path(page,'y');expect(short).not.toBe(y);
  await set(page,'weight',2);expect(await path(page,'y')).not.toBe(short);
  await page.locator('#mpc-reset').click();await expect(pidOverlay).toHaveCount(0);expect(await path(page,'y')).toBe(y);expect(await path(page,'prediction')).toBe(pred);expect(errors).toEqual([]);
});

test('MPC obeys the input limit and keeps the inspected plan across language changes on mobile',async({page})=>{
  await page.setViewportSize({width:320,height:812});await page.goto(`${base}mpc-lti/?lang=en`);
  await set(page,'limit',.5);await set(page,'time',99);await set(page,'horizon',30);
  await expect(page.locator('#mpc-peak-u')).toHaveText('0.50');expect(Number(await page.locator('#mpc-final-y').textContent())).toBeLessThan(.51);
  await expect(page.locator('#mpc-limit-hint')).toContainText('cannot hold');
  const plan=await path(page,'prediction','input');await page.locator('[data-lang=ko]').click();
  await expect(page.locator('#mpc-time-value')).toHaveText('19.8 s');expect(await path(page,'prediction','input')).toBe(plan);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  for(const svg of await page.locator('svg[role=img]').all())expect(await svg.evaluate(el=>[...el.querySelectorAll('text')].every(n=>{const a=n.getBoundingClientRect(),b=el.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1&&a.bottom<=b.bottom+1}))).toBe(true);
  await expect(page.locator('#pid-lab-link')).toHaveAttribute('href','../pid-lti/?lang=ko');
  await page.locator('#pid-lab-link').click();await page.locator('[data-lang=en]').click();
  await expect(page.locator('#mpc-lab-link')).toHaveAttribute('href','../mpc-lti/?lang=en');
  await page.locator('#mpc-lab-link').click();await expect(page.locator('h1')).toHaveText('MPC control of a second-order LTI system');
});
