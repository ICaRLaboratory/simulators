import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Do not bring back a second device drawing at any of the three playback entry points.
// Plot canvases remain live regardless of whether the 3D view can be constructed.
for (const [file, graph, retired] of [
  ['app.js','drawGraph(', /function apparatus\(canvas|apparatus\(\$\('#apparatus'\)/],
  ['pendulum-app.js',"plot('response'", /canvasContext\('apparatus'\)/],
  ['experiment-app.js','d.plots.forEach(plot)', /context\('apparatus'\)|draw:drawModel/],
]) test(`${file}: no retired device renderer; still draws the live graph`,()=>{
  const src=readFileSync(new URL(`../assets/${file}`,import.meta.url),'utf8');
  assert.ok(src.includes(graph));assert.ok(!retired.test(src), 'retired apparatus drawing is still present');
});
