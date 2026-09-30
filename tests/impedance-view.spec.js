import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
for(const width of [320,1280])test(`articulated robot has room for visible joint motion at ${width}px`,async({page})=>{
 await page.setViewportSize({width,height:900});await page.goto(`${base}impedance-robot/?lang=ko`);await expect(page.locator('#start-pause')).toBeEnabled();
 const box=await page.locator('#apparatus').boundingBox();expect(box.height).toBeGreaterThanOrEqual(400);
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
