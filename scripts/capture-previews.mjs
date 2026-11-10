// Capture the actual apparatus renderers; never substitute category icons.
// Run after renderer edits with the repository served at /simulators/.
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {catalog} from '../assets/catalog.js';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const out=new URL('../assets/previews/',import.meta.url);
await mkdir(out,{recursive:true});
const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,
 args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
const records=[];
try{
 for(const item of catalog){
  for(const lang of ['ko','en']){
   const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
   const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
   if(!item.external)await page.addInitScript(()=>{
    const nativeRequest=window.requestAnimationFrame.bind(window);
    let callbacks=[],now=0;window.requestAnimationFrame=fn=>{callbacks.push(fn);return callbacks.length;};
    window.previewFrames=async count=>{
     for(let i=0;i<count;i++){
      now+=20;const current=callbacks;callbacks=[];for(const fn of current)fn(now);
      if((i+1)%8===0&&callbacks.length)await new Promise(resolve=>nativeRequest(resolve));
     }
     await new Promise(resolve=>nativeRequest(resolve));
    };
   });
   const canonical=item.external?new URL(item.href):null;
   if(canonical)canonical.searchParams.set('lang',lang);
   const url=item.external?(process.env.RESEARCH_BASE?new URL(`research.html${canonical.search}${canonical.hash}`,process.env.RESEARCH_BASE).href:canonical.href):`${base}${item.id}/?lang=${lang}`;
   await page.goto(url);let canvas;
   if(item.external){
    canvas=page.locator('.sim__fig canvas[data-renderer="three"]:visible');await canvas.waitFor({state:'visible'});
    await page.evaluate(()=>document.fonts.ready);
    // Research has its own renderer/aspect ratio; retain the real apparatus view.
    await canvas.scrollIntoViewIfNeeded();await page.waitForTimeout(250);
   }else{
    await page.locator('#start-pause:not([disabled])').waitFor();
    await page.locator('#apparatus[data-renderer="three"]').waitFor({state:'visible'});
    await page.addStyleTag({content:'.three-apparatus { width:640px!important; height:430px!important; max-width:none!important; }'});
    await page.evaluate(()=>document.fonts.ready);
    await page.locator('#start-pause').click();await page.evaluate(()=>window.previewFrames(101));
    await page.locator('#start-pause').click();canvas=page.locator('#apparatus');
   }
   if(errors.length)throw Error(`${item.id}: ${errors.join('; ')}`);
   const name=`${item.id}-${lang}.png`,path=new URL(name,out);
   // The 3D viewport already isolates the apparatus; old pixel crops would cut it.
   await canvas.scrollIntoViewIfNeeded();
   await canvas.screenshot({path:path.pathname});
   const bytes=await readFile(path);
   records.push({id:item.id,lang,file:name,source:item.external?canonical.href:`${item.id}/?lang=${lang}`,renderer:'three',sha256:createHash('sha256').update(bytes).digest('hex')});
   await writeFile(new URL('manifest.json',out),JSON.stringify(records,null,2)+'\n');
   await context.close();
  }
 }
 if(records.length!==catalog.length*2)throw Error('Incomplete preview set');
 for(const lang of ['ko','en'])if(new Set(records.filter(x=>x.lang===lang).map(x=>x.sha256)).size!==catalog.length)throw Error(`Duplicate ${lang} apparatus previews`);
 console.log(JSON.stringify({experiments:catalog.length,images:records.length,unique:true}));
}finally{await browser.close();}
