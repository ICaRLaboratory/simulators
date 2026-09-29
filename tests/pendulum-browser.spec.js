import {test,expect} from '@playwright/test';
const root=(process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/')+'inverted-pendulum/';
const graphPixels=page=>page.locator('#response').evaluate(canvas=>canvas.toDataURL());
async function setRange(page,id,value){await page.locator('#'+id).evaluate((node,value)=>{node.value=value;node.dispatchEvent(new Event('input',{bubbles:true}));},value);}

test('run, pause, impulse, reset and locale preserve experiment settings and plots',async({page})=>{
 const errors=[];page.on('pageerror',error=>errors.push(error.message));
 await page.goto(root+'?lang=en');
 await expect(page.locator('h1')).toHaveText('Inverted pendulum');
 await setRange(page,'target','0.3');
 await page.locator('#start-pause').click();
 await expect.poll(()=>page.locator('#sim-time').textContent()).not.toBe('0.00');
 await page.locator('[data-lang=ko]').click();
 await expect(page.locator('#run-status')).toHaveText('실행 중');
 await page.locator('#disturb').click();
 await expect(page.locator('#simulation-message')).toContainText('+0.5 rad/s');
 await page.waitForTimeout(200);
 await page.locator('#start-pause').click();
 const time=await page.locator('#sim-time').textContent();
 const pixels=await graphPixels(page);
 await page.locator('summary').click();
 await page.locator('[data-lang=en]').click();
 await page.waitForTimeout(150);
 await expect(page.locator('#sim-time')).toHaveText(time);
 expect(await graphPixels(page)).toBe(pixels);
 await expect(page.locator('#target')).toHaveValue('0.3');
 await expect(page.locator('details')).toHaveAttribute('open','');
 await expect(page.locator('#apparatus')).toHaveAttribute('aria-label',/positive angle leans right/);
 await expect(page).toHaveTitle('Inverted pendulum · Control Simulators');
 await page.locator('#reset').click();
 await expect(page.locator('#sim-time')).toHaveText('0.00');
 await expect(page.locator('#sim-angle')).toHaveText('0.080');
 await expect(page.locator('#target')).toHaveValue('0.3');
 await page.reload();
 await expect(page.locator('html')).toHaveAttribute('lang','en');
 expect(errors).toEqual([]);
});

test('unstabilized pole fails, remains stopped and resets',async({page})=>{
 await page.goto(root+'?lang=en');
 for(const key of ['kx','kv','ktheta','komega']) await setRange(page,key,'0');
 await page.locator('#start-pause').click();
 await expect(page.locator('#start-pause')).toBeDisabled({timeout:5000});
 await expect(page.locator('#simulation-message')).toContainText('Balance lost');
 const time=await page.locator('#sim-time').textContent();
 await page.waitForTimeout(100);
 await expect(page.locator('#sim-time')).toHaveText(time);
 await page.locator('[data-lang=ko]').click();
 await expect(page.locator('#simulation-message')).toContainText('넘어졌습니다');
 await page.locator('#reset').click();
 await expect(page.locator('#start-pause')).toBeEnabled();
 await expect(page.locator('#ktheta')).toHaveValue('0');
});

test('mobile diagram scrolls without page overflow and all SVG text stays in bounds',async({page})=>{
 await page.setViewportSize({width:390,height:844});await page.goto(root+'?lang=en');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 const region=page.locator('.loop-viewport');await region.focus();await page.keyboard.press('ArrowRight');
 await expect.poll(()=>region.evaluate(node=>node.scrollLeft)).toBeGreaterThan(0);
 expect(await page.locator('.loop-diagram').evaluate(svg=>[...svg.querySelectorAll('text')].every(node=>{const b=node.getBBox();return b.x>=0 && b.y>=0 && b.x+b.width<=1120 && b.y+b.height<=320;}))).toBe(true);
});

test('no-JavaScript Korean model and reference remain accessible',async({browser})=>{
 const context=await browser.newContext({javaScriptEnabled:false});const page=await context.newPage();
 await page.goto(root);await expect(page.locator('h1')).toHaveText('도립진자');
 await expect(page.locator('#start-pause')).toBeDisabled();
 await page.locator('summary').click();await expect(page.locator('.loop-details')).toContainText('PID나 스윙업 제어가 아닌 전상태 피드백');
 await expect(page.locator('a[href*="Virtual-Controls-Laboratory"]')).toBeVisible();await context.close();
});

test('hidden tab pauses and reduced motion still integrates; storage denial is safe',async({page})=>{
 await page.emulateMedia({reducedMotion:'reduce'});
 await page.addInitScript(()=>{Object.defineProperty(window,'localStorage',{get(){throw new DOMException('Blocked','SecurityError');}});});
 await page.goto(root);await page.locator('#start-pause').click();
 await expect.poll(()=>page.locator('#sim-time').textContent()).not.toBe('0.00');
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));});
 await expect(page.locator('#run-status')).toHaveText('일시정지');
 const time=await page.locator('#sim-time').textContent();await page.waitForTimeout(200);
 await expect(page.locator('#sim-time')).toHaveText(time);
 await page.locator('[data-lang=en]').click();await expect(page.locator('#simulation-message')).toContainText('tab was hidden');
});
test('pendulum starts paused and has accessible static model and state feedback',async({page})=>{
 await page.goto(root);
 await expect(page.locator('h1')).toHaveText('도립진자');
 await expect(page.locator('#start-pause')).toBeEnabled();
 await expect(page.locator('#sim-time')).toHaveText('0.00');
 await page.waitForTimeout(150);
 await expect(page.locator('#sim-time')).toHaveText('0.00');
 await expect(page.locator('#parameter-controls input')).toHaveCount(5);
 await expect(page.locator('.loop-diagram')).toContainText('kx(x − r) + kv v + kθ θ + kω ω');
 await expect(page.locator('details')).not.toHaveAttribute('open');
});
