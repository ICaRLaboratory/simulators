import {test,expect} from '@playwright/test';
const root=process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test('lab theme and concise footer apply across simulator pages',async({page})=>{
 for(const route of ['', 'cruise-control/','dc-motor/','ball-and-beam/']){
  await page.goto(root+route);
  await expect(page.locator('body')).toHaveCSS('background-color','rgb(255, 255, 255)');
  await expect(page.locator('header')).toHaveCSS('background-color','rgb(10, 10, 10)');
  await expect(page.locator('footer')).toHaveCSS('background-color','rgb(10, 10, 10)');
  await expect(page.locator('body')).toHaveCSS('font-family',/Pretendard/);
  await expect(page.locator('footer')).not.toContainText('데이터 저장 없음');
  await expect(page.locator('body')).not.toContainText('ICaR');
 }
});
