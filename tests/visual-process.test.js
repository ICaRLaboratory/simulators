import test from 'node:test';
import assert from 'node:assert/strict';
import * as heat from '../assets/models/heat-exchanger.js';
import * as cstr from '../assets/models/cstr.js';
import * as aircraft from '../assets/models/aircraft-pitch.js';
function render(model, overrides={},lang='en') {
 const sim=new model.Simulation(), calls=[], labels=[];
 const ctx=new Proxy({font:'',fillText(text,x,y){labels.push({text,x,y,font:this.font});}}, {get(o,k){return k in o?o[k]:(...a)=>calls.push([k,...a]);}});
 const state={...sim.state,...overrides};model.draw(ctx,state,sim.params,320,320,lang);
 assert.deepEqual(state,{...sim.state,...overrides});
 for(const l of labels){assert.ok(parseFloat(l.font)>=12);assert.ok(l.x>=0&&l.x<320&&l.y>=12&&l.y<=320);}
 return {calls,labels};
}
test('aircraft has curved fuselage and actual pitch/elevator transforms',()=>{
 const a=render(aircraft,{theta:.2,elevator:.1});
 assert.ok(a.calls.filter(c=>c[0]==='quadraticCurveTo').length>=3);
 assert.ok(a.calls.some(c=>c[0]==='rotate'&&c[1]===-.2));
 assert.ok(a.calls.some(c=>c[0]==='rotate'&&c[1]===.1));
 assert.ok(a.labels.some(l=>l.text==='Horizon'));
 for(const lang of ['ko','en'])render(aircraft,{theta:-.52,elevator:-.4},lang);
});
test('CSTR shows a coolant passage with stationary schematic agitator',()=>{
 const a=render(cstr),b=render(cstr,{t:10});
 assert.ok(a.labels.some(l=>l.text.includes('Coolant passage')));
 assert.ok(a.calls.filter(c=>c[0]==='quadraticCurveTo').length>=8);
 assert.deepEqual(a,b);
 for(const lang of ['ko','en'])render(cstr,{temperature:399,coolant:280},lang);
});
test('heat exchanger identifies both circuits without invented transport motion',()=>{
 const a=render(heat),b=render(heat,{t:10});
 assert.ok(a.labels.some(l=>l.text.includes('Hot side')));
 assert.ok(a.labels.some(l=>l.text.includes('Mixed outlet')));
 assert.deepEqual(a,b);
});
