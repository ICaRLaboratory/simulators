import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalog} from '../assets/catalog.js';
test('Korean reset and dashed-line wording stays consistent',()=>{
 for(const id of ['cruise-control','dc-motor','ball-and-beam']){
  const html=readFileSync(new URL(`../${id}/index.html`,import.meta.url),'utf8');
  assert.ok(html.includes('초기화하면 시간과 상태가 처음으로 돌아갑니다.'),id);
 }
 for(const id of ['rotary-pendulum','ball-and-plate'])assert.ok(!readFileSync(new URL(`../assets/models/${id}.js`,import.meta.url),'utf8').includes('파선'),id);
});
test('generated loop accessible names join experiment titles naturally',()=>{
 for(const item of catalog.filter(x=>!x.external)){
  const html=readFileSync(new URL(`../${item.id}/index.html`,import.meta.url),'utf8');
  if(!html.includes('data-experiment='))continue;
  assert.ok(!html.includes('제어 제어 구조'),item.id);
  assert.ok(html.includes('의 제어 구조'),item.id);
 }
});
