import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from '../assets/vendor/three.js';
import { createProcessScene } from '../assets/three/process-scenes.js';
import { Simulation as Heat } from '../assets/models/heat-exchanger.js';
import { Simulation as Cstr } from '../assets/models/cstr.js';
import { createApparatusCamera } from '../assets/three/camera.js';

const part = (scene, name) => {
  const result = scene.root.getObjectByName(name);
  assert.ok(result, `Missing ${name}`); return result;
};
const frozen = value => Object.freeze(structuredClone(value));
const update = (scene, model) => scene.update(frozen(model.state), frozen(model.params));
const near = (a, b, tolerance = 1e-10) => assert.ok(Math.abs(a - b) < tolerance, `${a} != ${b}`);

// Real controller trajectory, not an invented axial temperature field.
test('exchanger bulk fluid visibly carries temperature while structural steel stays neutral', () => {
  const scene = createProcessScene('heat-exchanger'), model = new Heat();
  const fluid = part(scene, 'mixed-fluid'), shell = part(scene, 'exchanger-shell');
  const steel = shell.material.color.clone();
  update(scene, model);
  assert.ok(fluid.material.opacity >= .6, 'Bulk cutaway must be conspicuous, not the old .08 wash');
  assert.equal(fluid.material.emissive.getHex(), 0, 'False-color fluid, not thermal radiation');
  const cold = fluid.material.color.clone();
  Object.assign(model.params, { target: 75, flow: .1 });
  for (let i = 0; i < 240; i++) model.step(.5);
  assert.ok(model.state.temperature > 70);
  update(scene, model);
  assert.ok(cold.distanceTo ? cold.distanceTo(fluid.material.color) > .3 :
    new T.Vector3(...cold.toArray()).distanceTo(new T.Vector3(...fluid.material.color.toArray())) > .3);
  assert.equal(part(scene, 'outlet-pipe').material.color.getHex(), fluid.material.color.getHex());
  assert.deepEqual(shell.material.color, steel);
  assert.match(scene.legend.en, /false.color.*fluid/i);
  assert.match(scene.legend.en, /0.*25.*50.*75.*100/);
});

test('CSTR bulk, surface and cutaway jacket use the same Celsius palette without concentration tint or level changes', () => {
  const scene = createProcessScene('cstr'), model = new Cstr();
  const hx = createProcessScene('heat-exchanger'), heat = new Heat();
  const fluid = part(scene, 'reactor-fluid'), surface = part(scene, 'fluid-surface');
  const jacket = part(scene, 'cooling-jacket');
  const initial = [fluid.position.toArray(), fluid.scale.toArray(), surface.position.toArray()];
  assert.ok(fluid.material.opacity >= .6, 'Reactor liquid must be strongly visible');
  assert.ok(jacket.material.opacity >= .6, 'Open jacket bands must show a separate coolant state');
  // Analytical unit-conversion snapshots, with real model schemas.
  for (const celsius of [0, 25, 50, 60, 75, 100, 126.85]) {
    scene.update(frozen({...model.state, temperature:celsius+273.15, coolant:celsius+273.15}), frozen(model.params));
    hx.update(frozen({...heat.state, temperature:celsius}), frozen(heat.params));
    for (const name of ['reactor-fluid','fluid-surface','product-pipe','cooling-jacket','coolant-inlet','coolant-outlet'])
      assert.equal(part(scene,name).material.color.getHex(), part(hx,'mixed-fluid').material.color.getHex(), name);
  }
  update(scene, model);
  const color = fluid.material.color.clone(), opacity = fluid.material.opacity;
  scene.update(frozen({...model.state, concentration:1.5}), frozen(model.params));
  assert.deepEqual(fluid.material.color, color);
  assert.equal(fluid.material.opacity, opacity, 'Concentration is the separate column, never temperature saturation');
  near(part(scene, 'concentration-column').scale.y, 1.2);
  assert.deepEqual([fluid.position.toArray(),fluid.scale.toArray(),surface.position.toArray()], initial);
  assert.equal(fluid.userData.volumeLitres, 100);
  assert.match(scene.legend.en, /false.color.*fluid/i);
  assert.match(scene.legend.en, /concentration.*column/i);
  assert.match(scene.legend.en, /amber.*target.*feed/i, 'Retain the existing target/feed marker key');
});

test('exchanger heat arrows and mass-flow chevrons respond to actual input without an invented clock', () => {
  const scene = createProcessScene('heat-exchanger'), model = new Heat();
  const heat = part(scene, 'heat-transfer-0');
  const inlet = part(scene, 'inlet-flow'), outlet = part(scene, 'outlet-flow');
  update(scene,model);
  assert.equal(heat.visible,false, 'Zero Q must have no heat transfer cue');
  for (const flow of [.1,.5,1]) {
    model.params.flow=flow; model.step(.2); update(scene,model);
    near(heat.userData.value,model.state.heat);
    for (const cue of [inlet,outlet]) {
      near(cue.userData.value,flow);
      const direction = new T.Vector3(0,1,0).applyQuaternion(cue.quaternion);
      near(direction.x,1); near(direction.y,0);
    }
    assert.equal(inlet.scale.x,outlet.scale.x);
    if(flow===.1)scene.root.userData.lowFlowWidth=inlet.scale.x;
  }
  assert.ok(inlet.scale.x>scene.root.userData.lowFlowWidth*1.5);
  // Analytical input endpoints from the real schema: arrow width, not a fabricated hot-side T.
  for(const q of [0,75,150]){
    scene.update(frozen({...model.state,heat:q}),frozen(model.params));
    near(heat.userData.value,q);assert.equal(heat.visible,q>0);
    const direction=new T.Vector3(0,1,0).applyQuaternion(heat.quaternion);
    near(direction.y,-1);
    if(q===75)scene.root.userData.halfHeatWidth=heat.scale.x;
  }
  assert.ok(heat.scale.x>scene.root.userData.halfHeatWidth);
  model.disturb();update(scene,model);
  near(part(scene,'inlet-pipe').userData.temperatureC,model.params.inlet-10);
  const before=[inlet.position.toArray(),inlet.quaternion.toArray()];
  scene.update(frozen({...model.state,t:9876}),frozen(model.params));
  assert.deepEqual([inlet.position.toArray(),inlet.quaternion.toArray()],before,'Static direction markers do not invent transit time');
  assert.match(scene.legend.en,/flow.*width/i);
});

test('CSTR heat cues expose the actual energy balance and reverse jacket transfer when coolant heats the liquid', () => {
  const scene=createProcessScene('cstr'),model=new Cstr();
  const reaction=part(scene,'reaction-heat-right'),jacket=part(scene,'jacket-heat');
  for(const target of [60,80,100]) {
    model.reset();model.params.target=target;
    for(let i=0;i<320&&!model.state.failed;i++) {
      if(i===80)model.disturb();
      model.step(.1);update(scene,model);
      const d=scene.root.userData.thermal;
      assert.ok(d,'Read-only instantaneous equation diagnostics, not another integrator');
      near(d.rate,model.state.rate,1e-9);
      near((d.feedKW+d.reactionKW+d.jacketKW)/23.9,d.rate,1e-9);
      near(reaction.userData.value,d.reactionKW);
      near(jacket.userData.value,d.jacketKW);
    }
  }
  model.reset();update(scene,model);
  near(reaction.userData.value,5000/120);
  near(jacket.userData.value,-50000/60/1000*50);
  near(reaction.scale.x,jacket.scale.x);
  // Explicit analytical snapshots of admissible T/Tc and zero concentration.
  for(const [temperature,coolant,concentration] of [[310,330,.5],[330,310,.5],[330,330,0]]) {
    const state=frozen({...model.state,temperature,coolant,concentration});
    scene.update(state,frozen(model.params));
    const direction=new T.Vector3(0,1,0).applyQuaternion(jacket.quaternion);
    assert.equal(jacket.visible,temperature!==coolant);
    if(temperature!==coolant)near(direction.x,temperature>coolant?1:-1);
    assert.equal(reaction.visible,concentration>0);
    near(part(scene,'coolant-inlet').userData.temperatureC,coolant-273.15);
    near(part(scene,'coolant-outlet').userData.temperatureC,coolant-273.15);
  }
  assert.match(scene.legend.en,/reaction/);
  assert.match(scene.legend.en,/jacket.*exchange/);
  assert.match(scene.legend.en,/width.*qualitative/i);
});

function visualSnapshot(scene) {
  scene.root.updateMatrixWorld(true);
  const rows=[];
  scene.root.traverse(n=>rows.push([n.name,n.matrixWorld.toArray(),n.visible,
    n.material?.color?.toArray(),n.material?.opacity,structuredClone(n.userData)]));
  return rows;
}
function resourceList(scene) {
  const refs=[];
  scene.root.traverse(n=>{
    refs.push(n,n.geometry,n.material,n.material?.color);
    for(const a of Object.values(n.geometry?.attributes??{}))refs.push(a,a.array,a.array.buffer);
  });
  return refs;
}
for(const [id,Model] of [['heat-exchanger',Heat],['cstr',Cstr]]) {
  test(`${id}: frozen state, materials, colors and buffers survive pause, disturbance and reset`,()=>{
    const model=new Model(),scene=createProcessScene(id),other=createProcessScene(id);
    update(scene,model);update(other,model);
    const refs=resourceList(scene),initial=visualSnapshot(scene),untouched=visualSnapshot(other);
    const readouts=scene.readouts(),camera=structuredClone(scene.camera);
    for(let i=0;i<100;i++){
      if(i===30)model.disturb();
      model.step(.25);
      const state=frozen(model.state),params=frozen(model.params),before=JSON.stringify({state,params});
      scene.update(state,params);const once=visualSnapshot(scene);
      scene.update(state,params);assert.deepEqual(visualSnapshot(scene),once,'Identical paused snapshot is an exact no-op');
      assert.equal(JSON.stringify({state,params}),before);
    }
    const after=resourceList(scene);assert.equal(after.length,refs.length);
    refs.forEach((r,i)=>assert.equal(after[i],r,'No material/color/geometry/buffer reallocation'));
    assert.equal(scene.readouts(),readouts);assert.deepEqual(scene.camera,camera);
    assert.deepEqual(visualSnapshot(other),untouched,'No cross-instance recoloring');
    model.reset();update(scene,model);assert.deepEqual(visualSnapshot(scene),initial,'Reset exactly reproduces the initial apparatus');
  });
}

test('exchanger flow cues are not hidden behind end heads or the thermometer in the production view',()=>{
  const scene=createProcessScene('heat-exchanger'),model=new Heat();update(scene,model);
  scene.root.updateMatrixWorld(true);
  const camera=createApparatusCamera(scene.camera,1.6),ray=new T.Raycaster();
  for(const name of ['inlet-flow','outlet-flow']){
    const cue=part(scene,name),point=cue.localToWorld(new T.Vector3(0,.36,0));
    ray.set(camera.position,point.sub(camera.position).normalize());
    const hit=ray.intersectObject(scene.root,true).find(h=>h.object.material?.opacity>=.95);
    assert.ok(hit?.object.name.startsWith(name),`${name} hidden by ${hit?.object.name}`);
  }
});

test('thermal apparatuses frame every real transient and maximum cue through the production camera',()=>{
  const p=new T.Vector3();
  for(const [id,Model] of [['heat-exchanger',Heat],['cstr',Cstr]]){
    const scene=createProcessScene(id),model=new Model(),poses=[];
    for(const target of id==='cstr'?[60,100]:[30,75]){
      model.reset();model.params.target=target;
      for(let i=0;i<120&&!model.state.failed;i++){
        if(i===20)model.disturb();model.step(.5);
        if(i%5===0||model.state.failed)poses.push([frozen(model.state),frozen(model.params)]);
      }
    }
    // Explicit analytical extremal inputs, not claimed to be a trajectory.
    poses.push([frozen({...model.state,temperature:id==='cstr'?399:100,coolant:330,heat:150,concentration:2}),frozen({...model.params,flow:1})]);
    for(const aspect of [.8,1,1.25,1.6,2.1]){
      const camera=createApparatusCamera(scene.camera,aspect);
      for(const [state,params] of poses){
        scene.update(state,params);scene.root.updateMatrixWorld(true);
        scene.root.traverseVisible(n=>{
          for(let a=n;a;a=a.parent)if(a.userData.environment)return;
          const positions=n.geometry?.attributes.position;if(!positions)return;
          for(let i=0;i<positions.count;i++){
            p.fromBufferAttribute(positions,i).applyMatrix4(n.matrixWorld).project(camera);
            assert.ok(p.toArray().every(Number.isFinite));
            assert.ok(Math.abs(p.x)<=.97&&Math.abs(p.y)<=.97&&Math.abs(p.z)<=1,`${id}/${n.name} clipped at ${p.toArray()}, aspect ${aspect}`);
          }
        });
      }
    }
  }
});
