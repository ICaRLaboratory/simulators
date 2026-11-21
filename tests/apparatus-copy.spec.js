import { test, expect } from '@playwright/test';
import {measureApparatusCopy} from './apparatus-geometry.js';
const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';

test('rotary: controller and the prose matrix solve retain their mathematical structure', async ({page}) => {
  await page.goto(`${base}rotary-pendulum/`);
  await page.locator('.loop-notes summary').click();
  for (const lang of ['ko','en','ko']) {
    await page.locator(`[data-lang=${lang}]`).click();
    const controller = page.locator('[data-loop-label=controller] math');
    await expect(controller).toHaveText('τ∗=kα(α−αr)+kvα˙+kθθ+kωθ˙');
    expect(await controller.locator('msup').allTextContents()).toEqual(['τ∗']);
    expect(await controller.locator('msub').allTextContents()).toEqual(['kα','αr','kv','kθ','kω']);
    expect(await controller.locator('mover > :first-child').allTextContents()).toEqual(['α','θ']);
    // Temml groups bracketed matrices; select the single equation containing three tables.
    const matrices = await page.locator('.loop-details > div:nth-child(2) math').evaluateAll(roots => roots
      .filter(root=>root.querySelectorAll('mtable').length===3).map(root=>Array.from(root.querySelectorAll('mtable'), table=>Array.from(table.children,row=>Array.from(row.children,cell=>cell.textContent)))));
    const accelerations = page.locator('.loop-details > div:nth-child(2) mtable mover');
    expect(await accelerations.locator(':scope > :first-child').allTextContents()).toEqual(['α','θ']);
    expect(await accelerations.locator(':scope > :last-child').allTextContents()).toEqual(['¨','¨']);
    expect(matrices).toEqual([[[['A','B'],['B','C']],[['α¨'],['θ¨']],[['f'],['h']]]]);
  }
});

// Not a TeX-to-TeX comparison: flatten the *browser's* selected MathML
// against the model author's original display copy. Retain row order and
// reconstruct quotient grouping; ignore typography and notational variants.
function readSelectedCopy() {
  const read=n=>{
    if(n.nodeType===Node.TEXT_NODE)return n.nodeValue;
    if(n.localName==='mtable')return Array.from(n.children,r=>Array.from(r.children,read).join(' ')).join(';');
    if(n.localName==='mfrac'){
      const [top,bottom]=Array.from(n.children,read);
      return top+'/'+(bottom.includes('⋅')?'('+bottom+')':bottom);
    }
    return Array.from(n.childNodes,read).join('');
  };
  const labels=[...document.querySelectorAll('[data-loop-label]')];
  const params=[...document.querySelectorAll('[data-parameter-label]')];
  const notes=[...document.querySelectorAll('.loop-details>div:nth-child(2) p')].slice(0,-1);
  const authored=[...labels,...params,...notes];
  const named=sel=>document.querySelector(sel);
  const plain=authored.concat([...document.querySelectorAll('.model-notes p,.control-help,.metrics span,.legend span,.parameter label')]).map(el=>{
    const clone=el.cloneNode(true);clone.querySelectorAll('math').forEach(m=>m.replaceWith(' '));return clone.textContent;
  }).join('\n');
  return {keys:labels.map(n=>n.dataset.loopLabel),copy:authored.map(read),plain,
    controlLabels:params.map(n=>read(named(`label[for="${n.dataset.parameterLabel}"] > span`)))};
}
const norm=s=>s.replaceAll('˙','\u0307').replaceAll('¨','\u0308').replaceAll('∗','*').replaceAll('⋅','·')
  .replaceAll('q_web','qweb').replaceAll('v_s','vs').normalize('NFKC').replace(/[\s\u2061]/g,'');
const ids=['rotary-pendulum','ball-and-plate','robot-arm','parking','heat-exchanger','drone','impedance-robot','path-tracking','suspension','cstr','aircraft-pitch','rocket-landing'];
for(const id of ids)test(`${id}: preserve authored KO/EN labels, relations and notes`,async({page})=>{
  const {definition:d}=await import(`../assets/models/${id}.js`);
  await page.goto(`${base}${id}/`);await expect(page.locator('#start-pause')).toBeEnabled();
  await page.locator('.loop-notes summary').click();
  for(const [i,lang] of [[0,'ko'],[1,'en'],[0,'ko']]){
    await page.locator(`[data-lang=${lang}]`).click();
    const r=await page.evaluate(readSelectedCopy);
    expect(r.keys).toHaveLength(6);
    const expected=[...r.keys.map(key=>d.loop[key]),...d.parameters.map(p=>p.label),...d.notes];
    expect(r.copy.map(norm)).toEqual(expected.map(pair=>norm(pair[i])));
    expect(r.controlLabels.map(norm)).toEqual(d.parameters.map(p=>norm(p.label[i]+' · '+p.unit)));
    expect(r.plain).not.toMatch(/[α-ω\u0307\u0308≤≥=<>_₀-₉]|\b(?:[xyzduqQTD]|K[pid]|vx|vy|Jarm|qcanonical|Tc)\b/);
    if(id==='robot-arm'){
      const notes=page.locator('.loop-details > div:nth-child(2) p math');
      await expect(notes.filter({hasText:'Ki=0'}).locator('msub')).toHaveText('Ki');
      await expect(notes.filter({hasText:'2.8'})).toHaveText('|q|≥2.8rad');
    }
  }
});

test('narrow static Korean controller and matrix solve remain visible without scripting',async({browser})=>{
  const context=await browser.newContext({javaScriptEnabled:false,viewport:{width:320,height:844}});
  try {
    const page=await context.newPage();await page.goto(`${base}rotary-pendulum/`);
    await page.locator('.loop-notes summary').click();await page.evaluate(()=>document.fonts.ready);
    const matrix=page.locator('.loop-details > div:nth-child(2) p').nth(1);
    await expect(matrix.locator('mtable')).toHaveCount(3);
    await expect(matrix.locator('mtable').nth(1).locator('mover')).toHaveCount(2);
    await expect(matrix).toContainText('함께 풀어');await expect(matrix).not.toContainText('Solving');
    const {regions,issues}=await page.evaluate(measureApparatusCopy);
    expect(regions).toBe(6);expect(issues).toEqual([]);
  } finally {await context.close();}
});
