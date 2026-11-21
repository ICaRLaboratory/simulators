import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
// Check the particular signal within its own explanation, not math elsewhere
// on the page. In particular, K_DC is not the DDC feedback row K.
const plant=[['label[for=plant-wn] msub','ωn'],['label[for=plant-zeta] mi','ζ'],['label[for=plant-disturbance] mi','d']];
const contexts={
  pid:[['.pid-guide li msub','Kp'],['.pid-metrics msub','e∞'],['.pid-model p:not(.eq) math','K'],['.actual-line math','y'],['.sum-key math','u']],
  mpc:[['label[for=mpc-horizon] math','N'],['label[for=mpc-weight] math','λ'],['.pid-guide li math','λ'],['.pid-metrics math','|u|']],
  ddc:[['.sim-heading p math','K'],['label[for=method-decay] mi','α'],['#method-status math','K'],['.pid-model p:not(.eq) math','Q'],['.pid-model p:not(.eq) math','ρ'],['.pid-model p:not(.eq) math','K'],['.key-record-v math','v'],['.pid-metrics math','|u|']],
  smc:[['label[for=method-phi] math','φ'],['label[for=method-lambda] math','λ'],['label[for=method-gain] math','η'],['.pid-model p:not(.eq) math','d'],['.pid-model p:not(.eq) math','u'],['.pid-guide p math','φ=0'],['.pid-metrics math','s']],
  tdc:[['label[for=method-delay] math','ℓ'],['.pid-guide math','ℓ'],['.key-unknown math','F'],['.pid-model p:not(.eq) math','b'],['.pid-model p:not(.eq) math','F'],['.pid-model p:not(.eq) math','u'],['.pid-model p:not(.eq) math','d']],
};
for(const width of [320,1280])for(const [lab,checks] of Object.entries(contexts))test(`${lab}: contextual notation in KO/EN at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:800});
  await page.goto(`${base}${lab}-lti/?lang=ko`);
  await page.locator('.pid-model summary').click();
  await page.locator('#plant-disturbance').press('Home');
  const findings=[];
  for(const lang of ['ko','en','ko']){
    await page.locator(`[data-lang=${lang}]`).click();
    await expect(page.locator('#plant-disturbance')).toHaveValue('-2');
    await page.evaluate(()=>document.fonts.ready);
    const missing=await page.evaluate(checks=>checks.filter(([sel,want])=>![...document.querySelectorAll(sel)].some(el=>
      el.getBoundingClientRect().width>0 && el.textContent===want)).map(([sel,want])=>`${sel}: ${want}`),
      [...plant,[`label[for=plant-gain] ${lab==='ddc'?'msub':'math'}`,lab==='ddc'?'KDC':'K'],...checks]);
    if(missing.length)findings.push({lang,missing});
    // Page-level overflow alone misses formulas clipped inside their panel.
    const clipped=await page.locator('main math:visible').evaluateAll(roots=>roots.filter(el=>{
      if(el.closest('.eq'))return false; // display equations have their own scroll row
      const box=el.getBoundingClientRect(), parent=el.closest('section,details,aside,.pid-metrics,main').getBoundingClientRect();
      return box.left<Math.max(0,parent.left)-1||box.right>Math.min(innerWidth,parent.right)+1;
    }).map(el=>el.textContent));
    if(clipped.length)findings.push({lang,clipped});
    expect(await page.locator('main').innerText()).not.toContain('$');
    expect(await page.locator('meta[name=description]').getAttribute('content')).not.toContain('$');
  }
  expect(findings).toEqual([]);
});

test('the planning bound encloses the input, not the inequality or live limit',async({page})=>{
  await page.goto(`${base}mpc-lti/?lang=en`);
  await page.locator('#mpc-limit').press('Home');
  for(const lang of ['en','ko']){
    await page.locator(`[data-lang=${lang}]`).click();
    const bound=page.locator('label[for=mpc-limit] math');
    expect(await bound.locator('mo,mi').evaluateAll(nodes=>nodes.map(n=>[n.localName,n.textContent]))).toEqual([
      ['mo','|'],['mi','u'],['mo','|'],['mo','≤'],
    ]);
    await expect(page.locator('#mpc-limit-value')).toHaveText('0.50');
  }
});

test('the DDC gain readout retains the two ordered coefficients, including after rank recovery',async({page})=>{
  await page.goto(`${base}ddc-lti/?lang=en`);
  await page.locator('#method-decay').press('End');
  const values=await page.evaluate(async()=>{
    const {simulate}=await import('../assets/models/ddc-lti.js');
    return simulate({decay:2}).K.map(v=>v.toFixed(3));
  });
  const gain=page.locator('#method-gain');
  expect(await gain.locator('math mn').allTextContents()).toEqual(values);
  await page.locator('#method-excitation').selectOption('0');
  await expect(gain).toHaveText('—');
  await page.locator('[data-lang=ko]').click();
  await page.locator('#method-excitation').selectOption('1');
  expect(await gain.locator('math mn').allTextContents()).toEqual(values);
});
