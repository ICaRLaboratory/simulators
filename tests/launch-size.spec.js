import {test,expect} from '@playwright/test';
import {catalog} from '../assets/catalog.js';
const root=process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test('Korean launch chips are compact; English keeps its width and both fit on one line',async({page})=>{
 await page.goto(`${root}?lang=ko`);
 const buttons=page.locator('.launch');
 await expect(buttons).toHaveCount(catalog.length);
 for(const width of [1280,390,320]){
  await page.setViewportSize({width,height:900});
  for(const lang of ['ko','en']){
   await page.locator(`[data-lang=${lang}]`).click();
   await page.evaluate(()=>document.fonts.ready);
   const boxes=await buttons.evaluateAll(els=>els.map(el=>{const {width,height}=el.getBoundingClientRect();return [width,height];}));
   expect(boxes).toEqual(catalog.map(()=>[lang==='ko'?120:216,30]));
  }
 }
});
