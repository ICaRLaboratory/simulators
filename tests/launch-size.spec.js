import {test,expect} from '@playwright/test';
const root=process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test('launch chips fit their text height',async({page})=>{
 await page.goto(root);
 const buttons=page.locator('.launch');
 await expect(buttons).toHaveCount(17);
 for(const width of [1280,390]){
  await page.setViewportSize({width,height:900});
  for(const button of await buttons.all()){
   const box=await button.boundingBox();
   expect(box.height).toBeLessThanOrEqual(34);
   expect(box.height).toBeGreaterThanOrEqual(28);
  }
 }
});
