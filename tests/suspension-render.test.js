import test from 'node:test';
import assert from 'node:assert/strict';
import { draw, Simulation } from '../assets/models/suspension.js';

function record(state = {}, language = 'en', width = 280, height = 245) {
  const sim = new Simulation();
  const paths = [], rects = [], texts = [];
  let path = [];
  const ctx = {
    font: '', fillStyle: '', strokeStyle: '', textAlign: 'start',
    beginPath() { path = []; }, moveTo(x,y) { path.push([x,y]); },
    lineTo(x,y) { path.push([x,y]); },
    stroke() { paths.push({ points: path, color: this.strokeStyle }); },
    fillRect(x,y,w,h) { rects.push({ x,y,w,h,color:this.fillStyle }); },
    strokeRect(x,y,w,h) { rects.push({ x,y,w,h,color:this.strokeStyle, outline:true }); },
    fillText(text,x,y) { texts.push({ text,x,y,font:this.font,align:this.textAlign }); },
    setLineDash() {},
  };
  draw(ctx, { ...sim.state, ...state }, sim.params, width, height, language);
  return { paths, rects, texts };
}

test('damper has a rigid open cylinder and a separate body-mounted piston throughout travel', () => {
  for (const height of [245,260,360]) for (const zs of [-1.01,0,1.01]) for (const zu of [-1.01,0,1.01]) {
    const { paths, rects } = record({zs,zu}, 'en', 280, height);
    const cylinder = paths.find(p => p.points.length===4 && p.points[0][0]===129 && p.points[3][0]===151);
    assert.ok(cylinder, 'open U-shaped damper cylinder');
    const [a,b,c,d] = cylinder.points;
    assert.equal(b[1]-a[1],34);
    assert.equal(c[1],b[1]); assert.equal(a[1],d[1]);
    const piston = paths.find(p => p.points.length===2 && p.points[0][0]===132 && p.points[1][0]===148);
    assert.ok(piston.points[0][1] > a[1] && piston.points[0][1] < b[1], 'piston stays inside cylinder');
    const body=rects.find(r=>r.color==='#087f74'&&!r.outline);
    const rod=paths.find(p=>p.points.length===2 && p.points[0][0]===140 && p.points[0][1]===body.y+body.h);
    assert.equal(rod.points[1][1],piston.points[0][1]);
    const actuator=rects.find(r=>r.outline && r.color==='#087f74');
    assert.deepEqual([actuator.w,actuator.h],[18,32]);
  }
});

test('force arrows reverse as an equal/opposite pair and disappear at zero; tire joins wheel to road', () => {
  for (const vs of [-1,0,1]) {
    const {paths,rects,texts}=record({vs,distance:6,bumpStart:5});
    const arrows=paths.filter(p=>p.color==='#087f74' && p.points.length===2 && p.points[0][0]===248);
    assert.equal(arrows.length,vs===0?0:2);
    if(vs!==0) {
      assert.equal(Math.sign(arrows[0].points[1][1]-arrows[0].points[0][1]),Math.sign(vs));
      assert.equal(Math.sign(arrows[1].points[1][1]-arrows[1].points[0][1]),-Math.sign(vs));
    }
    const wheel=rects.find(r=>r.color==='#555'&&!r.outline);
    const tire=paths.find(p=>p.points.length===7 && p.points[0][0]===140);
    const road=paths.find(p=>p.color==='#c56b31');
    assert.deepEqual(tire.points[0],[140,wheel.y+wheel.h]);
    assert.equal(tire.points.at(-1)[1],road.points[0][1]);
    for(const label of ['Spring kₛ','Damper c','Actuator u','Tire kₜ']) assert.ok(texts.some(t=>t.text===label));
  }
});

test('three parallel branches terminate on both mass attachment bars at displacement extremes', () => {
  for (const zs of [-1.01,-0.3,0,0.3,1.01]) for (const zu of [-1.01,0,1.01]) {
    const { paths, rects } = record({ zs, zu, failed: true });
    const body = rects.find(r => r.color === '#087f74' && !r.outline);
    const wheel = rects.find(r => r.color === '#555' && !r.outline);
    const bars = paths.filter(p => p.points.length === 2 && p.points[0][1] === p.points[1][1] && p.points[1][0]-p.points[0][0] > 100 && p.color === '#555');
    const bar = bars.find(p => p.points[0][1] < wheel.y && p.points[0][1] > body.y+body.h);
    assert.ok(bar, 'wheel attachment bar must reach all three branches');
    for (const x of [55,140,225]) {
      assert.ok(x >= body.x && x <= body.x+body.w);
      assert.ok(x >= bar.points[0][0] && x <= bar.points[1][0]);
      assert.ok(paths.some(p => p.points.some(([px,py]) => px===x && py===body.y+body.h)), 'branch attached to body');
      assert.ok(paths.some(p => p.points.some(([px,py]) => px===x && py===bar.points[0][1])), 'branch attached to wheel bar');
    }
    assert.ok(paths.some(p => p.points.some(([x,y]) => x===140 && y===wheel.y)), 'bar stem attached to wheel');
  }
});
