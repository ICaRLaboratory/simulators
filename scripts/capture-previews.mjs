// Capture the real device viewport or response graph, never a category icon.
import {chromium} from 'playwright';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
import {catalog} from '../assets/catalog.js';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const locales=['ko','en'];

async function preparePidPreview(page){
 const panel=page.locator('#pid-response-panel');
 await panel.locator('#pid-output-plot path[data-series="y"][d]').waitFor({state:'visible'});
 await page.locator('#pin-response').click();
 await page.locator('#enable-i').check();
 await page.waitForFunction(()=>{
  const plot=document.getElementById('pid-output-plot');
  const curve=key=>plot.querySelector(`path[data-series="${key}"]`)?.getAttribute('d');
  return curve('saved') && curve('y') && curve('saved')!==curve('y');
 });
 return panel;
}

export async function prepareGraphPreview(page,id){
 let panel;
 if(id==='pid-lti')panel=await preparePidPreview(page);
 else if(id==='mpc-lti'){
  panel=page.locator('#mpc-response-panel');
  for(const series of ['y','prediction']){
   await panel.locator(`#mpc-output-plot path[data-series="${series}"][d]`).waitFor({state:'visible'});
  }
 }else if(['deepc-lti','smc-lti','tdc-lti'].includes(id)){
  panel=page.locator('#method-response-panel');
  await panel.locator('svg path[data-series="output"][d]').waitFor({state:'visible'});
 }else throw Error(`No graph preview recipe for ${id}`);
 await page.evaluate(()=>document.fonts.ready);
 return panel;
}

async function capture(browser,item,lang){
 const context=await browser.newContext({viewport:{width:1280,height:900},deviceScaleFactor:1,reducedMotion:'reduce'});
 try{
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  if(item.view==='apparatus')await page.addInitScript(()=>{
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
  const source=item.external?canonical.href:`${item.id}/?lang=${lang}`;
  const url=item.external?(process.env.RESEARCH_BASE?new URL(`research.html${canonical.search}${canonical.hash}`,process.env.RESEARCH_BASE).href:source):new URL(source,base).href;
  await page.goto(url);let view,renderer='three';
  if(item.external){
   view=page.locator('.sim__fig canvas[data-renderer="three"]:visible');await view.waitFor({state:'visible'});
   await page.evaluate(()=>document.fonts.ready);
   await view.scrollIntoViewIfNeeded();await page.waitForTimeout(250);
  }else if(item.view==='graph'){
   view=await prepareGraphPreview(page,item.id);renderer='svg';
  }else{
   await page.locator('#start-pause:not([disabled])').waitFor();
   await page.locator('#apparatus[data-renderer="three"]').waitFor({state:'visible'});
   await page.addStyleTag({content:'.three-apparatus { width:640px!important; height:430px!important; max-width:none!important; }'});
   await page.evaluate(()=>document.fonts.ready);
   await page.locator('#start-pause').click();
   // The Gen3 target finishes its approach at 2 s; capture the subsequent wall press.
   await page.evaluate(n=>window.previewFrames(n),item.id==='impedance-robot'?201:101);
   await page.locator('#start-pause').click();view=page.locator('#apparatus');
  }
  await view.scrollIntoViewIfNeeded();
  const bytes=await view.screenshot();
  if(errors.length)throw Error(`${item.id}: ${errors.join('; ')}`);
  const file=`${item.id}-${lang}.png`,sha256=createHash('sha256').update(bytes).digest('hex');
  return {bytes,record:{id:item.id,lang,file,source,renderer,sha256}};
 }finally{await context.close();}
}

// Validate the entire batch (including retained records) before writing any files.
export function completeManifest(records){
 const ordered=catalog.flatMap(({id})=>locales.map(lang=>{
  const matches=records.filter(r=>r.id===id&&r.lang===lang);
  if(matches.length!==1)throw Error(`Expected one preview for ${id}/${lang}, found ${matches.length}`);
  return matches[0];
 }));
 if(ordered.length!==records.length)throw Error('Unexpected preview entry');
 for(const lang of locales)if(new Set(ordered.filter(x=>x.lang===lang).map(x=>x.sha256)).size!==catalog.length)throw Error(`Duplicate ${lang} previews`);
 return ordered;
}

export async function capturePreviews(ids,out){
 const selected=new Set(ids);
 for(const id of selected)if(!catalog.some(item=>item.id===id))throw Error(`Unknown catalog ID: ${id}`);
 const items=selected.size?catalog.filter(item=>selected.has(item.id)):catalog;
 const manifest=new URL('manifest.json',out);
 const kept=selected.size?JSON.parse(await readFile(manifest,'utf8')).filter(r=>!selected.has(r.id)):[];
 const browser=await chromium.launch({headless:true,executablePath:process.env.CHROMIUM_PATH,
  args:['--enable-webgl','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const captures=[];
 try{
  for(const item of items)for(const lang of locales)captures.push(await capture(browser,item,lang));
 }finally{await browser.close();}
 const records=completeManifest([...kept,...captures.map(c=>c.record)]);
 await mkdir(out,{recursive:true});
 for(const {bytes,record} of captures)await writeFile(new URL(record.file,out),bytes);
 await writeFile(manifest,JSON.stringify(records,null,2)+'\n');
 return {experiments:catalog.length,images:records.length,captured:captures.length,unique:true};
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
 const summary=await capturePreviews(process.argv.slice(2),new URL('../assets/previews/',import.meta.url));
 console.log(JSON.stringify(summary));
}
