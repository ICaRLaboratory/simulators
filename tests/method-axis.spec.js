import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const graphs=['response-plot','diag-plot','input-plot'];
const ticks=(p,id)=>p.locator(`#${id} text[text-anchor="end"]`).allTextContents();
const settings=(page,id,n)=>page.locator('#'+id).evaluate((el,n)=>{el.value=String(n);el.dispatchEvent(new Event('input',{bubbles:true}));},n);
const all=page=>Promise.all(graphs.map(id=>ticks(page,id)));
for(const [lab,control,value] of [['tdc','delay',10],['smc','lambda',3],['ddc','decay',2]]){
 test(`${lab}: Y ticks do not follow controller, plant or disturbance`,async({page})=>{
  await page.goto(`${base}${lab}-lti/?lang=ko`);const curve=page.locator('#response-plot path[data-series="output"]');await expect(curve).toBeVisible();
  const orig=await all(page),d=await curve.getAttribute('d');
  for(const [id,n] of [['plant-disturbance',2],[`method-${control}`,value],['plant-wn',2],['plant-zeta',.1],['plant-gain',2]]){
   await settings(page,id,n);expect(await all(page),id).toEqual(orig);
  }
  await expect(curve).not.toHaveAttribute('d',d);
  if(lab==='smc'){await page.locator('#input-zoom').check();expect(await all(page)).toEqual(orig);}
  if(lab==='ddc'){await page.locator('#method-excitation').selectOption('0');await expect(curve).toHaveCount(0);expect(await all(page)).toEqual(orig);}
  if(lab==='tdc'){
   const note=page.locator('#diag-plot-range-note');await expect(note).toBeVisible();await expect(note).toContainText('최댓값');
   await page.locator('[data-lang=en]').click();await expect(note).toContainText('maximum');expect(await all(page)).toEqual(orig);
   const geometry=await page.locator('#diag-plot path[data-series="unknown"]').evaluate(p=>{const r=p.ownerSVGElement.querySelector('clipPath rect').getBBox(),curve=p.getBBox();return [p.getAttribute('clip-path'),curve.y<r.y||curve.y+curve.height>r.y+r.height];});expect(geometry).toEqual(['url(#diag-plot-clip)',true]);
  }
  await page.setViewportSize({width:360,height:820});expect(await all(page)).toEqual(orig);
  await page.locator('#method-reset').click();expect(await all(page)).toEqual(orig);
  if(lab==='tdc')await expect(page.locator('#diag-plot-range-note')).toBeHidden();
 });
}
