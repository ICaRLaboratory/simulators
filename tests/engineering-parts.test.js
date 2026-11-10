import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {finish, housing, turned, flange, fasteners, cable} from '../assets/three/engineering.js';
import {floor} from '../assets/three/primitives.js';

test('the environment is a continuous ground surface, not a toy-sized gridded plinth',()=>{
  const root=new T.Group(),stage=floor(root,4,3);
  const surface=stage.getObjectByName('stage-surface');
  assert.equal(surface.userData.environment,true);
  assert.equal(surface.geometry.type,'PlaneGeometry');
  assert.equal(surface.castShadow,false);assert.equal(surface.receiveShadow,true);
  assert.equal(stage.getObjectByName('stage-grid'),undefined);
});

test('engineering finishes distinguish metal, coated panels and rubber without DOM textures', () => {
  const steel=finish('steel'), paint=finish('paint'), rubber=finish('rubber');
  assert(steel.metalness>.75 && paint.metalness<.2 && rubber.metalness===0);
  assert(rubber.roughness>paint.roughness && paint.roughness>steel.roughness);
  assert(steel.roughnessMap?.isDataTexture);
  assert.equal(steel.roughnessMap,finish('steel').roughnessMap,'reuse deterministic grain');
  for(const material of [steel,paint,rubber])assert(material.color.toArray().every(Number.isFinite));
  assert.throws(()=>finish('unlisted'),/finish/);
});

test('machined housing keeps exact dimensions while adding small edge bevels', () => {
  const root=new T.Group(), part=housing(root,'housing',[2,1,.6],[1,2,3],'aluminium');
  assert.equal(part.parent,root);assert.deepEqual(part.position.toArray(),[1,2,3]);
  part.geometry.computeBoundingBox();const size=part.geometry.boundingBox.getSize(new T.Vector3());
  for(const [a,b] of [[size.x,2],[size.y,1],[size.z,.6]])assert(Math.abs(a-b)<1e-6);
  assert(part.geometry.getAttribute('position').count>24);
});

test('turned parts, real flange bores and cable runs have finite reusable geometry', () => {
  const root=new T.Group();
  const part=turned(root,'housing',[[0,-.2],[.4,-.2],[.4,.2],[0,.2]],[0,0,0],'steel');
  const ring=flange(root,'flange',.3,.05,[0,.25,0],'aluminium',.12);
  const screws=fasteners(root,'bolts',.23,[0,.29,0],6,.025);
  const wire=cable(root,'signal-cable',[[0,0,0],[.2,.4,.1],[.5,.1,0]],.012);
  assert.equal(screws.children.length,6);
  assert.equal(ring.userData.bore,.12);
  assert(wire.material.roughness>.7);
  for(const object of [part,ring,wire])assert(object.geometry.attributes.position.array.every(Number.isFinite));
  root.updateMatrixWorld(true);root.traverse(node=>assert(node.matrixWorld.elements.every(Number.isFinite)));
});
