import { test, expect } from '@playwright/test';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test('catalog offers exactly three real experiments and searchable source entries', async ({page}) => {
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root);
 await expect(page.locator('.sim-card')).toHaveCount(15);
 await expect(page.locator('a[data-launch]')).toHaveCount(3);
 await page.locator('#search').fill('크루즈');
 await expect(page.locator('.sim-card:visible')).toHaveCount(1);
 await expect(page.locator('a[data-launch]:visible')).toHaveCount(1);
 await page.locator('#search').fill('없는프로젝트xyz');
 await expect(page.locator('.sim-card:visible')).toHaveCount(0);
 expect(errors).toEqual([]);
});
for (const name of ['cruise-control','dc-motor','ball-and-beam']) {
 test(`${name}: start, pause, reset, disturbance and adjustable target`, async ({page}) => {
  const errors=[]; page.on('pageerror',e=>errors.push(e.message));
  await page.goto(root+name+'/');
  await expect(page.locator('#sim-time')).toContainText('0');
  const initial=await page.locator('#sim-time').textContent();
  await page.waitForTimeout(200);
  expect(await page.locator('#sim-time').textContent()).toBe(initial);
  await page.locator('#start-pause').click();
  await page.waitForTimeout(700);
  expect(await page.locator('#sim-time').textContent()).not.toBe(initial);
  await page.locator('#disturb').click();
  await page.locator('#start-pause').click();
  const stopped=await page.locator('#sim-time').textContent();
  await page.waitForTimeout(250);
  expect(await page.locator('#sim-time').textContent()).toBe(stopped);
  await page.locator('#target').focus(); await page.keyboard.press('ArrowRight');
  await page.locator('#reset').click();
  expect(await page.locator('#sim-time').textContent()).toBe(initial);
  expect(errors).toEqual([]);
 });
}
test('mobile catalog and experiments do not overflow viewport',async({page})=>{
 await page.setViewportSize({width:390,height:844});
 for(const path of ['', 'cruise-control/', 'dc-motor/', 'ball-and-beam/']){
  await page.goto(root+path);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('category and ready-only filters compose',async({page})=>{
 await page.goto(root);
 await page.locator('#ready-only').check();
 await expect(page.locator('.sim-card')).toHaveCount(3);
 await page.locator('[data-category="균형·진자"]').click();
 await expect(page.locator('.sim-card')).toHaveCount(1);
 await expect(page.locator('a[data-launch]')).toHaveAttribute('href','ball-and-beam/');
 await page.locator('#ready-only').uncheck();
 await expect(page.locator('.sim-card')).toHaveCount(4);
});
test('rail failure stops beam and reset permits another experiment',async({page})=>{
 await page.goto(root+'ball-and-beam/');
 for(let i=0;i<10;i++)await page.locator('#disturb').click();
 await page.locator('#start-pause').click();
 await expect(page.locator('#start-pause')).toBeDisabled({timeout:5000});
 await expect(page.locator('#simulation-message')).toContainText('레일');
 await page.locator('#reset').click();
 await expect(page.locator('#start-pause')).toBeEnabled();
 await expect(page.locator('#sim-output')).toHaveText('0.000');
});
