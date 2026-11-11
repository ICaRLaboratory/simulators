import test from 'node:test';
import assert from 'node:assert/strict';
import {Simulation, mechanics, definition, contactForce, kinematics, draw} from '../assets/models/impedance-robot.js';
import * as T from '../assets/vendor/three.js';
import {createRobotScene} from '../assets/three/robot-scenes.js';
import {createApparatusCamera} from '../assets/three/camera.js';
const near = (a,b,eps=1e-10) => assert.ok(Math.abs(a-b)<eps, `${a} != ${b}`);

test('EXP11 uses the farther contact workspace as real model coordinates', () => {
  assert.equal(mechanics.wallX, .8);
  assert.equal(mechanics.initialX, .5);
  assert.deepEqual(definition.parameters.find(p=>p.key==='target'), {
    key:'target',label:['수평 목표 위치','Horizontal target position'],unit:'m',min:.35,max:1,step:.01,default:.95,
  });
  const sim = new Simulation();
  near(sim.state.x,.5); near(sim.state.y,.15);
  near(kinematics([sim.state.q1,sim.state.q2]).x,.5);
  assert.ok(sim.state.q2 > -2.11 && sim.state.q2 < -2.10, 'reset is no longer a tightly doubled-back arm');
  assert.equal(sim.observe().wall,.8);
  near(sim.observe().equilibriumForce,12.5);
  assert.equal(contactForce(.8,10,500),0, 'rest plane is not already compressed');
  assert.equal(contactForce(.79,10,500),0);
  assert.equal(contactForce(.9,-100,500),0, 'unilateral damping cannot pull');
  near(contactForce(.9,.2,500),52.4);
  assert.equal(sim.observe().force,0);
  for(let n=0;n<20;n++) sim.step(.005);
  assert.ok(sim.state.x>.5 && sim.state.x<.8, 'a real finite free-space approach precedes contact');
  assert.equal(sim.observe().force,0);
  for(let n=0;n<2980;n++) sim.step(.005);
  near(sim.state.x,.825,1e-8); near(sim.state.y,.15,1e-8);
  near(sim.observe().force,12.5,1e-6);
  assert.equal(sim.state.failed,false);
  assert.ok(definition.plots[0].range[1]>=1, 'the position plot includes the entire target slider');
});

function vertices(scene,name) {
  const mesh=scene.root.getObjectByName(name); assert.ok(mesh, name);
  const bounds=new T.Box3(),p=mesh.geometry.attributes.position;
  for(let i=0;i<p.count;i++) bounds.expandByPoint(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(mesh.matrixWorld));
  return bounds;
}

test('EXP11 has dedicated compact joint/link solids and a farther honest contact fixture', () => {
  const sim=new Simulation(),scene=createRobotScene('impedance-robot');
  scene.update(Object.freeze({...sim.state,q1:0,q2:0}),Object.freeze({...sim.params}));
  scene.root.updateMatrixWorld(true);
  for(const [name,min,max,depth] of [
    ['shoulder-gearcase',.18,.22,.105],['elbow-gearcase',.13,.16,.13],
    ['upper-link',.12,.16,.085],['forearm-link',.09,.12,.065],
  ]) {
    const b=vertices(scene,name),s=b.getSize(new T.Vector3());
    assert.ok(s.y>=min-1e-7 && s.y<=max+1e-7,`${name}: actual transverse size ${s.y}`);
    assert.ok(s.z<=depth+1e-7,`${name}: axial depth ${s.z}`);
  }
  const probe=vertices(scene,'contact-probe').getSize(new T.Vector3());
  assert.ok(probe.x>=.035 && probe.x<=.055,'small contact tip, not a massive ball');
  const stand=vertices(scene,'fixed-pedestal').getSize(new T.Vector3());
  assert.ok(stand.x<=.14 && stand.z<=.14,'narrow structural extrusion, not a bottle-shaped body');
  near(vertices(scene,'contact-wall').min.x,.8,1e-7);
  assert.ok(vertices(scene,'contact-wall').getSize(new T.Vector3()).y<=.8,'compact task fixture');
  scene.update(Object.freeze({...sim.state}),Object.freeze({...sim.params}));scene.root.updateMatrixWorld(true);
  const tip=scene.root.getObjectByName('contact-probe').getWorldPosition(new T.Vector3());
  near(tip.x,.5);near(tip.y,.15);near(tip.z,0);
  near(vertices(scene,'contact-wall').min.x-tip.x,.3,1e-7);
});

test('equations, notes and the proportionate 2D fallback share the real workspace', () => {
  assert.ok(definition.equations.some(text=>text.includes('x−0.8') && text.includes('x>0.8 m')));
  assert.ok(definition.equations.some(text=>text.includes('xᵣ−0.8') && text.includes('x∞ = 0.8')));
  assert.ok(definition.notes.flat().some(text=>text.includes('(0.5, 0.15)')),'document the actual initial TCP');
  const sim=new Simulation();
  for(const language of ['ko','en']) for(const w of [320,800]) {
    const arcs=[],rects=[],strokes=[],texts=[];let path=[];
    const ctx=new Proxy({}, {get:(o,key)=>key in o?o[key]:(...args)=>{
      if(key==='beginPath')path=[];
      if(key==='moveTo'||key==='lineTo')path.push(args);
      if(key==='stroke')strokes.push(path);
      if(key==='arc')arcs.push(args);
      if(key==='fillRect')rects.push(args);
      if(key==='fillText')texts.push(args[0]);
    },set:(o,key,value)=>(o[key]=value,true)});
    draw(ctx,Object.freeze({...sim.state}),Object.freeze({...sim.params}),w,300,language);
    const [base,elbow,tip]=strokes.find(p=>p.length===3);
    const scale=Math.hypot(elbow[0]-base[0],elbow[1]-base[1])/.55;
    near((tip[0]-base[0])/scale,.5); near((base[1]-tip[1])/scale,.15);
    near((rects[0][0]-base[0])/scale,.8);
    assert.ok(arcs.some(([x,y,r])=>Math.hypot(x-tip[0],y-tip[1])<1e-7 && Math.abs(r/scale-.024)<1e-7),'compact physical probe radius');
    assert.ok(arcs.filter(([x,y])=>Math.hypot(x-base[0],y-base[1])<1e-7).every(([, ,r])=>r/scale<=.10+1e-7),'joint proportions match 3D');
    assert.ok(texts.includes(language==='en'?'Wall 0.8 m':'벽 0.8 m'));
  }
});

function solidSections(mesh,origin,direction,axis) {
  const original=mesh.material.side;mesh.material.side=T.DoubleSide;
  const hits=new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction)).intersectObject(mesh,false);
  mesh.material.side=original;
  const xs=hits.map(hit=>hit.point[axis]).sort((a,b)=>a-b).filter((x,i,a)=>!i||Math.abs(x-a[i-1])>1e-7);
  assert.equal(xs.length%2,0,`${mesh.name}: closed solid`);
  return Array.from({length:xs.length/2},(_,i)=>xs.slice(i*2,i*2+2));
}
function connected(sections,start,end) {
  let covered=start;
  for(const [lo,hi] of sections.sort((a,b)=>a[0]-b[0])) {
    if(hi<covered)continue;
    if(lo>covered+1e-6)break;
    covered=Math.max(covered,hi);
  }
  assert.ok(covered>=end-1e-6,`load path ends at ${covered}, needs ${end}`);
}

test('the compact compliant fixture has continuous real solid mounting paths', () => {
  const scene=createRobotScene('impedance-robot');scene.root.updateMatrixWorld(true);
  const get=name=>scene.root.getObjectByName(name);
  for(const y of [-.18,.48]) {
    const bracket=get(`wall-cross-bracket-${y}`),wall=get('contact-wall');
    for(const x of [.83,.87,.91]) {
      connected([bracket,wall].flatMap(mesh=>solidSections(mesh,[x,y+.0013,2],[0,0,-1],'z')),-.4,.04);
    }
    connected([get('wall-upright-front'),bracket].flatMap(mesh=>solidSections(mesh,[2,y+.0013,-.4],[-1,0,0],'x')),.83,1.13);
  }
  connected([get('wall-mounting-foot'),get('wall-upright-front')]
    .flatMap(mesh=>solidSections(mesh,[1.132,2,-.403],[0,-1,0],'y')),-1.31,.50);
});

test('all slider corners and critical histories preserve exact frames, resources and production-camera fit', () => {
  const scene=createRobotScene('impedance-robot'),cameraSpec=JSON.stringify(scene.camera),resources=[];
  const aspect=1.6*scene.camera.minHorizontalSpan/scene.camera.span;
  const cameras=[.4,358/390,aspect,1.6,2.4].map(a=>createApparatusCamera(scene.camera,a));
  scene.root.traverse(object=>resources.push({object,geometry:object.geometry,material:object.material,
    attributes:Object.entries(object.geometry?.attributes||{}).map(([key,value])=>[key,value,value.array,value.array.buffer])}));
  const settings=[{}, {target:1,stiffness:300,damping:1,wallStiffness:100}, {target:.95,stiffness:5,damping:0,wallStiffness:1500}];
  for(let mask=0;mask<16;mask++)settings.push(Object.fromEntries(definition.parameters.map((p,i)=>[p.key,mask&(1<<i)?p.max:p.min])));
  for(const setting of settings) {
    const sim=new Simulation();Object.assign(sim.params,setting);
    const samples=[];
    for(let step=0;step<=1000;step++) {
      if(step){if(step===200||step===700)sim.disturb();sim.step(.01);}
      assert.equal(sim.state.failed,false,JSON.stringify(setting));
      samples.push({state:Object.freeze({...sim.state}),observed:sim.observe()});
    }
    const selected=new Set([0,10,199,200,201,699,700,701,1000]);
    for(const key of ['x','y','v','vy'])for(const sign of [-1,1])selected.add(samples.reduce((best,s,i)=>sign*s.state[key]>sign*samples[best].state[key]?i:best,0));
    const first=samples.findIndex(s=>s.observed.force>0);if(first>0){selected.add(first-1);selected.add(first);}
    const params=Object.freeze({...sim.params});
    for(const step of selected) {
      const {state,observed}=samples[step],before=JSON.stringify({state,params});
      scene.update(state,params,Object.freeze({observed:Object.freeze(observed)}));scene.root.updateMatrixWorld(true);
      assert.equal(JSON.stringify({state,params}),before);
      const get=name=>scene.root.getObjectByName(name),k=kinematics([state.q1,state.q2]);
      for(const [name,expected] of [['shoulder',[0,0,0]],['elbow',[...k.elbow,0]],['tool-center',[k.x,k.y,0]],['contact-probe',[k.x,k.y,0]]]) {
        assert.ok(get(name).getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(...expected))<1e-8,`${name}: exact FK ${step}`);
      }
      near(get('shoulder').rotation.z,state.q1);near(get('elbow').rotation.z,state.q2);
      near(get('tool-center').rotation.z,0);near(get('wrist-hardware').rotation.z,0);
      assert.deepEqual(scene.readouts().map(r=>r.value),[`${observed.x.toFixed(3)} m`,`${observed.force.toFixed(2)} N`]);
      assert.equal(get('contact-force').visible,observed.force>0);
      // Axial extrema from actual transformed vertices cover folded casings too.
      const upper=vertices(scene,'upper-link'),lower=vertices(scene,'forearm-link');
      assert.ok(lower.min.z-upper.max.z>=.012);
      const objects=[];scene.root.traverse(o=>objects.push(o));assert.equal(objects.length,resources.length);
      for(const {object,geometry,material,attributes} of resources) {
        assert.equal(object.geometry,geometry);assert.equal(object.material,material);
        for(const [key,value,array,buffer] of attributes){assert.equal(geometry.attributes[key],value);assert.equal(value.array,array);assert.equal(array.buffer,buffer);}
        let omitted=false;for(let o=object;o;o=o.parent)if(!o.visible||o.userData.environment)omitted=true;
        const p=geometry?.attributes.position;if(!p)continue;
        const count=object.isLine?Math.min(p.count,geometry.drawRange.count):p.count;
        for(let i=0;i<count;i++) {
          const v=new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld);
          assert.ok(v.toArray().every(Number.isFinite));
          if(omitted)continue;
          for(const camera of cameras){const q=v.clone().project(camera);if(Math.abs(q.x)>.98||Math.abs(q.y)>.98||Math.abs(q.z)>1)assert.fail(`${JSON.stringify(setting)} step ${step} ${object.name}: frustum ${q.toArray()}`);}
        }
      }
    }
  }
  assert.equal(JSON.stringify(scene.camera),cameraSpec,'camera does not chase the arm');
});
