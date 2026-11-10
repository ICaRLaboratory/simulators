import * as T from '../vendor/three.js';
import { C, group, material, box, cylinder, sphere, rod, setRod, line, floor,
  targetMarker } from './primitives.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const rad = Math.PI / 180;
const cold = new T.Color(0x158e99), hot = new T.Color(0xd97442);

function mesh(parent, name, geometry, color, position = [0, 0, 0], options = {}) {
  const object = new T.Mesh(geometry, material(color, options));
  object.name = name;
  object.position.set(...position);
  object.castShadow = !options.transparent;
  object.receiveShadow = true;
  parent.add(object);
  return object;
}
function ring(parent, name, radius, tube, position, color) {
  return mesh(parent, name, new T.TorusGeometry(radius, tube, 10, 48), color, position);
}
function temperature(object, celsius, minimum = 0, maximum = 100) {
  object.material.color.copy(cold).lerp(hot, clamp((celsius - minimum) / (maximum - minimum), 0, 1));
  object.userData.temperatureC = celsius;
}
function thermometer(parent, name, x, z, bottom = .48, height = 1.65, minimum = 0, maximum = 100) {
  box(parent, `${name}-backplate`, [.36, height + .28, .08], [x, bottom + height / 2, z - .07], C.white);
  cylinder(parent, `${name}-tube`, .058, height, [x, bottom + height / 2, z], C.light,
    { transparent: true, opacity: .3, depthWrite: false });
  const column = cylinder(parent, `${name}-column`, .037, 1, [x, bottom, z], C.teal);
  sphere(parent, `${name}-bulb`, .09, [x, bottom, z], C.teal);
  const target = box(parent, `${name}-target`, [.30, .025, .035], [x, bottom, z + .07], C.amber);
  for (let i = 0; i <= 10; i++)
    box(parent, `${name}-tick-${i}`, [i % 5 === 0 ? .09 : .045, .012, .015],
      [x + .11, bottom + height * i / 10, z], C.metal);
  return (actual, reference) => {
    const level = height * clamp((actual - minimum) / (maximum - minimum), 0, 1);
    column.scale.y = Math.max(.0001, level);
    column.position.y = bottom + column.scale.y / 2;
    column.userData.temperatureC = actual;
    target.position.y = bottom + height * clamp((reference - minimum) / (maximum - minimum), 0, 1);
    target.userData.temperatureC = reference;
  };
}

function heatExchanger() {
  const root = group('heat-exchanger-rig');
  floor(root, 6.6, 3.5);
  box(root, 'equipment-skid', [5.7, .14, 2.3], [0, .08, 0], C.light);
  const apparatus = group('exchanger');
  apparatus.position.y = 1.35;
  root.add(apparatus);
  // A back half-shell and transparent front expose the static tube bundle.
  const shell = mesh(apparatus, 'exchanger-shell',
    new T.CylinderGeometry(.68, .68, 3.4, 48, 1, true, Math.PI / 2, Math.PI),
    C.metal, [0, 0, 0], { side: T.DoubleSide });
  shell.rotation.z = -Math.PI / 2;
  const window = mesh(apparatus, 'shell-cutaway-window',
    new T.CylinderGeometry(.685, .685, 3.35, 48, 1, true, -Math.PI / 2, Math.PI),
    C.white, [0, 0, 0], { transparent: true, opacity: .11, depthWrite: false, side: T.DoubleSide });
  window.rotation.z = -Math.PI / 2;
  const fluid = cylinder(apparatus, 'mixed-fluid', .53, 3.15, [0, 0, 0], C.teal,
    { transparent: true, opacity: .16, depthWrite: false });
  fluid.rotation.z = -Math.PI / 2;
  const bundle = group('tube-bundle');
  apparatus.add(bundle);
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI / 3;
    const y = i === 6 ? 0 : .32 * Math.sin(angle), z = i === 6 ? 0 : .32 * Math.cos(angle);
    rod(bundle, `heat-tube-${i}`, [-1.58, y, z], [1.58, y, z], .048, C.light);
  }
  for (const x of [-.84, 0, .84]) {
    const baffle = mesh(bundle, `baffle-${x}`, new T.CylinderGeometry(.55, .55, .035, 32, 1, false, 0, Math.PI * 1.5),
      C.metal, [x, 0, 0]);
    baffle.rotation.z = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    const flange = cylinder(apparatus, `end-flange-${side}`, .73, .12, [side * 1.7, 0, 0], C.light);
    flange.rotation.z = Math.PI / 2;
    const gasket = ring(apparatus, `flange-gasket-${side}`, .62, .025, [side * 1.77, 0, 0], C.ink);
    gasket.rotation.y = Math.PI / 2;
    for (let i = 0; i < 10; i++) {
      const angle = i * Math.PI / 5;
      const bolt = cylinder(apparatus, `flange-bolt-${side}-${i}`, .038, .17,
        [side * 1.7, .64 * Math.sin(angle), .64 * Math.cos(angle)], C.metal, { metalness: .7 });
      bolt.rotation.z = Math.PI / 2;
    }
    box(root, `saddle-${side}`, [.34, .66, 1.15], [side * 1.1, .46, 0], C.metal);
    box(root, `saddle-foot-${side}`, [.62, .08, 1.4], [side * 1.1, .19, 0], C.ink);
  }
  const inlet = rod(root, 'inlet-pipe', [-2.75, 1.35, 0], [-1.77, 1.35, 0], .13, C.teal);
  const outlet = rod(root, 'outlet-pipe', [1.77, 1.35, 0], [2.65, 1.35, 0], .13, C.teal);
  for (const x of [-2.4, 2.3]) {
    rod(root, `valve-stem-${x}`, [x, 1.35, 0], [x, 1.75, 0], .035, C.metal);
    const wheel = ring(root, `valve-handwheel-${x}`, .14, .026, [x, 1.75, 0], C.ink);
    wheel.rotation.x = Math.PI / 2;
    rod(root, `valve-spoke-${x}`, [x - .14, 1.75, 0], [x + .14, 1.75, 0], .014, C.ink);
  }
  const jacket = group('heating-jacket');
  root.add(jacket);
  rod(jacket, 'heat-input-header', [-2.3, 2.28, -.38], [2.3, 2.28, -.38], .065, C.metal);
  for (const x of [-1.1, 1.1]) {
    rod(jacket, `heat-input-riser-${x}`, [x, 1.86, -.38], [x, 2.28, -.38], .065, C.metal);
    cylinder(jacket, `heater-port-${x}`, .12, .16, [x, 1.96, -.38], C.light);
  }
  box(root, 'heater-power-backplate', [.3, 1.15, .1], [-2.5, .8, .8], C.white);
  const power = box(root, 'heater-power', [.13, 1, .055], [-2.5, .3, .89], C.amber);
  const gauge = thermometer(root, 'temperature', 2.45, .85);
  return {
    root,
    camera: { position: [6.54, 4.31, 8.05], target: [.04, 1.06, .05], span: 6.4 },
    legend: {
      ko: '절개 열교환기 · 청록: 혼합 출구 온도 · 황색: 목표/열입력 · 유체 색: 온도 · 가열측 동특성은 생략합니다.',
      en: 'Cutaway exchanger · teal: mixed outlet temperature · amber: target / heat input · fluid tint: temperature. No hot-side dynamics.',
    },
    update(state, params) {
      temperature(fluid, state.temperature);
      temperature(inlet, params.inlet + (params.load ?? state.load ?? 0));
      temperature(outlet, state.temperature);
      gauge(state.temperature, params.target);
      power.scale.y = clamp(state.heat / 150, 0, 1);
      power.position.y = .3 + power.scale.y / 2;
      power.visible = state.heat > 0;
      power.userData.heatKW = state.heat;
    },
  };
}

function stirredTank() {
  const root = group('cstr-rig');
  floor(root, 5.7, 3.8);
  box(root, 'reactor-skid', [4.9, .14, 2.8], [0, .07, 0], C.light);
  for (const x of [-.6, .6]) for (const z of [-.45, .45]) {
    cylinder(root, `reactor-leg-${x}-${z}`, .07, .65, [x, .46, z], C.metal);
    box(root, `reactor-foot-${x}-${z}`, [.3, .06, .3], [x, .17, z], C.ink);
  }
  mesh(root, 'jacket-back-shell', new T.CylinderGeometry(.88, .88, 1.85, 48, 1, true, Math.PI / 2, Math.PI),
    C.metal, [0, 1.65, 0], { side: T.DoubleSide });
  const jacket = mesh(root, 'cooling-jacket',
    new T.CylinderGeometry(.86, .86, 1.85, 48, 1, true, -Math.PI / 2, Math.PI), C.blue,
    [0, 1.65, 0], { transparent: true, opacity: .18, depthWrite: false, side: T.DoubleSide });
  mesh(root, 'reactor-vessel', new T.CylinderGeometry(.67, .67, 1.8, 48, 1, true), C.white,
    [0, 1.65, 0], { transparent: true, opacity: .12, depthWrite: false, side: T.DoubleSide });
  const fluid = cylinder(root, 'reactor-fluid', .625, 1.18, [0, 1.34, 0], C.teal,
    { transparent: true, opacity: .25, depthWrite: false });
  fluid.userData.volumeLitres = 100;
  cylinder(root, 'fluid-surface', .626, .017, [0, 1.93, 0], C.teal,
    { transparent: true, opacity: .45, depthWrite: false });
  for (const y of [.72, 2.57]) {
    cylinder(root, `vessel-lid-${y}`, .88, .13, [0, y, 0], C.light);
    const rim = ring(root, `vessel-rim-${y}`, .87, .035, [0, y, 0], C.metal);
    rim.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      cylinder(root, `lid-bolt-${y}-${i}`, .033, .16, [.77 * Math.cos(a), y, .77 * Math.sin(a)], C.ink);
    }
  }
  for (const x of [-.5, .5])
    box(root, `mixing-baffle-${x}`, [.05, 1.4, .24], [x, 1.53, -.16], C.light);
  const mixer = group('mixer');
  root.add(mixer);
  cylinder(mixer, 'agitator-shaft', .036, 1.9, [0, 1.95, 0], C.metal);
  for (const y of [1.03, 1.56]) {
    cylinder(mixer, `impeller-hub-${y}`, .1, .11, [0, y, 0], C.ink);
    for (let i = 0; i < 4; i++) {
      const paddle = box(mixer, `impeller-${y}-${i}`, [.4, .07, .12], [0, y, 0], C.metal);
      paddle.rotation.y = i * Math.PI / 2;
      paddle.position.x = .2 * Math.cos(paddle.rotation.y);
      paddle.position.z = -.2 * Math.sin(paddle.rotation.y);
      paddle.rotation.z = .15;
    }
  }
  cylinder(root, 'motor-mount', .25, .21, [0, 2.78, 0], C.ink);
  cylinder(root, 'mixer-motor', .23, .48, [0, 3.1, 0], C.metal);
  for (let i = 0; i < 6; i++)
    cylinder(root, `motor-cooling-fin-${i}`, .26, .023, [0, 2.9 + i * .065, 0], C.ink);
  cylinder(root, 'motor-cap', .24, .05, [0, 3.36, 0], C.light);
  rod(root, 'feed-pipe', [-2.3, 2.85, 0], [-.43, 2.85, 0], .075, C.metal);
  rod(root, 'feed-downcomer', [-.43, 2.85, 0], [-.43, 2.35, 0], .075, C.metal);
  const product = rod(root, 'product-pipe', [.66, 1.07, 0], [2.3, 1.07, 0], .085, C.teal);
  const coolantIn = rod(root, 'coolant-inlet', [-2.3, 1.05, -.18], [-.84, 1.05, -.18], .065, C.blue);
  const coolantOut = rod(root, 'coolant-outlet', [.84, 2.2, -.18], [2.3, 2.2, -.18], .065, C.blue);
  for (const [x, y] of [[-1.5, 1.05], [1.6, 2.2]]) {
    rod(root, `coolant-valve-stem-${x}`, [x, y, -.18], [x, y + .25, -.18], .025, C.ink);
    const valve = ring(root, `coolant-valve-${x}`, .12, .024, [x, y + .25, -.18], C.blue);
    valve.rotation.x = Math.PI / 2;
  }
  const gauge = thermometer(root, 'reactor-temperature', 1.5, 1.03, .5, 1.65, 40, 130);
  box(root, 'concentration-backplate', [.34, 1.85, .08], [-1.5, 1.3, .96], C.white);
  const concentration = cylinder(root, 'concentration-column', .055, 1, [-1.5, .5, 1.03], C.teal);
  const feedMarker = box(root, 'feed-concentration-marker', [.27, .025, .04], [-1.5, .5, 1.12], C.amber);
  for (let i = 0; i <= 8; i++)
    box(root, `concentration-tick-${i}`, [.07, .012, .015], [-1.38, .5 + i * .2, 1.03], C.metal);
  return {
    root,
    camera: { position: [6.24, 4.35, 8.56], target: [.04, 1.4, .06], span: 7.1 },
    legend: {
      ko: '절개 반응기 · 일정 체적 100 L · 청록 농도/온도계 · 재킷 색: 냉각수 온도 · 황색: 목표/공급 농도 · 교반기는 고정 도식입니다.',
      en: 'Cutaway CSTR · fixed 100 L fill · teal: concentration / thermometer · jacket tint: coolant temperature · amber: target / feed. Static mixer schematic.',
    },
    update(state, params) {
      const celsius = state.temperature - 273.15, coolant = state.coolant - 273.15;
      fluid.material.opacity = .18 + .36 * clamp(state.concentration / 2, 0, 1);
      fluid.userData.concentration = state.concentration;
      temperature(product, celsius, 40, 130);
      temperature(jacket, coolant, 0, 60);
      temperature(coolantIn, coolant, 0, 60);
      temperature(coolantOut, coolant, 0, 60);
      gauge(celsius, params.target);
      concentration.scale.y = Math.max(.0001, clamp(state.concentration / 2, 0, 1) * 1.6);
      concentration.position.y = .5 + concentration.scale.y / 2;
      feedMarker.position.y = .5 + clamp((params.feed + (params.load ?? state.load ?? 0)) / 2, 0, 1) * 1.6;
    },
  };
}

function arrow(parent, name, color = C.teal, radius = .023) {
  const object = group(name);
  parent.add(object);
  cylinder(object, `${name}-shaft`, radius, .78, [0, .39, 0], color);
  mesh(object, `${name}-head`, new T.ConeGeometry(radius * 3.5, .22, 16), color, [0, .89, 0]);
  return object;
}
function coil(parent, name, x, z, radius, turns, wire = .025) {
  const points = [];
  for (let i = 0; i <= 160; i++) {
    const t = i / 160, taper = Math.min(1, t * 20, (1 - t) * 20);
    points.push(new T.Vector3(radius * Math.cos(t * turns * Math.PI * 2) * taper,
      t, radius * Math.sin(t * turns * Math.PI * 2) * taper));
  }
  return mesh(parent, name, new T.TubeGeometry(new T.CatmullRomCurve3(points), 160, wire, 8, false),
    C.metal, [x, 0, z]);
}

function quarterCar() {
  const root = group('quarter-car-rig');
  floor(root, 5.4, 3.2);
  const body = group('sprung-body'), wheel = group('wheel-assembly'), road = group('road-platform');
  root.add(body, wheel, road);
  box(body, 'chassis-main', [3, .42, .94], [0, 0, 0], C.teal);
  box(body, 'chassis-top-flange', [3.18, .08, 1.08], [0, .24, 0], C.light);
  box(body, 'chassis-lower-rail', [3.12, .08, 1.02], [0, -.25, 0], C.ink);
  for (const x of [-1.33, 1.33]) {
    box(body, `chassis-end-plate-${x}`, [.2, .42, .99], [x, 0, 0], C.metal);
    for (const y of [-.11, .11]) {
      const bolt = cylinder(body, `chassis-fastener-${x}-${y}`, .034, .06, [x, y, .52], C.ink);
      bolt.rotation.x = Math.PI / 2;
    }
  }
  box(wheel, 'axle-crossmember', [2.35, .12, .38], [0, .35, 0], C.light);
  box(wheel, 'hub-knuckle', [.22, .45, .24], [0, .11, -.1], C.metal);
  const tire = ring(wheel, 'tire', .39, .13, [0, 0, .2], C.ink);
  tire.scale.z = 1.45;
  const rim = cylinder(wheel, 'wheel-rim', .31, .25, [0, 0, .25], C.light);
  rim.rotation.x = Math.PI / 2;
  const hub = cylinder(wheel, 'wheel-hub', .09, .33, [0, 0, .3], C.metal);
  hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    rod(wheel, `wheel-spoke-${i}`, [.1 * Math.cos(a), .1 * Math.sin(a), .4],
      [.27 * Math.cos(a), .27 * Math.sin(a), .4], .026, C.ink);
  }
  box(road, 'road-slab', [4.3, .14, 1.6], [0, -.07, 0], C.light);
  box(road, 'road-input-strip', [4.3, .018, .055], [0, .006, .83], C.amber);
  for (let i = 0; i < 13; i++) {
    const hatch = box(road, `road-hatch-${i}`, [.025, .08, .02], [-2 + i / 3, -.07, .815], C.metal);
    hatch.rotation.z = -.4;
  }
  const spring = coil(root, 'suspension-spring', -.82, 0, .18, 8, .032);
  const tireSpring = coil(root, 'tire-spring', 0, .2, .105, 4, .02);
  const housing = cylinder(wheel, 'damper-housing', .13, 1.1, [0, .75, 0], C.light,
    { transparent: true, opacity: .35, depthWrite: false });
  for (const y of [.2, 1.3]) cylinder(wheel, `damper-collar-${y}`, .15, .07, [0, y, 0], C.ink);
  const piston = cylinder(body, 'damper-piston', .105, .075, [0, -1.1, 0], C.metal);
  rod(body, 'damper-rod', [0, -.25, 0], [0, -1.1, 0], .037, C.metal);
  const actuator = cylinder(wheel, 'active-actuator', .13, .68, [.82, .55, 0], C.teal);
  for (let i = 0; i < 5; i++) cylinder(wheel, `actuator-band-${i}`, .139, .025, [.82, .32 + .11 * i, 0], C.ink);
  const activeRod = rod(root, 'actuator-rod', [.82, 1, 0], [.82, 2, 0], .04, C.metal);
  for (const x of [-.82, 0, .82]) {
    cylinder(body, `upper-mount-${x}`, .15, .07, [x, -.25, 0], C.metal);
    cylinder(wheel, `lower-mount-${x}`, .15, .07, [x, .35, 0], C.metal);
  }
  const bodyForce = arrow(root, 'body-force'), wheelForce = arrow(root, 'wheel-force');
  bodyForce.position.set(1.55, 0, .4); wheelForce.position.set(1.55, 0, .4);
  return {
    root,
    camera: { position: [5.5, 3.76, 8.53], target: [0, 1.56, .03], span: 6.6 },
    legend: {
      ko: '1/4 차량 · 차체/휠 변위는 평형점 기준의 확대 도식 · 청록: 능동 힘(반대 방향) · 황색: 노면 입력 · 휠 회전은 모델링하지 않습니다.',
      en: 'Quarter car · bounded, magnified displacement from equilibrium · teal: equal/opposite active forces · amber: road input. No wheel-rotation state.',
    },
    update(state, params) {
      body.position.y = 2.9 + .25 * Math.tanh(state.zs * 8);
      wheel.position.y = 1.05 + .25 * Math.tanh(state.zu * 8);
      body.userData.displacementM = state.zs;
      wheel.userData.displacementM = state.zu;
      const q = state.distance - state.bumpStart;
      const input = q >= 0 && q <= 2 ? params.height * (1 - Math.cos(Math.PI * q)) / 2 : 0;
      road.position.y = .18 + .25 * Math.tanh(input * 8);
      road.userData.road = input;
      spring.position.y = wheel.position.y + .35;
      spring.scale.y = body.position.y - .25 - spring.position.y;
      tireSpring.position.y = road.position.y;
      tireSpring.scale.y = wheel.position.y - .46 - road.position.y;
      setRod(activeRod, [.82, wheel.position.y + .89, 0], [.82, body.position.y - .25, 0]);
      const force = clamp(-params.gain * state.vs, -1500, 1500);
      for (const [indicator, direction, y] of [[bodyForce, 1, body.position.y - .5], [wheelForce, -1, wheel.position.y + .5]]) {
        indicator.position.y = y;
        indicator.rotation.z = force * direction < 0 ? Math.PI : 0;
        indicator.scale.y = Math.abs(force) / 1500 * .65;
        indicator.visible = force !== 0;
        indicator.userData.forceN = force * direction;
      }
      // Fixed-size cylinder and body-mounted piston retain their mechanical connection.
      housing.userData.damping = params.damping;
      actuator.userData.forceN = force;
      piston.userData.relativeTravelM = state.zs - state.zu;
    },
  };
}

function quadcopter() {
  const root = group('drone-rig');
  floor(root, 7, 4.3);
  const frame = group('flight-frame'), pose = group('drone-pose'), airframe = group('drone-airframe');
  root.add(frame); frame.add(pose); pose.add(airframe);
  // Only the apparatus is magnified; position/altitude stay in model metres.
  airframe.scale.setScalar(4);
  box(airframe, 'avionics-body', [.24, .085, .27], [0, 0, 0], C.ink);
  box(airframe, 'flight-controller-cover', [.2, .025, .23], [0, .052, 0], C.light);
  box(airframe, 'battery-pack', [.13, .045, .18], [0, .087, 0], C.teal);
  box(airframe, 'battery-strap', [.032, .051, .185], [0, .087, 0], C.ink);
  for (const [side, x] of [['left', -.25], ['right', .25]]) {
    for (const [depth, z] of [['front', .19], ['rear', -.19]]) {
      const key = `${side}-${depth}`;
      rod(airframe, `rotor-arm-${key}`, [Math.sign(x) * .06, 0, Math.sign(z) * .06], [x, 0, z], .023, C.ink);
      rod(airframe, `arm-top-rail-${key}`, [Math.sign(x) * .06, .02, Math.sign(z) * .06], [x, .02, z], .009, C.metal);
      cylinder(airframe, `motor-pod-${key}`, .036, .065, [x, .035, z], C.metal);
      cylinder(airframe, `motor-cap-${key}`, .031, .016, [x, .076, z], C.ink);
      cylinder(airframe, `rotor-disc-${key}`, .126, .006, [x, .09, z], C.light,
        { transparent: true, opacity: .42, depthWrite: false });
      const rim = ring(airframe, `rotor-swept-rim-${key}`, .126, .003, [x, .09, z], C.metal);
      rim.rotation.x = Math.PI / 2;
      box(airframe, `static-blade-${key}`, [.23, .007, .019], [x, .095, z], C.metal);
      cylinder(airframe, `rotor-hub-${key}`, .014, .02, [x, .102, z], C.teal);
    }
    for (const z of [-.10, .10])
      rod(airframe, `landing-strut-${side}-${z}`, [Math.sign(x) * .075, -.025, z], [Math.sign(x) * .14, -.15, z], .012, C.metal);
    rod(airframe, `landing-skid-${side}`, [Math.sign(x) * .14, -.15, -.17], [Math.sign(x) * .14, -.15, .17], .015, C.ink);
  }
  sphere(airframe, 'underside-sensor', .027, [0, -.065, .07], C.ink);
  sphere(airframe, 'sensor-lens', .013, [0, -.077, .09], C.blue);
  const left = arrow(pose, 'left-pair-thrust'), right = arrow(pose, 'right-pair-thrust');
  left.position.set(-1, .5, 0); right.position.set(1, .5, 0);
  const altitude = line(root, 'altitude-target', [[-2.6, 0, -.75], [2.6, 0, -.75]], C.amber, true);
  const roll = line(root, 'roll-target', [[-1.15, 0, -.8], [1.15, 0, -.8]], C.amber, true);
  const plumb = rod(root, 'altitude-plumb', [0, 0, -.8], [0, 1, -.8], .008, C.teal);
  targetMarker(root, 'ground-projection', [0, .012, -.8], .14, C.teal);
  rod(root, 'altitude-scale', [-2.7, 0, -.75], [-2.7, 5.5, -.75], .012, C.metal);
  for (let i = 0; i <= 11; i++)
    line(root, `altitude-tick-${i}`, [[-2.7, i / 2, -.75], [-2.7 + (i % 2 ? .1 : .2), i / 2, -.75]], C.metal);
  const groundMarks = [];
  for (let i = 0; i < 14; i++) groundMarks.push(box(root, `ground-mark-${i}`, [.022, .015, 2.8], [i / 2 - 3.5, .01, 0], C.metal));
  return {
    root,
    camera: { position: [5.9, 4.9, 9.8], target: [.2, 3.25, -.2], span: 12 },
    legend: {
      ko: 'x-z 평면 · 수평 추적 시점 · 기체만 4배 확대 · 청록: 좌/우 로터 쌍의 합 추력 · 황색: 고도/롤 목표 · 로터 회전은 도식입니다.',
      en: 'Planar x-z motion · horizontal follow · airframe enlarged 4x · teal: left/right rotor-pair thrust sums · amber: altitude/roll targets. Static rotor discs.',
    },
    update(state, params) {
      pose.position.set(state.x, state.z, 0);
      pose.rotation.z = state.roll;
      frame.position.x = -state.x;
      altitude.position.y = params.altitude;
      roll.position.y = state.z;
      roll.rotation.z = params.rollTarget;
      setRod(plumb, [0, 0, -.8], [0, state.z, -.8]);
      for (const [indicator, thrust] of [[left, state.left], [right, state.right]]) {
        indicator.visible = thrust > 0;
        indicator.scale.y = clamp(thrust / 10, 0, 1);
        indicator.userData.pairThrustN = thrust;
      }
      const offset = ((state.x % .5) + .5) % .5;
      groundMarks.forEach((mark, i) => { mark.position.x = i / 2 - 3.25 - offset; });
    },
  };
}

function plate(parent, name, points, thickness, color, horizontal = true) {
  const shape = new T.Shape();
  points.forEach(([x, y], i) => i ? shape.lineTo(x, y) : shape.moveTo(x, y));
  shape.closePath();
  const geometry = new T.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false });
  geometry.translate(0, 0, -thickness / 2);
  if (horizontal) geometry.rotateX(Math.PI / 2);
  return mesh(parent, name, geometry, color);
}

function aircraft() {
  const root = group('aircraft-pitch-rig');
  floor(root, 6, 4.7);
  const pose = group('aircraft-pose');
  pose.position.y = 2;
  root.add(pose);
  const profile = [[.025, -1.85], [.09, -1.62], [.16, -1.25], [.20, -.7], [.21, .6], [.18, 1.05], [.10, 1.45], [0, 1.65]];
  const hull = new T.LatheGeometry(profile.map(([radius, x]) => new T.Vector2(radius, x)), 48);
  hull.rotateZ(-Math.PI / 2);
  mesh(pose, 'fuselage', hull, C.white);
  const nose = group('nose-tip'); nose.position.x = 1.65; pose.add(nose);
  const cockpit = sphere(pose, 'cockpit-glazing', 1, [.93, .13, 0], C.ink);
  cockpit.scale.set(.30, .105, .18);
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? 'left' : 'right';
    plate(pose, `main-wing-${sideName}`,
      [[.3, side * .13], [-.30, side * 1.65], [-.79, side * 1.61], [-.54, side * .13]], .055, C.light);
    plate(pose, `wing-tip-${sideName}`,
      [[-.30, side * 1.52], [-.35, side * 1.65], [-.79, side * 1.61], [-.77, side * 1.49]], .06, C.teal);
    plate(pose, `horizontal-tail-${sideName}`,
      [[-1.17, side * .07], [-1.44, side * .68], [-1.62, side * .65], [-1.62, side * .07]], .04, C.light);
    for (let i = 0; i < 7; i++) {
      const window = sphere(pose, `cabin-window-${sideName}-${i}`, .038, [.55 - i * .2, .075, side * .19], C.ink);
      window.scale.set(.85, 1, .25);
    }
    rod(pose, `attitude-stripe-${sideName}`, [-1.24, -.015, side * .16], [1.17, -.015, side * .16], .018, C.teal);
    box(pose, `engine-pylon-${sideName}`, [.22, .2, .055], [-.05, -.12, side * .7], C.metal);
    const nacelle = cylinder(pose, `engine-nacelle-${sideName}`, .1, .48, [.04, -.24, side * .7], C.metal);
    nacelle.rotation.z = Math.PI / 2;
    const intake = cylinder(pose, `engine-intake-${sideName}`, .075, .012, [.286, -.24, side * .7], C.ink);
    intake.rotation.z = Math.PI / 2;
    const intakeRim = ring(pose, `engine-rim-${sideName}`, .09, .014, [.29, -.24, side * .7], C.light);
    intakeRim.rotation.y = Math.PI / 2;
  }
  plate(pose, 'vertical-tail', [[-1.7, .11], [-1.66, .75], [-1.38, .75], [-.98, .12]], .055, C.metal, false);
  plate(pose, 'tail-identification-panel', [[-1.65, .32], [-1.62, .66], [-1.4, .66], [-1.17, .32]], .06, C.teal, false);
  const elevator = group('elevator-hinge');
  elevator.position.set(-1.62, .015, 0);
  pose.add(elevator);
  plate(elevator, 'elevator-surface', [[0, -.65], [-.23, -.62], [-.23, .62], [0, .65]], .035, C.teal);
  rod(pose, 'elevator-hinge-pin', [-1.62, .015, -.65], [-1.62, .015, .65], .013, C.ink);
  const target = line(root, 'pitch-target', [[-2.3, 0, -.85], [2.3, 0, -.85]], C.amber, true);
  target.position.y = 2;
  const horizon = line(root, 'horizon-reference', [[-2.6, 0, -.9], [2.6, 0, -.9]], C.metal);
  horizon.position.y = 2;
  const path = line(root, 'flight-path-reference', [[-1.9, 0, .9], [1.9, 0, .9]], C.blue, true);
  path.position.y = 2;
  const arc = [];
  for (let i = -30; i <= 30; i++) arc.push([2.3 * Math.cos(i * rad), 2 + 2.3 * Math.sin(i * rad), -.85]);
  line(root, 'pitch-protractor', arc, C.metal);
  for (let i = -30; i <= 30; i += 5) {
    const a = i * rad, radius = i % 10 === 0 ? 2.16 : 2.23;
    line(root, `pitch-tick-${i}`, [[radius * Math.cos(a), 2 + radius * Math.sin(a), -.85],
      [2.3 * Math.cos(a), 2 + 2.3 * Math.sin(a), -.85]], C.metal);
  }
  return {
    root,
    camera: { position: [5.64, 3.83, 8.82], target: [.24, 1.93, -.18], span: 5.3 },
    legend: {
      ko: '종방향 트림 모델 · 청록: 피치/승강타 · 황색: 목표 피치 · 청색: 비행 경로각 θ−α · 속도/고도 운동은 생략합니다.',
      en: 'Longitudinal trim model · teal: pitch / elevator · amber: pitch target · blue: flight-path angle theta-alpha. No airspeed or altitude dynamics.',
    },
    update(state, params) {
      pose.rotation.z = state.theta;
      elevator.rotation.z = -state.elevator;
      target.rotation.z = params.target * rad;
      path.rotation.z = state.theta - state.alpha;
      pose.userData.pitchRate = state.q;
    },
  };
}

function rocketHardware(parent, prefix = '') {
  const pose = group(prefix ? `${prefix}pose` : 'rocket-pose');
  parent.add(pose);
  cylinder(pose, `${prefix}rocket-body`, .52, 1.92, [0, .16, 0], C.light);
  cylinder(pose, `${prefix}body-band`, .526, .35, [0, .325, 0], C.teal);
  mesh(pose, `${prefix}nose-cone`, new T.ConeGeometry(.52, .88, 48), C.teal, [0, 1.56, 0]);
  const nose = group(`${prefix}nose-tip`); nose.position.y = 2; pose.add(nose);
  cylinder(pose, `${prefix}engine-deck`, .55, .14, [0, -.73, 0], C.ink);
  for (const y of [-.5, .87, 1.12]) {
    const seam = ring(pose, `${prefix}tank-seam-${y}`, .523, .017, [0, y, 0], C.metal);
    seam.rotation.x = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    rod(pose, `${prefix}body-rail-${side}`, [side * .35, -.6, .39], [side * .35, .95, .39], .024, C.metal);
    for (const y of [-.5, .6, .9]) sphere(pose, `${prefix}rail-fastener-${side}-${y}`, .028, [side * .35, y, .42], C.ink);
  }
  const window = cylinder(pose, `${prefix}service-port`, .12, .025, [0, .77, .52], C.ink);
  window.rotation.x = Math.PI / 2;
  const ports = [];
  for (const [name, side] of [['left', -1], ['right', 1]]) {
    const foot = group(`${prefix}${name}-foot`);
    foot.position.set(side * .9, -1.5, 0); pose.add(foot);
    rod(pose, `${prefix}${name}-landing-strut`, [side * .42, -.45, 0], [side * .88, -1.45, 0], .045, C.ink);
    rod(pose, `${prefix}${name}-landing-brace`, [side * .5, -1.05, 0], [side * .88, -1.45, 0], .027, C.metal);
    box(pose, `${prefix}${name}-footpad`, [.22, .05, .42], [side * .79, -1.475, 0], C.ink);
    sphere(pose, `${prefix}${name}-leg-pivot`, .07, [side * .42, -.45, 0], C.metal);
    const engine = group(`${prefix}${name}-engine`);
    engine.position.set(side * .6, -1.1, 0); pose.add(engine);
    mesh(engine, `${prefix}${name}-nozzle-bell`, new T.CylinderGeometry(.13, .22, .45, 32, 1, true),
      C.metal, [0, .225, 0], { side: T.DoubleSide, metalness: .7 });
    const lip = ring(engine, `${prefix}${name}-nozzle-rim`, .22, .022, [0, .01, 0], C.ink);
    lip.rotation.x = Math.PI / 2;
    cylinder(engine, `${prefix}${name}-combustion-chamber`, .12, .25, [0, .51, 0], C.ink);
    const flameGeometry = new T.ConeGeometry(.18, 1, 32);
    flameGeometry.rotateZ(Math.PI); flameGeometry.translate(0, -.5, 0);
    const flame = mesh(engine, `${prefix}${name}-plume`, flameGeometry, C.amber, [0, 0, 0],
      { emissive: C.amber, emissiveIntensity: .5, transparent: true, opacity: .78, depthWrite: false });
    const coreGeometry = new T.ConeGeometry(.09, 1, 24);
    coreGeometry.rotateZ(Math.PI); coreGeometry.translate(0, -.5, 0);
    const core = mesh(engine, `${prefix}${name}-plume-core`, coreGeometry, 0xffe4aa, [0, 0, .015],
      { emissive: 0xffd486, emissiveIntensity: .7, transparent: true, opacity: .95, depthWrite: false });
    const thrust = arrow(pose, `${prefix}${name}-thrust`, C.teal, .022);
    thrust.position.set(side * 1.15, -.65, 0);
    ports.push({ flame, core, thrust });
  }
  return {
    pose,
    update(state) {
      // Rocket theta is clockwise from upright, unlike drone roll.
      pose.rotation.z = -state.theta;
      ports.forEach(({ flame, core, thrust }, i) => {
        const value = i === 0 ? state.left : state.right;
        const fraction = clamp(value / 12, 0, 1);
        flame.visible = core.visible = thrust.visible = value > 0;
        flame.scale.y = fraction * 1.6;
        core.scale.y = fraction * 1.04;
        thrust.scale.y = fraction * 1.2;
        thrust.userData.thrustN = value;
      });
    },
  };
}

function rocketLander() {
  const root = group('rocket-landing-rig');
  floor(root, 35, 10);
  const hardware = rocketHardware(root);
  const pad = group('landing-pad');
  root.add(pad);
  cylinder(pad, 'landing-deck', 1.7, .16, [0, -.08, 0], C.metal);
  const rim = ring(pad, 'landing-deck-rim', 1.55, .055, [0, .015, 0], C.amber);
  rim.rotation.x = Math.PI / 2;
  box(pad, 'pad-acceptance-strip', [1.6, .018, .12], [0, .012, .5], C.amber);
  targetMarker(pad, 'pad-crosshair', [0, .015, 0], .65, C.amber);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6;
    const marker = box(pad, `pad-perimeter-${i}`, [.18, .02, .3], [1.3 * Math.cos(a), .015, 1.3 * Math.sin(a)], C.light);
    marker.rotation.y = -a;
  }
  const target = line(root, 'pad-target', [[0, 0, -.35], [0, 23, -.35]], C.amber, true);
  line(root, 'ground-datum', [[-15, .01, 0], [15, .01, 0]], C.metal);
  for (let i = 0; i <= 12; i++)
    line(root, `height-tick-${i}`, [[-14.5, i * 2, -.35], [-14, i * 2, -.35]], C.metal);
  line(root, 'height-scale', [[-14.5, 0, -.35], [-14.5, 24, -.35]], C.metal);
  // Same geometry and pose, enlarged at a fixed location; never a second simulated body.
  const detail = group('attitude-detail');
  detail.position.set(13, 13, 0); detail.scale.setScalar(2.3); root.add(detail);
  box(detail, 'detail-backplate', [4.2, 6, .1], [0, -.4, -.85], C.white);
  line(detail, 'detail-border', [[-2.1, -3.4, -.77], [2.1, -3.4, -.77], [2.1, 2.6, -.77], [-2.1, 2.6, -.77], [-2.1, -3.4, -.77]], C.metal);
  const enlarged = rocketHardware(detail, 'detail-');
  return {
    root,
    camera: { position: [20, 20, 60], target: [2, 12, 0], span: 45 },
    legend: {
      ko: '평면 착륙 · 왼쪽: 고정 축척 궤적 · 오른쪽: 동일 자세 2.3배 확대 · 황색: 착륙 패드 · 불꽃 길이: 실제 추력 · 노즐은 고정입니다.',
      en: 'Planar landing · left: fixed-scale flight · right: same attitude enlarged 2.3x · amber: landing pad · plume length: actual thrust. Fixed nozzles.',
    },
    update(state, params) {
      hardware.pose.position.set(state.x, state.y, 0);
      hardware.update(state); enlarged.update(state);
      pad.position.x = target.position.x = params.targetX;
    },
  };
}

export function createProcessScene(id) {
  if (id === 'heat-exchanger') return heatExchanger();
  if (id === 'cstr') return stirredTank();
  if (id === 'suspension') return quarterCar();
  if (id === 'drone') return quadcopter();
  if (id === 'aircraft-pitch') return aircraft();
  if (id === 'rocket-landing') return rocketLander();
  return null;
}
