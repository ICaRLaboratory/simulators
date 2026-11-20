import {test,expect} from '@playwright/test';

const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const outputTicks=['-0.5','0','0.5','1','1.5','2'];
const inputTicks=['-4','-2','0','2','4'];
const times=['0','5','10','15','20'];

async function checkTicks(plot,yTicks,xTicks=times){
  // Read the labels painted by the renderer, not its scale configuration.
  await expect(plot.locator('text[text-anchor="end"]')).toHaveText(yTicks);
  const timeLabels=plot.locator('text[text-anchor="middle"]').filter({hasText:/^\d+$/});
  await expect(timeLabels).toHaveText(xTicks);
}

async function checkClip(plot){
  const clipped=await plot.evaluate(svg=>{
    const grid=[...svg.querySelectorAll('line')].filter(l=>l.y1.baseVal.value===l.y2.baseVal.value);
    const {x,width}=grid[0].getBBox(),ys=grid.map(l=>l.y1.baseVal.value);
    const top=Math.min(...ys),bottom=Math.max(...ys);
    return [...svg.querySelectorAll('path,circle')].every(shape=>{
      const url=shape.closest('[clip-path]')?.getAttribute('clip-path');
      const id=url?.match(/^url\(#(.+)\)$/)?.[1];
      const rect=id&&svg.getElementById(id)?.querySelector('rect');
      if(!rect)return false;
      const box=rect.getBBox();
      return Math.abs(box.x-x)<.01 && Math.abs(box.width-width)<.01 && Math.abs(box.y-top)<.01 && Math.abs(box.height-(bottom-top))<.01;
    });
  });
  expect(clipped,`traces, reference lines and plan markers clip at the outer grid lines of ${await plot.getAttribute('id')}`).toBe(true);
}

// getBBox returns the original path geometry, before SVG applies its clip.
async function extendsBeyond(plot,series,edge){
  return plot.locator(`path[data-series="${series}"]`).evaluate((path,edge)=>{
    const rect=path.ownerSVGElement.querySelector('clipPath rect').getBBox(),box=path.getBBox();
    return edge==='top'?box.y<rect.y-.01:box.y+box.height>rect.y+rect.height+.01;
  },edge);
}

const rangeNote=plot=>plot.locator('xpath=following-sibling::*[1][self::p]');

test('PID fixed Y ticks survive gain changes, pinning an excursion, and clearing it',async({page})=>{
  await page.goto(base+'pid-lti/?lang=en&gain=2&disturbance=2');
  const output=page.locator('#pid-output-plot'),terms=page.locator('#pid-terms-plot');
  const axes=async()=>{await checkTicks(output,outputTicks);await checkTicks(terms,inputTicks);};
  await axes();
  await page.locator('#enable-p').uncheck(); // The disturbance now takes y above 4.6.
  await page.locator('#pin-response').click();
  await page.locator('#enable-p').check();
  await page.locator('#gain-p').press('End'); // Applied u is bounded; P and the requested sum are not.
  await axes();await checkClip(output);await checkClip(terms);
  expect(await extendsBeyond(output,'y','top')).toBe(false);
  expect(await extendsBeyond(output,'saved','top')).toBe(true);
  expect(await extendsBeyond(terms,'uRaw','top')).toBe(true);
  expect(await extendsBeyond(terms,'u','top')).toBe(false);
  await expect(rangeNote(output)).toBeVisible();await expect(rangeNote(output)).toContainText(/maximum 4\.65/);
  await expect(rangeNote(terms)).toBeVisible();await expect(rangeNote(terms)).toContainText(/minimum [-−]5\.6/);
  await expect(rangeNote(terms)).toContainText(/maximum 12\b/);
  await page.locator('#clear-pin').click();await axes();await expect(rangeNote(output)).toBeHidden();
  await page.locator('#pid-reset').click();await axes();await expect(rangeNote(terms)).toBeHidden();
});

test('MPC fixed Y ticks ignore planning bounds and the inspected forecast; late plans still extend time',async({page})=>{
  await page.goto(base+'mpc-lti/?lang=en&gain=0.5&zeta=0.1&disturbance=2');
  const output=page.locator('#mpc-output-plot'),input=page.locator('#mpc-input-plot');
  const axes=async(xTicks)=>{await checkTicks(output,outputTicks,xTicks);await checkTicks(input,inputTicks,xTicks);};
  await axes();await page.locator('#mpc-limit').press('Home');await axes();
  await expect(rangeNote(input)).toBeHidden();await expect(rangeNote(output)).toBeHidden();
  // At 7.2 s the selected prediction leaves the lower bound; the measured run never does.
  await page.locator('#mpc-time').evaluate(el=>{el.value=36;el.dispatchEvent(new Event('input'));});
  await expect(page.locator('#mpc-time-value')).toHaveText('7.2 s');
  await axes();await checkClip(output);await checkClip(input);
  expect(await extendsBeyond(output,'prediction','bottom')).toBe(true);
  expect(await extendsBeyond(output,'y','bottom')).toBe(false);
  await expect(rangeNote(output)).toBeVisible();await expect(rangeNote(output)).toContainText(/minimum [-−]0\.568/);
  await page.locator('#mpc-time').press('Home');await expect(rangeNote(output)).toBeHidden();
  await page.locator('#mpc-horizon').press('End');await page.locator('#mpc-time').press('End');
  await expect(page.locator('#mpc-time-value')).toHaveText('19.8 s');await axes([...times,'25','30']);
});
