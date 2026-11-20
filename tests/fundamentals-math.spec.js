import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const labs=['pid','mpc','ddc','smc','tdc'];

test('PID effort and pinned plant, MPC clock and equilibrium requirement use math',async({page})=>{
  await page.goto(`${base}pid-lti/?lang=ko&wn=1.3`);
  await expect(page.locator('.pid-terms .panel-heading math msub')).toHaveText('ureq');
  await page.locator('#pin-response').click();
  await page.locator('#plant-wn').press('End');
  await expect(page.locator('#pin-info math').first()).toContainText('1.3');
  await page.locator('#mpc-lab-link').click();
  await expect(page.locator('.pid-settings .panel-heading math msub')).toHaveText('Ts');
  await page.locator('#plant-disturbance').press('End');
  for(const lang of ['ko','en']){
    await page.locator(`[data-lang=${lang}]`).click();
    const demand=page.locator('#mpc-limit-hint math');
    await expect(demand.locator('mfrac')).toHaveText('1K');
    await expect(demand).toContainText(/≈[−-]1$/);
  }
});

const modelNotes={
  pid:['mfrac','Disabled terms','끈 항'],mpc:['msub','last applied input','직전에 적용한 입력'],
  ddc:['mtable','row rank','행 랭크'],smc:['mfrac','reaching law','도달식'],tdc:['msub','applied actuator input','구동기 입력'],
};
for(const lab of labs)test(`${lab}: equations within the notes survive a language round trip`,async({page})=>{
  await page.goto(`${base}${lab}-lti/?lang=en`);
  await page.locator('.pid-model summary').click();
  const [tag,en,ko]=modelNotes[lab];
  const p=page.locator('.pid-model p:not(.eq)');
  for(const [lang,phrase] of [['en',en],['ko',ko],['en',en]]){
    await page.locator(`[data-lang=${lang}]`).click();
    const note=p.filter({hasText:phrase});
    await expect(note.locator(`math ${tag}`).first()).toBeVisible();
    await expect(page.locator('#plant-conditions math').filter({hasText:'u+d'})).toBeVisible();
  }
});

// Each row must still teach the original relation with scripting disabled.
const rows={
  pid:['mfrac','mo:text-is("∫")'],
  mpc:['mfrac','munderover'],
  ddc:['mfrac','msup','mtable','msup','msup'],
  smc:['mfrac','mover','mfrac','mover'],
  tdc:['mfrac','mover','msub','mfrac','mfrac'],
};
test.describe('static model disclosures',()=>{
  test.use({javaScriptEnabled:false,viewport:{width:320,height:800}});
  for(const lab of labs)test(`${lab}: plant and every equation row are native math without JavaScript`,async({page})=>{
    await page.goto(`${base}${lab}-lti/`);
    await expect(page.locator('#plant-equation math mfrac')).toBeVisible();
    await page.locator('.pid-model summary').click();
    const eq=page.locator('.pid-model .eq');
    await expect(eq).toHaveCount(rows[lab].length);
    for(const [i,selector] of rows[lab].entries())await expect(eq.nth(i).locator(`math ${selector}`).first()).toBeVisible();
    // Check which signals are differentiated, summed, transposed or delayed,
    // not just the presence of an integral, summation, matrix or fraction.
    if(lab==='pid'){
      await expect(eq.nth(1)).toContainText('Ki∫edt−Kd');
      await expect(eq.nth(1).locator('mover > mi')).toHaveText('y');
    }else if(lab==='mpc'){
      await expect(eq.nth(1).locator('munderover > *')).toHaveText(['∑','j=1','N']);
      await expect(eq.nth(1).locator('msub > :last-child')).toHaveText(['j','0','−1','1','0']);
    }else if(lab==='ddc'){
      const cells=await eq.nth(2).locator('mtable mtd').allTextContents();
      expect(cells.map(s=>s.normalize('NFKC'))).toEqual(['P','X1Q','(X1Q)T','P']);
      await expect(eq.nth(2)).toContainText('≻0');
      await expect(eq.nth(3)).toContainText('K=U0QP−1');
    }else if(lab==='smc'){
      await expect(eq.nth(1)).toContainText('e=y−1');
      await expect(eq.nth(2).locator('mfrac > *')).toHaveText(['s','φ']);
      await expect(eq.nth(3)).toContainText('b(u+d)');
    }else{
      await expect(eq.nth(3).locator('mfrac > *')).toHaveText(['v[k+1]−v[k]','Ts']);
      await expect(eq.nth(3)).toContainText('[k−ℓ]−b0u[k−ℓ]');
      await expect(eq.nth(4).locator('mfrac > *')).toHaveText(['6.25(r−y)−5y˙−Fˆ','b0']);
    }
  });
});

for(const lab of labs)test(`${lab}: changing the plant updates the typeset quotient and reset restores the unit plant`,async({page})=>{
  await page.goto(`${base}${lab}-lti/?lang=en&wn=1.3&zeta=0.7&gain=1.5`);
  const frac=page.locator('#plant-equation math mfrac');
  const check=async(num,den)=>{
    await expect(frac.locator(':scope > :first-child')).toHaveText(num);
    await expect(frac.locator(':scope > :last-child')).toHaveText(den);
    await expect(frac.locator('msup')).toHaveText('s2');
  };
  await check('2.535','s2+1.82s+1.69');
  await page.locator('#plant-wn').press('End');
  await check('6','s2+2.8s+4');
  await page.locator('[data-lang=ko]').click();
  await check('6','s2+2.8s+4');
  await page.locator(`#${['pid','mpc'].includes(lab)?lab:'method'}-reset`).click();
  await check('1','s2+s+1');
});
