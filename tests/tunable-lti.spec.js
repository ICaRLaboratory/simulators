import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const set=(page,id,val)=>page.locator('#plant-'+id).evaluate((n,v)=>{n.value=v;n.dispatchEvent(new Event('input',{bubbles:true}));},String(val));
const curve=(p,key,id)=>p.locator(`#${id}-output-plot [data-series=${key}]`).getAttribute('d');
test('tuning all three plant parameters changes PID and the MPC comparison carries the same plant both ways',async({page})=>{
 await page.goto(base+'pid-lti/?lang=ko');await expect(page.locator('#plant-wn')).toBeVisible({timeout:2000});
 const baseY=await curve(page,'y','pid');await page.locator('#pin-response').click();await set(page,'wn',2);const fast=await curve(page,'y','pid');expect(fast===baseY).toBe(false);
 await set(page,'zeta',1);expect(await curve(page,'y','pid')===fast).toBe(false);await set(page,'gain',.5);await expect(page.locator('#steady-error')).toHaveText('0.333');
 await expect(page.locator('#pin-info')).toContainText('K=1');await expect(page.locator('#plant-equation')).toContainText('2 / (s² + 4s + 4)');
 await page.locator('#mpc-lab-link').click();await expect(page.locator('#plant-wn')).toHaveValue('2');await expect(page.locator('#plant-zeta')).toHaveValue('1');await expect(page.locator('#plant-gain')).toHaveValue('0.5');
 await page.locator('[data-lang=en]').click();await page.locator('#mpc-limit').focus();await page.keyboard.press('Home');await expect(page.locator('#mpc-limit-hint')).toContainText('cannot hold');
 const m=await curve(page,'y','mpc'),p=await curve(page,'pid','mpc');await set(page,'gain',2);await expect(page.locator('#mpc-limit-hint')).toContainText('within');
 expect(await curve(page,'y','mpc')===m).toBe(false);expect(await curve(page,'pid','mpc')===p).toBe(false);
 await page.reload();await expect(page.locator('#plant-gain')).toHaveValue('2');await page.locator('#pid-lab-link').click();await expect(page.locator('#steady-error')).toHaveText('0.111');
 await page.locator('#pid-reset').click();await expect(page.locator('#plant-wn')).toHaveValue('1');await expect(page.locator('#plant-zeta')).toHaveValue('0.5');await expect(page.locator('#plant-gain')).toHaveValue('1');await expect(page.locator('#steady-error')).toHaveText('0.200');
});
