import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('catalog search combines category, ready and case-insensitive text', async () => {
  const { filterCatalog } = await import('../assets/catalog.js');
  assert.equal(typeof filterCatalog, 'function');
  assert.equal(filterCatalog({query:'  DC MOTOR  '}).length, 1);
  assert.equal(filterCatalog({ready:true}).length, 23);
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

test('control fundamentals lists five LTI graph labs in order with distinct references', async () => {
  const {catalog, filterCatalog} = await import('../assets/catalog.js');
  const local = catalog.filter(item => !item.external);
  const graphIds = ['pid-lti','mpc-lti','ddc-lti','smc-lti','tdc-lti'];
  const labs = filterCatalog({category:'제어 기초', ready:true});
  const [pid, mpc] = labs;
  assert.deepEqual(labs.map(item => item.id), graphIds);
  assert.deepEqual(local.filter(item => item.view === 'graph').map(item => item.id), graphIds);
  assert.deepEqual(local.slice(-5).map(item => item.id), graphIds);
  assert.equal(pid.id, 'pid-lti');
  assert.equal(pid.view, 'graph');
  assert.equal(pid.name, '2차 LTI 시스템의 PID 제어');
  assert.equal(pid.english, 'PID control of a second-order LTI system');
  assert.equal(pid.source, 'https://www.mathworks.com/help/control/ug/pid-controller-design-at-the-command-line.html');
  assert.deepEqual(filterCatalog({category:'제어 기초', query:'LTI', ready:true}), labs);
  for (const query of ['정상상태 오차', 'steady-state error'])
    assert.deepEqual(filterCatalog({category:'제어 기초', query, ready:true}), [pid]);
  assert.equal(mpc.view, 'graph');
  assert.equal(mpc.name, '2차 LTI 시스템의 MPC 제어');
  assert.equal(mpc.english, 'MPC control of a second-order LTI system');
  assert.equal(mpc.source, 'https://www.mathworks.com/help/mpc/gs/what-is-mpc.html');
  for (const query of ['MPC', '예측 구간', 'prediction horizon'])
    assert.deepEqual(filterCatalog({category:'제어 기초', query, ready:true}), [mpc]);
  for (const [id,ko,en,doi] of [
    ['ddc-lti','상태 피드백 이득','state-feedback gain','10.1109/TAC.2019.2959924'],
    ['smc-lti','위상 평면','phase plane','10.1109/TAC.1977.1101446'],
    ['tdc-lti','지연 가속도','delayed acceleration','10.1115/1.2894130'],
  ]) {
    const item = labs.find(item => item.id === id);
    assert.equal(item.source, `https://doi.org/${doi}`);
    for (const query of [id.split('-')[0], ko, en])
      assert.deepEqual(filterCatalog({category:'제어 기초', query, ready:true}), [item]);
  }
  assert.equal(local.filter(item => item.view === 'apparatus').length, 16);
  assert.match(catalog.find(i=>i.id==='aircraft-pitch').source,/mathworks\.com\/help\/control\/ref\/dynamicsystem\.compreal/);
});

test('catalog has 23 unique experiments, twenty-one local launches and two research links', async () => {
  const { catalog } = await import('../assets/catalog.js');
  assert.equal(catalog.length, 23);
  assert.equal(new Set(catalog.map(item => item.id)).size, catalog.length);
  assert.equal(catalog.filter(item => item.status === 'ready').length, catalog.length);
  assert.equal(catalog.filter(item => !item.external).length, 21);
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
