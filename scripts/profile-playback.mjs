// Headless renderer-cadence probe, not a guarantee of display FPS on user hardware.
// Prefill 16 simulation seconds, then measure 3 real seconds per case.
// Start is the sole playback intent; OUT selects the JSON report.
import {chromium} from 'playwright';
import {writeFile} from 'node:fs/promises';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const browser=await chromium.launch({headless:true});const rows=[];
try{for(const id of ['cruise-control','rotary-pendulum','impedance-robot'])for(const motion of ['no-preference','reduce']){
 const context=await browser.newContext({viewport:{width:1280,height:900},reducedMotion:motion});const page=await context.newPage();
 if(process.env.CPU_RATE){const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:Number(process.env.CPU_RATE)});}
 await page.addInitScript(()=>{const raf=window.requestAnimationFrame.bind(window);let queue=[],hold=true,time=0,offset=0;window.profile={frames:[],draws:[],costs:[]};window.requestAnimationFrame=fn=>{const wrapped=t=>{const begin=performance.now();fn(hold?t:t+offset);if(!hold){window.profile.frames.push(t);window.profile.costs.push(performance.now()-begin);}};if(hold){queue.push(wrapped);return queue.length;}return raf(wrapped);};const clear=CanvasRenderingContext2D.prototype.clearRect;CanvasRenderingContext2D.prototype.clearRect=function(...args){if(!hold&&this.canvas.id==='apparatus')window.profile.draws.push(performance.now());return clear.apply(this,args);};window.beginProfile=()=>{for(let i=0;i<960;i++){time+=1000/60;const q=queue;queue=[];for(const f of q)f(time);}offset=time-performance.now();hold=false;for(const f of queue)raf(f);queue=[];};});
 await page.goto(`${base}${id}/`);await page.locator('#start-pause:not([disabled])').waitFor();await page.locator('#start-pause').click();await page.evaluate(()=>window.beginProfile());await page.waitForTimeout(3000);
 const result=await page.evaluate(()=>{const p=window.profile;const q=(v,n)=>[...v].sort((a,b)=>a-b)[Math.floor((v.length-1)*n)];const gaps=p.draws.slice(1).map((t,i)=>t-p.draws[i]);return {frames:p.frames.length,draws:p.draws.length,drawFps:1000*(p.draws.length-1)/(p.draws.at(-1)-p.draws[0]),drawGapP95:q(gaps,.95),callbackMsP50:q(p.costs,.5),callbackMsP95:q(p.costs,.95),reduced:matchMedia('(prefers-reduced-motion: reduce)').matches};});rows.push({id,motion,...result});await writeFile(process.env.OUT||'/tmp/fps-before.json',JSON.stringify(rows,null,2));await context.close();
}console.log(JSON.stringify(rows,null,2));}finally{await browser.close();}
