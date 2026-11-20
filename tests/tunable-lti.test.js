import test from 'node:test';
import assert from 'node:assert/strict';
import {stepResponse} from '../assets/models/pid-lti.js';
import {simulateMPC} from '../assets/models/mpc-lti.js';
const near=(actual,want,tol)=>assert.ok(Math.abs(actual-want)<tol,`${actual} != ${want}`);

test('PID changes its equilibrium, transient and Routh boundary with the plant',()=>{
 const plant={wn:2,zeta:.5,gain:.5},kp=2;
 const r=stepResponse({plant,kp,ki:0,kd:0});near(r.steadyError,.5,1e-12);
 for(const {t,y} of r.samples){const w=Math.sqrt(7);near(y,.5*(1-Math.exp(-t)*(Math.cos(w*t)+Math.sin(w*t)/w)),2e-8);}
 for(const [ki,expected] of [[7.9,'stable'],[8,'marginal'],[8.1,'unstable']])assert.equal(stepResponse({plant,kp,ki,kd:0}).stability,expected);
});

// Independent continuous-time integration for arbitrary held inputs (not the ZOH implementation).
function interval(state,u,{wn,zeta,gain}){
 let [y,v]=state;const h=.002,acc=(a,b)=>wn*wn*(gain*u-a)-2*zeta*wn*b;
 for(let n=0;n<100;n++){const a=acc(y,v),v2=v+h*a/2,b=acc(y+h*v/2,v2),v3=v+h*b/2,c=acc(y+h*v2/2,v3),v4=v+h*c,d=acc(y+h*v3,v4);y+=h*(v+2*v2+2*v3+v4)/6;v+=h*(a+2*b+2*c+d)/6;}
 return [y,v];
}
test('actual MPC, prediction and comparison PID all propagate the selected under/critical/overdamped plant',()=>{
 for(const zeta of [.1,1,1.0000001,2]){
  const plant={wn:1.8,zeta,gain:1.7};const {samples,plans,pidSamples}=simulateMPC({plant});
  for(const [trace,isMpc] of [[samples,true],[pidSamples,false]]){let state=[0,0];for(const [k,s] of trace.entries()){
   near(s.y,state[0],1e-9);if(k===100)break;
   if(isMpc && k%11===0){let predicted=state;for(const [j,u] of plans[k].u.entries()){predicted=interval(predicted,u,plant);near(plans[k].y[j+1],predicted[0],1e-9);}}
   state=interval(state,s.u,plant);
  }}
 }
});
test('invalid physical parameters rejected rather than silently ignored',()=>{
 for(const plant of [{wn:0},{zeta:-1},{gain:10},{wn:Infinity},{gain:'1'}])for(const simulate of [simulateMPC,p=>stepResponse({kp:4,ki:0,kd:0,...p})])assert.throws(()=>simulate({plant}),RangeError);
});
