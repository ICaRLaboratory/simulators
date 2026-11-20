import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
test('one input disturbance setting follows the same plant between all five labs',async({page})=>{
 await page.goto(`${base}pid-lti/?lang=en&gain=1.5`);const input=page.locator('#plant-disturbance');await expect(input).toHaveValue('0');
 await input.evaluate(el=>{el.value='-0.7';el.dispatchEvent(new Event('input',{bubbles:true}));});
 for(const id of ['mpc-lti','ddc-lti','smc-lti','tdc-lti','pid-lti']){
  await page.locator(`a[href*="../${id}/"]`).first().click();await expect(input).toHaveValue('-0.7');await expect(page).toHaveURL(/disturbance=-0.7/);await expect(page.locator('#plant-gain')).toHaveValue('1.5');
  await expect(page.locator('#plant-conditions')).toContainText('u + d');await expect(page.getByLabel('Input disturbance',{exact:false})).toHaveCount(1);
  await page.locator('[data-lang=ko]').click();await expect(page.locator('#plant-conditions')).toContainText('입력 외란');await expect(input).toHaveValue('-0.7');await page.locator('[data-lang=en]').click();
 }
});
