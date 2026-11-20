import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {Simulation, wallX, definition} from '../assets/models/impedance-robot.js';
import {createImpedanceScene} from '../assets/three/gen3-scene.js';
import {createApparatusCamera} from '../assets/three/camera.js';

const near=(a,b,tol=1e-8)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}`);
const world=o=>o.getWorldPosition(new T.Vector3());
function replay(scene,sim) {
  const state=structuredClone(sim.state); Object.freeze(state.q); Object.freeze(state.dq);
  scene.update(Object.freeze(state),Object.freeze({...sim.params}));scene.root.updateMatrixWorld(true);
}

test('frozen real snapshots show independent moving reference, unclamped tip and compressive reaction only', () => {
  const sim=new Simulation(),scene=createImpedanceScene(),get=n=>scene.root.getObjectByName(n);
  const tcp=get('EndEffector_Link'), ref=get('reference-tip'), arrow=get('contact-reaction'),wall=get('contact-wall');
  const camera=createApparatusCamera(scene.camera,1.6), ray=new T.Raycaster();
  const restColor=wall.material.color.clone(), initial=sim.observe(), referenceDepth=world(tcp).z;
  near(initial.x,wallX-.1); near(sim.params.target,wallX+.05,.0005); // slider rounded to a millimetre
  assert.ok(ref.material.color.r>ref.material.color.g*5 && ref.geometry.type==='SphereGeometry');
  const phases=new Set();
  function check(){
    replay(scene,sim);const o=sim.observe(),p=world(tcp),goal=world(ref),contact=o.force>0;
    near(p.x,o.x);near(p.y,o.z);near(p.z,referenceDepth);
    near(goal.x,o.target);near(goal.y,initial.z);near(goal.z,referenceDepth);
    near(new T.Box3().setFromObject(wall).min.x,wallX,1e-7);
    near(Math.max(0,p.x-wallX)*1000,o.penetration);
    assert.deepEqual(scene.readouts().map(r=>r.value),[`${o.x.toFixed(3)} m`,`${o.force.toFixed(2)} N`]);
    assert.equal(arrow.visible,contact);assert.equal(wall.material.color.equals(restColor),!contact);
    if(contact){
      near(world(arrow).x,p.x); assert.ok(world(arrow.cone).x<world(arrow).x,'reaction points toward -x');
      phases.add('press');
    }else if(goal.x-p.x>.005) phases.add('approach');
    // The rear of the source sphere seats inside the bracelet. Raycast its
    // exposed forward cap, not the (partially buried) whole silhouette.
    for(const y of [-.003,0,.003]) {
      const ndc=tcp.localToWorld(new T.Vector3(0,y,.009)).project(camera);
      ray.setFromCamera(ndc,camera);
      const opaque=ray.intersectObject(scene.root,true).find(({object:m})=>{
        if(!m.isMesh || (m.material.transparent && m.material.opacity<.5))return false;
        for(let a=m;a;a=a.parent)if(!a.visible)return false;
        return true;
      });
      // During departure the red reference can physically overlap the gray tip.
      assert.ok(opaque?.object===tcp || (opaque?.object===ref && p.distanceTo(goal)<.022),
        `probe cap at t=${o.t} blocked by ${opaque?.object.name}`);
    }
  }
  for(let i=0;i<=800;i++) {
    if(i%40===0)check();
    sim.step(.005);
  }
  assert.deepEqual([...phases],['approach','press']);
  assert.ok(world(tcp).x>wallX+.007 && world(tcp).x<world(ref).x,'press visibly short of the reference');
  sim.disturb();sim.step(.005);check();
  sim.params.target=definition.parameters.find(d=>d.key==='target').min;
  for(let i=0;i<600;i++)sim.step(.005);
  check();assert.ok(world(tcp).x<wallX && !arrow.visible,'free again after withdrawing');
  sim.reset();check();near(world(ref).x,initial.x);near(world(tcp).x,initial.x);
});
