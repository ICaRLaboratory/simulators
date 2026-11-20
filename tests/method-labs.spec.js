import {test, expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const val=(p,id,v)=>p.locator('#'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(v));
const path=(p,key)=>p.locator(`svg path[data-series="${key}"]`);
for(const [id,knob,setTo,diagnostic] of [['deepc-lti','horizon',4,'record-y'],['smc-lti','phi',0,'phase'],['tdc-lti','delay',8,'estimate']]){
 test(`${id}: real response, tunable controller and plant, bilingual mobile layout`,async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));await page.setViewportSize({width:360,height:760});
  const res=await page.goto(base+id+'/?lang=ko');expect(res.status()).toBe(200);await expect(path(page,'output')).toBeVisible();await expect(path(page,diagnostic)).toBeVisible();
  const orig=await path(page,'output').getAttribute('d');await val(page,'method-'+knob,setTo);await expect(path(page,'output')).not.toHaveAttribute('d',orig);
  await page.locator('[data-lang=en]').click();await expect(page.locator('html')).toHaveAttribute('lang','en');await expect(page.locator('h1')).not.toHaveText(/[가-힣]/);await expect(page.locator('#method-'+knob)).toHaveValue(String(setTo));
  await val(page,'plant-wn',1.7);await expect(page).toHaveURL(/wn=1.7/);await expect(page.locator('#method-final')).not.toHaveText('—');
  expect(await page.locator('main').evaluate(el=>[...el.querySelectorAll('input,svg,h1,details,button,select')].every(e=>!e.clientWidth||e.getBoundingClientRect().right<=innerWidth+1))).toBe(true);
  expect(await page.locator('svg path[d*="NaN"],svg path[d*="Infinity"]').count()).toBe(0);await page.locator('#method-reset').click();await expect(path(page,'output')).toHaveAttribute('d',orig);
  expect(errors).toEqual([]);
 });
}
test('DeePC: insufficient excitation leaves recorded input/output visible without a fictitious closed loop',async({page})=>{
 await page.goto(base+'deepc-lti/?lang=en');await expect(path(page,'output')).toBeVisible();await page.locator('#method-excitation').selectOption('0');await expect(page.locator('#method-status')).toContainText(/insufficient/i);await expect(path(page,'output')).toHaveCount(0);await expect(page.locator('#diag-plot')).toBeVisible();
 // SVG geometric bounds of a genuinely constant trace have zero height, despite its painted stroke.
 expect(await path(page,'record-u').evaluate(p=>p.getBBox().height===0 && p.getTotalLength()>100 && getComputedStyle(p).stroke!=='none')).toBe(true);
 await expect(page.locator('#method-final')).toHaveText('—');await page.locator('#method-excitation').selectOption('1');await expect(path(page,'output')).toBeVisible();
});
test('diagnostics use the measured PE rank and the TDC reference and final physical state',async({page})=>{
 await page.goto(base+'deepc-lti/?lang=en');await expect(page.locator('#method-stat')).toHaveText('14 / 14');await page.locator('#method-excitation').selectOption('0');await expect(page.locator('#method-stat')).toHaveText('1 / 14');
 await page.goto(base+'tdc-lti/?lang=en');await expect(path(page,'output')).toBeVisible();const truth=await page.evaluate(async()=>{const {simulate}=await import('../assets/models/tdc-lti.js');const r=simulate();return {final:r.finalState.y.toFixed(3),peak:Math.max(...r.samples.map(s=>Math.abs(s.u))).toFixed(3)};});
 await expect(page.locator('#method-final')).toHaveText(truth.final);await expect(page.locator('#method-peak')).toHaveText(truth.peak);
});
test('all Control fundamentals output plots hold the reference at the unit tick from t=0',async({page})=>{
 const selectors={'pid-lti':'#pid-output-plot path:not([data-series])','mpc-lti':'#mpc-output-plot path:not([data-series])'};
 for(const id of ['pid-lti','mpc-lti','deepc-lti','smc-lti','tdc-lti']){
  await page.goto(`${base}${id}/`);const target=page.locator(selectors[id]??'#response-plot path[data-series="target"]');await expect(target).toHaveCount(1);
  const errors=await target.evaluate(p=>{
   const svg=p.ownerSVGElement,box=p.getBBox();
   const tick=[...svg.querySelectorAll('text[text-anchor="end"]')].find(el=>el.textContent==='1');
   const y=Number(tick.getAttribute('y'))-4;
   const grid=[...svg.querySelectorAll('line')].find(el=>Math.abs(Number(el.getAttribute('y1'))-y)<.01 && el.getAttribute('y1')===el.getAttribute('y2'));
   return [box.height,box.y-y,box.x-Number(grid.getAttribute('x1')),box.x+box.width-Number(grid.getAttribute('x2'))];
  });
  for(const err of errors)expect(Math.abs(err),id).toBeLessThan(.02);
 }
});
test('cross-lab navigation carries language and plant through classical and modern labs',async({page})=>{
 await page.goto(base+'mpc-lti/?lang=en&gain=1.5&zeta=1.2');for(const id of ['deepc-lti','smc-lti','tdc-lti','pid-lti']){await page.locator(`a[href*="../${id}/"]`).first().click();await expect(page.locator('#plant-gain')).toHaveValue('1.5');await expect(page.locator('#plant-zeta')).toHaveValue('1.2');await expect(page.locator('html')).toHaveAttribute('lang','en');}
});
test('SMC: phase line and local view of held switching input; TDC: delay changes estimates following the disturbance',async({page})=>{
 await page.goto(base+'smc-lti/?lang=en');await expect(path(page,'surface')).toBeVisible();await val(page,'method-phi',0);const full=await path(page,'input').getAttribute('d');await page.locator('#input-zoom').check();await expect(path(page,'input')).not.toHaveAttribute('d',full);await expect(path(page,'input')).toHaveAttribute('d',/H.+V/);
 await page.locator('a[href*="../tdc-lti/"]').click();await expect(path(page,'unknown')).toBeVisible();const estimate=await path(page,'estimate').getAttribute('d');await val(page,'method-delay',5);await expect(path(page,'estimate')).not.toHaveAttribute('d',estimate);
});
