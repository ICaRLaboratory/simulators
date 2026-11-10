import * as T from '../vendor/three.js';
import { mechanics, kinematics, contactForce } from '../models/impedance-robot.js';
import {
  C, group, box, cylinder, sphere, rod, setRod, line, floor, targetMarker, material,
} from './primitives.js';

import { finish, housing, turned, flange, fasteners, cable } from './engineering.js';

const TAU = Math.PI * 2;
const addGroup = (parent, name) => {
  const result = group(name);
  parent.add(result);
  return result;
};

function solid(parent, name, geometry, color, options = {}) {
  const mesh = new T.Mesh(geometry, material(color, options));
  mesh.name = name;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

// The model bounds histories at 500 points and parking plans at 301. Allocate once.
function streamLine(parent, name, capacity, color, dashed = false) {
  const result = line(parent, name, Array.from({ length: capacity }, () => [0, 0, 0]), color, dashed);
  result.geometry.setDrawRange(0, 0);
  return result;
}

function writeLine(object, points) {
  const position = object.geometry.getAttribute('position');
  if (points.length > position.count) throw new RangeError(`Path exceeds ${object.name} capacity`);
  const distances = object.geometry.getAttribute('lineDistance');
  let distance = 0;
  for (let i = 0; i < points.length; i++) {
    position.setXYZ(i, ...points[i]);
    if (i) distance += Math.hypot(...points[i].map((value, axis) => value - points[i - 1][axis]));
    distances?.setX(i, distance);
  }
  position.needsUpdate = true;
  if (distances) distances.needsUpdate = true;
  object.geometry.setDrawRange(0, points.length);
  object.geometry.computeBoundingSphere();
}

function faceDisc(parent, name, radius, depth, position, color) {
  const mesh = cylinder(parent, name, radius, depth, position, color);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function faceFlange(parent, name, radius, depth, position, metal, bore) {
  const mesh = flange(parent, name, radius, depth, position, metal, bore);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function faceTurned(parent, name, profile, position, metal) {
  const mesh = turned(parent, name, profile, position, metal);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function faceFasteners(parent, name, radius, position, count = 6, headRadius = .012) {
  const ring = fasteners(parent, name, radius, position, count, headRadius);
  ring.rotation.x = Math.PI / 2;
  return ring;
}

function jointDrive(parent, name, radius, finishes) {
  const { steel, alloy, dark, paint } = finishes;
  // Rear servo, reduction stage, output bearing and shaft are separate solids.
  faceTurned(parent, `${name}-servo-can`, [[0, -.37], [radius * .7, -.37],
    [radius * .8, -.35], [radius * .8, -.18], [radius * .92, -.15],
    [radius * .92, -.11], [0, -.11]], [0, 0, 0], dark);
  faceTurned(parent, `${name}-encoder-cover`, [[0, -.394], [radius * .62, -.394],
    [radius * .74, -.38], [radius * .74, -.365], [0, -.365]], [0, 0, 0], alloy);
  faceTurned(parent, `${name}-gearcase`, [[0, -.15], [radius * .92, -.15],
    [radius, -.12], [radius, .06], [radius * .92, .085], [0, .085]], [0, 0, 0], paint);
  faceFlange(parent, `${name}-output-flange`, radius * .94, .034, [0, 0, .097], steel, radius * .42);
  faceFlange(parent, `${name}-bearing-seal`, radius * .63, .012, [0, 0, .119], dark, radius * .5);
  faceDisc(parent, `${name}-output-shaft`, radius * .49, .065, [0, 0, .115], alloy);
  faceDisc(parent, `${name}-index-cap`, radius * .29, .014, [0, 0, .153], finish('paint', { color: C.teal }));
  faceFasteners(parent, `${name}-flange-bolts`, radius * .78, [0, 0, .12], 6, radius * .055);
  housing(parent, `${name}-connector`, [.075, .06, .09], [0, radius * .89, -.28], dark);
  cable(parent, `${name}-service-loop`, [[0, radius * .9, -.29], [-radius * .65, radius * 1.24, -.34],
    [-radius * 1.08, radius * .65, -.39], [-radius * .9, -radius * .65, -.37],
    [.04, -radius * 1.08, -.29]], .014);
}

function machinedLink(parent, name, length, radius, finishes) {
  const { paint, alloy, dark } = finishes;
  // A tapered hollow casting, not a rectangular beam with cosmetic bolts.
  const contour = [[.02, -radius], [length * .22, -radius], [length * .54, -radius * .79],
    [length - .08, -radius * .57], [length + .025, -radius * .4],
    [length + .025, radius * .4], [length - .08, radius * .57],
    [length * .54, radius * .79], [length * .22, radius], [.02, radius], [-.045, radius * .62], [-.045, -radius * .62]];
  const pocket = [[length * .23, -radius * .66], [length * .57, -radius * .49],
    [length - .11, -radius * .28], [length - .11, radius * .28],
    [length * .57, radius * .49], [length * .23, radius * .66]];
  profileSolid(parent, name, contour, .22, paint, {}, .009, [pocket]);
  const serviceCover = profileSolid(parent, `${name}-service-cover`, pocket, .012, dark, {}, .009);
  serviceCover.position.z = -.113;
  const web = profileSolid(parent, `${name}-web`, [[length * .25, -.018], [length - .1, -.012],
    [length - .1, .012], [length * .25, .018]], .25, alloy, {}, .005);
  web.position.z = 0;
  cable(parent, `${name}-service-cable`, [[.05, -radius, -.26], [length * .3, -radius * 1.3, -.24],
    [length * .7, -radius, -.23], [length - .025, -.045, -.27]], .013);
  for (const x of [length * .34, length * .65]) {
    housing(parent, `${name}-cable-clip-${x}`, [.035, .034, .07], [x, -radius * 1.1, -.235], alloy);
  }
}

function armAssembly(root, l1, l2, reach) {
  const floorY = -reach - .27;
  const stage = floor(root, reach * 2 + .9, 2.6, floorY);
  stage.userData.environment = true;
  const finishes = { steel: finish('steel'), alloy: finish('aluminium'), dark: finish('dark-metal'),
    paint: finish('paint', { color: 0xb3bbb7 }) };
  const { steel, alloy, dark, paint } = finishes;
  const base = addGroup(root, 'arm-base');
  housing(base, 'mounting-plinth', [.84, .10, .78], [0, floorY + .05, -.42], dark);
  housing(base, 'plinth-insert', [.76, .05, .70], [0, floorY + .125, -.42], steel);
  housing(base, 'fixed-pedestal', [.22, -floorY - .21, .27], [0, (floorY + .15 - .06) / 2, -.45], paint);
  housing(base, 'pedestal-cap', [.41, .16, .43], [0, -.11, -.42], alloy);
  for (const sign of [-1, 1]) {
    const gusset = profileSolid(base, `pedestal-gusset-${sign < 0 ? 'left' : 'right'}`,
      [[sign * .12, floorY + .16], [sign * .36, floorY + .16], [sign * .12, floorY + .65]], .18, alloy, {}, .008);
    gusset.position.z = -.42;
  }
  housing(base, 'pedestal-service-cover', [.13, -floorY - .49, .02], [0, (floorY + .16) / 2, -.301], dark);
  for (const x of [-.3, .3]) for (const z of [-.66, -.16]) {
    fasteners(base, `mount-bolt-${x}-${z}`, 0, [x, floorY + .16, z], 1, .028);
  }
  cable(base, 'pedestal-cable', [[0, floorY + .17, -.63], [-.08, floorY + .46, -.65],
    [-.09, -.48, -.65], [0, -.19, -.35]], .019);
  jointDrive(base, 'shoulder', l1 > .7 ? .205 : .185, finishes);
  const shoulder = addGroup(root, 'shoulder');
  machinedLink(shoulder, 'upper-link', l1, l1 > .7 ? .17 : .135, finishes);
  const elbowDrive = addGroup(shoulder, 'elbow-drive');
  elbowDrive.position.x = l1;
  jointDrive(elbowDrive, 'elbow', l2 > .7 ? .16 : .142, finishes);
  const elbow = addGroup(shoulder, 'elbow');
  elbow.position.x = l1;
  const forearm = addGroup(elbow, 'forearm-hardware');
  machinedLink(forearm, 'forearm-link', l2, l2 > .7 ? .132 : .105, finishes);
  const tool = addGroup(elbow, 'tool-center');
  tool.position.x = l2;
  const wrist = addGroup(tool, 'wrist-hardware');
  faceTurned(wrist, 'wrist-bearing', [[0, -.105], [.072, -.105], [.08, -.08], [.08, .075],
    [.065, .1], [0, .1]], [0, 0, 0], dark);
  faceFlange(wrist, 'wrist-output-flange', .069, .028, [0, 0, .112], steel, .026);
  faceDisc(wrist, 'wrist-index', .025, .017, [0, 0, .133], finish('paint', { color: C.teal }));
  faceFasteners(wrist, 'wrist-bolts', .05, [0, 0, .132], 4, .007);
  return {
    shoulder, elbow, tool, forearm, wrist,
    pose(q1, q2) {
      shoulder.rotation.z = q1;
      elbow.rotation.z = q2;
    },
  };
}

function servoArm() {
  const root = group('robot-arm');
  const arm = armAssembly(root, .8, .8, 1.6);
  housing(arm.tool, 'gripper-palm', [.09, .16, .105], [.065, 0, 0], 'aluminium');
  for (const z of [-.035, .035]) rod(arm.tool, `jaw-guide-${z}`, [.07, -.09, z], [.07, .09, z], .012, finish('steel'));
  for (const [name, sign] of [['left', 1], ['right', -1]]) {
    housing(arm.tool, `gripper-${name}`, [.15, .028, .07], [.17, sign * .075, 0], 'dark-metal');
    housing(arm.tool, `gripper-${name}-pad`, [.028, .042, .071], [.23, sign * .054, 0], 'rubber');
  }
  const targetLinks = streamLine(root, 'target-links', 3, C.amber, true);
  const targetElbow = targetMarker(root, 'target-elbow', [.8, 0, 0], .055, C.amber);
  const targetTool = targetMarker(root, 'target-tool', [1.6, 0, 0], .075, C.amber);
  targetElbow.rotation.x = Math.PI / 2;
  targetTool.rotation.x = Math.PI / 2;
  const readings = [
    { id: 'joint-1', anchor: arm.shoulder, label: { ko: '관절 1', en: 'Joint 1' }, value: '', side: 'left' },
    { id: 'joint-2', anchor: arm.elbow, label: { ko: '관절 2', en: 'Joint 2' }, value: '', side: 'right' },
  ];
  return {
    root,
    readouts: () => readings,
    // Runtime span is the horizontal budget at aspect <= 1.6; retain full sweep.
    camera: { position: [1.43, 6.08, 10], target: [.38, .3, 0], span: 5.5 },
    legend: {
      ko: '청록: 실제 관절 자세 · 주황 점선: 목표 자세 · 링크 0.8 m + 0.8 m',
      en: 'Teal: actual joints · amber dashed: target pose · links 0.8 m + 0.8 m',
    },
    update(state, params) {
      arm.pose(state.q1, state.q2);
      readings[0].value = `${state.q1.toFixed(2)} rad`;
      readings[1].value = `${state.q2.toFixed(2)} rad`;
      const a = params.target1, b = a + params.target2;
      const e = [.8 * Math.cos(a), .8 * Math.sin(a), 0];
      const t = [e[0] + .8 * Math.cos(b), e[1] + .8 * Math.sin(b), 0];
      writeLine(targetLinks, [[0, 0, 0], e, t]);
      targetElbow.position.fromArray(e);
      targetTool.position.fromArray(t);
    },
  };
}

function impedanceArm() {
  const root = group('impedance-robot');
  const arm = armAssembly(root, mechanics.l1, mechanics.l2, mechanics.l1 + mechanics.l2);
  // Rear-mounted tooling leaves the modeled ball centre exposed in the XY plane.
  arm.forearm.position.z = -.16;
  arm.wrist.position.z = -.22;
  sphere(arm.tool, 'contact-probe', .062, [0, 0, 0], finish('steel', { color: 0x497b76 }));
  // The leading face, not the wall centre, is the model's x = 0.5 m plane.
  // Translucency exposes compliant penetration; visual geometry must not clamp it.
  box(root, 'contact-wall', [.12, 2.12, .42], [.56, -.06, 0], finish('glass', { opacity: .18 }));
  housing(root, 'wall-back-rail', [.065, 2.4, .075], [.66, -.1, -.29], 'aluminium');
  // Keep both uprights behind the XY motion plane, including during penetration.
  housing(root, 'wall-upright-front', [.065, 2.4, .075], [.66, -.1, -.14], 'aluminium');
  housing(root, 'wall-mounting-foot', [.43, .075, .83], [.72, -1.2825, 0], 'dark-metal');
  for (const z of [-.32, .32]) fasteners(root, `wall-anchor-${z}`, 0, [.79, -1.24, z], 1, .022);
  for (const y of [-1.15, 1.03]) {
    housing(root, `wall-cross-bracket-${y}`, [.17, .07, .66], [.63, y, 0], 'dark-metal');
    faceFasteners(root, `wall-bracket-bolts-${y}`, .04, [.63, y, .342], 2, .01);
  }
  line(root, 'wall-contact-plane', [[.5, -1.12, .217], [.5, 1, .217]], C.blue);
  for (let i = 0; i <= 12; i++) {
    const y = -.95 + i * .15;
    line(root, `wall-scale-${i}`, [[.5, y, .222], [.5 + (i % 2 ? .025 : .045), y, .222]], C.metal);
  }
  const target = targetMarker(root, 'target-tool', [.65, mechanics.targetY, 0], .066, C.amber);
  target.rotation.x = Math.PI / 2;
  const reference = streamLine(root, 'target-line', 2, C.amber, true);
  const force = addGroup(root, 'contact-force');
  const forceRod = rod(force, 'reaction-shaft', [0, 0, 0], [-.2, 0, 0], .008, C.teal);
  const forceHead = solid(force, 'reaction-arrow', new T.ConeGeometry(.027, .07, 16), C.teal);
  forceHead.rotation.z = Math.PI / 2;
  const contactAnchor = addGroup(root, 'contact-readout-anchor');
  const readings = [
    { id: 'endpoint-x', anchor: arm.tool, label: { ko: '끝점 x', en: 'Endpoint x' }, value: '', side: 'left' },
    { id: 'contact-force', anchor: contactAnchor, label: { ko: '접촉 힘', en: 'Contact force' }, value: '', side: 'right' },
  ];
  return {
    root,
    readouts: () => readings,
    camera: { position: [2.1, 1.2, 7], target: [.02, -.1, 0], span: 4.8 },
    legend: {
      ko: '청록: 실제 끝점 · 주황: (x 목표, 0.15 m) · 접촉면 x = 0.5 m',
      en: 'Teal: actual endpoint · amber: (target x, 0.15 m) · contact plane x = 0.5 m',
    },
    update(state, params) {
      arm.pose(state.q1, state.q2);
      const k = kinematics([state.q1, state.q2], [state.dq1, state.dq2]);
      target.position.set(params.target, mechanics.targetY, 0);
      writeLine(reference, [[params.target, -.98, 0], [params.target, 1, 0]]);
      const reaction = contactForce(k.x, k.vx, params.wallStiffness);
      readings[0].value = `${k.x.toFixed(3)} m`;
      readings[1].value = `${reaction.toFixed(2)} N`;
      contactAnchor.position.set(.5, k.y, .22);
      force.visible = reaction > 0;
      force.position.set(k.x, k.y - .12, .12);
      const length = Math.min(.4, .07 + reaction * .006);
      setRod(forceRod, [0, 0, 0], [-length, 0, 0]);
      forceHead.position.x = -length - .02;
    },
  };
}

function profileSolid(parent, name, points, width, color, options = {}, bevel = .035, pockets = []) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  for (const pocket of pockets) {
    const hole = new T.Path();
    pocket.forEach(([x, y], i) => i ? hole.lineTo(x, y) : hole.moveTo(x, y));
    hole.closePath(); shape.holes.push(hole);
  }
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 3, steps: 1,
  });
  geometry.translate(0, 0, -width / 2);
  return solid(parent, name, geometry, color, options);
}

// Longitudinal sections make the body narrower at the nose, tail and crown.
function coachwork(parent, name, sections, finishMaterial) {
  const vertices = [], indices = [];
  for (const [x, bottom, top, width] of sections) {
    for (const [y, z] of [[bottom, -width * .88], [bottom, width * .88],
      [top - .055, width], [top, width * .72], [top + .018, 0],
      [top, -width * .72], [top - .055, -width]]) vertices.push(x, y, z);
  }
  const count = 7;
  for (let i = 0; i < sections.length - 1; i++) for (let j = 0; j < count; j++) {
    const a = i * count + j, b = i * count + (j + 1) % count;
    indices.push(a, b + count, b, a, a + count, b + count);
  }
  for (let j = 1; j < count - 1; j++) {
    indices.push(0, j, j + 1);
    const end = (sections.length - 1) * count;
    indices.push(end, end + j + 1, end + j);
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices); geometry.computeVertexNormals();
  return solid(parent, name, geometry, finishMaterial);
}

function glazedPanel(parent, name, points, glass) {
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(points.flat(), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]); geometry.computeVertexNormals();
  return solid(parent, name, geometry, glass);
}

function carAssembly(root) {
  // Both models integrate the rear axle. +x is forward; model +y is world -Z.
  const car = addGroup(root, 'vehicle');
  addGroup(car, 'rear-axle');
  addGroup(car, 'front-axle').position.x = 2.7;
  const paint = finish('paint', { color: 0x718c8a, roughness: .29 });
  const alloy = finish('aluminium'), steel = finish('steel'), dark = finish('dark-metal');
  const rubber = finish('rubber');
  const glass = finish('glass', { color: 0x37505a, opacity: .86, side: T.DoubleSide });
  housing(car, 'underbody', [3.8, .16, 1.02], [1.3, .40, 0], dark);
  coachwork(car, 'car-body', [[-.78, .65, .91, .59], [-.52, .91, 1.02, .77],
    [0, .94, 1.06, .82], [.55, .95, 1.08, .84], [1.6, .95, 1.08, .84],
    [2.2, .95, 1.04, .82], [2.7, .95, 1.01, .8], [3.13, .91, .96, .74], [3.38, .67, .87, .57]], paint);
  profileSolid(car, 'car-cabin', [[-.08, 1.06], [2.27, 1.06], [1.67, 1.49], [.55, 1.51]], 1.08, rubber, {}, .025);
  coachwork(car, 'car-roof', [[.47, 1.48, 1.51, .54], [.67, 1.5, 1.55, .59],
    [1.35, 1.51, 1.55, .59], [1.7, 1.47, 1.51, .55]], paint);
  glazedPanel(car, 'windshield', [[1.72, 1.49, -.54], [1.72, 1.49, .54],
    [2.30, 1.075, .70], [2.30, 1.075, -.70]], glass);
  glazedPanel(car, 'rear-window', [[-.09, 1.075, -.69], [-.09, 1.075, .69],
    [.49, 1.49, .53], [.49, 1.49, -.53]], glass);
  housing(car, 'front-bumper', [.12, .15, 1.18], [3.32, .62, 0], rubber);
  housing(car, 'rear-bumper', [.10, .16, 1.21], [-.72, .64, 0], rubber);
  housing(car, 'front-grille', [.018, .18, .67], [3.39, .79, 0], dark);
  for (const y of [.74, .79, .84]) housing(car, `grille-slat-${y}`, [.023, .012, .62], [3.405, y, 0], alloy);
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const shape = new T.Shape();
    shape.moveTo(-.75, .87); shape.lineTo(-.48, 1.03); shape.lineTo(.55, 1.06);
    shape.lineTo(2.2, 1.02); shape.lineTo(2.95, .98); shape.lineTo(3.34, .83);
    shape.lineTo(3.3, .52); shape.lineTo(3.21, .43);
    shape.absarc(2.7, .43, .51, 0, Math.PI, false);
    shape.lineTo(.51, .43); shape.absarc(0, .43, .51, 0, Math.PI, false);
    shape.lineTo(-.73, .57); shape.closePath();
    const geometry = new T.ExtrudeGeometry(shape, { depth: .045, bevelEnabled: true,
      bevelSize: .009, bevelThickness: .009, bevelSegments: 2, steps: 1, curveSegments: 24 });
    geometry.translate(0, 0, -.0225);
    const quarter = solid(car, `${side}-quarter-panel`, geometry, paint);
    quarter.position.z = sign * .79;
    glazedPanel(car, `${side}-windows`, [[.02, 1.10, sign * .69], [.58, 1.48, sign * .555],
      [1.63, 1.48, sign * .555], [2.16, 1.10, sign * .69]], glass);
    rod(car, `${side}-a-pillar`, [1.71, 1.49, sign * .56], [2.30, 1.07, sign * .71], .032, paint);
    rod(car, `${side}-c-pillar`, [-.09, 1.07, sign * .7], [.48, 1.49, sign * .55], .034, paint);
    rod(car, `${side}-window-pillar`, [1.1, 1.08, sign * .7], [1.1, 1.51, sign * .565], .027, rubber);
    housing(car, `${side}-rocker`, [1.65, .09, .07], [1.35, .46, sign * .79], dark);
    line(car, `${side}-door-seam`, [[1.12, 1.07, sign * .835], [1.14, .61, sign * .823],
      [1.22, .53, sign * .82], [2.08, .53, sign * .82], [2.16, 1.04, sign * .82]], 0x3f4b4c);
    for (const x of [.74, 1.87]) housing(car, `door-handle-${side}-${x}`, [.18, .027, .024], [x, .99, sign * .844], alloy);
    rod(car, `${side}-mirror-stalk`, [2.12, 1.1, sign * .68], [2.05, 1.13, sign * .85], .019, rubber);
    const mirror = sphere(car, `${side}-mirror`, 1, [2.04, 1.14, sign * .86], paint);
    mirror.scale.set(.115, .065, .075);
    housing(car, `${side}-headlamp`, [.07, .105, .29], [3.32, .86, sign * .43], finish('glass', { color: 0xe7ece5, opacity: .92 }));
    housing(car, `${side}-taillamp`, [.045, .12, .27], [-.747, .84, sign * .46], finish('glass', { color: 0x91392b, opacity: 1 }));
  }
  const frontWheels = [];
  for (const [axle, x] of [['rear', 0], ['front', 2.7]]) {
    rod(car, `${axle}-shaft`, [x, .43, -.76], [x, .43, .76], .04, steel);
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const archPoints = Array.from({ length: 25 }, (_, i) => {
        const a = Math.PI * i / 24;
        return [x + .525 * Math.cos(a), .43 + .525 * Math.sin(a), sign * .823];
      });
      cable(car, `${axle}-${side}-wheel-arch`, archPoints, .017, 0x353c3c);
      const wheel = addGroup(car, `${axle}-${side}-wheel`);
      wheel.position.set(x, .43, sign * .76);
      faceTurned(wheel, `${axle}-${side}-tire`, [[.285, -.116], [.36, -.126], [.405, -.105],
        [.43, -.065], [.43, .065], [.405, .105], [.36, .126], [.285, .116], [.285, -.116]], [0, 0, 0], rubber);
      faceFlange(wheel, `${axle}-${side}-rim`, .294, .035, [0, 0, sign * .112], alloy, .245);
      faceDisc(wheel, `${axle}-${side}-brake-disc`, .235, .014, [0, 0, sign * .078], steel);
      housing(wheel, `${axle}-${side}-caliper`, [.09, .18, .045], [.18, 0, sign * .10], dark);
      faceDisc(wheel, `${axle}-${side}-hub`, .075, .045, [0, 0, sign * .135], alloy);
      for (let i = 0; i < 5; i++) {
        const angle = i * TAU / 5;
        const spoke = housing(wheel, `${axle}-${side}-spoke-${i}`, [.2, .038, .03],
          [.16 * Math.cos(angle), .16 * Math.sin(angle), sign * .133], alloy);
        spoke.rotation.z = angle;
      }
      faceFasteners(wheel, `${axle}-${side}-lug-bolts`, .052, [0, 0, sign * .161], 5, .011);
      if (axle === 'front') frontWheels.push(wheel);
    }
  }
  const footprint = line(car, 'vehicle-footprint', [
    [-.8, .018, .9], [3.4, .018, .9], [3.4, .018, -.9], [-.8, .018, -.9], [-.8, .018, .9],
  ], C.teal);
  footprint.material.transparent = true;
  footprint.material.opacity = .38;
  return {
    car,
    pose(state) {
      car.position.set(state.x, 0, -state.y);
      car.rotation.y = state.psi;
      for (const wheel of frontWheels) wheel.rotation.y = state.steering;
    },
  };
}

const groundPoint = (p, height = .035) => [p.x, height, -p.y];

function roadLine(parent, name, points, color, dashed = false, capacity = 0) {
  const result = capacity ? streamLine(parent, name, capacity, color, dashed) : line(parent, name, points, color, dashed);
  if (dashed) {
    result.material.dashSize = .45;
    result.material.gapSize = .28;
  }
  return result;
}

function parkingLot() {
  const root = group('parking');
  const stage = floor(root, 39, 20);
  stage.position.x = 3.5;
  stage.userData.environment = true;
  const pavement = solid(root, 'parking-pavement', new T.PlaneGeometry(39, 20),
    finish('paint', { color: 0xb1b7b3, roughness: .97, metalness: 0 }));
  pavement.rotation.x = -Math.PI / 2; pavement.position.set(3.5, .004, 0);
  pavement.castShadow = false;
  // Only the real perimeter is raised. Practice bays are paint, not obstacles.
  for (const z of [-10.13, 10.13]) box(root, `lot-curb-z-${z}`, [39.52, .22, .26], [3.5, .11, z], C.light);
  for (const x of [-16.13, 23.13]) box(root, `lot-curb-x-${x}`, [.26, .22, 20], [x, .11, 0], C.light);
  roadLine(root, 'lot-boundary', [[-16, .012, -10], [23, .012, -10], [23, .012, 10], [-16, .012, 10], [-16, .012, -10]], C.metal);
  for (const y of [-7, -3.5, 0, 3.5, 7]) {
    roadLine(root, `practice-bay-${y}`, [[-5, .012, -y - 1.5], [-12, .012, -y - 1.5], [-12, .012, -y + 1.5], [-5, .012, -y + 1.5]], C.metal);
  }
  const car = carAssembly(root);
  const bay = addGroup(root, 'parking-bay');
  roadLine(bay, 'goal-bay-paint', [[-1.2, 0, -1.5], [4.8, 0, -1.5], [4.8, 0, 1.5], [-1.2, 0, 1.5], [-1.2, 0, -1.5]], C.amber, true);
  const goal = targetMarker(root, 'goal-pose', [-10, .045, -3], .34, C.amber);
  roadLine(goal, 'goal-heading', [[0, 0, 0], [2.7, 0, 0], [2.2, 0, -.25], [2.7, 0, 0], [2.2, 0, .25]], C.amber);
  const reference = roadLine(root, 'reference-path', [], C.amber, true, 301);
  const alignment = roadLine(root, 'forward-alignment', [[12, .035, 0], [15, .035, 0]], C.amber, true);
  const history = streamLine(root, 'actual-path', 500, C.teal);
  const lookahead = targetMarker(root, 'lookahead-target', [15, .06, 0], .33, C.amber);
  const readings = [
    { id: 'distance-to-goal', anchor: goal, label: { ko: '남은 거리', en: 'Distance to goal' }, value: '', side: 'left' },
    { id: 'steering', anchor: car.car.getObjectByName('front-right-wheel'), label: { ko: '조향각', en: 'Steering' }, value: '', side: 'right' },
  ];
  return {
    root,
    readouts: () => readings,
    camera: { position: [5, 34, 48], target: [3.5, 0, 0], span: 49 },
    legend: {
      ko: '청록: 차량·실제 경로 · 주황: 계획 경로·목표 주차 자세 · 후륜 축 기준',
      en: 'Teal: car / actual path · amber: plan / parking goal · rear-axle coordinates',
    },
    update(state, params) {
      car.pose(state);
      readings[0].value = `${Math.hypot(state.x + 10, state.y - params.target).toFixed(2)} m`;
      readings[1].value = `${state.steering.toFixed(2)} rad`;
      bay.position.set(-10, .025, -params.target);
      goal.position.set(-10, .045, -params.target);
      lookahead.position.fromArray(groundPoint(state.targetPoint, .06));
      writeLine(reference, state.path.map(p => groundPoint(p)));
      writeLine(history, state.history.map(p => groundPoint(p, .05)));
      alignment.visible = state.phase === 'forward';
    },
  };
}

function circularTrack() {
  const root = group('path-tracking');
  floor(root, 39, 39).userData.environment = true;
  const track = solid(root, 'track-surface', new T.RingGeometry(11.6, 16.4, 160),
    finish('paint', { color: 0xb1b7b3, roughness: .97, metalness: 0 }));
  track.castShadow = false;
  track.rotation.x = -Math.PI / 2;
  track.position.y = .009;
  const circle = (radius, height) => Array.from({ length: 193 }, (_, i) => {
    const a = i * TAU / 192;
    return [radius * Math.cos(a), height, -radius * Math.sin(a)];
  });
  for (const radius of [11.6, 16.4]) roadLine(root, `track-edge-${radius}`, circle(radius, .015), C.metal);
  for (let i = 0; i < 48; i++) {
    const a = i * TAU / 48;
    roadLine(root, `track-joint-${i}`, [[11.7 * Math.cos(a), .013, -11.7 * Math.sin(a)],
      [16.3 * Math.cos(a), .013, -16.3 * Math.sin(a)]], 0xd2dbe2);
  }
  roadLine(root, 'reference-path', circle(14, .035), C.amber, true);
  for (let i = 0; i < 4; i++) {
    const a = i * TAU / 4 + Math.PI / 4;
    const arrow = addGroup(root, `track-direction-${i}`);
    arrow.position.set(15.35 * Math.cos(a), .02, -15.35 * Math.sin(a));
    arrow.rotation.y = a + Math.PI / 2;
    roadLine(arrow, `track-arrow-${i}`, [[-.6, 0, 0], [.6, 0, 0], [.2, 0, -.25], [.6, 0, 0], [.2, 0, .25]], C.white);
  }
  targetMarker(root, 'track-centre', [0, .015, 0], .35, C.metal);
  const car = carAssembly(root);
  const history = streamLine(root, 'actual-path', 500, C.teal);
  const lookahead = targetMarker(root, 'lookahead-target', [14, .06, -4], .38, C.amber);
  const chord = roadLine(root, 'lookahead-chord', [], C.amber, true, 2);
  const readings = [
    { id: 'cross-track-error', anchor: car.car.getObjectByName('rear-axle'), label: { ko: '횡방향 오차', en: 'Cross-track error' }, value: '', side: 'left' },
    { id: 'steering', anchor: car.car.getObjectByName('front-right-wheel'), label: { ko: '조향각', en: 'Steering' }, value: '', side: 'right' },
  ];
  return {
    root,
    readouts: () => readings,
    camera: { position: [21, 30, 40], target: [0, 0, 1.7], span: 43.5 },
    legend: {
      ko: '청록: 차량·실제 경로 · 주황: 반지름 14 m 기준 원·전방 주시점 · 축거 2.7 m',
      en: 'Teal: car / actual path · amber: 14 m reference / lookahead · wheelbase 2.7 m',
    },
    update(state) {
      car.pose(state);
      readings[0].value = `${(Math.hypot(state.x, state.y) - 14).toFixed(2)} m`;
      readings[1].value = `${state.steering.toFixed(2)} rad`;
      lookahead.position.fromArray(groundPoint(state.target, .06));
      writeLine(history, state.history.map(p => groundPoint(p, .05)));
      writeLine(chord, [groundPoint(state, .055), groundPoint(state.target, .055)]);
    },
  };
}

export function createRobotScene(id) {
  if (id === 'robot-arm') return servoArm();
  if (id === 'impedance-robot') return impedanceArm();
  if (id === 'parking') return parkingLot();
  if (id === 'path-tracking') return circularTrack();
  return null;
}
