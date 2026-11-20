import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {Simulation, wallX} from '../assets/models/impedance-robot.js';
import {createImpedanceScene} from '../assets/three/gen3-scene.js';
import {createApparatusCamera} from '../assets/three/camera.js';

// Bounds measured on the original Kinova STLs in metres (before mesh reduction).
const source = [
  ['Base_Link',0xd5e1ef,[-.04605,-.04600,0],[.04644,.04616,.17085]],
  ['Shoulder_Link',0xf4c0c0,[-.04636,-.04865,-.17438],[.04636,.04606,-.00237]],
  ['HalfArm1_Link',0xebf2c3,[-.046,-.22480,-.05538],[.046,.046,.03962]],
  ['HalfArm2_Link',0xfaca8f,[-.046,-.049,-.25638],[.046,.046,-.00237]],
  ['ForeArm_Link',0xd5e1ef,[-.046,-.22090,-.05594],[.046,.046,.02865]],
  ['SphericalWrist1_Link',0xf4c0c0,[-.035,-.05305,-.14100],[.035,.035,-.00250]],
  ['SphericalWrist2_Link',0xebf2c3,[-.035,-.11840,-.05333],[.035,.03508,.03482]],
  ['Bracelet_Link',0xfaca8f,[-.04550,-.07467,-.06442],[.04550,.03750,-.00250]],
  ['EndEffector_Link',0x808080,[-.01248,-.01250,-.01249],[.01249,.01250,.01249]],
];

test('the nine link-local solids have the source dimensions, materials and spherical tool', () => {
  const scene=createImpedanceScene(), assembly=scene.root.getObjectByName('gen3');
  const meshes=[]; assembly.traverse(o=>{if(o.isMesh)meshes.push(o);});
  assert.deepEqual(meshes.map(o=>o.name),source.map(d=>d[0]),'no duplicate probe or invented gripper');
  for(const [name,color,lo,hi] of source) {
    const mesh=assembly.getObjectByName(name), g=mesh.geometry;
    assert.equal(mesh.material.color.getHex(),color);
    const bounds=new T.Box3().setFromBufferAttribute(g.attributes.position);
    for(const [point,expected] of [[bounds.min,lo],[bounds.max,hi]])
      point.toArray().forEach((v,i)=>assert.ok(Math.abs(v-expected[i])<.001,`${name} local bounds: ${v} vs ${expected[i]}`));
    if(name==='EndEffector_Link') {
      for(let i=0;i<g.attributes.position.count;i++) {
        const r=new T.Vector3().fromBufferAttribute(g.attributes.position,i).length();
        assert.ok(Math.abs(r-.0125)<.00025,`actual contact sphere vertex radius ${r}`);
      }
    }
  }
});

test('the blue wall is one 0.1 × 1 × 1 m slab with its front on the rest plane', () => {
  const {root}=createImpedanceScene(), wall=root.getObjectByName('contact-wall');
  const b=new T.Box3().setFromObject(wall);
  assert.ok(b.min.distanceTo(new T.Vector3(wallX,0,-.5))<1e-7);
  assert.ok(b.max.distanceTo(new T.Vector3(wallX+.1,1,.5))<1e-7);
  assert.ok(wall.material.transparent && wall.material.opacity>0 && wall.material.opacity<.5 && !wall.material.depthWrite);
  assert.ok(wall.material.color.b>wall.material.color.r);
});

test('fixed camera frames the actual arm, wall and reference at narrow and wide aspects', () => {
  const scene=createImpedanceScene(), sim=new Simulation(), point=new T.Vector3();
  const views=[.50,.73,1.6*scene.camera.minHorizontalSpan/scene.camera.span,1.60,2.40]
    .map(aspect=>createApparatusCamera(scene.camera,aspect));
  for(const camera of views){
    // The entire wall is a metre deep. Parallax along x can make a 3 px
    // indentation appear much larger than the TCP's real displacement.
    const near=new T.Vector3(wallX,.43,.5).project(camera), far=new T.Vector3(wallX,.43,-.5).project(camera);
    assert.ok(Math.abs(near.x-far.x)<1e-10,'default elevation shows the true front plane');
  }
  for(let step=0;step<=80;step++) {
    if(step===42)sim.disturb();
    scene.update(sim.state,sim.params); scene.root.updateMatrixWorld(true);
    for(const camera of views) {
      const armBounds=new T.Box3();
      scene.root.traverseVisible(object=>{
        if(object.userData.environment)return;
        const p=object.geometry?.attributes.position;
        if(!p)return;
        for(let i=0;i<p.count;i++) {
          point.fromBufferAttribute(p,i).applyMatrix4(object.matrixWorld).project(camera);
          assert.ok(Math.max(Math.abs(point.x),Math.abs(point.y))<.98 && Math.abs(point.z)<1,`clipped ${object.name}`);
          if(object.parent.name==='gen3')armBounds.expandByPoint(point);
        }
      });
      const size=armBounds.getSize(point);
      assert.ok(size.y>.95 || size.x>1.0,'arm itself is readable, not just the wall');
    }
    sim.step(.05);
  }
});
