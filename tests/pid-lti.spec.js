import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const getCurve=(page,key)=>page.locator(`#pid-output-plot path[data-series="${key}"]`).getAttribute('d');

test('P, I and D alter the unit-step response independently; pinning preserves the comparison',async({page})=>{
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  const res=await page.goto(`${base}pid-lti/?lang=ko`);expect(res.status()).toBe(200);
  await expect(page.locator('#steady-error')).toHaveText('0.200');
  const p=await getCurve(page,'y');
  await page.locator('#pin-response').click();
  await page.locator('#enable-i').check();await expect(page.locator('#steady-error')).toHaveText('0.000');
  const pi=await getCurve(page,'y');expect(pi).not.toBe(p);expect(await getCurve(page,'saved')).toBe(p);
  await page.locator('#enable-d').check();const pid=await getCurve(page,'y');expect(pid).not.toBe(pi);
  await page.locator('#gain-d').focus();await page.keyboard.press('ArrowRight');expect(await getCurve(page,'y')).not.toBe(pid);
  const adjusted=await getCurve(page,'y');await page.locator('[data-lang=en]').click();
  await expect(page.locator('html')).toHaveAttribute('lang','en');expect(await getCurve(page,'y')).toBe(adjusted);
  expect(await getCurve(page,'saved')).toBe(p);await expect(page.locator('#pin-info')).toContainText('P');
  await page.locator('#clear-pin').click();await expect(page.locator('[data-series=saved]')).toHaveCount(0);
  await page.locator('#enable-i').uncheck();await page.locator('#enable-d').uncheck();await expect(page.locator('#gain-i')).toBeDisabled();
  expect(await getCurve(page,'y')).toBe(p);
  await page.locator('#enable-p').uncheck();await expect(page.locator('#steady-error')).toHaveText('1.000');await expect(page.locator('#end-value')).toHaveText('0.000');
  await page.locator('#pid-reset').click();expect(await getCurve(page,'y')).toBe(p);expect(errors).toEqual([]);
});

test('PID distinguishes the requested sum, actuator output and nominal predictions',async({page})=>{
  await page.goto(`${base}pid-lti/?lang=en&disturbance=2`);
  await page.locator('#gain-p').focus();await page.keyboard.press('End');
  await page.locator('#enable-d').check();
  const term=key=>page.locator(`#pid-terms-plot [data-series=${key}]`);
  await expect(term('uRaw')).toBeVisible();
  expect(await term('uRaw').getAttribute('d')).not.toBe(await term('u').getAttribute('d'));
  await expect(term('d')).toBeVisible();
  for(const [lang,nominal,requested,applied] of [['en','Nominal','Requested','Applied'],['ko','공칭','요구','적용']]){
    await page.locator(`[data-lang=${lang}]`).click();
    for(const key of ['#steady-error','#stability'])await expect(page.locator(key).locator('..')).toContainText(nominal);
    const legend=page.locator('.pid-terms .legend');
    await expect(legend).toContainText(requested);await expect(legend).toContainText(applied);
  }
});

test('stability boundary is not reported as converged; mobile page and plots stay readable',async({page})=>{
  await page.setViewportSize({width:320,height:812});await page.goto(`${base}pid-lti/?lang=en`);
  await page.locator('#enable-i').check();await page.locator('#gain-i').focus();await page.keyboard.press('End');
  await expect(page.locator('#peak-value')).toHaveText(/%$/);
  await expect(page.locator('#stability')).toHaveText('Unstable');await expect(page.locator('#steady-error')).toHaveText('—');
  await page.locator('#gain-i').evaluate(el=>{el.value='5';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await expect(page.locator('#stability')).toHaveText('Marginal');await expect(page.locator('#steady-error')).toHaveText('—');
  for(const lang of ['ko','en']){await page.locator(`[data-lang=${lang}]`).click();
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    for(const sel of ['#pid-output-plot','#pid-terms-plot']){
      const axis=page.locator(sel);expect(await axis.locator('path[data-series]').count()).toBeGreaterThan(0);
      expect(await axis.evaluate(s=>[...s.querySelectorAll('text')].every(t=>{const b=t.getBoundingClientRect(),r=s.getBoundingClientRect();return b.left>=r.left-1&&b.right<=r.right+1&&b.bottom<=r.bottom+1}))).toBe(true);
    }
  }
});
