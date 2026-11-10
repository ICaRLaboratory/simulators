import * as T from '../vendor/three.js';
import { mechanics, kinematics, contactForce } from '../models/impedance-robot.js';
import {
  C, group, box, cylinder, sphere, rod, setRod, line, updateLine, floor, targetMarker, material,
} from './primitives.js';

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

function capsulePlate(parent, name, length, radius, depth, color, options = {}) {
  const shape = new T.Shape();
  shape.moveTo(0, -radius);
  shape.lineTo(length, -radius);
  shape.absarc(length, 0, radius, -Math.PI / 2, Math.PI / 2, false);
  shape.lineTo(0, radius);
  shape.absarc(0, 0, radius, Math.PI / 2, Math.PI * 1.5, false);
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, {
    depth, bevelEnabled: true, bevelSize: .008, bevelThickness: .008, bevelSegments: 2, steps: 1, curveSegments: 12,
  });
  geometry.translate(0, 0, -depth / 2);
  return solid(parent, name, geometry, color, options);
}

function faceDisc(parent, name, radius, depth, position, color) {
  const mesh = cylinder(parent, name, radius, depth, position, color);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}

function joint(parent, name, radius) {
  faceDisc(parent, `${name}-housing`, radius, .19, [0, 0, -.025], C.ink);
  faceDisc(parent, `${name}-race`, radius * .84, .025, [0, 0, .08], C.metal);
  faceDisc(parent, `${name}-servo`, radius * .66, .022, [0, 0, .099], C.teal);
  faceDisc(parent, `${name}-cap`, radius * .28, .025, [0, 0, .113], C.light);
  for (let i = 0; i < 4; i++) {
    const angle = i * TAU / 4 + Math.PI / 4;
    faceDisc(parent, `${name}-bolt-${i}`, radius * .075, .014,
      [radius * .76 * Math.cos(angle), radius * .76 * Math.sin(angle), .103], C.ink);
  }
}

function machinedLink(parent, name, length, radius) {
  capsulePlate(parent, name, length, radius, .095, C.ink);
  const inset = capsulePlate(parent, `${name}-face`, length - .18, radius * .69, .019, C.light);
  inset.position.set(.09, 0, .06);
  box(parent, `${name}-inlay`, [length - .2, .017, .011], [length / 2, .022, .079], C.teal);
  for (const [i, x] of [.13, length - .13].entries()) {
    faceDisc(parent, `${name}-screw-${i}`, .011, .012, [x, -.021, .081], C.metal);
  }
  // A routed cable sits behind the link, never changes its kinematic length.
  const cable = new T.CatmullRomCurve3([
    new T.Vector3(.06, -.035, -.071), new T.Vector3(length * .35, -.085, -.083),
    new T.Vector3(length * .72, -.085, -.083), new T.Vector3(length - .04, -.035, -.071),
  ]);
  solid(parent, `${name}-cable`, new T.TubeGeometry(cable, 16, .012, 6, false), C.ink);
}

function armAssembly(root, l1, l2, reach) {
  const floorY = -reach - .19;
  floor(root, reach * 2 + .9, 2.6, floorY);
  const base = addGroup(root, 'arm-base');
  box(base, 'mounting-plinth', [.76, .11, .68], [0, floorY + .055, -.36], C.ink);
  box(base, 'plinth-insert', [.65, .035, .57], [0, floorY + .122, -.36], C.light);
  box(base, 'fixed-pedestal', [.16, -floorY - .11, .19], [0, (floorY + .11) / 2, -.36], C.metal);
  box(base, 'pedestal-channel', [.075, -floorY - .25, .013], [0, (floorY + .11) / 2, -.257], C.ink);
  for (const x of [-.27, .27]) for (const z of [-.58, -.14]) {
    cylinder(base, `mount-bolt-${x}-${z}`, .027, .02, [x, floorY + .151, z], C.metal);
  }
  faceDisc(base, 'fixed-shoulder-motor', .16, .28, [0, 0, -.23], C.ink);
  faceDisc(base, 'motor-rear-cover', .134, .028, [0, 0, -.386], C.metal);
  const shoulder = addGroup(root, 'shoulder');
  machinedLink(shoulder, 'upper-link', l1, .082);
  joint(shoulder, 'shoulder', .124);
  const elbow = addGroup(shoulder, 'elbow');
  elbow.position.x = l1;
  machinedLink(elbow, 'forearm-link', l2, .067);
  joint(elbow, 'elbow', .096);
  const tool = addGroup(elbow, 'tool-center');
  tool.position.x = l2;
  joint(tool, 'wrist', .064);
  return {
    shoulder, elbow, tool,
    pose(q1, q2) {
      shoulder.rotation.z = q1;
      elbow.rotation.z = q2;
    },
  };
}

function servoArm() {
  const root = group('robot-arm');
  const arm = armAssembly(root, .8, .8, 1.6);
  box(arm.tool, 'gripper-palm', [.09, .16, .105], [.065, 0, 0], C.metal);
  for (const [name, sign] of [['left', 1], ['right', -1]]) {
    box(arm.tool, `gripper-${name}`, [.15, .028, .07], [.17, sign * .075, 0], C.ink);
    box(arm.tool, `gripper-${name}-pad`, [.028, .042, .071], [.23, sign * .054, 0], C.teal);
  }
  const targetLinks = line(root, 'target-links', [[0, 0, 0], [.8, 0, 0], [1.6, 0, 0]], C.amber, true);
  const targetElbow = targetMarker(root, 'target-elbow', [.8, 0, 0], .055, C.amber);
  const targetTool = targetMarker(root, 'target-tool', [1.6, 0, 0], .075, C.amber);
  targetElbow.rotation.x = Math.PI / 2;
  targetTool.rotation.x = Math.PI / 2;
  return {
    root,
    // Runtime span is the horizontal budget at aspect <= 1.6; retain full sweep.
    camera: { position: [3.3, 1.94, 6.6], target: [0, -.33, 0], span: 7.1 },
    legend: {
      ko: '청록: 실제 관절 자세 · 주황 점선: 목표 자세 · 링크 0.8 m + 0.8 m',
      en: 'Teal: actual joints · amber dashed: target pose · links 0.8 m + 0.8 m',
    },
    update(state, params) {
      arm.pose(state.q1, state.q2);
      const a = params.target1, b = a + params.target2;
      const e = [.8 * Math.cos(a), .8 * Math.sin(a), 0];
      const t = [e[0] + .8 * Math.cos(b), e[1] + .8 * Math.sin(b), 0];
      updateLine(targetLinks, [[0, 0, 0], e, t]);
      targetElbow.position.fromArray(e);
      targetTool.position.fromArray(t);
    },
  };
}

function impedanceArm() {
  const root = group('impedance-robot');
  const arm = armAssembly(root, mechanics.l1, mechanics.l2, mechanics.l1 + mechanics.l2);
  sphere(arm.tool, 'contact-probe', .062, [0, 0, 0], C.teal, { roughness: .24, metalness: .52 });
  // The leading face, not the wall centre, is the model's x = 0.5 m plane.
  // Translucency exposes compliant penetration; visual geometry must not clamp it.
  box(root, 'contact-wall', [.12, 2.12, .42], [.56, -.06, 0], C.blue,
    { transparent: true, opacity: .21, depthWrite: false, roughness: .65 });
  box(root, 'wall-back-rail', [.055, 2.18, .065], [.59, -.06, -.25], C.metal);
  for (const y of [-1.15, 1.03]) {
    box(root, `wall-cross-bracket-${y}`, [.2, .055, .58], [.59, y, -.015], C.ink);
    faceDisc(root, `wall-bracket-bolt-${y}`, .018, .018, [.59, y, .286], C.light);
  }
  line(root, 'wall-contact-plane', [[.5, -1.12, .217], [.5, 1, .217]], C.blue);
  for (let i = 0; i <= 12; i++) {
    const y = -.95 + i * .15;
    line(root, `wall-scale-${i}`, [[.5, y, .222], [.5 + (i % 2 ? .025 : .045), y, .222]], C.metal);
  }
  const target = targetMarker(root, 'target-tool', [.65, mechanics.targetY, 0], .066, C.amber);
  target.rotation.x = Math.PI / 2;
  const reference = line(root, 'target-line', [[.65, -.98, 0], [.65, 1, 0]], C.amber, true);
  const force = addGroup(root, 'contact-force');
  const forceRod = rod(force, 'reaction-shaft', [0, 0, 0], [-.2, 0, 0], .008, C.teal);
  const forceHead = solid(force, 'reaction-arrow', new T.ConeGeometry(.027, .07, 16), C.teal);
  forceHead.rotation.z = Math.PI / 2;
  return {
    root,
    camera: { position: [2.35, 1.3, 5.7], target: [.05, -.33, 0], span: 4.85 },
    legend: {
      ko: '청록: 실제 끝점 · 주황: (x 목표, 0.15 m) · 접촉면 x = 0.5 m',
      en: 'Teal: actual endpoint · amber: (target x, 0.15 m) · contact plane x = 0.5 m',
    },
    update(state, params) {
      arm.pose(state.q1, state.q2);
      const k = kinematics([state.q1, state.q2], [state.dq1, state.dq2]);
      target.position.set(params.target, mechanics.targetY, 0);
      updateLine(reference, [[params.target, -.98, 0], [params.target, 1, 0]]);
      const reaction = contactForce(k.x, k.vx, params.wallStiffness);
      force.visible = reaction > 0;
      force.position.set(k.x, k.y - .12, .12);
      const length = Math.min(.4, .07 + reaction * .006);
      setRod(forceRod, [0, 0, 0], [-length, 0, 0]);
      forceHead.position.x = -length - .02;
    },
  };
}

function profileSolid(parent, name, points, width, color, options = {}, bevel = .035) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, {
    depth: width, bevelEnabled: bevel > 0, bevelSize: bevel, bevelThickness: bevel,
    bevelSegments: 3, steps: 1,
  });
  geometry.translate(0, 0, -width / 2);
  return solid(parent, name, geometry, color, options);
}

function carAssembly(root) {
  // x/y in both bicycle models is the rear axle, not the body centre.
  // Local forward is +X; model +y maps to world -Z. A positive yaw is +Y rotation.
  const car = addGroup(root, 'vehicle');
  addGroup(car, 'rear-axle');
  addGroup(car, 'front-axle').position.x = 2.7;
  box(car, 'underbody', [3.9, .2, 1.5], [1.3, .49, 0], C.ink);
  profileSolid(car, 'car-body', [
    [-.765, .55], [3.365, .55], [3.365, .8], [2.91, .99],
    [-.36, .99], [-.68, .86],
  ], 1.61, C.teal, { roughness: .3, metalness: .48 });
  const glass = { roughness: .17, metalness: .55 };
  profileSolid(car, 'car-cabin', [[.1, 1.02], [2.3, 1.02], [1.73, 1.55], [.57, 1.55]], 1.29, C.ink, glass);
  profileSolid(car, 'windshield', [[1.76, 1.55], [2.31, 1.03], [2.32, 1.08], [1.81, 1.56]], 1.24, C.blue, glass, .012);
  profileSolid(car, 'rear-window', [[.1, 1.03], [.54, 1.55], [.59, 1.56], [.16, 1.04]], 1.24, C.blue, glass, .012);
  box(car, 'car-roof', [1.18, .065, 1.34], [1.15, 1.58, 0], C.white, { roughness: .35, metalness: .36 });
  box(car, 'front-bumper', [.1, .16, 1.36], [3.34, .59, 0], C.ink);
  box(car, 'rear-bumper', [.09, .16, 1.37], [-.74, .59, 0], C.ink);
  box(car, 'front-grille', [.016, .13, .59], [3.405, .77, 0], C.ink);
  for (const [side, sign] of [['left', -1], ['right', 1]]) {
    const window = profileSolid(car, `${side}-windows`, [[.28, 1.08], [2.1, 1.08], [1.67, 1.48], [.62, 1.48]], .012, C.blue, glass, .005);
    window.position.z = sign * .662;
    box(car, `${side}-window-pillar`, [.085, .46, .02], [1.14, 1.28, sign * .679], C.ink);
    box(car, `${side}-rocker`, [3.28, .1, .045], [1.28, .59, sign * .838], C.ink);
    for (const x of [.63, 1.77]) box(car, `door-handle-${side}-${x}`, [.2, .035, .025], [x, .935, sign * .844], C.light);
    box(car, `${side}-headlamp`, [.08, .13, .31], [3.37, .87, sign * .51], C.white,
      { emissive: C.white, emissiveIntensity: .18 });
    box(car, `${side}-taillamp`, [.065, .13, .29], [-.733, .79, sign * .55], C.red);
  }
  const frontWheels = [];
  for (const [axle, x] of [['rear', 0], ['front', 2.7]]) {
    rod(car, `${axle}-shaft`, [x, .43, -.86], [x, .43, .86], .045, C.metal);
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const wheel = addGroup(car, `${axle}-${side}-wheel`);
      wheel.position.set(x, .43, sign * .86);
      const tire = cylinder(wheel, `${axle}-${side}-tire`, .43, .28, [0, 0, 0], C.ink,
        { roughness: .92, metalness: .04 });
      tire.rotation.x = Math.PI / 2;
      faceDisc(wheel, `${axle}-${side}-rim`, .285, .028, [0, 0, sign * .153], C.metal);
      faceDisc(wheel, `${axle}-${side}-hub`, .11, .035, [0, 0, sign * .176], C.light);
      for (let i = 0; i < 5; i++) {
        const angle = i * TAU / 5;
        const spoke = box(wheel, `${axle}-${side}-spoke-${i}`, [.17, .052, .022],
          [.17 * Math.cos(angle), .17 * Math.sin(angle), sign * .171], C.light);
        spoke.rotation.z = angle;
      }
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

function roadLine(parent, name, points, color, dashed = false) {
  const result = line(parent, name, points, color, dashed);
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
  const reference = roadLine(root, 'reference-path', [], C.amber, true);
  const alignment = roadLine(root, 'forward-alignment', [[12, .035, 0], [15, .035, 0]], C.amber, true);
  const history = roadLine(root, 'actual-path', [], C.teal);
  const lookahead = targetMarker(root, 'lookahead-target', [15, .06, 0], .33, C.amber);
  return {
    root,
    camera: { position: [15, 35, 36], target: [3.5, 0, 0], span: 44 },
    legend: {
      ko: '청록: 차량·실제 경로 · 주황: 계획 경로·목표 주차 자세 · 후륜 축 기준',
      en: 'Teal: car / actual path · amber: plan / parking goal · rear-axle coordinates',
    },
    update(state, params) {
      car.pose(state);
      bay.position.set(-10, .025, -params.target);
      goal.position.set(-10, .045, -params.target);
      lookahead.position.fromArray(groundPoint(state.targetPoint, .06));
      updateLine(reference, state.path.map(p => groundPoint(p)));
      updateLine(history, state.history.map(p => groundPoint(p, .05)));
      alignment.visible = state.phase === 'forward';
    },
  };
}

function circularTrack() {
  const root = group('path-tracking');
  floor(root, 39, 39);
  const track = solid(root, 'track-surface', new T.RingGeometry(11.6, 16.4, 160), C.light,
    { roughness: .95, metalness: 0 });
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
  const history = roadLine(root, 'actual-path', [], C.teal);
  const lookahead = targetMarker(root, 'lookahead-target', [14, .06, -4], .38, C.amber);
  const chord = roadLine(root, 'lookahead-chord', [], C.amber, true);
  return {
    root,
    camera: { position: [24, 37, 32], target: [0, 0, 0], span: 43 },
    legend: {
      ko: '청록: 차량·실제 경로 · 주황: 반지름 14 m 기준 원·전방 주시점 · 축거 2.7 m',
      en: 'Teal: car / actual path · amber: 14 m reference / lookahead · wheelbase 2.7 m',
    },
    update(state) {
      car.pose(state);
      lookahead.position.fromArray(groundPoint(state.target, .06));
      updateLine(history, state.history.map(p => groundPoint(p, .05)));
      updateLine(chord, [groundPoint(state, .055), groundPoint(state.target, .055)]);
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
