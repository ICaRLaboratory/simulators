import {test,expect} from '@playwright/test';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
const cases={
 'robot-arm':['PID'], 'aircraft-pitch':['PID'], drone:['PID','PD'],
 'heat-exchanger':['PI'], cstr:['PI'], 'ball-and-plate':['PD'], 'rocket-landing':['PD','P'],
};
// Check the law in the *visible controller*, not the retained plant disclosure.
const signatures={
 'robot-arm':['Kpiei+KiiIi−Kdiq˙i+Gi(q)','(L1,L2)=(40,20)','(40,0,12)','(25,0,5)'],
 'aircraft-pitch':['Kpe+I−Kdq','q=θ˙','(2,0.2,2)','L=20°'],
 drone:['9.81+Kpzez+KizI−Kdzz˙','Kpϕeϕ−Kdϕϕ˙','T−τ/ℓ','T+τ/ℓ','(6,2,4)','(1.6,0.5)'],
 'heat-exchanger':['Q∗=Kpe+I','ΔI=KieΔt','clip(Q∗,0,150)','(3,0.15)'],
 cstr:['Tc∗=300K+Kpe+I','ΔI=KieΔt','Tc,min,330','(5,0.08)'],
 'ball-and-plate':['βi∗=kpiei−kdivi','vi=q˙i','B=0.2rad','(0.8,0.65)'],
 'rocket-landing':['Kx(xr−x)−1.3vx','Kv(vr−vy)','J[12(θr−θ)−6ω]','A=min(T,24−T)','FL=(T+Δ)/2','FR=(T−Δ)/2'],
};
function diagramOverflow(){
 const issues=[];
 for(const f of document.querySelectorAll('.pid-pair foreignObject')){
  const b=f.getBoundingClientRect(),w=document.createTreeWalker(f,NodeFilter.SHOW_TEXT);
  for(let n;(n=w.nextNode());){
   const r=document.createRange();r.selectNodeContents(n);
   for(const a of r.getClientRects())if(a.width&&a.height&&(a.left<b.left-1||a.right>b.right+1||a.bottom>b.bottom+1||a.top<b.top-1))issues.push(f.textContent);
  }
 }
 return [...new Set(issues)];
}
for(const [id,families] of Object.entries(cases))test(`${id}: standard error branches and implemented signal path`,async({page})=>{
 await page.goto(`${base}${id}/`);
 const views=page.locator('figure[data-pid-view]');expect(await views.evaluateAll(ns=>ns.map(n=>n.dataset.pidView))).toEqual(['standard','experiment']);
 const standard=views.first(),actual=views.last();
 for(const [i,kind] of families.entries()){
  const row=standard.locator('[data-family]').nth(i);await expect(row).toHaveAttribute('data-family',kind);
  expect(await row.locator('[data-branch]').evaluateAll(ns=>ns.map(n=>n.dataset.branch).join(''))).toBe(kind);
  for(const term of kind){
   const attached=await row.evaluate((g,t)=>{
    const box=g.querySelector(`[data-branch=${t}]`).getBBox(),y=box.y+box.height/2;
    const input=g.querySelector(`path[data-input=${t}]`),output=g.querySelector(`path[data-output=${t}]`);
    const a=input.getPointAtLength(input.getTotalLength()),b=output.getPointAtLength(0);
    return Math.hypot(a.x-box.x,a.y-y)<1 && Math.hypot(b.x-box.x-box.width,b.y-y)<1;
   },term);expect(attached,`${id}: ${term} must join both wires`).toBe(true);
  }
  if(kind.includes('D'))await expect(row.locator('[data-branch=D] mover > mi')).toHaveText('e');
 }
 await expect(actual.locator('path[data-signal=derivative]')).toHaveCount(families.includes('PI')?0:1);
 await expect(actual.locator('path[data-signal=disturbance]')).toHaveCount(1);
 for(const [lang,width] of [['ko',1280],['en',320],['ko',320]]){
  await page.setViewportSize({width,height:900});await page.locator(`[data-lang=${lang}]`).click();await page.evaluate(()=>document.fonts.ready);
  const a=await standard.boundingBox(),b=await actual.boundingBox();expect(b.y).toBeGreaterThanOrEqual(a.y+a.height-1);
  const notes=actual.locator('.pid-controller');await expect(notes).toBeVisible();await expect(notes.locator('math').first()).toBeVisible();
  const law=(await notes.locator('.pid-relations math').allTextContents()).join(' ').replaceAll('\u2061','');
  for(const signature of signatures[id])expect(law).toContain(signature);
  expect(await notes.innerText()).toMatch(lang==='ko'?/기본/:/default/i);
  expect(await page.evaluate(diagramOverflow)).toEqual([]);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  if(width===320){
   const pan=page.locator('.pid-pair');await pan.evaluate(n=>{n.scrollLeft=n.scrollWidth;});
   const r=await notes.boundingBox(),v=await pan.boundingBox();expect(Math.abs(r.x-v.x)).toBeLessThan(1);expect(r.width).toBeLessThanOrEqual(v.width+1);
   await pan.evaluate(n=>{n.scrollLeft=0;});
  }
 }
});
test('all seven comparisons, equations and captions work in static Korean',async({browser})=>{
 const ctx=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:844}});
 try{
  const page=await ctx.newPage();
  for(const id of Object.keys(cases)){
   await page.goto(`${base}${id}/`);await page.evaluate(()=>document.fonts.ready);
   await expect(page.locator('.pid-pair figcaption')).toHaveText([/^1\. 표준/,/^2\..*실험/]);
   await expect(page.locator('.pid-controller .pid-watch')).toHaveText(/[가-힣]/);
   await expect(page.locator('.pid-pair svg[role=img]')).toHaveCount(2);
   expect(await page.evaluate(diagramOverflow),id).toEqual([]);
  }
 }finally{await ctx.close();}
});
