import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
for(const id of ['pid-lti','mpc-lti'])test(`${id}: language choice is available only after the lab can handle it`,async({page})=>{
 let release;const gate=new Promise(resolve=>{release=resolve;});
 await page.route(`**/assets/${id}.js`,async route=>{await gate;await route.continue();});
 await page.goto(`${base}${id}/?lang=ko`,{waitUntil:'commit'});const en=page.locator('[data-lang=en]');
 try{await expect(en).toBeDisabled({timeout:1500});}finally{release();}
 await en.click();await expect(page.locator('html')).toHaveAttribute('lang','en');
});
const set=(page,id,val)=>page.locator('#plant-'+id).evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},String(val));
const curve=(p,key,id)=>p.locator(`#${id}-output-plot [data-series=${key}]`).getAttribute('d');
test('tuning all three plant parameters changes PID and the MPC lab carries the same plant both ways',async({page})=>{
 await page.goto(base+'pid-lti/?lang=ko');await expect(page.locator('#plant-wn')).toBeVisible({timeout:2000});
 const baseY=await curve(page,'y','pid');await page.locator('#pin-response').click();await set(page,'wn',2);const fast=await curve(page,'y','pid');expect(fast===baseY).toBe(false);
 await set(page,'zeta',1);expect(await curve(page,'y','pid')===fast).toBe(false);await set(page,'gain',.5);await expect(page.locator('#steady-error')).toHaveText('0.333');
 await expect(page.locator('#pin-info')).toContainText('K=1');const frac=page.locator('#plant-equation mfrac');await expect(frac.locator(':scope > :first-child')).toHaveText('2');await expect(frac.locator(':scope > :last-child')).toHaveText('s2+4s+4');
 await page.locator('#mpc-lab-link').click();await expect(page.locator('#plant-wn')).toHaveValue('2');await expect(page.locator('#plant-zeta')).toHaveValue('1');await expect(page.locator('#plant-gain')).toHaveValue('0.5');
 await page.locator('[data-lang=en]').click();await page.locator('#mpc-limit').focus();await page.keyboard.press('Home');await expect(page.locator('#mpc-limit-hint')).toContainText('cannot hold');
 const m=await curve(page,'y','mpc'),p=await curve(page,'prediction','mpc');await set(page,'gain',2);await expect(page.locator('#mpc-limit-hint')).toContainText('within');
 expect(await curve(page,'y','mpc')).not.toBe(m);expect(await curve(page,'prediction','mpc')).not.toBe(p);
 await page.reload();await expect(page.locator('#plant-gain')).toHaveValue('2');await page.locator('#pid-lab-link').click();await expect(page.locator('#steady-error')).toHaveText('0.111');
 await page.locator('#pid-reset').click();await expect(page.locator('#plant-wn')).toHaveValue('1');await expect(page.locator('#plant-zeta')).toHaveValue('0.5');await expect(page.locator('#plant-gain')).toHaveValue('1');await expect(page.locator('#steady-error')).toHaveText('0.200');
});
