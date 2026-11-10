import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
test.use({launchOptions:{executablePath:process.env.CHROMIUM_PATH,args:['--use-angle=swiftshader','--enable-unsafe-swiftshader']}});
for(const width of [390,1440])for(const lang of ['ko','en']){
  test(`device-first workspace ${width}px ${lang}`,async({page})=>{
    await page.setViewportSize({width,height:1000});
    await page.goto(base+'dc-motor/?lang='+lang);
    await expect(page.locator('#apparatus')).toHaveAttribute('data-renderer','three');
    await page.evaluate(()=>document.fonts.ready);
    const height=await page.locator('.three-viewport').evaluate(el=>el.getBoundingClientRect().height);
    expect(height).toBeGreaterThanOrEqual(width>600?410:290);
    const size=await page.locator('.sim-heading h1').evaluate(el=>parseFloat(getComputedStyle(el).fontSize));
    expect(size).toBeLessThanOrEqual(38);expect(size).toBeGreaterThanOrEqual(28);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    const readouts=page.locator('.three-readout');
    for(const node of await readouts.all()){
      if(!await node.isVisible())continue;
      expect(await node.evaluate(el=>{const a=el.getBoundingClientRect(),b=el.closest('.three-viewport').getBoundingClientRect();return a.left>=b.left&&a.right<=b.right&&a.top>=b.top&&a.bottom<=b.bottom;})).toBe(true);
    }
  });
}
