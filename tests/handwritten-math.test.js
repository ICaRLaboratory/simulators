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

for (const id of pages) test(`${id}: signal labels, limits and explanatory prose ship as math`, () => {
  const html = readFileSync(new URL(`${id}/index.html`, root), 'utf8');
  const panel = html.match(/<section class="control-loop panel"[\s\S]*?<\/section>/)[0];
  const labels = panel.match(/<g class="loop-labels">[\s\S]*?<\/g>/)[0];
  const plain = section => section.replace(/<math\b[\s\S]*?<\/math>|<[^>]*>/g, ' ');
  assert.doesNotMatch(plain(labels), /[±θω]|\b[eFqruvyx]\b|\bx − r\b/);
  const notes = panel.match(/<details[\s\S]*?<\/details>/)[0];
  assert.doesNotMatch(plain(notes), /[Δθ]|\b[IFdu]\b|0\.005|0\.6/);
  if (id === 'inverted-pendulum') assert.match(labels, /<mi>x<\/mi><mo>−<\/mo><mi>r<\/mi>/);
  else for (const locale of ['ko', 'en']) {
    const note = notes.split('<!--math:integrationNote-->')[1].split('<!--/math-->')[0];
    const run = note.split(`lang="${locale}"`)[1].match(/<math\b[\s\S]*?<\/math>/)[0];
    assert.equal(run.replace(/<[^>]+>/g, ''), 'I←I+ΔI');
  }
});

test('checked-in formula regions agree with the handwritten TeX source', () => {
  execFileSync(process.execPath, ['scripts/build-handwritten-math.mjs', '--check'], { cwd: root });
});
