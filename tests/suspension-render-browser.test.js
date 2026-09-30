import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { chromium } from '@playwright/test';

test('320px viewport: actual canvas label bounds, 12px type and unobstructed actuator rod in both languages', async () => {
  const browser = await chromium.launch({headless:true});
  try {
    const page = await browser.newPage({viewport:{width:320,height:560},deviceScaleFactor:2});
    await page.setContent('<body style="margin:20px;background:#f5f5f3"><canvas width="280" height="260"></canvas></body>');
    const source=await readFile(new URL('../assets/models/suspension.js',import.meta.url),'utf8');
    const errors=await page.evaluate(async source=>{
      const {draw,Simulation}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
      const canvas=document.querySelector('canvas'), ctx=canvas.getContext('2d'), errors=[];
      const original=ctx.fillText.bind(ctx);
      for(const language of ['ko','en']) for(const zs of [-1.01,0,1.01]) for(const zu of [-1.01,0,1.01]) for(const vs of [-1,0,1]) {
        const sim=new Simulation();Object.assign(sim.state,{zs,zu,vs,distance:6,bumpStart:5});
        ctx.fillText=(text,x,y)=>{
          const m=ctx.measureText(text),left=x-m.actualBoundingBoxLeft,right=x+m.actualBoundingBoxRight;
          if(left<0||right>280||y-m.actualBoundingBoxAscent<0||y+m.actualBoundingBoxDescent>260) errors.push(`clipped ${language}: ${text}`);
          if(parseFloat(ctx.font)<12) errors.push(`small: ${text}`);
          const top=78-6*Math.tanh(zs*12),bottom=171-6*Math.tanh(zu*12);
          if(left<225&&right>225&&y>top&&y-m.actualBoundingBoxAscent<bottom-44) errors.push(`label crosses actuator rod: ${text}`);
          original(text,x,y);
        };
        ctx.clearRect(0,0,280,260);draw(ctx,sim.state,sim.params,280,260,language);
      }
      ctx.fillText=original;
      ctx.clearRect(0,0,280,260);
      const sim=new Simulation();sim.state.vs=-0.4;draw(ctx,sim.state,sim.params,280,260,'en');
      return errors;
    },source);
    await page.screenshot({path:'/tmp/suspension-render-320-en.png'});
    assert.deepEqual(errors,[]);
  } finally {await browser.close();}
});
