import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
test('legacy graph URL has a usable static link in either language without JavaScript',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});
 try{
  const page=await context.newPage();await page.goto(`${base}deepc-lti/`);
  await expect(page.getByRole('link',{name:/DDC 실험/})).toHaveAttribute('href','../ddc-lti/?lang=ko');
  await expect(page.getByRole('link',{name:/Open the DDC lab/})).toHaveAttribute('href','../ddc-lti/?lang=en');
 }finally{await context.close();}
});
test('legacy graph URL preserves language, plant and fragment on the DDC page',async({page})=>{
 const suffix='?lang=en&wn=1.4&zeta=0.9&gain=1.5#main';
 await page.goto(`${base}deepc-lti/${suffix}`);
 await expect(page).toHaveURL(`${base}ddc-lti/${suffix}`);
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 await expect(page.locator('#plant-gain')).toHaveValue('1.5');
 await expect(page.locator('h1')).toContainText('DDC');
});
