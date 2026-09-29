import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
for(const path of ['index.html','cruise-control/index.html','dc-motor/index.html','ball-and-beam/index.html']) {
 test(`${path} has neutral simulator branding`,async()=>{
  const html=await readFile(new URL('../'+path,import.meta.url),'utf8');
  assert.doesNotMatch(html,/icar|연구실로 돌아가기/i);
  assert.match(html,/Control Simulators/);
 });
}
