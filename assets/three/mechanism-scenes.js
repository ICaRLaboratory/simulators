import * as T from '../vendor/three.js';
import { C, group, box, cylinder, sphere, rod, setRod, line, updateLine, floor, targetMarker } from './primitives.js';

// Geometry is in metres, Y-up. Decorative housings never feed the models.
function child(parent, name, position = [0, 0, 0]) {
  const node = group(name);
  node.position.fromArray(position);
  parent.add(node);
  return node;
}
function axle(parent, name, radius, length, position, color = C.metal) {
  const mesh = cylinder(parent, name, radius, length, position, color);
  mesh.rotation.x = Math.PI / 2;
  return mesh;
}
function wheel(parent, name, position, radius, width) {
  const assembly = child(parent, name, position);
  axle(assembly, `${name}-tire`, radius, width, [0, 0, 0], C.ink);
  for (const side of [-1, 1]) {
    axle(assembly, `${name}-rim-${side}`, radius * .66, .018, [0, 0, side * (width / 2 + .005)], C.light);
    axle(assembly, `${name}-hub-${side}`, radius * .2, .025, [0, 0, side * (width / 2 + .017)], C.metal);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5, z = side * (width / 2 + .018);
      rod(assembly, `${name}-spoke-${side}-${i}`, [0, 0, z], [radius * .58 * Math.cos(a), radius * .58 * Math.sin(a), z], radius * .045, C.ink);
    }
  }
  return assembly;
}
function cruiseScene() {
  const root = group('cruise-control');
  floor(root, 10.6, 5.1);
  box(root, 'road', [10.4, .05, 2.8], [0, .025, 0], C.light, { roughness: .95 });
  for (const z of [-1.3, 1.3]) box(root, `road-edge-${z}`, [10.3, .005, .035], [0, .053, z], C.white);
  const marks = Array.from({ length: 8 }, (_, i) => box(root, `road-mark-${i}`, [1.1, .006, .045], [-7.8 + i * 2.6, .056, -.98], C.metal));
  const car = child(root, 'car', [0, .05, 0]);
  box(car, 'chassis', [3.85, .4, 1.52], [0, .64, 0], C.teal);
  box(car, 'body', [3.7, .25, 1.5], [0, .9, 0], C.white);
  box(car, 'hood', [1.03, .12, 1.47], [1.22, 1.02, 0], C.white);
  box(car, 'cabin', [1.68, .48, 1.3], [-.26, 1.25, 0], C.ink);
  box(car, 'roof', [1.68, .08, 1.36], [-.26, 1.52, 0], C.white);
  const windshield = box(car, 'windshield', [.035, .49, 1.2], [.65, 1.26, 0], C.blue, { roughness: .2, metalness: .55 });
  windshield.rotation.z = .32;
  const rearGlass = box(car, 'rear-window', [.035, .45, 1.2], [-1.16, 1.25, 0], C.blue, { roughness: .2 });
  rearGlass.rotation.z = -.25;
  for (const z of [-1, 1]) {
    box(car, `side-window-${z}`, [1.48, .32, .025], [-.26, 1.29, z * .661], C.blue, { roughness: .2, metalness: .45 });
    box(car, `window-pillar-${z}`, [.065, .42, .035], [-.28, 1.28, z * .68], C.ink);
    box(car, `door-handle-${z}`, [.22, .035, .03], [-.5, .93, z * .77], C.metal);
    box(car, `side-trim-${z}`, [2.7, .045, .025], [0, .7, z * .77], C.light);
    box(car, `mirror-${z}`, [.2, .1, .18], [.55, 1.13, z * .81], C.ink);
    box(car, `headlamp-${z}`, [.035, .12, .35], [1.86, .9, z * .5], C.white);
    box(car, `tail-lamp-${z}`, [.035, .1, .3], [-1.86, .9, z * .52], C.red);
  }
  box(car, 'front-bumper', [.12, .16, 1.43], [1.91, .57, 0], C.ink);
  box(car, 'rear-bumper', [.12, .16, 1.43], [-1.91, .57, 0], C.ink);
  const wheels = [];
  for (const [end, x] of [['front', 1.22], ['rear', -1.22]]) {
    for (const [side, z] of [['left', .79], ['right', -.79]]) wheels.push(wheel(car, `wheel-${end}-${side}`, [x, .34, z], .34, .22));
  }
  // These are speed scales, not fictitious reference-car displacement.
  const gauges = ['actual-speed', 'target-speed'].map((name, i) => {
    box(root, `${name}-track`, [3.6, .035, .13], [0, .04, 1.78 + i * .31], C.light);
    const gauge = child(root, name, [-1.8, .062, 1.78 + i * .31]);
    box(gauge, `${name}-bar`, [3.6, .035, .105], [1.8, 0, 0], i ? C.amber : C.teal);
    return gauge;
  });
  return {
    root,
    camera: { position: [6.8, 4.3, 7.6], target: [0, .45, 0], span: 8.6 },
    legend: {
      ko: '청록 막대: 실제 속도 · 주황 막대: 목표 속도. 도로와 바퀴는 적분 이동거리에 연동됩니다.',
      en: 'Teal bar: actual speed · amber bar: target speed. Road and wheels follow integrated distance.'
    },
    update(state, params, extras = {}) {
      const distance = Number.isFinite(extras.distance) ? extras.distance : 0;
      const phase = ((distance % 2.6) + 2.6) % 2.6;
      for (let i = 0; i < marks.length; i++) {
        marks[i].position.x = -7.8 + i * 2.6 - phase;
        marks[i].visible = Math.abs(marks[i].position.x) < 4.6;
      }
      for (const tire of wheels) tire.rotation.z = -distance / .34;
      gauges[0].scale.x = state.y / 40;
      gauges[1].scale.x = params.target / 40;
    }
  };
}

function motorScene() {
  const root = group('dc-motor');
  floor(root, 3.4, 3.3);
  box(root, 'motor-mount', [1.62, .12, 1.85], [0, .1, -.35], C.metal);
  for (const x of [-.55, .55]) {
    box(root, `motor-foot-${x}`, [.18, .35, 1.02], [x, .3, -.45], C.ink);
    for (const z of [-1.1, .38]) cylinder(root, `mount-bolt-${x}-${z}`, .045, .025, [x, .173, z], C.ink);
  }
  axle(root, 'motor-housing', .49, 1.12, [0, .95, -.4], C.metal);
  axle(root, 'motor-rear-cap', .5, .12, [0, .95, -.99], C.ink);
  axle(root, 'motor-front-cap', .51, .1, [0, .95, .2], C.light);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const fin = box(root, `cooling-fin-${i}`, [.055, .09, .87], [.49 * Math.cos(a), .95 + .49 * Math.sin(a), -.4], C.ink);
    fin.rotation.z = a - Math.PI / 2;
  }
  box(root, 'terminal-box', [.42, .17, .36], [0, 1.51, -.4], C.light);
  rod(root, 'motor-cable', [.22, 1.5, -.4], [.54, 1.36, -.78], .025, C.ink);
  axle(root, 'motor-bearing', .16, .14, [0, .95, .32], C.ink);
  rod(root, 'motor-shaft', [0, .95, .2], [0, .95, .84], .075, C.metal);
  // The dial is the front XY face; +theta is counterclockwise from +X.
  const rotor = child(root, 'rotor', [0, .95, .64]);
  axle(rotor, 'rotor-disc', .72, .08, [0, 0, 0], C.light);
  axle(rotor, 'rotor-inset', .55, .012, [0, 0, .048], C.metal);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    rod(rotor, `rotor-spoke-${i}`, [.15 * Math.cos(a), .15 * Math.sin(a), .061], [.47 * Math.cos(a), .47 * Math.sin(a), .061], .045, C.ink);
    axle(rotor, `rotor-bolt-${i}`, .028, .015, [.59 * Math.cos(a), .59 * Math.sin(a), .05], C.ink);
  }
  rod(rotor, 'actual-pointer', [0, 0, .095], [.63, 0, .095], .021, C.teal);
  sphere(rotor, 'actual-pointer-tip', .033, [.63, 0, .095], C.teal);
  axle(rotor, 'shaft-cap', .1, .035, [0, 0, .1], C.teal);
  const dial = child(root, 'dial', [0, .95, .65]);
  const ring = new T.Mesh(new T.TorusGeometry(.85, .018, 8, 64), new T.MeshStandardMaterial({ color: C.ink, roughness: .45 }));
  ring.name = 'dial-rim'; dial.add(ring);
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, r = i % 6 === 0 ? .755 : .79;
    rod(dial, `dial-tick-${i}`, [r * Math.cos(a), r * Math.sin(a), 0], [.84 * Math.cos(a), .84 * Math.sin(a), 0], .006, C.metal);
  }
  const reference = child(root, 'motor-target', [0, .95, .79]);
  line(reference, 'target-angle-ray', [[0, 0, 0], [.79, 0, 0]], C.amber, true);
  sphere(reference, 'target-pointer-tip', .035, [.79, 0, 0], C.amber);
  return {
    root,
    camera: { position: [3.2, 2.5, 5], target: [0, .85, -.1], span: 3.4 },
    legend: {
      ko: '청록 지침: 실제 축 각도 · 주황 점선: 목표 각도. 0 rad은 오른쪽, 양의 각도는 반시계 방향입니다.',
      en: 'Teal pointer: actual shaft angle · amber dashed pointer: target angle. Zero points right; positive is counterclockwise.'
    },
    update(state, params) {
      rotor.rotation.z = state.y;
      reference.rotation.z = params.target;
    }
  };
}

function beamScene() {
  const root = group('ball-and-beam');
  floor(root, 2.8, 1.55);
  box(root, 'beam-base', [.7, .075, .73], [0, .07, 0], C.metal);
  for (const x of [-.27, .27]) {
    for (const z of [-.28, .28]) cylinder(root, `beam-base-bolt-${x}-${z}`, .022, .02, [x, .117, z], C.ink);
  }
  for (const [name, z] of [['left', -.19], ['right', .19]]) {
    box(root, `mount-${name}`, [.16, .44, .09], [0, .34, z], C.light);
    rod(root, `mount-brace-${name}`, [-.25, .12, z], [0, .53, z], .035, C.metal);
  }
  axle(root, 'beam-pivot', .065, .54, [0, .62, 0], C.metal);
  axle(root, 'pivot-bearing', .09, .055, [0, .62, .25], C.ink);
  axle(root, 'pivot-cap', .038, .06, [0, .62, .255], C.teal);
  box(root, 'servo-housing', [.24, .23, .23], [0, .55, -.36], C.ink);
  for (let i = 0; i < 4; i++) box(root, `servo-fin-${i}`, [.265, .016, .23], [0, .47 + i * .048, -.36], C.metal);
  const beam = child(root, 'beam', [0, .62, 0]);
  box(beam, 'beam-deck', [2.08, .048, .23], [0, -.024, 0], C.ink);
  box(beam, 'beam-running-surface', [2.02, .006, .15], [0, -.003, 0], C.light);
  rod(beam, 'beam-rail-front', [-1.04, -.008, .11], [1.04, -.008, .11], .01, C.metal);
  rod(beam, 'beam-rail-rear', [-1.04, -.008, -.11], [1.04, -.008, -.11], .01, C.metal);
  for (let i = -10; i <= 10; i++) box(beam, `beam-tick-${i}`, [.004, .003, i % 5 === 0 ? .04 : .022], [i / 10, .002, .082], C.metal);
  for (const [name, x] of [['left', -1], ['right', 1]]) {
    child(beam, `beam-end-${name}`, [x, 0, 0]);
    box(beam, `beam-limit-${name}`, [.014, .004, .23], [x, .002, 0], C.red);
  }
  const ball = sphere(beam, 'beam-ball', .065, [0, .065, 0], C.teal, { metalness: .42, roughness: .2 });
  const target = targetMarker(beam, 'beam-target', [0, .004, 0], .083);
  line(target, 'beam-target-guide', [[0, -.09, .14], [0, .17, .14]], C.amber, true);
  return {
    root,
    camera: { position: [1.4, 1.45, 2.8], target: [0, .4, 0], span: 2.75 },
    legend: {
      ko: '청록 공: 실제 위치 · 주황 표식: 목표 위치. 양의 입력은 오른쪽 내리막이며 이동 한계는 ±1 m입니다.',
      en: 'Teal ball: actual position · amber marker: target position. Positive input slopes downhill to the right; travel limits are ±1 m.'
    },
    update(state, params) {
      beam.rotation.z = -state.u;
      ball.position.x = state.y;
      target.position.x = params.target;
    }
  };
}

function cartPendulumScene() {
  const root = group('inverted-pendulum');
  floor(root, 5.1, 1.8);
  box(root, 'rail-bed', [4.65, .085, .49], [0, .095, 0], C.ink);
  for (const [name, z] of [['front', .17], ['rear', -.17]]) {
    box(root, `rail-${name}`, [4.52, .055, .05], [0, .1675, z], C.metal);
    for (const x of [-2.05, -1, 0, 1, 2.05]) {
      box(root, `rail-mount-${name}-${x}`, [.14, .04, .11], [x, .13, z], C.light);
      cylinder(root, `rail-bolt-${name}-${x}`, .016, .012, [x, .156, z + (z > 0 ? .035 : -.035)], C.ink);
    }
  }
  for (const x of [-2.3, 2.3]) {
    box(root, `end-block-${x}`, [.09, .22, .49], [x, .15, 0], C.light);
    box(root, `travel-limit-${x}`, [.02, .012, .48], [Math.sign(x) * 2, .15, 0], C.red);
  }
  box(root, 'cart-drive', [.25, .22, .32], [-2.47, .18, 0], C.ink);
  for (let i = -20; i <= 20; i++) box(root, `rail-tick-${i}`, [.008, .004, i % 10 === 0 ? .075 : .035], [i / 10, .141, .27], C.metal);
  const cart = child(root, 'cart');
  box(cart, 'cart-body', [.44, .12, .29], [0, .335, 0], C.light);
  box(cart, 'cart-trim', [.42, .026, .3], [0, .3, 0], C.teal);
  box(cart, 'hinge-mount', [.12, .075, .14], [0, .415, 0], C.ink);
  const wheels = [];
  for (const [end, x] of [['front', .14], ['rear', -.14]]) {
    for (const [side, z] of [['left', .17], ['right', -.17]]) wheels.push(wheel(cart, `cart-wheel-${end}-${side}`, [x, .26, z], .065, .048));
  }
  axle(cart, 'cart-pivot', .037, .19, [0, .43, 0], C.metal);
  axle(cart, 'cart-encoder', .048, .035, [0, .43, -.12], C.ink);
  const pole = rod(cart, 'pole', [0, .43, 0], [0, .93, 0], .012, C.teal);
  const tip = sphere(cart, 'pole-tip', .045, [0, .93, 0], C.teal, { roughness: .23 });
  line(cart, 'upright-reference', [[0, .43, -.045], [0, .93, -.045]], C.amber, true);
  const target = targetMarker(root, 'cart-target', [0, .201, 0], .13);
  line(target, 'cart-target-guide', [[0, 0, -.3], [0, .83, -.3]], C.amber, true);
  return {
    root,
    camera: { position: [1.7, 1.7, 4.6], target: [0, .4, 0], span: 4.9 },
    legend: {
      ko: '청록: 실제 카트와 진자 · 주황: 목표 카트 위치와 직립. 막대 길이 0.5 m, 양의 각도는 오른쪽 기울기입니다.',
      en: 'Teal: actual cart and pole · amber: target cart position and upright. Pole length is 0.5 m; positive angle leans right.'
    },
    update(state, params) {
      cart.position.x = state.x;
      const end = [.5 * Math.sin(state.theta), .43 + .5 * Math.cos(state.theta), 0];
      setRod(pole, [0, .43, 0], end);
      tip.position.fromArray(end);
      for (const tire of wheels) tire.rotation.z = -state.x / .065;
      target.position.x = params.target;
    }
  };
}

function rotaryScene() {
  const root = group('rotary-pendulum');
  floor(root, .66, .62);
  box(root, 'rotary-base', [.23, .025, .21], [0, .028, 0], C.metal);
  for (const x of [-.085, .085]) {
    for (const z of [-.075, .075]) {
      cylinder(root, `rotary-foot-${x}-${z}`, .016, .016, [x, .008, z], C.ink);
      cylinder(root, `rotary-bolt-${x}-${z}`, .006, .007, [x, .044, z], C.ink);
    }
  }
  cylinder(root, 'rotary-motor', .052, .086, [0, .087, 0], C.ink);
  for (let i = 0; i < 5; i++) cylinder(root, `rotary-motor-fin-${i}`, .057, .004, [0, .055 + i * .015, 0], C.metal);
  box(root, 'rotary-terminal', [.055, .036, .035], [0, .086, -.062], C.light);
  cylinder(root, 'rotary-encoder', .059, .012, [0, .134, 0], C.light);
  cylinder(root, 'rotary-shaft', .013, .028, [0, .151, 0], C.metal);
  const drive = child(root, 'rotary-drive', [0, .16, 0]);
  cylinder(drive, 'rotary-hub', .025, .018, [0, 0, 0], C.teal);
  box(drive, 'arm-body', [.18, .014, .028], [.09, -.006, 0], C.light);
  rod(drive, 'rotary-arm', [0, 0, 0], [.18, 0, 0], .006, C.teal);
  // Physical (x,y,z) maps to world (X,Y,Z)=(x,z,-y).
  // Hence the +alpha tangent is (-sin(alpha),0,-cos(alpha)).
  const pivot = cylinder(drive, 'rotary-pivot', .02, .037, [.18, 0, 0], C.ink);
  pivot.rotation.z = Math.PI / 2;
  const hinge = cylinder(drive, 'rotary-hinge-cap', .011, .041, [.18, 0, 0], C.metal);
  hinge.rotation.z = Math.PI / 2;
  const pole = rod(drive, 'rotary-pole', [.18, 0, 0], [.18, .22, 0], .0045, C.teal);
  const tip = sphere(drive, 'rotary-tip', .015, [.18, .22, 0], C.teal, { roughness: .23 });
  const upright = line(drive, 'rotary-upright', [[.18, 0, 0], [.18, .22, 0]], C.amber, true);
  upright.material.dashSize = .012; upright.material.gapSize = .008;
  const reference = line(root, 'arm-target-ray', [[0, .16, 0], [.18, .16, 0]], C.amber, true);
  reference.material.dashSize = .012; reference.material.gapSize = .008;
  const target = targetMarker(root, 'arm-target', [.18, .161, 0], .019);
  return {
    root,
    camera: { position: [.66, .5, .85], target: [.04, .18, 0], span: .9 },
    legend: {
      ko: '청록: 실제 암과 진자 · 주황: 목표 암 각도와 직립. 암 0.18 m, 진자 0.22 m; +θ는 +α 접선 방향입니다.',
      en: 'Teal: actual arm and pole · amber: target arm angle and upright. Arm 0.18 m, pole 0.22 m; +θ leans along the +α tangent.'
    },
    update(state, params) {
      drive.rotation.y = state.alpha;
      const end = [.18, .22 * Math.cos(state.theta), -.22 * Math.sin(state.theta)];
      setRod(pole, [.18, 0, 0], end);
      tip.position.fromArray(end);
      const x = .18 * Math.cos(params.target), z = -.18 * Math.sin(params.target);
      target.position.set(x, .161, z);
      updateLine(reference, [[0, .16, 0], [x, .16, z]]);
    }
  };
}

function plateScene() {
  const root = group('ball-and-plate');
  floor(root, 1, .95);
  box(root, 'plate-base', [.43, .035, .43], [0, .035, 0], C.metal);
  for (const x of [-.17, .17]) {
    for (const z of [-.17, .17]) {
      cylinder(root, `plate-foot-${x}-${z}`, .023, .025, [x, .0125, z], C.ink);
      cylinder(root, `plate-bolt-${x}-${z}`, .008, .006, [x, .056, z], C.ink);
    }
  }
  cylinder(root, 'plate-pedestal', .049, .17, [0, .1375, 0], C.ink);
  cylinder(root, 'plate-pedestal-collar', .06, .014, [0, .077, 0], C.light);
  sphere(root, 'plate-joint', .032, [0, .253, 0], C.metal);
  for (const x of [-.067, .067]) box(root, `gimbal-fork-${x}`, [.021, .07, .055], [x, .233, 0], C.light);
  const servoY = cylinder(root, 'plate-servo-y', .036, .075, [.11, .248, 0], C.ink);
  servoY.rotation.z = Math.PI / 2;
  rod(root, 'plate-y-shaft', [-.075, .28, 0], [.15, .28, 0], .009, C.metal);
  const tiltY = child(root, 'plate-tilt-y', [0, .28, 0]);
  for (const z of [-.058, .058]) box(tiltY, `gimbal-yoke-${z}`, [.16, .015, .018], [0, -.026, z], C.metal);
  axle(tiltY, 'plate-servo-x', .029, .05, [0, -.029, .099], C.ink);
  rod(tiltY, 'plate-x-shaft', [0, 0, -.071], [0, 0, .12], .008, C.metal);
  const plate = child(tiltY, 'plate');
  box(plate, 'plate-deck', [.6, .025, .6], [0, -.0125, 0], C.light, { roughness: .68 });
  for (let i = -2; i <= 2; i++) {
    line(plate, `plate-grid-x-${i}`, [[i / 10, .001, -.3], [i / 10, .001, .3]], C.metal);
    line(plate, `plate-grid-y-${i}`, [[-.3, .001, i / 10], [.3, .001, i / 10]], C.metal);
  }
  const corners = [[-.3, -.3], [.3, -.3], [.3, .3], [-.3, .3]];
  for (let i = 0; i < corners.length; i++) {
    const [x, y] = corners[i], [nextX, nextY] = corners[(i + 1) % 4];
    child(plate, `plate-corner-${i}`, [x, 0, -y]);
    rod(plate, `plate-edge-${i}`, [x, -.004, -y], [nextX, -.004, -nextY], .004, C.ink);
    cylinder(plate, `plate-corner-bolt-${i}`, .006, .004, [x * .9, .002, -y * .9], C.metal);
  }
  const ball = sphere(plate, 'plate-ball', .026, [0, .026, 0], C.teal, { roughness: .19, metalness: .4 });
  const target = targetMarker(plate, 'plate-target', [0, .002, 0], .035);
  return {
    root,
    camera: { position: [.78, .76, 1.03], target: [0, .19, 0], span: .98 },
    legend: {
      ko: '청록 공: 실제 위치 · 주황 원: 목표 위치. 각 축의 양의 기울기는 내리막이며 판의 이동 한계는 ±0.30 m입니다.',
      en: 'Teal ball: actual position · amber ring: target position. Positive axis tilt is downhill; plate travel limits are ±0.30 m.'
    },
    update(state, params) {
      // Exact ideal-servo law from models/ball-and-plate.js controls().
      const limit = Math.max(0, Math.min(.3, params.tiltLimit));
      const cap = value => Math.max(-limit, Math.min(limit, value));
      const tx = cap(params.kpX * (params.targetX - state.x) - params.kdX * state.vx);
      const ty = cap(params.kpY * (params.targetY - state.y) - params.kdY * state.vy);
      // Same compound rotation as draw(): Rx(-ty) Rz(-tx), y -> -Z.
      tiltY.rotation.x = -ty;
      plate.rotation.z = -tx;
      ball.position.set(state.x, .026, -state.y);
      target.position.set(params.targetX, .002, -params.targetY);
    }
  };
}

export function createMechanismScene(id) {
  switch (id) {
    case 'cruise-control': return cruiseScene();
    case 'dc-motor': return motorScene();
    case 'ball-and-beam': return beamScene();
    case 'inverted-pendulum': return cartPendulumScene();
    case 'rotary-pendulum': return rotaryScene();
    case 'ball-and-plate': return plateScene();
    default: return null;
  }
}
