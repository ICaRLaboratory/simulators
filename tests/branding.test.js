import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog} from '../assets/catalog.js';
for(const path of ['index.html',...catalog.filter(item=>!item.external).map(item=>`${item.id}/index.html`)]) {
 test(`${path} has neutral simulator branding`,async()=>{
  const html=await readFile(new URL('../'+path,import.meta.url),'utf8');
  assert.doesNotMatch(html,/icar|연구실로 돌아가기/i);
  assert.match(html,/Control Simulators/);
 });
}
