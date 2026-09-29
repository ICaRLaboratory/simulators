import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog} from '../assets/catalog.js';
test('pages present experiments directly with related MATLAB projects', async () => {
  const home = await readFile('index.html','utf8');
  assert.doesNotMatch(home,/이식본|독립적으로 재구성/);
  for (const item of catalog.filter(item => item.status === 'ready')) {
    const html = await readFile(`${item.id}/index.html`,'utf8');
    assert.doesNotMatch(html,/이식본|독립적으로 재구성/);
    assert.ok(html.includes(`href="${item.source}"`));
    assert.match(html,/관련 MATLAB 프로젝트/);
  }
});
