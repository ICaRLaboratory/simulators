import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// One paragraph per original definition.equations entry. Each independent
// relation is a wrap opportunity, not a new paragraph or an extra model.
const clauses = {
  'rotary-pendulum': [3, 1, 4, 2, 1],
  'ball-and-plate': [2, 4, 4],
  'robot-arm': [1, 3, 2, 1, 1],
  parking: [3, 1, 2],
  'heat-exchanger': [1, 2, 4],
  drone: [2, 1, 1, 3],
  'impedance-robot': [3, 2, 1, 1, 1],
  'path-tracking': [3, 3, 2],
  suspension: [1, 1, 1, 2, 4],
  cstr: [1, 1, 1, 2, 2],
  'aircraft-pitch': [1, 1, 1, 2, 2],
  'rocket-landing': [3, 2, 2, 2, 4],
};
const readPage = id => readFileSync(new URL(`../${id}/index.html`, import.meta.url), 'utf8');
const blocks = id => [...readPage(id).matchAll(/<p class="loop-equation">(.*?)<\/p>/gs)].map(m => m[1]);

// The two notations have different grouping (stacked fractions, matrix rows,
// scripted indices). Compare their ordered operands, signs, relations and units
// against the original model strings, not against the TeX that made the page.
const mathText = html => html.replaceAll('<msqrt>', '√').replace(/<[^>]+>/g, '')
  .replaceAll('&lt;', '<').replaceAll('&gt;', '>');
const symbols = s => s.replaceAll('aᵧ', 'a_y') // legacy modifier gamma denotes y acceleration
  .normalize('NFKD').replaceAll('⟺', '⇔').replaceAll('AND', '∧').replaceAll('⋅', '·')
  .replace(/[\s\u2061,;()\[\]_/⁄]/g, '');

for (const [id, expected] of Object.entries(clauses)) {
  test(`${id}: static native equations preserve model blocks and all clauses`, async () => {
    const {definition} = await import(`../assets/models/${id}.js`);
    assert.equal(expected.length, definition.equations.length);
    const paragraphs = blocks(id);
    assert.equal(paragraphs.length, expected.length);
    for (const [i, html] of paragraphs.entries()) {
      const roots = /<math\b[^>]*xmlns="http:\/\/www\.w3\.org\/1998\/Math\/MathML"[^>]*>[\s\S]*?<\/math>/g;
      assert.equal([...html.matchAll(roots)].length, expected[i], `${id}, block ${i+1}: ${definition.equations[i]}`);
      assert.equal(html.replace(roots, '').trim(), '', 'no duplicate plaintext or client-side fallback');
      assert.doesNotMatch(html, /<(?:annotation|merror)\b|tml-error/);
      const source = definition.equations[i];
      const reference = source.replace(/(Fₙ) = (.+) if (.+); Fₙ = (.+) otherwise/, '$1 = {$2, $3; $4, otherwise');
      assert.equal(symbols(mathText(html)), symbols(reference), `${id}, block ${i+1}: ${source}`);
      assert.equal((html.match(/<mfrac>/g) ?? []).length + (mathText(html).match(/\//g) ?? []).length,
        (source.match(/[½/]/g) ?? []).length, `${id}, block ${i+1}: quotient count`);
    }
  });
}

test('Furuta inertia multiplies two accelerations; contact uses two exclusive branches', () => {
  const rows = html => [...html.matchAll(/<mtr>(.*?)<\/mtr>/gs)].map(row =>
    [...row[1].matchAll(/<mtd\b[^>]*>(.*?)<\/mtd>/gs)].map(cell => symbols(mathText(cell[1]))));
  assert.deepEqual(rows(blocks('rotary-pendulum')[2]), [['A','B'], ['B','C'], ['α̈'], ['θ̈'], ['f'], ['h']]);
  assert.deepEqual(rows(blocks('impedance-robot')[3]), [['max0Kex−xw+0.1ẋ', 'x>xw'], ['0', 'otherwise']]);
});
