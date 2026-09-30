import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

function render(kind, width=272, state={y:0.3,u:0.15,disturbance:0}, target=0.5) {
  const source=fs.readFileSync(new URL('../assets/app.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function apparatus('),source.indexOf('function drawGraph('));
  const labels=[]; let scale=1; const stack=[];
  const c=new Proxy({font:'12px sans-serif',save(){stack.push(scale);},restore(){scale=stack.pop();},scale(x){scale*=x;},fillText(text,x,y){labels.push({text,size:parseFloat(this.font)*scale});},measureText(text){return {width:text.length*7};}}, {get(o,k){return k in o?o[k]:()=>{};}});
  vm.runInNewContext(`${code}\napparatus({},sim,15);`, {canvasContext:()=>({ctx:c,width,height:270}),sim:{kind,state,params:{target}},INK:'#0a0a0a',MUTED:'#555',TEAL:'#087f74',ORANGE:'#c56b31',t:x=>x});
  return labels;
}
test('cart-pole has a carriage housing, wheel hubs and rigid highlighted rod',()=>{
  const source=fs.readFileSync(new URL('../assets/pendulum-app.js',import.meta.url),'utf8');
  const code=source.slice(source.indexOf('function apparatus()'),source.indexOf('function plot('));
  let housings=0;const arcs=[];
  const c=new Proxy({roundRect(){housings++;},arc(...args){arcs.push(args);}}, {get(o,k){return k in o?o[k]:()=>{};}});
  vm.runInNewContext(`${code}\napparatus();`,{canvasContext:()=>({ctx:c,w:272,h:270}),simulation:{state:{x:0.3,theta:0.08},params:{target:0.5}},t:x=>x});
  assert.ok(housings>=2,'carriage and track need physical housings');
  assert.ok(arcs.length>=8,'wheels, hubs, pivot and highlighted bob');
});
for(const kind of ['cruise-control','dc-motor','ball-and-beam']) test(`${kind}: mobile apparatus labels stay at least 12 CSS pixels`,()=>{
  const labels=render(kind); assert.ok(labels.length>=2);
  for(const label of labels) assert.ok(label.size>=12,`${label.text}: ${label.size}px`);
});
