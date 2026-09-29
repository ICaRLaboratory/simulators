import { chromium } from '@playwright/test';
import { mkdir } from 'node:fs/promises';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const out = process.env.SIM_SHOTS || '/tmp/icar-simulator-review';
await mkdir(out, {recursive:true});
const browser = await chromium.launch();
const page = await browser.newPage({viewport:{width:1440,height:1000},deviceScaleFactor:1});
for (const [name,path] of [['dashboard',''],['cruise','cruise-control/'],['motor','dc-motor/'],['beam','ball-and-beam/']]) {
 await page.goto(root+path); await page.waitForLoadState('networkidle');
 if(path){await page.locator('#start-pause').click();await page.waitForTimeout(1800);await page.locator('#start-pause').click();}
 await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
}
await page.setViewportSize({width:390,height:844});
for (const [name,path] of [['dashboard-mobile',''],['beam-mobile','ball-and-beam/']]) {
 await page.goto(root+path); await page.waitForLoadState('networkidle');
 await page.screenshot({path:`${out}/${name}.png`,fullPage:true});
}
await browser.close();
console.log(out);
