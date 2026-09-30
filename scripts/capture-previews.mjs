// Capture the actual apparatus renderers; never substitute category icons.
// Run after renderer edits with the repository served at /simulators/.
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalog} from '../assets/catalog.js';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const out=new URL('../assets/previews/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true});
const records=[];
try{
 for(const item of catalog){
  for(const lang of ['ko','en']){
   const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   if(!item.external)await page.addInitScript(()=>{let callbacks=[],now=0;window.requestAnimationFrame=fn=>{callbacks.push(fn);return callbacks.length;};window.previewFrames=count=>{for(let i=0;i<count;i++){now+=20;const current=callbacks;callbacks=[];for(const fn of current)fn(now);}};});
   const url=item.external?item.href.replace('lang=ko',`lang=${lang}`):`${base}${item.id}/?lang=${lang}`;
   await page.goto(url);let canvas;
   if(item.external){
    canvas=page.locator('.sim__fig canvas:visible');await canvas.waitFor({state:'visible'});
    await page.evaluate(()=>document.fonts.ready);
    // Research has its own renderer/aspect ratio; retain the real apparatus view.
    await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(250);
   }else{
    await page.locator('#start-pause:not([disabled])').waitFor();
    await page.addStyleTag({content:'#apparatus { width:640px!important; height:340px!important; max-width:none!important; }'});
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('#start-pause').click();await page.evaluate(()=>window.previewFrames(101));
    await page.locator('#start-pause').click();canvas=page.locator('#apparatus');
   }
   if(errors.length)throw Error(`${item.id}: ${errors.join('; ')}`);
   const name=`${item.id}-${lang}.png`,path=new URL(name,out);
   // Focus the apparatus rather than shrinking a full world/plot panel into a card.
   const crops={
    'inverted-pendulum':[225,4,230,320],
    'rotary-pendulum':[210,50,240,255],
    'ball-and-plate':[190,40,280,265],
    'robot-arm':[215,45,250,240],
    'impedance-robot':[210,45,280,280],
    drone:[155,110,330,160]
   };
   await canvas.scrollIntoViewIfNeeded();
   const box=await canvas.boundingBox();
   const crop=item.external?[box.width*.42,0,box.width*.575,box.height*.52]:crops[item.id];
   if(crop)await page.screenshot({path:path.pathname,clip:{x:box.x+crop[0],y:box.y+crop[1],width:crop[2],height:crop[3]}});
   else await canvas.screenshot({path:path.pathname});
   const bytes=await readFile(path);
   records.push({id:item.id,lang,file:name,source:item.external?url:`${item.id}/?lang=${lang}`,sha256:createHash('sha256').update(bytes).digest('hex')});
   await writeFile(new URL('manifest.json',out),JSON.stringify(records,null,2)+'\n');
   await context.close();
  }
 }
 if(records.length!==catalog.length*2)throw Error('Incomplete preview set');
 for(const lang of ['ko','en'])if(new Set(records.filter(x=>x.lang===lang).map(x=>x.sha256)).size!==catalog.length)throw Error(`Duplicate ${lang} apparatus previews`);
 console.log(JSON.stringify({experiments:catalog.length,images:records.length,unique:true}));
}finally{await browser.close();}
