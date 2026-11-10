import * as T from '../vendor/three.js';
import { C, group, box, cylinder, sphere, rod, setRod, line, updateLine, floor, targetMarker } from './primitives.js';
import { finish, housing, turned, flange, cable } from './engineering.js';

function shaped(parent, name, shape, depth, position, material, bevel = .004) {
  const geometry = new T.ExtrudeGeometry(shape, {depth: depth - 2 * bevel, bevelEnabled: bevel > 0,
    bevelThickness: bevel, bevelSize: bevel, bevelSegments: 2, steps: 1, curveSegments: 24});
  geometry.translate(0, 0, -depth / 2 + bevel);
  const mesh = new T.Mesh(geometry, material);
  mesh.name = name; mesh.position.fromArray(position); mesh.castShadow = mesh.receiveShadow = true;
  parent.add(mesh); return mesh;
}
function outline(points) {
  const shape = new T.Shape(); shape.moveTo(...points[0]);
  points.slice(1).forEach(p => shape.lineTo(...p)); shape.closePath(); return shape;
}
function turnedAxle(parent, name, profile, position, material) {
  const mesh = turned(parent, name, profile, position, material); mesh.rotation.x = Math.PI / 2; return mesh;
}
function axialFlange(parent, name, radius, depth, position, material, bore) {
  const mesh = flange(parent, name, radius, depth, position, material, bore); mesh.rotation.x = Math.PI / 2; return mesh;
}
function measurement(id, anchor, ko, en, side = 'left') {
  return {id, anchor, label: {ko, en}, value: '', side};
}

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
  const assembly = child(parent, name, position), rubber = finish('rubber'), alloy = finish('aluminium'), steel = finish('steel');
  turnedAxle(assembly, `${name}-tire`, [[radius * .65, -width * .5], [radius * .85, -width * .5],
    [radius * .98, -width * .37], [radius, -width * .28], [radius, width * .28],
    [radius * .98, width * .37], [radius * .85, width * .5], [radius * .65, width * .5]], [0, 0, 0], rubber);
  for (const side of [-1, 1]) {
    axialFlange(assembly, `${name}-rim-${side}`, radius * .68, width * .08, [0, 0, side * width * .45], alloy, radius * .54);
    axle(assembly, `${name}-hub-${side}`, radius * .19, width * .12, [0, 0, side * width * .48], steel);
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5, z = side * width * .47;
      rod(assembly, `${name}-spoke-${side}-${i}`, [radius * .12 * Math.cos(a), radius * .12 * Math.sin(a), z],
        [radius * .61 * Math.cos(a), radius * .61 * Math.sin(a), z], radius * .06, alloy);
    }
  }
  // Narrow circumferential grooves leave the model's exact rolling radius intact.
  for (const [i, z] of [-.22, 0, .22].entries()) {
    const groove = new T.Mesh(new T.TorusGeometry(radius * .991, radius * .009, 6, 64), finish('rubber', {color: 0x111414}));
    groove.name = `${name}-tread-${i}`; groove.position.z = z * width; assembly.add(groove);
  }
  return assembly;
}
function cruiseScene() {
  const root = group('cruise-control');
  floor(root, 8, 5);
  const paint = finish('paint', {color: 0xaebdbb, roughness: .32}), steel = finish('steel'), dark = finish('dark-metal');
  const glazing = finish('glass', {color: 0x26393d, transparent: false, opacity: 1, depthWrite: true, roughness: .18});
  housing(root, 'road', [6.6, .05, 2.8], [0, .025, 0], finish('rubber', {color: 0x555c5b}));
  for (const z of [-1.3, 1.3]) box(root, `road-edge-${z}`, [6.5, .005, .035], [0, .053, z], C.white);
  const marks = Array.from({length: 8}, (_, i) => box(root, `road-mark-${i}`, [1.1, .006, .045], [-7.8 + i * 2.6, .056, -.98], C.white));
  const car = child(root, 'car', [0, .05, 0]);
  housing(car, 'chassis', [2.25, .13, 1.26], [0, .43, 0], dark);
  for (const [end, x] of [['front', 1.22], ['rear', -1.22]]) {
    housing(car, `underbody-crossmember-${end}`, [.23, .10, 1.3], [x, .32, 0], dark);
    axle(car, `drive-axle-${end}`, .055, 1.55, [x, .34, 0], steel);
  }
  // The lower body boundary follows real wheel openings, rather than hiding
  // cylinders under a rectangular slab. Front is +X; wheel centres stay fixed.
  const skin = new T.Shape();
  skin.moveTo(-1.94, .42); skin.lineTo(-1.625, .34);
  skin.absarc(-1.22, .34, .405, Math.PI, 0, true);
  skin.lineTo(.815, .34); skin.absarc(1.22, .34, .405, Math.PI, 0, true);
  skin.lineTo(1.94, .44); skin.lineTo(1.96, .79); skin.quadraticCurveTo(1.8, 1.01, 1.6, 1.04);
  skin.lineTo(.6, 1.09); skin.lineTo(-.95, 1.09); skin.lineTo(-1.77, .99); skin.lineTo(-1.96, .80); skin.closePath();
  shaped(car, 'body', skin, 1.5, [0, 0, 0], paint, .025);
  shaped(car, 'hood', outline([[.66, 1.075], [1.65, 1.025], [1.81, .995], [1.65, 1.077], [.66, 1.125]]), 1.42, [0, 0, 0], paint, .012);
  shaped(car, 'cabin', outline([[-1.18, 1.04], [-.76, 1.50], [.20, 1.50], [.72, 1.07]]), 1.28, [0, 0, 0], dark, .018);
  shaped(car, 'roof', outline([[-.83, 1.49], [-.74, 1.54], [.18, 1.54], [.25, 1.49]]), 1.29, [0, 0, 0], paint, .015);
  const windshield = housing(car, 'windshield', [.018, .59, 1.17], [.46, 1.295, 0], glazing);
  windshield.rotation.z = .87;
  const rearGlass = housing(car, 'rear-window', [.018, .56, 1.16], [-.98, 1.28, 0], glazing);
  rearGlass.rotation.z = -.74;
  for (const side of [-1, 1]) {
    shaped(car, `side-window-${side}`, outline([[-1.08, 1.09], [-.72, 1.45], [.16, 1.45], [.59, 1.09]]), .014, [0, 0, side * .655], glazing, .002);
    housing(car, `window-pillar-${side}`, [.055, .42, .027], [-.32, 1.28, side * .67], dark);
    housing(car, `door-handle-${side}`, [.17, .028, .035], [-.45, .95, side * .78], steel);
    housing(car, `side-trim-${side}`, [1.50, .055, .03], [0, .47, side * .77], dark);
    housing(car, `mirror-${side}`, [.19, .10, .17], [.52, 1.12, side * .82], paint);
    housing(car, `headlamp-${side}`, [.052, .13, .35], [1.92, .86, side * .49], finish('ceramic'));
    housing(car, `tail-lamp-${side}`, [.042, .10, .30], [-1.95, .85, side * .53], finish('paint', {color: 0x7d2521}));
    line(car, `door-seam-${side}`, [[-.3, 1.065, side * .779], [-.3, .65, side * .779], [.62, .65, side * .779], [.69, .96, side * .779]], 0x5b6767);
  }
  housing(car, 'front-bumper', [.1, .14, 1.42], [1.94, .53, 0], dark);
  housing(car, 'rear-bumper', [.1, .14, 1.42], [-1.94, .53, 0], dark);
  for (let i = 0; i < 5; i++) housing(car, `radiator-grille-${i}`, [.018, .018, .75], [2.001, .65 + i * .035, 0], dark);
  const wheels = [];
  for (const [end, x] of [['front', 1.22], ['rear', -1.22]]) {
    for (const [side, z] of [['left', .79], ['right', -.79]]) {
      wheels.push(wheel(car, `wheel-${end}-${side}`, [x, .34, z], .34, .22));
      const arch = new T.Mesh(new T.TorusGeometry(.408, .023, 8, 40, Math.PI), dark);
      arch.name = `wheel-arch-${end}-${side}`; arch.position.set(x, .34, z); car.add(arch);
    }
  }
  const readings = [measurement('speed', car, '실제 속도', 'Actual speed'),
    measurement('distance', wheels[0], '적분 이동거리', 'Integrated distance', 'right')];
  // These are speed scales, not fictitious reference-car displacement.
  const gauges = ['actual-speed', 'target-speed'].map((name, i) => {
    box(root, `${name}-track`, [3.6, .035, .13], [0, .04, 1.78 + i * .31], C.light);
    const gauge = child(root, name, [-1.8, .062, 1.78 + i * .31]);
    box(gauge, `${name}-bar`, [3.6, .035, .105], [1.8, 0, 0], i ? C.amber : C.teal);
    return gauge;
  });
  return {
    root,
    camera: { position: [5.4, 3.5, 8.8], target: [0, .55, .25], span: 8.0 },
    readouts: () => readings,
    legend: {
      ko: '청록 막대: 실제 속도 · 주황 막대: 목표 속도. 도로와 바퀴는 적분 이동거리에 연동됩니다.',
      en: 'Teal bar: actual speed · amber bar: target speed. Road and wheels follow integrated distance.'
    },
    update(state, params, extras = {}) {
      const distance = Number.isFinite(extras.distance) ? extras.distance : 0;
      const phase = ((distance % 2.6) + 2.6) % 2.6;
      for (let i = 0; i < marks.length; i++) {
        marks[i].position.x = -7.8 + i * 2.6 - phase;
        marks[i].visible = Math.abs(marks[i].position.x) < 2.7;
      }
      for (const tire of wheels) tire.rotation.z = -distance / .34;
      gauges[0].scale.x = state.y / 40;
      gauges[1].scale.x = params.target / 40;
      readings[0].value = `${state.y.toFixed(3)} m/s`;
      readings[1].value = `${distance.toFixed(3)} m`;
    }
  };
}

function motorScene() {
  const root = group('dc-motor'), aluminium = finish('aluminium'), steel = finish('steel'), dark = finish('dark-metal');
  floor(root, 3.4, 3.3);
  housing(root, 'motor-mount', [1.62, .12, 2.15], [0, .1, -.35], aluminium);
  for (const x of [-.65, .65]) for (const z of [-1.25, .52]) cylinder(root, `motor-isolator-${x}-${z}`, .065, .04, [x, .02, z], finish('rubber'));
  for (const x of [-.55, .55]) {
    housing(root, `motor-foot-${x}`, [.19, .35, 1.02], [x, .3, -.45], dark);
    for (const z of [-1.1, .38]) cylinder(root, `mount-bolt-${x}-${z}`, .035, .026, [x, .173, z], steel);
  }
  for (const [name, z] of [['front', -.08], ['rear', -.78]]) {
    const saddle = new T.Shape();
    saddle.moveTo(-.64, .16); saddle.lineTo(.64, .16); saddle.lineTo(.64, .38);
    saddle.lineTo(.53, .95); saddle.lineTo(.495, .95);
    saddle.absarc(0, .95, .495, 0, -Math.PI, true);
    saddle.lineTo(-.53, .95); saddle.lineTo(-.64, .38); saddle.closePath();
    shaped(root, `motor-saddle-${name}`, saddle, .11, [0, 0, z], aluminium, .006);
  }
  turnedAxle(root, 'motor-housing', [[.39, -.56], [.46, -.54], [.49, -.47], [.49, .47], [.46, .54], [.39, .56]], [0, .95, -.4], aluminium);
  turnedAxle(root, 'motor-rear-cap', [[0, -.07], [.36, -.07], [.46, -.04], [.5, 0], [.5, .04], [.44, .07], [0, .07]], [0, .95, -.99], dark);
  turnedAxle(root, 'motor-front-cap', [[.08, -.05], [.45, -.05], [.51, -.02], [.51, .015], [.43, .035], [.23, .06], [.13, .10], [.08, .10]], [0, .95, .2], aluminium);
  for (let i = 0; i < 20; i++) {
    const a = i * Math.PI / 10;
    const fin = housing(root, `cooling-fin-${i}`, [.028, .07, .87], [.49 * Math.cos(a), .95 + .49 * Math.sin(a), -.4], aluminium);
    fin.rotation.z = a - Math.PI / 2;
  }
  for (let i = 0; i < 6; i++) {
    const a = i * Math.PI / 3;
    axle(root, `endbell-tie-bolt-${i}`, .023, .035, [.445 * Math.cos(a), .95 + .445 * Math.sin(a), .24], steel);
    rod(root, `motor-tie-rod-${i}`, [.438 * Math.cos(a), .95 + .438 * Math.sin(a), -.96], [.438 * Math.cos(a), .95 + .438 * Math.sin(a), .18], .014, steel);
  }
  housing(root, 'terminal-box', [.36, .15, .32], [0, 1.49, -.4], dark);
  housing(root, 'terminal-lid', [.38, .025, .34], [0, 1.574, -.4], aluminium);
  axle(root, 'cable-gland', .045, .10, [.12, 1.48, -.60], steel);
  cable(root, 'motor-cable', [[.12, 1.48, -.65], [.30, 1.40, -.84], [.61, .63, -1.02], [.66, .21, -.93], [.78, .19, -.50]], .022);
  axle(root, 'motor-bearing', .14, .12, [0, .95, .32], dark);
  const shaft = rod(root, 'motor-shaft', [0, .95, .2], [0, .95, .84], .075, steel);
  turnedAxle(root, 'shaft-coupling', [[.075, -.08], [.125, -.08], [.135, -.065], [.135, .065], [.125, .08], [.075, .08]], [0, .95, .43], steel);
  for (const z of [.385, .415, .445, .475]) axialFlange(root, `coupling-flexure-${z}`, .137, .008, [0, .95, z], dark, .126);
  const support = outline([[-.26, .16], [-.26, 1.02], [-.16, 1.14], [.16, 1.14], [.26, 1.02], [.26, .16]]);
  const bore = new T.Path(); bore.absarc(0, .95, .142, 0, Math.PI * 2, true); support.holes.push(bore);
  shaped(root, 'front-bearing-support', support, .105, [0, 0, .55], aluminium, .008);
  axialFlange(root, 'front-bearing-race', .145, .13, [0, .95, .55], steel, .078);
  const encoder = turnedAxle(root, 'encoder-housing', [[0, -.12], [.15, -.12], [.18, -.09], [.18, .08], [.15, .1], [0, .1]], [0, .95, -1.17], dark);
  axialFlange(root, 'encoder-adaptor', .21, .035, [0, .95, -1.07], aluminium, .08);
  cable(root, 'encoder-cable', [[.12, .95, -1.27], [.3, .8, -1.32], [.40, .20, -1.24], [.64, .19, -1.12]], .014);
  // Open metrology witness, not an oversized solid flywheel. Its long pointer
  // keeps the original .63 m angular scale and exact XY sign convention.
  const rotor = child(root, 'rotor', [0, .95, .64]);
  axialFlange(rotor, 'rotor-disc', .72, .008, [0, 0, 0], aluminium, .703);
  axle(rotor, 'rotor-inset', .10, .026, [0, 0, .048], steel);
  for (let i = 0; i < 3; i++) {
    const a = i * Math.PI * 2 / 3;
    rod(rotor, `rotor-spoke-${i}`, [.10 * Math.cos(a), .10 * Math.sin(a), .004], [.71 * Math.cos(a), .71 * Math.sin(a), .004], .006, steel);
    axle(rotor, `rotor-bolt-${i}`, .014, .009, [.71 * Math.cos(a), .71 * Math.sin(a), .01], dark);
  }
  rod(rotor, 'actual-pointer', [0, 0, .095], [.63, 0, .095], .012, finish('paint', {color: C.teal}));
  sphere(rotor, 'actual-pointer-tip', .033, [.63, 0, .095], C.teal);
  axle(rotor, 'shaft-cap', .08, .035, [0, 0, .1], steel);
  const dial = child(root, 'dial', [0, .95, .65]);
  const ring = new T.Mesh(new T.TorusGeometry(.85, .008, 8, 80), steel);
  ring.name = 'dial-rim'; dial.add(ring);
  for (let i = 0; i < 24; i++) {
    const a = i * Math.PI / 12, r = i % 6 === 0 ? .785 : .815;
    rod(dial, `dial-tick-${i}`, [r * Math.cos(a), r * Math.sin(a), 0], [.84 * Math.cos(a), .84 * Math.sin(a), 0], .004, dark);
  }
  for (const x of [-.57, .57]) rod(root, `dial-standoff-${x}`, [x, .18, .65], [x, .32, .65], .018, steel);
  const reference = child(root, 'motor-target', [0, .95, .79]);
  line(reference, 'target-angle-ray', [[0, 0, 0], [.79, 0, 0]], C.amber, true);
  sphere(reference, 'target-pointer-tip', .035, [.79, 0, 0], C.amber);
  const readings = [measurement('angle', shaft, '축 각도', 'Shaft angle'), measurement('rate', encoder, '축 각속도', 'Shaft rate', 'right')];
  return {
    root,
    camera: { position: [3.7, 2.7, 4.6], target: [0, .63, -.18], span: 4.7 },
    readouts: () => readings,
    legend: {
      ko: '청록 지침: 실제 축 각도 · 주황 점선: 목표 각도. 0 rad은 오른쪽, 양의 각도는 반시계 방향입니다.',
      en: 'Teal pointer: actual shaft angle · amber dashed pointer: target angle. Zero points right; positive is counterclockwise.'
    },
    update(state, params) {
      rotor.rotation.z = state.y;
      reference.rotation.z = params.target;
      readings[0].value = `${state.y.toFixed(3)} rad`;
      readings[1].value = `${state.v.toFixed(3)} rad/s`;
    }
  };
}

function beamScene() {
  const root = group('ball-and-beam'), aluminium = finish('aluminium'), steel = finish('steel'), dark = finish('dark-metal');
  floor(root, 2.8, 1.55);
  housing(root, 'beam-base', [1.5, .075, .73], [0, .07, 0], aluminium);
  for (const x of [-.62, .62]) for (const z of [-.28, .28]) {
    cylinder(root, `beam-base-bolt-${x}-${z}`, .022, .02, [x, .117, z], steel);
    cylinder(root, `beam-level-foot-${x}-${z}`, .046, .03, [x, .017, z], finish('rubber'));
  }
  for (const [name, z] of [['left', -.19], ['right', .19]]) {
    const bracket = outline([[-.24, .11], [-.10, .65], [-.065, .72], [.065, .72], [.10, .65], [.24, .11]]);
    const bore = new T.Path(); bore.absarc(0, .62, .067, 0, Math.PI * 2, true); bracket.holes.push(bore);
    shaped(root, `mount-${name}`, bracket, .055, [0, 0, z], aluminium, .004);
    rod(root, `mount-brace-${name}`, [-.30, .12, z], [-.06, .53, z], .024, dark);
    axialFlange(root, `beam-bearing-${name}`, .087, .068, [0, .62, z], steel, .047);
  }
  const pivot = axle(root, 'beam-pivot', .047, .54, [0, .62, 0], steel);
  axialFlange(root, 'pivot-bearing', .09, .055, [0, .62, .25], steel, .048);
  axle(root, 'pivot-cap', .038, .06, [0, .62, .255], dark);
  housing(root, 'servo-housing', [.24, .23, .23], [0, .55, -.36], dark);
  axialFlange(root, 'servo-output-flange', .10, .025, [0, .62, -.27], aluminium, .045);
  for (let i = 0; i < 4; i++) housing(root, `servo-fin-${i}`, [.265, .012, .23], [0, .47 + i * .048, -.36], aluminium);
  axle(root, 'beam-encoder', .063, .065, [0, .62, .31], dark);
  cable(root, 'beam-servo-cable', [[.09, .48, -.47], [.21, .39, -.49], [.32, .15, -.32], [.58, .13, -.30]], .012);
  cable(root, 'beam-encoder-cable', [[0, .59, .35], [.12, .40, .32], [.21, .14, .30], [.56, .13, .30]], .007);
  const beam = child(root, 'beam', [0, .62, 0]);
  const section = outline([[-.115, 0], [.115, 0], [.115, -.014], [.018, -.014], [.018, -.065], [.115, -.065],
    [.115, -.08], [-.115, -.08], [-.115, -.065], [-.018, -.065], [-.018, -.014], [-.115, -.014]]);
  const deck = shaped(beam, 'beam-deck', section, 2.08, [0, 0, 0], aluminium, 0);
  deck.rotation.y = Math.PI / 2;
  housing(beam, 'beam-guide-web', [1.94, .035, .009], [0, -.04, .021], dark);
  housing(beam, 'beam-running-surface', [2.02, .006, .15], [0, -.003, 0], finish('steel', {roughness: .29}));
  rod(beam, 'beam-rail-front', [-1.04, -.008, .11], [1.04, -.008, .11], .01, steel);
  rod(beam, 'beam-rail-rear', [-1.04, -.008, -.11], [1.04, -.008, -.11], .01, steel);
  for (let i = -10; i <= 10; i++) box(beam, `beam-tick-${i}`, [.003, .002, i % 5 === 0 ? .035 : .018], [i / 10, .002, .082], dark);
  for (const [name, x] of [['left', -1], ['right', 1]]) {
    child(beam, `beam-end-${name}`, [x, 0, 0]);
    box(beam, `beam-limit-${name}`, [.014, .004, .23], [x, .002, 0], C.red);
  }
  const ball = sphere(beam, 'beam-ball', .065, [0, .065, 0], finish('steel', {roughness: .16}));
  const target = targetMarker(beam, 'beam-target', [0, .004, 0], .083);
  line(target, 'beam-target-guide', [[0, -.09, .14], [0, .17, .14]], C.amber, true);
  const readings = [measurement('position', ball, '공 위치', 'Ball position'), measurement('tilt', pivot, '내리막 기울기', 'Downhill tilt', 'right')];
  return {
    root,
    camera: { position: [1.4, 1.45, 2.8], target: [0, .4, 0], span: 2.75 },
    readouts: () => readings,
    legend: {
      ko: '강철 공: 실제 위치 · 주황 표식: 목표 위치. 양의 입력은 오른쪽 내리막이며 이동 한계는 ±1 m입니다.',
      en: 'Steel ball: actual position · amber marker: target position. Positive input slopes downhill to the right; travel limits are ±1 m.'
    },
    update(state, params) {
      beam.rotation.z = -state.u;
      ball.position.x = state.y;
      target.position.x = params.target;
      readings[0].value = `${state.y.toFixed(3)} m`;
      readings[1].value = `${state.u.toFixed(3)} rad`;
    }
  };
}

function cartPendulumScene() {
  const root = group('inverted-pendulum'), aluminium = finish('aluminium'), steel = finish('steel'), dark = finish('dark-metal');
  floor(root, 5.1, 1.8);
  const section = outline([[-.245, -.043], [.245, -.043], [.245, .043], [.18, .043], [.18, .025], [.21, .025],
    [.21, -.02], [-.21, -.02], [-.21, .025], [-.18, .025], [-.18, .043], [-.245, .043]]);
  const bed = shaped(root, 'rail-bed', section, 4.65, [0, .095, 0], aluminium, 0); bed.rotation.y = Math.PI / 2;
  for (const [name, z] of [['front', .17], ['rear', -.17]]) {
    housing(root, `rail-${name}`, [4.52, .055, .05], [0, .1675, z], steel);
    housing(root, `extrusion-slot-${name}`, [4.4, .012, .009], [0, .095, Math.sign(z) * .247], dark);
    for (const x of [-2.05, -1, 0, 1, 2.05]) {
      housing(root, `rail-mount-${name}-${x}`, [.14, .04, .11], [x, .13, z], aluminium);
      cylinder(root, `rail-bolt-${name}-${x}`, .012, .012, [x, .156, z + (z > 0 ? .035 : -.035)], dark);
    }
  }
  for (const x of [-2.3, 2.3]) {
    housing(root, `end-block-${x}`, [.09, .22, .49], [x, .15, 0], aluminium);
    housing(root, `end-foot-${x}`, [.22, .035, .73], [x, .025, 0], dark);
    box(root, `travel-limit-${x}`, [.02, .012, .48], [Math.sign(x) * 2, .15, 0], C.red);
    housing(root, `limit-sensor-${x}`, [.075, .035, .045], [Math.sign(x) * 2.08, .205, -.235], dark);
  }
  housing(root, 'cart-drive', [.25, .22, .32], [-2.47, .18, 0], dark);
  axle(root, 'drive-motor-endbell', .10, .03, [-2.47, .18, .17], aluminium);
  for (const [name, x] of [['drive-pulley', -2.25], ['idler-pulley', 2.25]]) {
    turnedAxle(root, name, [[0, -.045], [.085, -.045], [.085, -.035], [.07, -.035], [.07, .035], [.085, .035], [.085, .045], [0, .045]], [x, .13, 0], steel);
    axle(root, `${name}-shaft`, .022, .31, [x, .13, 0], steel);
  }
  housing(root, 'drive-belt-upper', [4.50, .008, .055], [0, .20, 0], finish('rubber'));
  housing(root, 'drive-belt-return', [4.50, .008, .055], [0, .06, 0], finish('rubber'));
  cable(root, 'drive-supply-cable', [[-2.48, .17, -.16], [-2.5, .08, -.29], [-2.2, .06, -.34], [-1.75, .06, -.34]], .011);
  for (let i = -20; i <= 20; i++) box(root, `rail-tick-${i}`, [.006, .004, i % 10 === 0 ? .075 : .035], [i / 10, .141, .27], dark);
  const cart = child(root, 'cart');
  housing(cart, 'cart-body', [.44, .12, .29], [0, .335, 0], aluminium);
  housing(cart, 'cart-trim', [.42, .026, .3], [0, .3, 0], finish('paint', {color: C.teal}));
  housing(cart, 'belt-clamp', [.16, .075, .08], [0, .24, 0], dark);
  for (const [name, z] of [['front', .17], ['rear', -.17]]) housing(cart, `cart-bearing-${name}`, [.13, .075, .075], [0, .25, z], dark);
  const mount = outline([[-.08, .385], [-.08, .45], [-.045, .48], [.045, .48], [.08, .45], [.08, .385]]);
  const bore = new T.Path(); bore.absarc(0, .43, .038, 0, Math.PI * 2, true); mount.holes.push(bore);
  shaped(cart, 'hinge-mount', mount, .14, [0, 0, 0], aluminium, .003);
  const wheels = [];
  for (const [end, x] of [['front', .14], ['rear', -.14]]) {
    for (const [side, z] of [['left', .17], ['right', -.17]]) {
      const name = `cart-wheel-${end}-${side}`, roller = child(cart, name, [x, .26, z]);
      turnedAxle(roller, `${name}-tire`, [[.02, -.024], [.06, -.024], [.065, -.018], [.065, .018], [.06, .024], [.02, .024]], [0, 0, 0], steel);
      axle(roller, `${name}-hub`, .018, .054, [0, 0, 0], dark); wheels.push(roller);
    }
  }
  const pivot = axle(cart, 'cart-pivot', .037, .19, [0, .43, 0], steel);
  axle(cart, 'cart-encoder', .048, .035, [0, .43, -.12], dark);
  axialFlange(cart, 'hinge-bearing-ring', .043, .018, [0, .43, .087], steel, .025);
  cable(cart, 'cart-encoder-cable', [[0, .43, -.145], [.09, .40, -.17], [.13, .34, -.17], [.18, .34, -.10]], .006);
  const pole = rod(cart, 'pole', [0, .43, 0], [0, .93, 0], .012, steel);
  const tip = sphere(cart, 'pole-tip', .045, [0, .93, 0], finish('steel', {color: 0x829e98, roughness: .22}));
  line(cart, 'upright-reference', [[0, .43, -.045], [0, .93, -.045]], C.amber, true);
  const target = targetMarker(root, 'cart-target', [0, .201, 0], .13);
  line(target, 'cart-target-guide', [[0, 0, -.3], [0, .83, -.3]], C.amber, true);
  const readings = [measurement('cart-position', cart, '카트 위치', 'Cart position'), measurement('pole-angle', pivot, '직립 오차', 'Upright error', 'right')];
  return {
    root,
    camera: { position: [4.8, 2.4, 4.4], target: [0, .4, 0], span: 5.4 },
    readouts: () => readings,
    legend: {
      ko: '강철 진자: 실제 자세 · 주황: 목표 카트 위치와 직립. 막대 길이 0.5 m, 양의 각도는 오른쪽 기울기입니다.',
      en: 'Steel pole: actual pose · amber: target cart position and upright. Pole length is 0.5 m; positive angle leans right.'
    },
    update(state, params) {
      cart.position.x = state.x;
      const end = [.5 * Math.sin(state.theta), .43 + .5 * Math.cos(state.theta), 0];
      setRod(pole, [0, .43, 0], end);
      tip.position.fromArray(end);
      for (const tire of wheels) tire.rotation.z = -state.x / .065;
      target.position.x = params.target;
      readings[0].value = `${state.x.toFixed(3)} m`;
      readings[1].value = `${state.theta.toFixed(3)} rad`;
    }
  };
}

function rotaryScene() {
  const root = group('rotary-pendulum'), aluminium = finish('aluminium'), steel = finish('steel'), dark = finish('dark-metal');
  floor(root, .66, .62);
  housing(root, 'rotary-base', [.34, .025, .28], [0, .028, 0], aluminium);
  for (const x of [-.135, .135]) for (const z of [-.105, .105]) {
    cylinder(root, `rotary-foot-${x}-${z}`, .016, .016, [x, .008, z], finish('rubber'));
    cylinder(root, `rotary-bolt-${x}-${z}`, .006, .007, [x, .044, z], steel);
  }
  turned(root, 'rotary-motor', [[0, -.043], [.044, -.043], [.052, -.035], [.052, .033], [.046, .043], [0, .043]], [0, .087, 0], dark);
  for (let i = 0; i < 5; i++) flange(root, `rotary-motor-fin-${i}`, .057, .0025, [0, .055 + i * .015, 0], aluminium, .05);
  housing(root, 'rotary-terminal', [.055, .036, .035], [0, .086, -.062], dark);
  flange(root, 'rotary-motor-foot', .068, .008, [0, .045, 0], aluminium, .034);
  cylinder(root, 'rotary-encoder', .059, .012, [0, .134, 0], aluminium);
  turned(root, 'rotary-bearing-cartridge', [[.012, -.012], [.037, -.012], [.042, -.006], [.042, .002], [.027, .008], [.012, .008]], [0, .143, 0], steel);
  cylinder(root, 'rotary-shaft', .013, .028, [0, .151, 0], steel);
  cable(root, 'rotary-drive-cable', [[0, .077, -.079], [.033, .065, -.10], [.09, .047, -.11], [.145, .046, -.085]], .0035);
  const drive = child(root, 'rotary-drive', [0, .16, 0]);
  flange(drive, 'rotary-hub', .025, .018, [0, 0, 0], steel, .013);
  const armShape = outline([[-.022, -.019], [.025, -.019], [.155, -.012], [.20, -.021], [.205, .021], [.155, .012], [.025, .019], [-.022, .019]]);
  for (const x of [.065, .10, .135]) {
    const hole = new T.Path(); hole.absarc(x, 0, .006, 0, Math.PI * 2, true); armShape.holes.push(hole);
  }
  const arm = shaped(drive, 'arm-body', armShape, .014, [0, -.006, 0], aluminium, .001); arm.rotation.x = Math.PI / 2;
  rod(drive, 'rotary-arm', [0, 0, 0], [.18, 0, 0], .006, finish('steel', {color: 0x638b82}));
  // Physical (x,y,z) maps to world (X,Y,Z)=(x,z,-y).
  // Hence the +alpha tangent is (-sin(alpha),0,-cos(alpha)).
  const pivot = cylinder(drive, 'rotary-pivot', .02, .037, [.18, 0, 0], dark);
  pivot.rotation.z = Math.PI / 2;
  const hinge = cylinder(drive, 'rotary-hinge-cap', .011, .041, [.18, 0, 0], steel);
  hinge.rotation.z = Math.PI / 2;
  const race = flange(drive, 'rotary-pivot-bearing', .018, .009, [.202, 0, 0], steel, .009); race.rotation.z = Math.PI / 2;
  const encoder = turned(drive, 'rotary-hinge-encoder', [[0, -.009], [.016, -.009], [.018, -.006], [.018, .006], [.015, .009], [0, .009]], [.22, 0, 0], dark); encoder.rotation.z = Math.PI / 2;
  cable(drive, 'rotary-encoder-lead', [[.22, -.008, -.013], [.15, -.016, -.018], [.07, -.016, -.02], [.025, -.01, -.022]], .002);
  const pole = rod(drive, 'rotary-pole', [.18, 0, 0], [.18, .22, 0], .0045, steel);
  const tip = sphere(drive, 'rotary-tip', .015, [.18, .22, 0], finish('steel', {color: 0x88a299, roughness: .2}));
  const upright = line(drive, 'rotary-upright', [[.18, 0, 0], [.18, .22, 0]], C.amber, true);
  upright.material.dashSize = .012; upright.material.gapSize = .008;
  const reference = line(root, 'arm-target-ray', [[0, .16, 0], [.18, .16, 0]], C.amber, true);
  reference.material.dashSize = .012; reference.material.gapSize = .008;
  const target = targetMarker(root, 'arm-target', [.18, .161, 0], .019);
  const readings = [measurement('arm-angle', drive, '암 각도', 'Arm angle'), measurement('pole-angle', pivot, '직립 오차', 'Upright error', 'right')];
  return {
    root,
    camera: { position: [.66, .5, .85], target: [.04, .18, 0], span: .9 },
    readouts: () => readings,
    legend: {
      ko: '금속 암과 진자: 실제 자세 · 주황: 목표 암 각도와 직립. 암 0.18 m, 진자 0.22 m; +θ는 +α 접선 방향입니다.',
      en: 'Metal arm and pole: actual pose · amber: target arm angle and upright. Arm 0.18 m, pole 0.22 m; +θ leans along the +α tangent.'
    },
    update(state, params) {
      drive.rotation.y = state.alpha;
      const end = [.18, .22 * Math.cos(state.theta), -.22 * Math.sin(state.theta)];
      setRod(pole, [.18, 0, 0], end);
      tip.position.fromArray(end);
      const x = .18 * Math.cos(params.target), z = -.18 * Math.sin(params.target);
      target.position.set(x, .161, z);
      updateLine(reference, [[0, .16, 0], [x, .16, z]]);
      readings[0].value = `${state.alpha.toFixed(3)} rad`;
      readings[1].value = `${state.theta.toFixed(3)} rad`;
    }
  };
}

function plateScene() {
  const root = group('ball-and-plate'), aluminium = finish('aluminium'), steel = finish('steel'), dark = finish('dark-metal');
  floor(root, 1, .95);
  housing(root, 'plate-base', [.82, .035, .62], [0, .035, 0], aluminium);
  for (const x of [-.35, .35]) for (const z of [-.25, .25]) {
    cylinder(root, `plate-foot-${x}-${z}`, .023, .025, [x, .0125, z], finish('rubber'));
    cylinder(root, `plate-bolt-${x}-${z}`, .008, .006, [x, .056, z], steel);
  }
  // The external fork and nested ring make the orthogonal axes visible; the
  // running deck remains exactly 0.60 m square, rotating about Y=.28 m.
  turned(root, 'plate-pedestal', [[0, -.085], [.049, -.085], [.049, -.07], [.034, -.055], [.034, .064], [.049, .075], [.049, .085], [0, .085]], [0, .1375, 0], dark);
  flange(root, 'plate-pedestal-collar', .06, .014, [0, .077, 0], steel, .035);
  for (const x of [-.35, .35]) {
    housing(root, `gimbal-fork-${x}`, [.035, .22, .095], [x, .166, 0], aluminium);
    const bearing = flange(root, x > 0 ? 'gimbal-outer-bearing' : 'gimbal-outer-bearing-left', .033, .044, [x, .28, 0], steel, .012);
    bearing.rotation.z = Math.PI / 2;
    housing(root, `fork-gusset-${x}`, [.095, .09, .07], [x - Math.sign(x) * .025, .098, 0], dark);
  }
  const servoY = turned(root, 'plate-servo-y', [[0, -.0375], [.031, -.0375], [.036, -.031], [.036, .031], [.03, .0375], [0, .0375]], [.405, .28, 0], dark);
  servoY.rotation.z = Math.PI / 2;
  rod(root, 'plate-y-shaft', [.318, .28, 0], [.442, .28, 0], .009, steel);
  rod(root, 'plate-y-shaft-left', [-.374, .28, 0], [-.318, .28, 0], .009, steel);
  cable(root, 'plate-servo-cable', [[.42, .26, -.018], [.40, .18, -.07], [.35, .065, -.19], [.20, .061, -.24]], .005);
  const tiltY = child(root, 'plate-tilt-y', [0, .28, 0]);
  const outer = child(tiltY, 'gimbal-outer-frame');
  for (const z of [-.337, .337]) housing(outer, `gimbal-yoke-${z}`, [.69, .022, .018], [0, -.006, z], aluminium);
  for (const x of [-.337, .337]) housing(outer, `gimbal-ring-side-${x}`, [.018, .022, .66], [x, -.006, 0], aluminium);
  turnedAxle(tiltY, 'plate-servo-x', [[0, -.025], [.025, -.025], [.029, -.02], [.029, .02], [.025, .025], [0, .025]], [0, 0, .385], dark);
  axialFlange(tiltY, 'gimbal-inner-bearing', .029, .024, [0, 0, .337], steel, .009);
  axialFlange(tiltY, 'gimbal-inner-bearing-rear', .029, .024, [0, 0, -.337], steel, .009);
  rod(tiltY, 'plate-x-shaft', [0, 0, .29], [0, 0, .407], .008, steel);
  rod(tiltY, 'plate-x-shaft-rear', [0, 0, -.355], [0, 0, -.29], .008, steel);
  cable(tiltY, 'plate-inner-servo-lead', [[.015, -.012, .4], [.12, -.022, .35], [.24, -.022, .33], [.33, -.022, .18]], .003);
  const plate = child(tiltY, 'plate');
  housing(plate, 'plate-deck', [.6, .025, .6], [0, -.0125, 0], finish('aluminium', {roughness: .44}));
  housing(plate, 'plate-underside-rib', [.54, .025, .035], [0, -.038, 0], aluminium);
  housing(plate, 'plate-underside-cross-rib', [.035, .025, .54], [0, -.038, 0], aluminium);
  sphere(plate, 'plate-joint', .032, [0, -.027, 0], steel);
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
  const ball = sphere(plate, 'plate-ball', .026, [0, .026, 0], finish('steel', {roughness: .16}));
  const target = targetMarker(plate, 'plate-target', [0, .002, 0], .035);
  const readings = [measurement('position-xy', ball, '공 위치 x, y', 'Ball position x, y'), measurement('tilt-xy', plate, '기울기 βx / βy', 'Tilt βx / βy', 'right')];
  return {
    root,
    camera: { position: [.78, .62, 1.03], target: [0, .18, 0], span: 1.50 },
    readouts: () => readings,
    legend: {
      ko: '강철 공: 실제 위치 · 주황 원: 목표 위치. 각 축의 양의 기울기는 내리막이며 판의 이동 한계는 ±0.30 m입니다.',
      en: 'Steel ball: actual position · amber ring: target position. Positive axis tilt is downhill; plate travel limits are ±0.30 m.'
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
      readings[0].value = `${state.x.toFixed(3)}, ${state.y.toFixed(3)} m`;
      readings[1].value = `${tx.toFixed(3)} / ${ty.toFixed(3)} rad`;
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
