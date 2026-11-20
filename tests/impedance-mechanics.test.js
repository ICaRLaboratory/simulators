import test from 'node:test';
import assert from 'node:assert/strict';
import * as plant from '../assets/models/impedance-robot.js';

const near = (a,b,eps=1e-8) => assert.ok(Math.abs(a-b)<eps, `${a} != ${b} (tol ${eps})`);
const home = [15,-130,55].map(d => d*Math.PI/180);
const velocity = [.31,-.2,.43];

// Independent 3D URDF reference: rotate each of the six moving bodies' COM
// and inertia into the base frame, sum m JvᵀJv + Jwᵀ I Jw, differentiate
// m g z and M(q) for G and the Christoffel velocity product. Orthogonal
// joint twists (ignore URDF rpy rounding); odd axes fixed at 0,π,0,π/2.
test('three active Gen3 joints reproduce full-chain mass, gravity and velocity-product projections', () => {
  const samples = [
    [home, [.5687279041,-.0719818121,-.0426855520,.2279910182,.0295364217,.0130770914],
      [-8.733242683,4.492994635,.975151876],[-.0362479301,-.0164388762,.0031038643]],
    [[.68,-1.4,.65], [1.0493688593,-.3196416840,-.0691265501,.2426698068,.0368758160,.0130770914],
      [-16.614393648,6.312839554,.957645418],[-.0452911068,-.0223313183,.0027202963]],
  ];
  for (const [q,upper,gravity,bias] of samples) {
    const {M,G,C}=plant.dynamics(q,velocity);
    assert.equal(M.length,3,'2, 4 and 6 all carry inertia');
    let n=0;
    for(let i=0;i<3;i++) {
      near(G[i],gravity[i]); near(C[i],bias[i]);
      for(let j=i;j<3;j++) { near(M[i][j],upper[n++]); near(M[j][i],M[i][j]); }
    }
  }
});

test('repeated tip impulses add Jxᵀ times 0.3 N·s to joint momentum without changing the pose or trajectory', async()=>{
  const {gen3Planar}=await import('../assets/models/gen3.js');
  const s=new plant.Simulation(); s.step(1); s.step(.23);
  const {t,q,dq}=structuredClone(s.state),p={...s.params};
  const {M}=plant.dynamics(q,dq),Jx=gen3Planar(q).J[0];
  for(let n=1;n<=2;n++) {
    s.disturb(); assert.equal(s.state.t,t); assert.deepEqual(s.state.q,q); assert.deepEqual(s.params,p);
    M.forEach((row,i)=>near(row.reduce((sum,m,j)=>sum+m*(s.state.dq[j]-dq[j]),0),n*.3*Jx[i]));
  }
});

test('tip wrench and contact act through Jᵀ; limits apply to total motor torque, not wall reaction',async()=>{
  const {gen3Pose,HOME}=await import('../assets/models/gen3.js');
  const z0=gen3Pose(HOME).z, h=1e-9;
  for(const q of [[.45,-1.94,.82],[.68,-1.4,.65]]){
    const s=new plant.Simulation();s.step(1);s.step(1);
    s.state.q=q.slice(); s.state.dq=velocity.slice();
    const k=gen3Pose(q), {M,G,C}=plant.dynamics(q,velocity);
    const W=[100*(.607-k.x),100*(z0-k.z),-500*Math.sin(k.pitch)];
    const vx=k.J[0].reduce((v,j,i)=>v+j*velocity[i],0);
    const Fn=500*(k.x-plant.wallX)+.1*vx; assert.ok(Fn>0);
    s.step(h);
    for(const [i,limit] of [39,39,9].entries()){
      const request=G[i]+W.reduce((sum,w,j)=>sum+k.J[j][i]*w,0)-[9,4,1][i]*velocity[i];
      const expected=Math.min(limit,Math.max(-limit,request));
      const inertia=M[i].reduce((sum,m,j)=>sum+m*(s.state.dq[j]-velocity[j])/h,0);
      near(inertia+C[i]+G[i]+.001*velocity[i]+k.J[0][i]*Fn,expected,.00005);
    }
  }
});
