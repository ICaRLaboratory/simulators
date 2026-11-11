import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import {createApparatusCamera,resizeApparatusCamera} from '../assets/three/camera.js';

test('engineering view uses a restrained perspective with the same target-plane framing budget',()=>{
  const spec={position:[0,0,5],target:[0,0,0],span:4};
  for(const aspect of [.8,1.6,2.4]){
    const camera=createApparatusCamera(spec,aspect);
    assert(camera.isPerspectiveCamera);camera.updateMatrixWorld(true);
    const vertical=spec.span/Math.min(aspect,1.6);
    const edge=new T.Vector3(vertical*aspect/2,vertical/2,0).project(camera);
    assert(Math.abs(edge.x-1)<1e-6&&Math.abs(edge.y-1)<1e-6);
    const position=camera.position.clone();resizeApparatusCamera(camera,spec,1.1);
    assert.deepEqual(camera.position,position,'resizing never changes the user orbit');
  }
});

test('compact apparatuses can explicitly retain orthographic projection',()=>{
  const spec={position:[4,3,5],target:[0,0,0],span:4,projection:'orthographic'};
  const camera=createApparatusCamera(spec,1.6);assert(camera.isOrthographicCamera);
  assert.deepEqual(camera.position.toArray(),spec.position);
});

test('an independently bounded horizontal workspace fills narrow views without moving the camera',()=>{
  for(const projection of ['perspective','orthographic']){
    const spec={position:[0,0,5],target:[0,0,0],span:4,minHorizontalSpan:2.8,projection};
    const camera=createApparatusCamera(spec,1.6),position=camera.position.clone(),rotation=camera.quaternion.toArray();
    for(const aspect of [.45,.8,1,1.6,2.4]){
      resizeApparatusCamera(camera,spec,aspect);
      const vertical=Math.max(4/1.6,2.8/aspect);
      const edge=new T.Vector3(vertical*aspect/2,vertical/2,0).project(camera);
      assert(Math.abs(edge.x-1)<1e-6&&Math.abs(edge.y-1)<1e-6,'fit the separately bounded horizontal and vertical extents');
      assert.deepEqual(camera.position,position);assert.deepEqual(camera.quaternion.toArray(),rotation);
    }
  }
});

test('invalid independent width budgets fail before mutating a camera',()=>{
  const spec={position:[0,0,5],target:[0,0,0],span:4};
  const camera=createApparatusCamera(spec,1.6),projection=camera.projectionMatrix.toArray();
  for(const width of [0,-1,NaN,Infinity,null,5]){
    assert.throws(()=>resizeApparatusCamera(camera,{...spec,minHorizontalSpan:width},.8),/horizontal span/);
    assert.deepEqual(camera.projectionMatrix.toArray(),projection);
  }
});
