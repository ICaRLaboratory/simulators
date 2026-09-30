import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
for(const [id,key,value] of [['rotary-pendulum','kick','0.1'],['ball-and-plate','impulse','0.3'],['suspension','height','0.08']]){
 test(`${id}: disturbance setting and action share one accessible group`,async({page})=>{
  await page.goto(`${base}${id}/?lang=ko`);await expect(page.locator('#disturb')).toBeEnabled();
  const group=page.locator('fieldset.disturbance-controls');await expect(group).toBeVisible();
  await expect(group.locator(`#${key}`)).toHaveCount(1);await expect(group.locator('#disturb')).toHaveCount(1);await expect(group.locator('#disturbance-help')).toBeVisible();
  await expect(page.locator(`#parameter-controls #${key}`)).toHaveCount(0);
  const initial=await page.locator('.metrics output').allTextContents();
  await group.locator(`#${key}`).fill(value);await group.locator(`#${key}`).dispatchEvent('input');
  expect(await page.locator('.metrics output').allTextContents()).toEqual(initial);
  await group.locator('#disturb').click();
  if(id==='rotary-pendulum')await expect(page.locator('#metric-theta')).toHaveText('0.140');
  if(id==='ball-and-plate'){await expect(page.locator('#metric-vx')).toHaveText('0.300');await expect(page.locator('#metric-vy')).toHaveText('-0.300');}
  for(const width of [320,1280]){await page.setViewportSize({width,height:900});for(const lang of ['en','ko']){await page.locator(`[data-lang=${lang}]`).click();await expect(group.locator('legend')).toHaveText(lang==='en'?'Disturbance':'외란');await expect(group.locator(`#${key}`)).toHaveValue(value);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}}
  await page.locator('#reset').click();await expect(group.locator(`#${key}`)).toHaveValue(value);
 });
}
