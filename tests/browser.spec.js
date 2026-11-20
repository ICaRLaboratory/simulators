import { test, expect } from '@playwright/test';
import {catalog} from '../assets/catalog.js';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test('catalog offers all local and Research launches with searchable source entries', async ({page}) => {
 const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.goto(root);
 await expect(page.locator('.sim-card')).toHaveCount(catalog.length);
 await expect(page.locator('a[data-launch]')).toHaveCount(catalog.length);
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
 for(const path of ['', 'cruise-control/', 'dc-motor/', 'ball-and-beam/', 'inverted-pendulum/']){
  await page.goto(root+path);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 }
});

test('Control fundamentals opens the localized PID lab and links to MathWorks documentation',async({page})=>{
 await page.goto(root+'?lang=ko');
 await page.locator('[data-category="제어 기초"]').click();
 await page.locator('#ready-only').check();
 await expect(page.locator('.sim-card')).toHaveCount(5);
 const card=page.locator('[data-id=pid-lti]');
 await expect(card.getByRole('heading')).toHaveText('2차 LTI 시스템의 PID 제어');
 await page.locator('[data-lang="en"]').click();
 await expect(page.locator('[data-category="제어 기초"]')).toContainText('Control fundamentals');
 await expect(card.getByRole('heading')).toHaveText('PID control of a second-order LTI system');
 const official='https://www.mathworks.com/help/control/ug/pid-controller-design-at-the-command-line.html';
 await expect(card.locator('.source-link')).toHaveAttribute('href',official);
 await expect(card.locator('[data-launch]')).toHaveAttribute('href','pid-lti/?lang=en');
 await card.locator('[data-launch]').click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('PID control of a second-order LTI system');
 for(const lang of ['en','ko']){
  await page.locator(`[data-lang="${lang}"]`).click();
  const label=lang==='ko'?/공식 문서: MathWorks/:/Official documentation: MathWorks/;
  await expect(page.getByRole('link',{name:label})).toHaveAttribute('href',official);
 }
});

test('MPC is searchable under Control fundamentals, with localized launch and preview links',async({page})=>{
 await page.goto(root+'?lang=ko');
 await page.locator('[data-category="제어 기초"]').click();
 await page.locator('#ready-only').check();
 for(const [lang,query,title] of [['ko','예측 구간','2차 LTI 시스템의 MPC 제어'],['en','prediction horizon','MPC control of a second-order LTI system']]){
  await page.locator(`[data-lang=${lang}]`).click();
  await page.locator('#search').fill(query);
  const card=page.locator('.sim-card');
  await expect(card).toHaveCount(1);
  await expect(card.getByRole('heading')).toHaveText(title);
  await expect(card.locator('.source-link')).toHaveAttribute('href','https://www.mathworks.com/help/mpc/gs/what-is-mpc.html');
  await expect(card.locator('[data-launch]')).toHaveAttribute('href',`mpc-lti/?lang=${lang}`);
  await expect(card.locator('.card-preview')).toHaveAttribute('src',`assets/previews/mpc-lti-${lang}.png`);
 }
 await page.locator('.sim-card [data-launch]').click();
 await expect(page.getByRole('heading',{level:1})).toHaveText('MPC control of a second-order LTI system');
});

test('category and ready-only filters compose',async({page})=>{
 await page.goto(root);
 await page.locator('#ready-only').check();
 await expect(page.locator('.sim-card')).toHaveCount(catalog.length);
 await page.locator('[data-category="균형·진자"]').click();
 await expect(page.locator('.sim-card')).toHaveCount(4);
 expect(await page.locator('a[data-launch]').evaluateAll(links=>links.map(a=>a.getAttribute('href')))).toEqual(['ball-and-beam/?lang=ko','inverted-pendulum/?lang=ko','rotary-pendulum/?lang=ko','ball-and-plate/?lang=ko']);
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
