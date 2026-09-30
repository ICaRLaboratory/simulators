import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog} from '../assets/catalog.js';
test('rocket landing is a local runnable experiment with a verified related project',async()=>{
 const entry=catalog.find(x=>x.id==='rocket-landing');assert.ok(entry,'missing rocket catalog entry');
 assert.equal(entry.external,false);assert.equal(entry.status,'ready');assert.equal(entry.href,'rocket-landing/');
 assert.equal(entry.source,'https://www.mathworks.com/help/mpc/ug/landing-rocket-with-mpc-example.html');
 const runtime=await readFile(new URL('../assets/experiment-app.js',import.meta.url),'utf8');
 assert.ok(runtime.includes("import('./models/rocket-landing.js')"));
 const html=await readFile(new URL('../rocket-landing/index.html',import.meta.url),'utf8');
 assert.match(html,/data-experiment="rocket-landing"/);assert.ok(html.includes(entry.source));
 assert.match(html,/id="disturbance-parameters"/);assert.match(html,/class="loop-diagram"/);
});
