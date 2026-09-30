import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation,draw} from '../assets/models/rocket-landing.js';
test('rocket has a labeled fixed-scale detail view drawn from the same pose',()=>{
 for(const width of [280,720])for(const lang of ['ko','en']){
  const labels=[],noses=[];let points=[];
  const ctx=new Proxy({beginPath(){points=[];},moveTo(x,y){points.push([x,y]);},lineTo(x,y){points.push([x,y]);},fill(){if(this.fillStyle==='#087f74'&&points.length===3)noses.push(points.map(p=>[...p]));},fillText(text,x,y){labels.push({text,x,y});},measureText(t){return {width:t.length*6};}}, {get:(o,k)=>k in o?o[k]:()=>{}});
  const sim=new Simulation();sim.state.theta=.2;const before=structuredClone(sim.state);
  draw(ctx,sim.state,sim.params,width,245,lang);
  assert.ok(labels.some(l=>l.text===(lang==='ko'?'자세 확대':'Attitude detail')),'missing attitude detail label');
  assert.equal(noses.length,2,'overview and detail must both show the physical rocket');
  const span=p=>Math.hypot(p[1][0]-p[0][0],p[1][1]-p[0][1]);
  assert.ok(span(noses[1])>2*span(noses[0]),'detail must actually enlarge the small overview');
  const vec=p=>[p[1][0]-p[0][0],p[1][1]-p[0][1]];
  const a=vec(noses[0]),b=vec(noses[1]);assert.ok(Math.abs(a[0]*b[1]-a[1]*b[0])<1e-8,'pose differs between views');
  assert.deepEqual(sim.state,before);
 }
});
