import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const ids=['cruise-control','dc-motor','ball-and-beam','inverted-pendulum','rotary-pendulum','ball-and-plate','robot-arm','parking','heat-exchanger','drone','impedance-robot','path-tracking','suspension','cstr','aircraft-pitch'];
for(const id of ids){
 test(`${id}: disturbance help stays visible and bilingual on mobile and desktop`,async({page})=>{
  await page.goto(`${base}${id}/?lang=en`);await expect(page.locator('#start-pause')).toBeEnabled();
  const help=page.locator('#disturbance-help');
  await expect(page.locator('#disturb')).toHaveAttribute('aria-describedby','disturbance-help');
  await expect(help).toContainText(/disturbance|external/i);const english=await help.textContent();
  expect(english).not.toMatch(/[가-힣]/);
  for(const width of [320,1280]){
   await page.setViewportSize({width,height:900});
   for(const lang of ['ko','en']){
    await page.locator(`[data-lang=${lang}]`).click();await expect(help).toBeVisible();
    expect(await help.evaluate(n=>!n.closest('details'))).toBe(true);
    const copy=await help.textContent();if(lang==='ko')expect(copy).toMatch(/외란|외부/);else expect(copy).toBe(english);
    expect(await help.evaluate(n=>{const r=n.getBoundingClientRect();return r.left>=0&&r.right<=innerWidth&&n.scrollWidth<=n.clientWidth;})).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   }
  }
  await page.locator('#disturb').click();await expect(help).toHaveText(english);
  await page.locator('#reset').click();await expect(help).toHaveText(english);
 });
}
test('CSTR jacket definition is visible without opening model details',async({page})=>{
 await page.goto(`${base}cstr/?lang=ko`);await expect(page.locator('#start-pause')).toBeEnabled();
 const help=page.locator('#concept-help');await expect(help).toBeVisible();await expect(help).toContainText('재킷');await expect(help).toContainText('냉각수');
 expect(await help.evaluate(n=>!n.closest('details'))).toBe(true);
 await page.locator('[data-lang=en]').click();await expect(help).toContainText(/jacket/i);expect(await help.textContent()).not.toMatch(/[가-힣]/);
 await page.setViewportSize({width:320,height:900});await expect(help).toBeVisible();
});
