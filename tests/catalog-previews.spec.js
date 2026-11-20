import {test,expect} from '@playwright/test';
import {catalog} from '../assets/catalog.js';
import {mkdtemp,readFile,readdir,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import {capturePreviews,completeManifest,prepareGraphPreview} from '../scripts/capture-previews.mjs';
const base=process.env.SIM_BASE||'http://127.0.0.1:8765/simulators/';
for (const id of ['pid-lti','mpc-lti']) test(`${id}: single-ID preview updates retain the other localized records in catalog order`, () => {
 const records = catalog.flatMap(({id}) => ['ko','en'].map(lang => ({id,lang,sha256:`${id}-${lang}`})));
 const kept = records.filter(r => r.id !== id);
 const updated = records.filter(r => r.id === id).map(r => ({...r, sha256:`new-${r.lang}`}));
 const result = completeManifest([...kept,...updated]);
 expect(result.map(r => [r.id,r.lang])).toEqual(records.map(r => [r.id,r.lang]));
 expect(result.filter(r => r.id !== id)).toEqual(kept);
 expect(result.filter(r => r.id === id)).toEqual(updated);
 expect(() => completeManifest(kept)).toThrow(id);
 expect(() => completeManifest([...kept,...updated,...updated])).toThrow(id);
});

test('one selected-ID batch bootstraps six previews and preserves every unrelated record', async () => {
 test.setTimeout(90_000); // Two Chromium runs capture ten localized panels.
 const ids = ['ddc-lti','smc-lti','tdc-lti'];
 const previous = catalog.filter(item => !ids.includes(item.id)).flatMap(({id}) =>
  ['ko','en'].map(lang => ({id,lang,sha256:`${id}-${lang}`})));
 const dir = await mkdtemp(join(tmpdir(),'preview-batch-'));
 const out = pathToFileURL(dir + '/');
 const manifest = new URL('manifest.json',out);
 try {
  await writeFile(manifest,JSON.stringify(previous));
  await expect(capturePreviews([ids[0],'unknown-id'],out)).rejects.toThrow('unknown-id');
  // Two IDs are not enough: don't write a partial manifest or any images.
  await expect(capturePreviews(ids.slice(0,2),out)).rejects.toThrow('tdc-lti/ko');
  expect(await readdir(dir)).toEqual(['manifest.json']);
  expect(JSON.parse(await readFile(manifest,'utf8'))).toEqual(previous);
  const summary = await capturePreviews(ids,out);
  expect(summary).toMatchObject({captured:6,images:catalog.length*2});
  const records = JSON.parse(await readFile(manifest,'utf8'));
  expect(records.filter(r => !ids.includes(r.id))).toEqual(previous);
  expect(records).toEqual(completeManifest(records));
  const files = ids.flatMap(id => ['ko','en'].map(lang => `${id}-${lang}.png`));
  expect((await readdir(dir)).sort()).toEqual(['manifest.json',...files].sort());
 } finally { await rm(dir,{recursive:true,force:true}); }
});

// Exercise the generator's production recipe without writing a screenshot or manifest.
for (const lang of ['ko', 'en']) test(`graph preview compares PI with a pinned P response (${lang})`, async ({page}) => {
 await page.goto(`${base}pid-lti/?lang=${lang}`);
 const panel = await prepareGraphPreview(page,'pid-lti');
 await expect(panel).toHaveAttribute('id', 'pid-response-panel');
 await expect(panel.getByRole('heading')).toHaveText(lang === 'ko' ? '단위 계단응답' : 'Unit-step response');
 await expect(page.locator('#enable-i')).toBeChecked();
 const curves = await panel.locator('svg path[data-series="saved"], svg path[data-series="y"]').evaluateAll(ns => ns.map(n => n.getAttribute('d')));
 expect(curves).toHaveLength(2);
 expect(new Set(curves).size).toBe(2);
});

for (const lang of ['ko','en']) test(`MPC preview shows the response and prediction without a PID overlay (${lang})`, async ({page}) => {
 await page.goto(`${base}mpc-lti/?lang=${lang}`);
 const panel = await prepareGraphPreview(page,'mpc-lti');
 await expect(panel).toHaveAttribute('id','mpc-response-panel');
 await expect(panel.getByRole('heading')).toHaveText(lang === 'ko' ? '단위 계단응답' : 'Unit-step response');
 await expect(panel.locator('[data-series="pid"], [data-pid]')).toHaveCount(0);
 for (const series of ['y','prediction']) {
  const path=panel.locator(`#mpc-output-plot path[data-series="${series}"]`);
  await expect(path).toBeVisible();
  await expect(path).toHaveAttribute('d',/\S/);
 }
});

for (const id of ['ddc-lti','smc-lti','tdc-lti']) for (const lang of ['ko','en']) {
 test(`${id}: preview uses the localized first response panel (${lang})`, async ({page}) => {
  await page.goto(`${base}${id}/?lang=${lang}`);
  const panel = await prepareGraphPreview(page,id);
  await expect(page.locator(`[data-lang="${lang}"]`)).toHaveAttribute('aria-pressed','true');
  await expect(panel).toHaveAttribute('id','method-response-panel');
  const series = await panel.locator('svg path[data-series]').evaluateAll(paths => paths.map(path => path.dataset.series).sort());
  expect(series).toEqual(['output','target']); // One controller and its reference, no comparison overlay.
  const output = panel.locator('svg path[data-series="output"]');
  await expect(output).toBeVisible();
  await expect(output).toHaveAttribute('d',/\S/);
 });
}

test('every catalog experiment has its own real, loaded localized preview',async({page})=>{
 await page.goto(base+'?lang=ko');await expect(page.locator('.sim-card')).toHaveCount(catalog.length);
 await expect(page.locator('.card-preview')).toHaveCount(catalog.length);
 for(const lang of ['ko','en']){
  await page.locator(`[data-lang=${lang}]`).click();
  const images=page.locator('.card-preview');
  for(const image of await images.all()){await image.scrollIntoViewIfNeeded();await expect.poll(()=>image.evaluate(n=>n.complete&&n.naturalWidth>0)).toBe(true);}
  const sources=await images.evaluateAll(ns=>ns.map(n=>n.getAttribute('src')));
  expect(new Set(sources).size).toBe(catalog.length);expect(sources.every(s=>s.endsWith(`-${lang}.png`))).toBe(true);
  for(const width of [320,1280]){await page.setViewportSize({width,height:900});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
   expect(await page.locator('.card-visual').evaluateAll(ns=>ns.every(n=>{const img=n.querySelector('img').getBoundingClientRect();return img.bottom<=n.getBoundingClientRect().bottom+1&&[...n.querySelectorAll('.card-number,.card-status')].every(b=>b.getBoundingClientRect().bottom<=img.top+1);}))).toBe(true);
  }
 }
});
