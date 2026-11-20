import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {catalog} from '../assets/catalog.js';
import {localizedHref} from '../assets/i18n.js';
test('each experiment has a unique capture of its actual view in both locales',()=>{
 const root=new URL('../assets/previews/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
 assert.equal(manifest.length,catalog.length*2);
 for(const lang of ['ko','en']){
  const hashes=[];
  for(const item of catalog){
   const entries=manifest.filter(x=>x.id===item.id&&x.lang===lang);assert.equal(entries.length,1,item.id);
   const entry=entries[0];assert.equal(entry.file,`${item.id}-${lang}.png`);
   assert.equal(entry.source,localizedHref(item.href,lang),`${item.id}: localized source`);
   assert.equal(entry.renderer,item.view === 'graph' ? 'svg' : 'three', `${item.id}: preview must match the actual renderer`);
   const bytes=readFileSync(new URL(entry.file,root));assert.equal(bytes.subarray(1,4).toString(),'PNG');
   const hash=createHash('sha256').update(bytes).digest('hex');assert.equal(hash,entry.sha256);hashes.push(hash);
  }
  assert.equal(new Set(hashes).size,catalog.length,`duplicate ${lang} previews`);
 }
});
