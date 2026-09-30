import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {chromium} from '@playwright/test';
test('actual 280px canvas labels fit in KO/EN and rendered state remains pure',async()=>{
 const browser=await chromium.launch({headless:true});
 try{
  const page=await browser.newPage({viewport:{width:320,height:440}});
  await page.setContent('<body style="margin:20px;background:white"><canvas width="280" height="400"></canvas></body>');
  const source=await readFile(new URL('../assets/models/rocket-landing.js',import.meta.url),'utf8');
  const errors=await page.evaluate(async source=>{
   const {draw,Simulation}=await import(URL.createObjectURL(new Blob([source],{type:'text/javascript'})));
   const ctx=document.querySelector('canvas').getContext('2d'),original=ctx.fillText.bind(ctx),errors=[];
   for(const language of ['ko','en'])for(const targetX of [-6,6])for(const x of [-13.9,0,13.9]){
    const sim=new Simulation();Object.assign(sim.state,{x,theta:.3,left:12,right:3});sim.params.targetX=targetX;
    const before=JSON.stringify(sim);
    ctx.fillText=(text,x,y)=>{
     const m=ctx.measureText(text);
     if(x-m.actualBoundingBoxLeft<0||x+m.actualBoundingBoxRight>280||y-m.actualBoundingBoxAscent<0||y+m.actualBoundingBoxDescent>400)errors.push(`clipped ${language}: ${text}`);
     if(parseFloat(ctx.font)<12)errors.push(`small: ${text}`);original(text,x,y);
    };
    ctx.clearRect(0,0,280,400);draw(ctx,sim.state,sim.params,280,400,language);
    if(JSON.stringify(sim)!==before)errors.push('draw mutated model');
   }
   const sim=new Simulation();sim.step(1);ctx.clearRect(0,0,280,400);draw(ctx,sim.state,sim.params,280,400,'en');
   return errors;
  },source);
  await page.screenshot({path:'/tmp/rocket-render-320-en.png'});
  assert.deepEqual(errors,[]);
 }finally{await browser.close();}
});
