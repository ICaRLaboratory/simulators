import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const pages = ['index.html', 'cruise-control/index.html', 'dc-motor/index.html', 'ball-and-beam/index.html', 'inverted-pendulum/index.html'];
test('footers omit the browser/storage filler without removing neutral branding', async () => {
  for (const path of pages) {
    const html = await readFile(new URL('../' + path, import.meta.url), 'utf8');
    const footer = html.match(/<footer\b[^>]*>([\s\S]*?)<\/footer>/)[1];
    assert.doesNotMatch(footer, /브라우저 기반 교육용 실험|데이터 저장 없음/);
    assert.match(footer, /Control Simulators/);
  }
});
