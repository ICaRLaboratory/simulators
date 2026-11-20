import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';

const root = new URL('../', import.meta.url);
const pages = ['ball-and-beam', 'dc-motor', 'cruise-control', 'inverted-pendulum'];
for (const id of pages) test(`${id}: ships paper equations in both the diagram and the model notes`, () => {
  const page = readFileSync(new URL(`${id}/index.html`, root), 'utf8');
  const diagram = page.match(/<svg class="loop-diagram"[\s\S]*?<\/svg>/)[0];
  const notes = page.match(/<details class="loop-notes">[\s\S]*?<\/details>/)[0];
  for (const section of [diagram, notes]) {
    assert.match(section, /<math\b/, 'missing static math');
    assert.match(section, /<msub>/, 'feedback gains need real subscripts');
    assert.doesNotMatch(section, /<merror\b|<annotation\b/);
  }
  if (id !== 'inverted-pendulum') {
    assert.match(page, /id="model-description"[^>]*><!--math:summary--><math\b/);
    assert.match(notes, /<msup>[\s\S]*?<mi>q<\/mi>/, 'candidate must be distinct from applied input');
  }
});

test('checked-in formula regions agree with the handwritten TeX source', () => {
  execFileSync(process.execPath, ['scripts/build-handwritten-math.mjs', '--check'], { cwd: root });
});
