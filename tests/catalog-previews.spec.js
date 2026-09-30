import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
test('every catalog experiment has its own real, loaded localized preview',async({page})=>{
 await page.goto(base+'?lang=ko');await expect(page.locator('.sim-card')).toHaveCount(17);
 await expect(page.locator('.card-preview')).toHaveCount(17);
 for(const lang of ['ko','en']){
  await page.locator(`[data-lang=${lang}]`).click();
  const images=page.locator('.card-preview');
  for(const image of await images.all()){await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);}
  const sources=await images.evaluateAll(ns=>ns.map(n=>n.getAttribute('src')));
  expect(new Set(sources).size).toBe(17);expect(sources.every(s=>s.endsWith(`-${lang}.png`))).toBe(true);
  for(const width of [320,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await page.locator('.card-visual').evaluateAll(ns=>ns.every(n=>{const img=n.querySelector('img').getBoundingClientRect();return img.bottom<=n.getBoundingClientRect().bottom+1&&[...n.querySelectorAll('.card-number,.card-status')].every(b=>b.getBoundingClientRect().bottom<=img.top+1);}))).toBe(true);
  }
 }
});
