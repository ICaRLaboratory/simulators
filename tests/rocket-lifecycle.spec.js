import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
async function open(page){
 await page.addInitScript(()=>{let queue=[],now=0;window.requestAnimationFrame=fn=>{queue.push(fn);return queue.length;};window.advanceRocket=(n)=>{for(let k=0;k<n;k++){now+=20;const current=queue;queue=[];for(const fn of current)fn(now);}};});
 await page.goto(base+'rocket-landing/?lang=en');await expect(page.locator('#start-pause')).toBeEnabled();
}
test('rocket completes a real soft landing, localizes the result, and resets deterministically',async({page})=>{
 await open(page);await expect(page.locator('.model-notes a')).toHaveAttribute('href','https://www.mathworks.com/help/mpc/ug/landing-rocket-with-mpc-example.html');
 await expect(page.locator('.disturbance-controls input[type=range]')).toHaveCount(1);
 await page.locator('#start-pause').click();await page.evaluate(()=>window.advanceRocket(3000));
 await expect(page.locator('#run-status')).toHaveText('Complete');await expect(page.locator('#simulation-message')).toContainText('Soft landing');
 await expect(page.locator('#start-pause')).toBeDisabled();await expect(page.locator('#disturb')).toBeDisabled();
 const time=await page.locator('#sim-time').textContent();await page.evaluate(()=>window.advanceRocket(50));await expect(page.locator('#sim-time')).toHaveText(time);
 await page.locator('[data-lang=ko]').click();await expect(page.locator('#simulation-message')).toContainText('연착륙');
 await page.locator('#reset').click();await expect(page.locator('#sim-time')).toHaveText('0.00');await expect(page.locator('#start-pause')).toBeEnabled();
 await page.locator('#start-pause').click();await page.evaluate(()=>window.advanceRocket(3000));await expect(page.locator('#sim-time')).toHaveText(time);
});
test('rocket large cumulative disturbance causes a latched stop instead of false success',async({page})=>{
 await open(page);
 await page.locator('.disturbance-controls input[type=range]').evaluate(n=>{n.value=n.max;n.dispatchEvent(new Event('input',{bubbles:true}));});
 for(let i=0;i<8;i++)await page.locator('#disturb').click();
 await page.locator('#start-pause').click();await page.evaluate(()=>window.advanceRocket(600));
 await expect(page.locator('#start-pause')).toBeDisabled();await expect(page.locator('#disturb')).toBeDisabled();
 await expect(page.locator('#run-status')).not.toHaveText('Complete');await expect(page.locator('#simulation-message')).toHaveClass(/error/);
 const before=await page.locator('#sim-time').textContent();await page.evaluate(()=>window.advanceRocket(50));await expect(page.locator('#sim-time')).toHaveText(before);
 await page.locator('#reset').click();await expect(page.locator('#start-pause')).toBeEnabled();await expect(page.locator('#sim-time')).toHaveText('0.00');
});
