import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('catalog search combines category, ready and case-insensitive text', async () => {
  const { filterCatalog } = await import('../assets/catalog.js');
  assert.equal(typeof filterCatalog, 'function');
  assert.equal(filterCatalog({query:'  DC MOTOR  '}).length, 1);
  assert.equal(filterCatalog({ready:true}).length, 5);
  assert.equal(filterCatalog({category:'모빌리티',ready:true}).length, 1);
  assert.equal(filterCatalog({query:'존재하지않는실험'}).length, 0);
});

test('pages expose keyboard accessible simulation and catalog controls', async () => {
  const home = await readFile(new URL('../index.html', import.meta.url), 'utf8');
  assert.match(home, /id="search"/);
  assert.match(home, /aria-label="Control Simulators 홈"/);
  for (const kind of ['cruise-control','dc-motor','ball-and-beam']) {
    const html = await readFile(new URL(`../${kind}/index.html`, import.meta.url), 'utf8');
    assert.match(html, /lang="ko"/);
    assert.match(html, new RegExp(`data-simulator="${kind}"`));
    for (const id of ['start-pause','reset','disturb','sim-time','sim-output']) assert.match(html,new RegExp(`id="${id}"`));
    assert.match(html, /type="module"/);
  }
});

test('catalog has 17 unique sources, three local launches and two research links', async () => {
  const { catalog } = await import('../assets/catalog.js');
  assert.equal(catalog.length, 17);
  assert.equal(new Set(catalog.map(item => item.id)).size, 17);
  assert.deepEqual(catalog.filter(item => item.status === 'ready').map(item => item.id), ['cruise-control', 'dc-motor', 'ball-and-beam', 'research-tracking', 'research-contact']);
  assert.equal(catalog.filter(item => item.status==='planned').length,12);
  for (const item of catalog) {
    for (const field of ['name', 'english', 'description', 'category', 'sourceName']) assert.ok(item[field], `${item.id}: ${field}`);
    assert.ok(item.features.length >= 2);
    assert.match(item.source, /^https:\/\//);
    if (item.external) {
      assert.equal(item.status,'ready');
      assert.equal(item.category,'로보틱스');
      const url=new URL(item.href);
      assert.equal(url.origin,'https://icarlaboratory.github.io');
      assert.equal(url.pathname,'/research.html');
      assert.equal(url.searchParams.get('sim'),item.id==='research-tracking'?'track':'contact');
      assert.equal(url.searchParams.get('lang'),'ko');
      assert.equal(url.hash,'#interactive');
      assert.equal(item.source,item.href);
    } else if (item.status === 'ready') assert.equal(item.href, `${item.id}/`);
    else { assert.equal(item.status, 'planned'); assert.equal(item.href, null); }
  }
});
