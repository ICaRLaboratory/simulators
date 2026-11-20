import {test, expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const val=(p,id,v)=>p.locator('#'+id).evaluate((el,v)=>{el.value=v;el.dispatchEvent(new Event('input',{bubbles:true}));},String(v));
const path=(p,key)=>p.locator(`svg path[data-series="${key}"]`);
for(const [id,knob,setTo,diagnostic] of [['ddc-lti','decay',.5,'record-v'],['smc-lti','phi',0,'phase'],['tdc-lti','delay',8,'estimate']]){
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
test('DDC: withhold feedback and closed-loop traces for a zero record, then recover',async({page})=>{
 await page.goto(base+'ddc-lti/?lang=en');await expect(path(page,'output')).toBeVisible();
 await page.locator('#method-excitation').selectOption('0');await expect(page.locator('#method-status')).toContainText(/rank/i);
 await expect(page.locator('#method-stat')).toHaveText('0 / 3');
 for(const key of ['gain','rho','final','peak'])await expect(page.locator('#method-'+key)).toHaveText('—');
 for(const key of ['output','target','input'])await expect(path(page,key)).toHaveCount(0);
 // A painted horizontal trace has zero geometric height; its length is still meaningful.
 for(const key of ['record-u','record-y','record-v'])expect(await path(page,key).evaluate(p=>p.getBBox().height===0 && p.getTotalLength()>100 && getComputedStyle(p).stroke!=='none')).toBe(true);
 await page.locator('[data-lang=ko]').click();await expect(page.locator('#method-status')).toContainText('랭크');
 await expect(page.locator('#method-excitation')).toHaveValue('0');await expect(path(page,'input')).toHaveCount(0);
 await page.locator('#method-excitation').selectOption('1');await expect(page.locator('#method-stat')).toHaveText('3 / 3');await expect(path(page,'output')).toBeVisible();
});
test('DDC: report the designed gain, spectral radius and applied-input metrics for the selected plant',async({page})=>{
 await page.goto(base+'ddc-lti/?lang=en&wn=1.3&zeta=0.7&gain=1.5');
 const decay=page.getByRole('slider',{name:/decay rate/i});
 await expect(decay).toHaveValue('1');await expect(path(page,'record-v')).toBeVisible();
 const record=await path(page,'record-v').getAttribute('d');
 const gainBefore=await page.locator('#method-gain').innerText();
 await decay.press('End');await expect(decay).toHaveValue('2');await expect(decay).toBeFocused();
 const truth=await page.evaluate(async()=>{
  const {simulate}=await import('../assets/models/ddc-lti.js');
  const r=simulate({plant:{wn:1.3,zeta:.7,gain:1.5},decay:2});
  return {K:r.K.map(n=>n.toFixed(3)).join(', '),rho:r.rho.toFixed(3),rank:`${r.rank} / ${r.requiredRank}`,
   final:r.samples.at(-1).y.toFixed(3),peak:Math.max(...r.samples.slice(0,-1).map(s=>Math.abs(s.u))).toFixed(3)};
 });
 await expect(page.locator('#method-gain')).toHaveText(`[${truth.K}]`);await expect(page.locator('#method-gain')).not.toHaveText(gainBefore);
 await expect(page.locator('#method-rho')).toHaveText(truth.rho);await expect(page.locator('#method-stat')).toHaveText(truth.rank);
 await expect(page.locator('#method-final')).toHaveText(truth.final);await expect(page.locator('#method-peak')).toHaveText(truth.peak);
 await expect(path(page,'input')).toHaveAttribute('d',/H.+V/);await expect(path(page,'record-v')).toHaveAttribute('d',record);
 await page.locator('.pid-model summary').click();await expect(page.locator('.pid-model')).toContainText('nominal unsaturated closed loop');await expect(page.locator('.pid-model')).toContainText('target equilibrium');
 const paper=page.getByRole('link',{name:/De Persis.*Tesi/});await expect(paper).toHaveAttribute('href','https://doi.org/10.1109/TAC.2019.2959924');
 await page.locator('[data-lang=ko]').click();await expect(page.getByRole('slider',{name:/설계 감쇠율/})).toHaveValue('2');
 await expect(page.locator('#diag-title')).toContainText('입력·상태');await expect(page.locator('.pid-model')).toHaveAttribute('open','');
 await expect(page.locator('#method-gain')).toHaveText(`[${truth.K}]`);await expect(paper).toHaveAttribute('href','https://doi.org/10.1109/TAC.2019.2959924');
});
test('TDC metrics use the final physical state and peak applied input',async({page})=>{
 await page.goto(base+'tdc-lti/?lang=en');await expect(path(page,'output')).toBeVisible();const truth=await page.evaluate(async()=>{const {simulate}=await import('../assets/models/tdc-lti.js');const r=simulate();return {final:r.finalState.y.toFixed(3),peak:Math.max(...r.samples.map(s=>Math.abs(s.u))).toFixed(3)};});
 await expect(page.locator('#method-final')).toHaveText(truth.final);await expect(page.locator('#method-peak')).toHaveText(truth.peak);
});
test('all Control fundamentals output plots hold the reference at the unit tick from t=0',async({page})=>{
 const selectors={'pid-lti':'#pid-output-plot path:not([data-series])','mpc-lti':'#mpc-output-plot path:not([data-series])'};
 for(const id of ['pid-lti','mpc-lti','ddc-lti','smc-lti','tdc-lti']){
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
 await page.goto(base+'mpc-lti/?lang=en&wn=1.4&gain=1.5&zeta=1.2');for(const id of ['ddc-lti','smc-lti','tdc-lti','pid-lti']){await page.locator(`a[href*="../${id}/"]`).first().click();await expect(page.locator('#plant-wn')).toHaveValue('1.4');await expect(page.locator('#plant-gain')).toHaveValue('1.5');await expect(page.locator('#plant-zeta')).toHaveValue('1.2');await expect(page.locator('html')).toHaveAttribute('lang','en');}
});
test('SMC: phase line and local view of held switching input; TDC: delay changes estimates following the disturbance',async({page})=>{
 await page.goto(base+'smc-lti/?lang=en');await expect(path(page,'surface')).toBeVisible();await val(page,'method-phi',0);const full=await path(page,'input').getAttribute('d');await page.locator('#input-zoom').check();await expect(path(page,'input')).not.toHaveAttribute('d',full);await expect(path(page,'input')).toHaveAttribute('d',/H.+V/);
 await val(page,'plant-disturbance',.8);await page.locator('a[href*="../tdc-lti/"]').click();await expect(page.locator('#plant-disturbance')).toHaveValue('0.8');await expect(path(page,'unknown')).toBeVisible();const estimate=await path(page,'estimate').getAttribute('d');await val(page,'method-delay',5);await expect(path(page,'estimate')).not.toHaveAttribute('d',estimate);
});
for(const id of ['smc-lti','tdc-lti'])test(`${id}: shared input disturbance on a 20 s run`,async({page})=>{
 await page.goto(`${base}${id}/?lang=en`);
 const load=page.locator('#plant-disturbance'),onset=page.locator('#response-plot line[data-onset]');
 await expect(page.locator('#method-disturbance')).toHaveCount(0);
 await expect(load).toHaveValue('0');await expect(path(page,'output')).toBeVisible();

 await expect(page.locator('#response-plot').getByText('20',{exact:true})).toBeVisible();
 await expect(onset).toHaveCount(0);
 const quiet=await path(page,'output').getAttribute('d');
 await load.press('Home');await expect(load).toHaveValue('-2');await expect(onset).toHaveAttribute('data-onset','4');
 await expect(path(page,'output')).not.toHaveAttribute('d',quiet);
 await page.locator('.pid-model summary').click();await expect(page.locator('.pid-model')).toContainText('b(u + d)');
 await expect(page.locator('.pid-guide')).toContainText(/input disturbance/i);
 await page.locator('[data-lang=ko]').click();await expect(page.locator('.pid-guide')).toContainText('입력 외란');
 await expect(load).toHaveValue('-2');await page.locator('#method-reset').click();
 await expect(load).toHaveValue('0');await expect(onset).toHaveCount(0);await expect(path(page,'output')).toHaveAttribute('d',quiet);
});
