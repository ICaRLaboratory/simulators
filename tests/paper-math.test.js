import test from 'node:test';
import assert from 'node:assert/strict';
import { math } from '../scripts/paper-math.mjs';

test('print formulas are native static math with relationships, not text or images', () => {
  const output = math(String.raw`G(s)=\frac{b}{s^2+a_1s+a_0}`);
  for (const tag of ['math', 'mi', 'mfrac', 'msup', 'msub']) assert.match(output, new RegExp(`<${tag}\\b`));
  assert.doesNotMatch(output, /<img|<script|<merror|<annotation/);
  assert.throws(() => math(String.raw`\unknownEquationCommand`));
});
