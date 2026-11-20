import * as T from '../vendor/three.js';
import {gen3Pose, HOME} from '../models/gen3.js';
import {wallX, referenceX, contactForce} from '../models/impedance-robot.js';
import {makeGen3Geometry} from './gen3-meshes.js';
import {group, box, sphere, floor, material} from './primitives.js';

// Material colors and link order from GEN3_FOR_URDF_ARM_V11_MOD. Each CAD
// visual has identity local origin, including the 12.5 mm sphere at the TCP.
const links = [
  ['Base_Link', 0xd5e1ef], ['Shoulder_Link', 0xf4c0c0],
  ['HalfArm1_Link', 0xebf2c3], ['HalfArm2_Link', 0xfaca8f],
  ['ForeArm_Link', 0xd5e1ef], ['SphericalWrist1_Link', 0xf4c0c0],
  ['SphericalWrist2_Link', 0xebf2c3], ['Bracelet_Link', 0xfaca8f], ['EndEffector_Link', 0x808080],
];

export function createImpedanceScene() {
  const root = group('impedance-robot'), robot = group('gen3');
  root.add(robot);
  robot.rotation.x = -Math.PI/2; // URDF (x,y,z) -> viewport (x,z,-y).
  const meshes = links.map(([name,color],i) => {
    const mesh = new T.Mesh(makeGen3Geometry(T,i), material(color, {metalness:.12, roughness:.38}));
    mesh.name = name; mesh.castShadow = true; mesh.receiveShadow = true;
    robot.add(mesh);
    return mesh;
  });
  const rotation = new T.Matrix4();
  function pose(frames) {
    // gen3Pose supplies absolute link transforms in the base frame. Composing
    // these a second time through a chain of parents would double each joint.
    frames.forEach(({p,r},i) => {
      meshes[i].position.fromArray(p);
      rotation.set(r[0],r[1],r[2],0, r[3],r[4],r[5],0, r[6],r[7],r[8],0, 0,0,0,1);
      meshes[i].quaternion.setFromRotationMatrix(rotation);
    });
  }
  const home = gen3Pose(HOME), tcp = meshes.at(-1);
  pose(home.frames);
  floor(root, 2, 2, 0);
  // Simscape Wall Object: 0.1 × 1 × 1 m. Place its leading face at the
  // plant's rest plane; compression moves the actual TCP, never the wall.
  const rest = new T.Color(0x699bcb), loaded = new T.Color(0x4486c2);
  const wall = box(root, 'contact-wall', [.1,1,1], [wallX+.05,.5,0], rest,
    {transparent:true, opacity:.44, depthWrite:false, roughness:.72, metalness:0});
  wall.castShadow = false;
  // Draw the reference after the translucent wall, but respect opaque CAD.
  // Where tip and reference overlap, outline the reference instead of covering
  // the physical tool with a red sphere at the same point.
  const reference = group('reference'); root.add(reference);
  reference.position.set(home.x,home.z,-home.y);
  const red = new T.MeshBasicMaterial({color:0xde171c, toneMapped:false, transparent:true,
    depthWrite:false, side:T.DoubleSide});
  const target = sphere(reference, 'reference-tip', .011, [0,0,0], red);
  const halo = new T.Mesh(new T.RingGeometry(.015,.018,48),red);
  halo.name = 'coincident-reference'; reference.add(halo);
  target.renderOrder = halo.renderOrder = 1;
  target.castShadow = target.receiveShadow = target.visible = false;
  const reaction = new T.ArrowHelper(new T.Vector3(-1,0,0), new T.Vector3(), .07, 0x09655f, .016, .012);
  reaction.name = 'contact-reaction'; reaction.visible = false; root.add(reaction);
  const wallPoint = group('wall-readout-anchor'); root.add(wallPoint);
  wallPoint.position.set(wallX,home.z,-home.y);
  const readings = [
    {id:'endpoint-x', anchor:tcp, label:{ko:'끝점 x',en:'Tip x'}, value:'', side:'left'},
    {id:'contact-force', anchor:wallPoint, label:{ko:'접촉 힘',en:'Contact force'}, value:'', side:'right'},
  ];
  return {
    root, readouts: () => readings,
    camera: {projection:'orthographic', position:[.30,.58,3], target:[.30,.50,0], span:1.78, minHorizontalSpan:.92},
    legend: {
      ko:'Gen3 · 관절 2, 4, 6 구동 · 빨강: 목표 끝점 · 파랑: 유연 벽 · 화살표: 접촉 반력',
      en:'Gen3 · active joints 2, 4, 6 · red: reference tip · blue: compliant wall · arrow: contact reaction',
    },
    update(state, params) {
      const k = gen3Pose(state.q);
      pose(k.frames);
      reference.position.x = referenceX(state.t, params);
      halo.visible = Math.hypot(reference.position.x-k.x, home.z-k.z, home.y-k.y) < .024;
      target.visible = !halo.visible;
      const vx = k.J[0].reduce((v,j,i) => v+j*state.dq[i], 0);
      const force = contactForce(k.x,vx,params.wallStiffness);
      readings[0].value = `${k.x.toFixed(3)} m`; readings[1].value = `${force.toFixed(2)} N`;
      wallPoint.position.set(wallX,k.z,-k.y);
      reaction.visible = force > 0;
      if (reaction.visible) {
        // Offset the annotation below the wrist so it never replaces the tip.
        reaction.position.set(k.x,k.z-.06,-k.y);
        reaction.setLength(.04+Math.min(.12,.009*force), .016, .012);
      }
      wall.material.color.copy(reaction.visible ? loaded : rest);
    },
  };
}
