import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {catalog} from '../assets/catalog.js';

test('all local experiments preserve the shared homepage symbol and footer tag',()=>{
  for(const item of catalog.filter(item=>!item.external)){
    const html=readFileSync(new URL(`../${item.id}/index.html`,import.meta.url),'utf8');
    assert.match(html, /class="brand-mark" aria-hidden="true"><img src="\.\.\/assets\/lab-logo\.png" alt="">/, item.id);
    assert.match(html, /class="footer-tag">Interactive Control Lab<\/span>/,item.id);
  }
});
