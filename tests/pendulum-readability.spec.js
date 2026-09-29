import {test,expect} from '@playwright/test';
const root=process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test('pendulum chart ticks retain readable 12px theme type at mobile width',async({page})=>{
 await page.setViewportSize({width:320,height:844});
 await page.goto(root+'inverted-pendulum/?lang=en');
 for(const id of ['response','angle-response']) {
  const typography=await page.locator('#'+id).evaluate(canvas=>{
   const ctx=canvas.getContext('2d');
   return {font:ctx.font,widest:Math.max(...['-2.00','-1.05','0.00','2.00'].map(label=>ctx.measureText(label).width))};
  });
  expect(typography.font).toMatch(/12px.*Pretendard/);
  expect(typography.widest).toBeLessThan(38);
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
