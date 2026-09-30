import test from 'node:test';
import assert from 'node:assert/strict';
const ids=['rotary-pendulum','ball-and-plate','robot-arm','drone','impedance-robot'];
for(const id of ids)test(`${id}: solid apparatus, isolated context and deterministic state-only rendering`,async()=>{
 const {draw,Simulation}=await import(`../assets/models/${id}.js`);const sim=new Simulation();
 function render(t){const commands=[],stack=[];const ctx={};for(const method of ['beginPath','moveTo','lineTo','closePath','arc','fill','stroke','fillRect','strokeRect','setLineDash','fillText'])ctx[method]=(...args)=>commands.push([method,...args]);ctx.save=()=>{stack.push({...ctx});commands.push(['save']);};ctx.restore=()=>{const old=stack.pop();assert.ok(old,'balanced restore');for(const k of Object.keys(ctx))delete ctx[k];Object.assign(ctx,old);commands.push(['restore']);};ctx.font='sentinel';draw(ctx,{...sim.state,t},sim.params,288,420,'en');assert.equal(ctx.font,'sentinel','draw must restore styles');assert.equal(stack.length,0);return commands;}
 const commands=render(0);assert.ok(commands.filter(c=>c[0]==='fill'||c[0]==='fillRect').length>=10,'apparatus needs solid housing, bearings and material surfaces, not only sticks');assert.deepEqual(render(10),commands,'time alone must not invent mechanical motion');
 const before=structuredClone(sim.state);render(0);assert.deepEqual(sim.state,before,'rendering must not mutate state');for(let i=0;i<80;i++)sim.step(.005);assert.notDeepEqual(render(0),commands,'actual dynamics must change apparatus rendering');
});
