import assert from 'node:assert/strict';
import test from 'node:test';

const near = (v,w,tol) => assert.ok(Math.abs(v-w)<tol, `${v} != ${w}`);
const radians = deg => deg*Math.PI/180;
test('Kinova home and bent poses agree with independent forward transforms from the source URDF', async () => {
  const g = await import('../assets/models/gen3.js');
  // Raw URDF: homogeneous origin(xyz,rpy) * rotZ(q) for each joint, including the fixed tool.
  for (const [q,p4,p6,tip,normal] of [
    [g.HOME,[.10896269,-.00537179,.69123297],[.28927217,.00117544,.43372426],[.45672717,.00135058,.43372426],[1,0,0]],
    [[30,-100,70].map(radians),[.21044198,-.00537195,.64919887],[.45125569,.00117657,.44713209],[.59627597,.00135277,.53085959],[.8660254,0,.5]],
  ]) {
    const pose = g.gen3Pose(q), planar=g.gen3Planar(q);
    assert.equal(pose.frames.length,9);
    for (const [i,p] of [[4,p4],[6,p6],[8,tip]]) p.forEach((v,j)=>near(pose.frames[i].p[j],v,1e-5));
    normal.forEach((v,i)=>near(pose.frames[8].r[3*i+2],v,1e-5));
    near(planar.x,pose.frames[8].p[0],1e-12);near(planar.z,pose.frames[8].p[2],1e-12);
    for (let j=0;j<3;j++) {
      const a=q.slice(),b=q.slice();a[j]-=1e-6;b[j]+=1e-6;
      const lo=g.gen3Pose(a),hi=g.gen3Pose(b);
      for (const [axis,field] of ['x','z','pitch'].entries()) near(planar.J[axis][j],(hi[field]-lo[field])/2e-6,1e-8);
    }
  }
});

test('fallback draws the actual probe and the moving target in the same wall coordinates',async()=>{
  const mod=await import('../assets/models/gen3-draw.js');
  const {Simulation,wallX,referenceX}=await import('../assets/models/impedance-robot.js');
  const sim=new Simulation();
  for(const time of [0,1.35,4]) {
    while(sim.state.t+1e-6<time) sim.step(.005);
    const circles=[],fills=[],lines=[],ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(...a)=>{
      if(k==='arc')circles.push([...a.slice(0,2),ctx.fillStyle]);
      if(k==='fillRect')fills.push([...a,ctx.fillStyle]);
      if(k==='lineTo')lines.push(a);
    }});
    mod.draw(ctx,sim.state,sim.params,380,320,'en');
    const probe=circles.find(c=>c[2]==='#374957'),goal=circles.find(c=>c[2]==='#c43339'),wall=fills.find(c=>c[4]==='#abc9df');
    assert.ok(probe&&goal&&wall&&lines.length,'apparatus, physical tool, commanded target and wall drawn');
    const scale=(goal[0]-wall[0])/(referenceX(sim.state.t,sim.params)-wallX);
    assert.ok(scale>150);near((probe[0]-wall[0])/scale,sim.state.x-wallX,1e-10);
  }
});
