import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('catalog search combines category, ready and case-insensitive text', async () => {
  const { filterCatalog } = await import('../assets/catalog.js');
  assert.equal(typeof filterCatalog, 'function');
  assert.equal(filterCatalog({query:'  DC MOTOR  '}).length, 1);
  assert.equal(filterCatalog({ready:true}).length, 3);
  assert.equal(filterCatalog({category:'모빌리티',ready:true}).length, 1);
  assert.equal(filterCatalog({query:'존재하지않는실험'}).length, 0);
});

test('pages expose keyboard accessible simulation and catalog controls', async () => {
  const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(home, /id="search"/);
  assert.match(home, /research\.html/);
  for (const kind of ['cruise-control','dc-motor','ball-and-beam']) {
    const html = await readFile(new URL(`../${kind}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /lang="ko"/);
    assert.match(html, new RegExp(`data-simulator="${kind}"`));
    for (const id of ['start-pause','reset','disturb','sim-time','sim-output']) assert.match(html,new RegExp(`id="${id}"`));
    assert.match(html, /type="module"/);
  }
});

test('catalog has 15 unique, sourced entries and only three working launches', async () => {
  const { catalog } = await import('../assets/catalog.js');
  assert.equal(catalog.length, 15);
  assert.equal(new Set(catalog.map(item => item.id)).size, 15);
  assert.deepEqual(catalog.filter(item => item.status === 'ready').map(item => item.id), ['cruise-control', 'dc-motor', 'ball-and-beam']);
  for (const item of catalog) {
    for (const field of ['name', 'english', 'description', 'category', 'sourceName']) assert.ok(item[field], `${item.id}: ${field}`);
    assert.ok(item.features.length >= 2);
    assert.match(item.source, /^https:\/\//);
    if (item.status === 'ready') assert.equal(item.href, `${item.id}/`);
    else { assert.equal(item.status, 'planned'); assert.equal(item.href, null); }
  }
});
