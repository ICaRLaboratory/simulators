import test from 'node:test';
import assert from 'node:assert/strict';
const ids=['rotary-pendulum','ball-and-plate','robot-arm','drone'];
for(const id of ids)test(`${id}: solid apparatus, isolated context and deterministic state-only rendering`,async()=>{
 const {draw,Simulation}=await import(`../assets/models/${id}.js`);const sim=new Simulation();
 function render(t){const commands=[],stack=[];const ctx={};for(const method of ['beginPath','moveTo','lineTo','closePath','arc','fill','stroke','fillRect','strokeRect','setLineDash','fillText'])ctx[method]=(...args)=>commands.push([method,...args]);ctx.save=()=>{stack.push({...ctx});commands.push(['save']);};ctx.restore=()=>{const old=stack.pop();assert.ok(old,'balanced restore');for(const k of Object.keys(ctx))delete ctx[k];Object.assign(ctx,old);commands.push(['restore']);};ctx.font='sentinel';draw(ctx,{...sim.state,t},sim.params,288,420,'en');assert.equal(ctx.font,'sentinel','draw must restore styles');assert.equal(stack.length,0);return commands;}
 const commands=render(0);assert.ok(commands.filter(c=>c[0]==='fill'||c[0]==='fillRect').length>=10,'apparatus needs solid housing, bearings and material surfaces, not only sticks');assert.deepEqual(render(10),commands,'time alone must not invent mechanical motion');
 const before=structuredClone(sim.state);render(0);assert.deepEqual(sim.state,before,'rendering must not mutate state');for(let i=0;i<80;i++)sim.step(.005);assert.notDeepEqual(render(0),commands,'actual dynamics must change apparatus rendering');
});

// The Gen3 reference has its own timed trajectory; only the physical links
// must stay still if t changes while q is held fixed.
test('Gen3 fallback holds the arm and reference at startup, then separates reference motion from FK',async()=>{
 const {draw,Simulation}=await import('../assets/models/impedance-robot.js');
 const sim=new Simulation();
 function capture(t) {
  const arcs=[],lines=[],labels=[],stack=[];
  const ctx={font:'sentinel',beginPath(){},moveTo(){},stroke(){},fill(){},fillRect(){},
   arc(x,y,r){arcs.push([this.fillStyle,x,y,r]);},lineTo(x,y){lines.push([x,y]);},fillText(s){labels.push(s);},
   save(){stack.push({...this});},restore(){Object.assign(this,stack.pop());}};
  const state=structuredClone(sim.state);Object.freeze(state.q);Object.freeze(state.dq);
  draw(ctx,Object.freeze({...state,t}),Object.freeze({...sim.params}),320,420,'en');
  assert.equal(ctx.font,'sentinel');assert.equal(stack.length,0);
  return {links:lines,tip:arcs.find(([color])=>color==='#374957'),reference:arcs.at(-1),labels};
 }
 const reset=capture(0);assert.ok(reset.tip);assert.deepEqual(capture(.5),reset);
 const later=capture(2);assert.deepEqual(later.links,reset.links);assert.deepEqual(later.tip,reset.tip);
 assert.ok(later.reference[1]>reset.reference[1] && later.reference[2]===reset.reference[2]);
 for(let i=0;i<600;i++)sim.step(.005);
 const press=capture(sim.state.t);assert.ok(press.tip[1]>reset.tip[1]);
 assert.ok(press.labels.some(text=>text.includes(`${sim.observe().force.toFixed(2)} N`)));
 sim.reset();assert.deepEqual(capture(0),reset);
});
