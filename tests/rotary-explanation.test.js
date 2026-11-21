import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {definition as d} from '../assets/models/rotary-pendulum.js';
test('rotary pendulum explains Furuta and coupled inertia in both languages',()=>{
 assert.equal(d.explanation?.length,2);
 assert.match(d.explanation[0],/Furuta.*후루타/);assert.match(d.explanation[0],/질량 행렬/);assert.match(d.explanation[0],/회전 관성/);
 assert.match(d.explanation[1],/mass matrix/i);assert.match(d.explanation[1],/inertia/i);
 for(const lang of [0,1]){const notes=d.notes.map(n=>n[lang]).join(' ');assert.match(notes,/A.*C/);assert.match(notes,/B/);assert.match(notes,/kg·m²/);}
 const html=readFileSync(new URL('../rotary-pendulum/index.html',import.meta.url),'utf8');
 assert.match(html,/id="concept-help"/);const help=html.match(/<p id="concept-help"[^>]*>(.*?)<template data-copy-en>(.*?)<\/template><\/p>/s);
 assert.ok(help); for (const i of [0,1]) {assert.match(help[i+1],/<math\b/);assert.equal(help[i+1].replace(/<[^>]+>/g,''),d.explanation[i]);}
 assert.ok(html.indexOf('id="concept-help"')<html.indexOf('<details'));
 assert.doesNotMatch(d.loop.plant[0],/Furuta/);
});
