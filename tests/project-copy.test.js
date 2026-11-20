import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {catalog} from '../assets/catalog.js';
test('pages present experiments with the associated project, tutorial or concept paper', async () => {
  const home = await readFile('index.html','utf8');
  assert.doesNotMatch(home,/이식본|독립적으로 재구성/);
  for (const item of catalog.filter(item => item.status === 'ready' && !item.external)) {
    const html = await readFile(`${item.id}/index.html`,'utf8');
    assert.doesNotMatch(html,/이식본|독립적으로 재구성/);
    const sourceLink = [...html.matchAll(/<a\b[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/g)]
      .find(([, href]) => href.replaceAll('&amp;', '&') === item.source);
    assert.ok(sourceLink, `${item.id}: missing reference`);
    if (item.id === 'pid-lti') assert.match(sourceLink[2], /CTMS/);
    else if (item.id === 'mpc-lti') assert.match(sourceLink[2], /What Is Model Predictive Control\?/);
    else if (item.view === 'graph') {
      assert.ok(sourceLink[2].replaceAll('&amp;', '&').includes(item.sourceName), `${item.id}: missing citation label`);
      assert.doesNotMatch(html, /관련 MATLAB 프로젝트/);
    } else assert.match(html, /관련 MATLAB 프로젝트/);
  }
});
