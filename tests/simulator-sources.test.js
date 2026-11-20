import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { catalog } from '../assets/catalog.js';

const ledgerPath = 'docs/simulator-sources.md';

test('catalog, generated labs and source guides omit retired tutorial links', async () => {
  const paths = ['index.html', 'README.md', ledgerPath, ...catalog.filter(i => !i.external).map(i => `${i.id}/index.html`)];
  for (const path of paths) assert.doesNotMatch(await readFile(path, 'utf8'), /ctms\.engin\.umich\.edu/i, path);
  for (const item of catalog) assert.doesNotMatch(item.source, /ctms\.engin\.umich\.edu/i, item.id);
});

test('the README leads to a source ledger covering the current catalog, including external entries', async () => {
  assert.ok((await readFile('README.md', 'utf8')).includes(`](${ledgerPath})`), 'missing README link');
  const ledger = await readFile(ledgerPath, 'utf8');
  for (const {id} of catalog) assert.ok(ledger.includes('`' + id + '`'), `missing scope for ${id}`);
});

test('each VCL entry is paired with its own revision-pinned SLX counterpart', async () => {
  const ledger = await readFile(ledgerPath, 'utf8');
  const models = {
    'cruise-control': 'CruiseControl', 'dc-motor': 'DCMotorControl', 'ball-and-beam': 'BallAndBeam',
    'inverted-pendulum': 'InvertedPendulum', 'rotary-pendulum': 'RotaryPendulum', 'ball-and-plate': 'BallAndPlate'
  };
  for (const [id, model] of Object.entries(models)) {
    const row = ledger.split('\n').find(line => line.startsWith('| `' + id + '`'));
    const upstream = catalog.find(item => item.id === id).source;
    assert.ok(row?.includes(`${upstream}/blob/fcb48179caf2762c906ddf52484718d0e84ab5b9/Models/${model}.slx)`), `${id}: wrong counterpart or revision`);
  }
});
