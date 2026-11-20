import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('catalog search combines category, ready and case-insensitive text', async () => {
  const { filterCatalog } = await import('../assets/catalog.js');
  assert.equal(typeof filterCatalog, 'function');
  assert.equal(filterCatalog({query:'  DC MOTOR  '}).length, 1);
  assert.equal(filterCatalog({ready:true}).length, 20);
  assert.equal(filterCatalog({category:'모빌리티',ready:true}).length, 4);
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

test('all implemented projects have static catalog fallback links without stale planned copy', async()=>{
  const {catalog}=await import('../assets/catalog.js');
  const home=await readFile(new URL('../index.html',import.meta.url),'utf8');
  assert.doesNotMatch(home,/준비 중인 실험/);
  for(const item of catalog.filter(item=>!item.external))assert.ok(home.includes(`href="${item.id}/"`),item.id);
});

test('control fundamentals lists the PID and MPC graph labs in order with distinct references', async () => {
  const {catalog, filterCatalog} = await import('../assets/catalog.js');
  const local = catalog.filter(item => !item.external);
  const [pid, mpc] = filterCatalog({category:'제어 기초', ready:true});
  assert.deepEqual(local.slice(-2).map(item => item.id), ['pid-lti','mpc-lti']);
  assert.equal(pid.id, 'pid-lti');
  assert.equal(pid.view, 'graph');
  assert.equal(pid.name, '2차 LTI 시스템의 PID 제어');
  assert.equal(pid.english, 'PID control of a second-order LTI system');
  assert.equal(pid.source, 'https://ctms.engin.umich.edu/CTMS/?example=Introduction&section=ControlPID');
  assert.deepEqual(filterCatalog({category:'제어 기초', query:'LTI', ready:true}), [pid, mpc]);
  for (const query of ['정상상태 오차', 'steady-state error'])
    assert.deepEqual(filterCatalog({category:'제어 기초', query, ready:true}), [pid]);
  assert.equal(mpc.view, 'graph');
  assert.equal(mpc.name, '2차 LTI 시스템의 MPC 제어');
  assert.equal(mpc.english, 'MPC control of a second-order LTI system');
  assert.equal(mpc.source, 'https://www.mathworks.com/help/mpc/gs/what-is-mpc.html');
  for (const query of ['MPC', '예측 구간', 'prediction horizon'])
    assert.deepEqual(filterCatalog({category:'제어 기초', query, ready:true}), [mpc]);
  assert.equal(local.filter(item => item.view === 'apparatus').length, 16);
});

test('catalog has 20 unique experiments, eighteen local launches and two research links', async () => {
  const { catalog } = await import('../assets/catalog.js');
  assert.equal(catalog.length, 20);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  assert.equal(catalog.filter(item => item.status === 'ready').length, catalog.length);
  assert.equal(catalog.filter(item => !item.external).length, 18);
  assert.equal(catalog.filter(item => item.external).length, 2);
  assert.equal(catalog.filter(item => item.status==='planned').length,0);
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
