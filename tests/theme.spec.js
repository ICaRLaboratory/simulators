import { test, expect } from '@playwright/test';
const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';

test('schematic surfaces use neutral paper while signal colors remain distinct', async ({ page }) => {
  await page.goto(root);
  const image = page.locator('[data-id="cruise-control"] .card-preview');
  await image.scrollIntoViewIfNeeded();
  await expect.poll(()=>image.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);
  const colors=await image.evaluate(n=>{
    const canvas=document.createElement('canvas');canvas.width=n.naturalWidth;canvas.height=n.naturalHeight;
    const ctx=canvas.getContext('2d');ctx.drawImage(n,0,0);const {data}=ctx.getImageData(0,0,canvas.width,canvas.height);
    let neutral=0,teal=0,orange=0;
    for(let i=0;i<data.length;i+=4){const [r,g,b]=data.slice(i,i+3);if(Math.max(r,g,b)-Math.min(r,g,b)<15)neutral++;if(g>r+25&&b>r+15)teal++;if(r>g+30&&g>b+20)orange++;}
    return {neutral:neutral/(data.length/4),teal,orange};
  });
  expect(colors.neutral).toBeGreaterThan(.6);expect(colors.teal).toBeGreaterThan(0);expect(colors.orange).toBeGreaterThan(0);
});

import {catalog} from '../assets/catalog.js';
for (const path of ['',...catalog.filter(item=>!item.external).map(item=>`${item.id}/`)]) {
  test(`${path || 'catalog'} shares the homepage visual language`, async ({ page }) => {
    await page.goto(root + path);
    await expect(page.locator('body')).toHaveCSS('background-color', 'rgb(255, 255, 255)');
    await expect(page.locator('body')).toHaveCSS('color', 'rgb(10, 10, 10)');
    await expect(page.locator('body')).toHaveCSS('font-family', /Pretendard Variable/);
    for (const band of ['.site-header', '.site-footer']) {
      await expect(page.locator(band)).toHaveCSS('background-color', 'rgb(10, 10, 10)');
      await expect(page.locator(band)).toHaveCSS('color', 'rgb(250, 250, 250)');
    }
    await expect(page.locator(path ? '.panel' : '.sim-card').first()).toHaveCSS('border-radius', '16px');
    await expect(page.locator(path ? '#apparatus' : '.card-visual').first()).toHaveCSS('background-color', 'rgb(245, 245, 243)');
    const action = page.locator(path ? '#start-pause' : '.launch').first();
    await expect(action).toHaveCSS('background-color', 'rgb(10, 10, 10)');
    await expect(action).toHaveCSS('border-radius', '999px');
    await expect(page.locator(path ? '.mono' : '.english-name').first()).toHaveCSS('font-family', /JetBrains Mono/);
    await page.evaluate(() => document.fonts.ready);
    expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('Pretendard Variable') && font.status === 'loaded'))).toBe(true);
    expect(await page.evaluate(() => [...document.fonts].some(font => font.family.includes('JetBrains Mono') && font.status === 'loaded'))).toBe(true);
    if (path) {
      const lines = await page.locator('.legend span').evaluateAll(nodes => nodes.map(node => {
        const style = getComputedStyle(node, '::before');
        return { color: style.borderTopColor, type: style.borderTopStyle };
      }));
      expect(lines.length).toBeGreaterThan(0);
      for(const line of lines)expect(['solid','dashed']).toContain(line.type);
      const reference=lines.find(line=>line.type==='dashed');
      const measured=lines.find(line=>line.type==='solid');
      expect(measured).toBeTruthy();
      if(reference)expect(reference.color).not.toBe(measured.color);
    }
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 });
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      const footer = await page.locator('.site-footer').boundingBox();
      expect(footer.x).toBe(0);
      expect(footer.width).toBe(width);
    }
  });
}
