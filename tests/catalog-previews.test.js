import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {catalog} from '../assets/catalog.js';
test('each experiment has a unique actual apparatus capture in both locales',()=>{
 const root=new URL('../assets/previews/',import.meta.url);
 const manifest=JSON.parse(readFileSync(new URL('manifest.json',root),'utf8'));
 assert.equal(manifest.length,catalog.length*2);
 for(const lang of ['ko','en']){
  const hashes=[];
  for(const item of catalog){
   const entries=manifest.filter(x=>x.id===item.id&&x.lang===lang);assert.equal(entries.length,1,item.id);
   const entry=entries[0];assert.equal(entry.file,`${item.id}-${lang}.png`);
   const bytes=readFileSync(new URL(entry.file,root));assert.equal(bytes.subarray(1,4).toString(),'PNG');
   const hash=createHash('sha256').update(bytes).digest('hex');assert.equal(hash,entry.sha256);hashes.push(hash);
  }
  assert.equal(new Set(hashes).size,catalog.length,`duplicate ${lang} previews`);
 }
});
