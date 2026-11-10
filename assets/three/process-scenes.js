import * as T from '../vendor/three.js';
import { C, group, material, box, cylinder, sphere, rod, setRod, line, floor,
  targetMarker } from './primitives.js';
import { finish, housing, turned, flange, fasteners, cable } from './engineering.js';

function pipe(parent, name, points, radius, surface) {
  const geometry = new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p => new T.Vector3(...p))), 48, radius, 12, false);
  return mesh(parent, name, geometry, surface);
}
function perforatedDisc(radius, holes, depth, cut = radius) {
  const shape = new T.Shape();
  for (let i = 0; i <= 64; i++) {
    const a = i * Math.PI / 32, x = radius * Math.cos(a), y = Math.min(cut, radius * Math.sin(a));
    if (i) shape.lineTo(x, y); else shape.moveTo(x, y);
  }
  shape.closePath();
  for (const [x, y, r] of holes) {
    const hole = new T.Path(); hole.absarc(x, y, r, 0, 2 * Math.PI, true); shape.holes.push(hole);
  }
  const geometry = new T.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: 12 });
  geometry.translate(0, 0, -depth / 2); geometry.rotateY(Math.PI / 2);
  return geometry;
}
function annotation(id, anchor, ko, en, side) {
  return { id, anchor, label: { ko, en }, side, value: '' };
}

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
  const steel = finish('steel'), aluminium = finish('aluminium'), copper = finish('copper');
  const coating = finish('paint', { color: 0x65716e }), dark = finish('dark-metal');
  floor(root, 6.6, 3.5);
  housing(root, 'equipment-skid', [5.7, .10, 2.3], [0, .10, 0], aluminium);
  for (const [name, z] of [['front', .98], ['rear', -.98]])
    housing(root, `skid-rail-${name}`, [5.7, .15, .13], [0, .2, z], coating);
  for (const x of [-2.55, 2.55]) housing(root, `skid-crossmember-${x}`, [.16, .15, 2.1], [x, .2, 0], coating);
  const apparatus = group('exchanger'); apparatus.position.y = 1.35; root.add(apparatus);
  // The front half is a presentation cutaway; the rear retains a real wall thickness.
  const shell = mesh(apparatus, 'exchanger-shell', new T.LatheGeometry(
    [[.65,-1.65],[.68,-1.65],[.68,1.65],[.65,1.65]].map(p => new T.Vector2(...p)), 64, Math.PI / 2, Math.PI),
    finish('steel', { side: T.DoubleSide }));
  shell.rotation.z = -Math.PI / 2;
  const window = mesh(apparatus, 'shell-cutaway-window',
    new T.CylinderGeometry(.685, .685, 3.3, 48, 1, true, -Math.PI / 2, Math.PI),
    finish('glass', { opacity: .08, side: T.DoubleSide }));
  window.rotation.z = -Math.PI / 2;
  const fluid = cylinder(apparatus, 'mixed-fluid', .54, 3.15, [0, 0, 0],
    finish('glass', { color: C.teal, opacity: .08 }));
  fluid.rotation.z = -Math.PI / 2;
  const bundle = group('tube-bundle'); apparatus.add(bundle);
  const holes = [];
  for (let i = 0; i < 7; i++) {
    const angle = i * Math.PI / 3;
    const y = i === 6 ? 0 : .32 * Math.sin(angle), z = i === 6 ? 0 : .32 * Math.cos(angle);
    rod(bundle, `heat-tube-${i}`, [-1.66, y, z], [1.66, y, z], .048, copper);
    holes.push([-z, y, .053]);
  }
  for (const [i, x] of [-.84, 0, .84].entries()) {
    const baffle = mesh(bundle, `baffle-${x}`, perforatedDisc(.57, holes, .025, .43), aluminium, [x, 0, 0]);
    if (i % 2) baffle.rotation.x = Math.PI;
  }
  for (const side of [-1, 1]) {
    mesh(apparatus, `tube-sheet-${side}`, perforatedDisc(.64, holes, .065), steel, [side * 1.62, 0, 0]);
    const rim = flange(apparatus, `end-flange-${side}`, .74, .115, [side * 1.70, 0, 0], steel, .59);
    rim.rotation.z = Math.PI / 2;
    const bolts = fasteners(apparatus, `flange-fasteners-${side}`, .676, [side * 1.78, 0, 0], 12, .033);
    bolts.rotation.z = -side * Math.PI / 2;
    const head = turned(apparatus, `channel-head-${side}`, [[.59,0],[.63,.04],[.60,.15],[.47,.29],[.23,.37],[.13,.40]],
      [side * 1.77, 0, 0], steel);
    head.rotation.z = -side * Math.PI / 2;
    const gasket = ring(apparatus, `flange-gasket-${side}`, .625, .018, [side * 1.765, 0, 0], finish('rubber'));
    gasket.rotation.y = Math.PI / 2;
    housing(root, `saddle-${side}`, [.28, .55, .97], [side * 1.1, .5, 0], coating);
    housing(root, `saddle-foot-${side}`, [.55, .07, 1.32], [side * 1.1, .27, 0], dark);
    const strap = mesh(root, `saddle-cradle-${side}`, new T.TorusGeometry(.695,.045,8,32,Math.PI), steel,
      [side * 1.1, 1.35, 0]);
    strap.rotation.y = Math.PI / 2; strap.rotation.x = Math.PI;
    for (const z of [-.55,.55]) fasteners(root, `saddle-anchor-${side}-${z}`, .09, [side * 1.1,.31,z], 2, .026);
  }
  const inlet = rod(root, 'inlet-pipe', [-2.75, 1.35, 0], [-2.16, 1.35, 0], .13, finish('steel'));
  const outlet = rod(root, 'outlet-pipe', [2.16, 1.35, 0], [2.75, 1.35, 0], .13, finish('steel'));
  for (const x of [-2.45, 2.45]) {
    turned(root, `valve-body-${x}`, [[.1,-.13],[.18,-.07],[.18,.07],[.1,.13]], [x, 1.35, 0], steel).rotation.z = Math.PI / 2;
    rod(root, `valve-stem-${x}`, [x, 1.35, 0], [x, 1.8, 0], .032, steel);
    cylinder(root, `valve-bonnet-${x}`, .095, .13, [x, 1.53, 0], dark);
    ring(root, `valve-handwheel-${x}`, .15, .024, [x, 1.8, 0], coating).rotation.x = Math.PI / 2;
    rod(root, `valve-spoke-${x}`, [x-.15,1.8,0], [x+.15,1.8,0], .012, steel);
  }
  const jacket = group('heating-jacket'); root.add(jacket);
  const header = rod(jacket, 'heat-input-header', [-2.1, 2.28, -.38], [1.35, 2.28, -.38], .065, steel);
  pipe(jacket, 'heat-input-return', [[1.1,1.86,-.38],[1.1,2.02,-.38],[1.37,2.1,-.38],[1.85,2.1,-.38],[2.05,1.94,-.38],[2.05,.48,-.38]], .065, copper);
  for (const x of [-1.1, 1.1]) {
    rod(jacket, `heat-input-riser-${x}`, [x,1.86,-.38], [x,2.28,-.38], .065, steel);
    flange(jacket, `heater-port-${x}`, .13, .05, [x,2.03,-.38], steel, .066);
    fasteners(jacket, `heater-port-bolts-${x}`, .10, [x,2.07,-.38], 4, .016);
  }
  housing(root, 'heater-power-backplate', [.3, 1.15, .1], [-2.5, .8, .8], 'ceramic');
  const power = box(root, 'heater-power', [.13, 1, .055], [-2.5, .3, .89], C.amber);
  const gauge = thermometer(root, 'temperature', 2.45, .85);
  cable(root, 'outlet-probe-lead', [[2.24,1.35,.1],[2.35,1.08,.43],[2.45,.65,.75]], .018);
  const readouts = [annotation('outlet',outlet,'출구 온도','Outlet temperature','right'),
    annotation('heat',header,'열입력','Heat input','left')];
  return {
    root, readouts: () => readouts,
    camera: { position: [5.2, 3.35, 9.5], target: [0, .86, 0], span: 6.65 },
    legend: {
      ko: '절개 열교환기 · 구리 관군 / 강재 동체 · 유체 색: 혼합 온도 · 황색: 목표/열입력 · 가열측 동특성은 생략합니다.',
      en: 'Cutaway exchanger · copper tube bundle / steel shell · fluid tint: mixed temperature · amber: target / heat input. No hot-side dynamics.',
    },
    update(state, params) {
      temperature(fluid, state.temperature);
      temperature(inlet, params.inlet + (params.load ?? state.load ?? 0));
      temperature(outlet, state.temperature);
      gauge(state.temperature, params.target);
      power.scale.y = clamp(state.heat / 150, 0, 1);
      power.position.y = .3 + power.scale.y / 2;
      power.visible = state.heat > 0; power.userData.heatKW = state.heat;
      readouts[0].value = `${state.temperature.toFixed(1)} °C`;
      readouts[1].value = `${state.heat.toFixed(1)} kW`;
    },
  };
}

function stirredTank() {
  const root = group('cstr-rig');
  const steel = finish('steel'), aluminium = finish('aluminium'), dark = finish('dark-metal');
  const coating = finish('paint', { color: 0x61716c });
  floor(root, 5.7, 3.8);
  housing(root, 'reactor-skid', [4.9, .14, 2.8], [0, .07, 0], aluminium);
  for (const z of [-1.23, 1.23]) housing(root, `reactor-skid-rail-${z}`, [4.9, .12, .14], [0, .19, z], coating);
  for (const x of [-.6, .6]) for (const z of [-.45, .45]) {
    cylinder(root, `reactor-leg-${x}-${z}`, .07, .65, [x, .46, z], steel);
    box(root, `reactor-foot-${x}-${z}`, [.3, .06, .3], [x, .17, z], dark);
  }
  mesh(root, 'jacket-back-shell', new T.CylinderGeometry(.88, .88, 1.85, 48, 1, true, Math.PI / 2, Math.PI),
    finish('steel', { side: T.DoubleSide }), [0, 1.65, 0]);
  const jacket = mesh(root, 'cooling-jacket',
    new T.CylinderGeometry(.86, .86, 1.85, 48, 1, true, -Math.PI / 2, Math.PI), finish('glass', { color: C.blue, opacity: .12, side: T.DoubleSide }), [0, 1.65, 0]);
  mesh(root, 'reactor-vessel', new T.LatheGeometry([[.65,-.9],[.68,-.9],[.68,.9],[.65,.9]].map(p => new T.Vector2(...p)), 48, Math.PI / 2, Math.PI),
    finish('steel', { side: T.DoubleSide }), [0, 1.65, 0]);
  mesh(root, 'reactor-cutaway-window', new T.CylinderGeometry(.67,.67,1.8,48,1,true,-Math.PI/2,Math.PI),
    finish('glass', { opacity:.08, side:T.DoubleSide }), [0,1.65,0]);
  const fluid = cylinder(root, 'reactor-fluid', .625, 1.18, [0, 1.34, 0], C.teal,
    { transparent: true, opacity: .25, depthWrite: false });
  fluid.userData.volumeLitres = 100;
  cylinder(root, 'fluid-surface', .626, .017, [0, 1.93, 0], C.teal,
    { transparent: true, opacity: .45, depthWrite: false });
  turned(root, 'reactor-bottom-head', [[0,.43],[.28,.45],[.52,.54],[.67,.68],[.68,.77]], [0,0,0], steel);
  turned(root, 'reactor-top-head', [[.68,2.54],[.65,2.62],[.48,2.70],[.22,2.75],[.08,2.75]], [0,0,0], steel);
  fasteners(root, 'lid-studs', .78, [0,2.67,0], 12, .033);
  for (const y of [.72, 2.57]) {
    flange(root, `vessel-lid-${y}`, .88, .10, [0, y, 0], aluminium, .68);
    const rim = ring(root, `vessel-rim-${y}`, .87, .035, [0, y, 0], steel);
    rim.rotation.x = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i * Math.PI / 6;
      cylinder(root, `lid-bolt-${y}-${i}`, .033, .16, [.77 * Math.cos(a), y, .77 * Math.sin(a)], C.ink);
    }
  }
  for (const x of [-.5, .5])
    box(root, `mixing-baffle-${x}`, [.05, 1.4, .24], [x, 1.53, -.16], aluminium);
  const mixer = group('mixer');
  root.add(mixer);
  cylinder(mixer, 'agitator-shaft', .036, 2.05, [0, 2.025, 0], steel);
  for (const y of [1.03, 1.56]) {
    cylinder(mixer, `impeller-hub-${y}`, .1, .11, [0, y, 0], C.ink);
    for (let i = 0; i < 4; i++) {
      const paddle = box(mixer, `impeller-${y}-${i}`, [.4, .07, .12], [0, y, 0], steel);
      paddle.rotation.y = i * Math.PI / 2;
      paddle.position.x = .2 * Math.cos(paddle.rotation.y);
      paddle.position.z = -.2 * Math.sin(paddle.rotation.y);
      paddle.rotation.z = .15;
    }
  }
  flange(root, 'shaft-seal', .16, .08, [0, 2.77, 0], steel, .04);
  for (const x of [-.21,.21]) housing(root, `motor-mount-column-${x}`, [.065,.36,.25], [x,2.89,0], aluminium);
  flange(root, 'motor-mount', .27, .08, [0, 3.02, 0], aluminium, .08);
  turned(root, 'mixer-motor', [[0,-.24],[.19,-.24],[.23,-.2],[.23,.19],[.18,.24],[0,.24]], [0, 3.24, 0], coating);
  for (let i = 0; i < 6; i++)
    cylinder(root, `motor-cooling-fin-${i}`, .26, .023, [0, 3.06 + i * .065, 0], dark);
  cylinder(root, 'motor-cap', .24, .05, [0, 3.5, 0], aluminium);
  housing(root, 'motor-terminal-box', [.19,.18,.20], [.26,3.24,0], coating);
  cable(root, 'motor-cable', [[.34,3.24,0],[.56,3.18,-.35],[.60,2.4,-.70],[.6,.3,-.92],[1.7,.23,-.92]], .023);
  rod(root, 'feed-pipe', [-2.3, 2.85, 0], [-.43, 2.85, 0], .075, steel);
  rod(root, 'feed-downcomer', [-.43, 2.85, 0], [-.43, 2.35, 0], .075, steel);
  const product = rod(root, 'product-pipe', [.66, 1.07, 0], [2.3, 1.07, 0], .085, C.teal);
  const coolantIn = rod(root, 'coolant-inlet', [-2.3, 1.05, -.18], [-.84, 1.05, -.18], .065, C.blue);
  const coolantOut = rod(root, 'coolant-outlet', [.84, 2.2, -.18], [2.3, 2.2, -.18], .065, C.blue);
  for (const [x, y] of [[-1.5, 1.05], [1.6, 2.2]]) {
    rod(root, `coolant-valve-stem-${x}`, [x, y, -.18], [x, y + .25, -.18], .025, C.ink);
    const valve = ring(root, `coolant-valve-${x}`, .12, .024, [x, y + .25, -.18], C.blue);
    valve.rotation.x = Math.PI / 2;
  }
  for (const [name,x,y] of [['inlet',-1.07,1.05],['outlet',1.07,2.2]]) {
    const union = flange(root, `coolant-union-${name}`, .14, .07, [x,y,-.18], steel, .066);
    union.rotation.z = Math.PI / 2;
    const bolts = fasteners(root, `coolant-fasteners-${name}`, .108, [x+.05,y,-.18], 6, .018);
    bolts.rotation.z = -Math.PI / 2;
  }
  const probe = rod(root, 'reactor-thermowell', [.37,2.72,.3], [.37,1.78,.3], .028, steel);
  cylinder(root, 'probe-head', .08, .12, [.37,2.78,.3], aluminium);
  cable(root, 'temperature-lead', [[.37,2.83,.3],[.84,2.72,.8],[1.5,1.25,.98]], .016);
  const gauge = thermometer(root, 'reactor-temperature', 1.5, 1.03, .5, 1.65, 40, 130);
  box(root, 'concentration-backplate', [.34, 1.85, .08], [-1.5, 1.3, .96], C.white);
  const concentration = cylinder(root, 'concentration-column', .055, 1, [-1.5, .5, 1.03], C.teal);
  const feedMarker = box(root, 'feed-concentration-marker', [.27, .025, .04], [-1.5, .5, 1.12], C.amber);
  for (let i = 0; i <= 8; i++)
    box(root, `concentration-tick-${i}`, [.07, .012, .015], [-1.38, .5 + i * .2, 1.03], C.metal);
  const readouts = [annotation('reactor',probe,'반응 온도','Reactor temperature','left'),
    annotation('coolant',coolantIn,'냉각수 온도','Coolant temperature','right')];
  return {
    root, readouts: () => readouts,
    camera: { position: [4.6, 3.6, 9.5], target: [0, 1.35, 0], span: 7.95 },
    legend: {
      ko: '절개 반응기 · 일정 체적 100 L · 청록 농도/온도계 · 재킷 색: 냉각수 온도 · 황색: 목표/공급 농도 · 교반기는 고정 도식입니다.',
      en: 'Cutaway CSTR · fixed 100 L fill · teal: concentration / thermometer · jacket tint: coolant temperature · amber: target / feed. Static mixer schematic.',
    },
    update(state, params) {
      const celsius = state.temperature - 273.15, coolant = state.coolant - 273.15;
      readouts[0].value = `${celsius.toFixed(1)} °C`;
      readouts[1].value = `${coolant.toFixed(1)} °C`;
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
  const steel = finish('steel'), aluminium = finish('aluminium'), dark = finish('dark-metal');
  const rubber = finish('rubber'), coating = finish('paint', { color:0x5c6b67 });
  floor(root, 5.4, 3.2);
  housing(root, 'suspension-test-skid', [4.8,.13,2], [0,.03,0], dark);
  const body = group('sprung-body'), wheel = group('wheel-assembly'), road = group('road-platform');
  root.add(body, wheel, road);
  housing(body, 'chassis-main', [3, .32, .82], [0, 0, 0], coating);
  for (let i=0;i<3;i++) housing(body, `ballast-plate-${i}`, [2.2,.065,.72], [0,.21+i*.071,0], steel);
  box(body, 'chassis-top-flange', [3.18, .08, 1.08], [0, .18, 0], aluminium);
  box(body, 'chassis-lower-rail', [3.12, .08, 1.02], [0, -.25, 0], dark);
  for (const x of [-1.33, 1.33]) {
    box(body, `chassis-end-plate-${x}`, [.2, .42, .99], [x, 0, 0], C.metal);
    for (const y of [-.11, .11]) {
      const bolt = cylinder(body, `chassis-fastener-${x}-${y}`, .034, .06, [x, y, .52], C.ink);
      bolt.rotation.x = Math.PI / 2;
    }
  }
  housing(wheel, 'axle-crossmember', [3.3, .16, .42], [0, .35, -.15], aluminium);
  for (const side of [-1,1]) {
    const x=side*1.72;
    housing(body, `body-guide-bracket-${side}`, [.33,.13,.26], [side*1.56,0,-.32], aluminium);
    cylinder(root, `guide-column-${side}`, .047, 3.45, [x,1.8,-.32], steel);
    flange(root, `guide-column-base-${side}`, .17,.07,[x,.13,-.32],steel,.048);
    for (const [parent,name,y] of [[body,'body',0],[wheel,'wheel',.35]]) {
      housing(parent, `${name}-guide-${side}`, [.25,.24,.28], [x,y,-.32], dark);
      for (const dy of [-.14,.14]) flange(parent, `${name}-bearing-${side}-${dy}`, .093,.04,[x,y+dy,-.32],steel,.049);
    }
  }
  housing(root,'test-rig-top-tie',[3.68,.10,.28],[0,3.55,-.32],coating);
  box(wheel, 'hub-knuckle', [.22, .45, .24], [0, .11, -.1], C.metal);
  const tire = turned(wheel, 'tire', [[.30,-.13],[.38,-.16],[.49,-.13],[.52,-.09],[.52,.09],[.49,.13],[.38,.16],[.30,.13]], [0,0,.20], rubber);
  tire.rotation.x = Math.PI / 2;
  for (const z of [.12,.20,.28]) ring(wheel, `tread-groove-${z}`, .519,.007,[0,0,z],dark);
  const rim = flange(wheel, 'wheel-rim', .31, .25, [0, 0, .25], aluminium, .245);
  rim.rotation.x = Math.PI / 2;
  const hub = cylinder(wheel, 'wheel-hub', .09, .33, [0, 0, .3], steel);
  hub.rotation.x = Math.PI / 2;
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4;
    rod(wheel, `wheel-spoke-${i}`, [.1 * Math.cos(a), .1 * Math.sin(a), .4],
      [.27 * Math.cos(a), .27 * Math.sin(a), .4], .036, aluminium);
  }
  housing(road, 'road-slab', [4.3, .14, 1.6], [0, -.07, 0], dark);
  box(road, 'road-input-strip', [4.3, .018, .055], [0, .006, .83], C.amber);
  for (let i = 0; i < 13; i++) {
    const hatch = box(road, `road-hatch-${i}`, [.025, .08, .02], [-2 + i / 3, -.07, .815], C.metal);
    hatch.rotation.z = -.4;
  }
  const spring = coil(root, 'suspension-spring', -.82, 0, .18, 8, .032);
  const tireSpring = coil(root, 'tire-spring', 0, .2, .105, 4, .02);
  const damper = mesh(wheel, 'damper-housing', new T.CylinderGeometry(.13,.13,1.1,48,1,true,Math.PI/2,Math.PI),
    finish('steel', { side:T.DoubleSide }), [0,.75,0]);
  mesh(wheel, 'damper-cutaway-window', new T.CylinderGeometry(.131,.131,1.1,48,1,true,-Math.PI/2,Math.PI),
    finish('glass', { opacity:.16, side:T.DoubleSide }), [0,.75,0]);
  for (const [side,parent,y] of [[-1,wheel,.35],[1,body,-.25]])
    flange(parent, `spring-seat-${side}`, .24,.065,[-.82,y,0],steel,.06);
  for (const y of [.2, 1.3]) cylinder(wheel, `damper-collar-${y}`, .15, .07, [0, y, 0], C.ink);
  const piston = cylinder(body, 'damper-piston', .105, .075, [0, -1.1, 0], steel);
  rod(body, 'damper-rod', [0, -.25, 0], [0, -1.1, 0], .037, steel);
  const actuator = turned(wheel, 'active-actuator', [[0,-.34],[.11,-.34],[.14,-.27],[.14,.22],[.1,.34],[.045,.34]], [.82,.55,0], coating);
  housing(body, 'actuator-clevis', [.26,.18,.23], [.82,-.25,0], dark);
  const pin=cylinder(body,'actuator-clevis-pin',.05,.29,[.82,-.25,0],steel); pin.rotation.x=Math.PI/2;
  cable(wheel,'actuator-supply',[[.94,.36,0],[1.2,.25,-.22],[1.2,.30,-.45],[.6,.35,-.45]],.024);
  for (let i = 0; i < 5; i++) cylinder(wheel, `actuator-band-${i}`, .139, .025, [.82, .32 + .11 * i, 0], C.ink);
  const activeRod = rod(root, 'actuator-rod', [.82, 1, 0], [.82, 2, 0], .04, C.metal);
  for (const x of [-.82, 0, .82]) {
    cylinder(body, `upper-mount-${x}`, .15, .07, [x, -.25, 0], C.metal);
    cylinder(wheel, `lower-mount-${x}`, .15, .07, [x, .35, 0], C.metal);
  }
  const bodyForce = arrow(root, 'body-force'), wheelForce = arrow(root, 'wheel-force');
  bodyForce.position.set(1.55, 0, .4); wheelForce.position.set(1.55, 0, .4);
  const readouts=[annotation('sprung',body,'차체 변위','Sprung displacement','left'),
    annotation('force',actuator,'능동 힘','Active force','right')];
  return {
    root, readouts: () => readouts,
    camera: { position: [3.3, 3.35, 9.5], target: [0, 1.45, 0], span: 7.65 },
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
      damper.userData.damping = params.damping;
      readouts[0].value = `${(state.zs * 1000).toFixed(1)} mm`;
      readouts[1].value = `${force.toFixed(0)} N`;
      actuator.userData.forceN = force;
      piston.userData.relativeTravelM = state.zs - state.zu;
    },
  };
}

function quadcopter() {
  const root = group('drone-rig');
  const aluminium=finish('aluminium'), steel=finish('steel'), dark=finish('dark-metal');
  const weave=new Uint8Array(16*16*4);
  for(let y=0;y<16;y++) for(let x=0;x<16;x++){
    const v=((Math.floor(x/4)+Math.floor(y/4))%2 ? x%4 : y%4)*9+65, i=(y*16+x)*4;
    weave[i]=weave[i+1]=weave[i+2]=v; weave[i+3]=255;
  }
  const texture=new T.DataTexture(weave,16,16,T.RGBAFormat);
  texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(5,5);texture.needsUpdate=true;
  const carbon=finish('paint',{color:0x4b5152,metalness:.12,roughness:.46,map:texture});
  carbon.userData.finish='carbon-composite';
  floor(root, 7, 4.3);
  const frame = group('flight-frame'), pose = group('drone-pose'), airframe = group('drone-airframe');
  root.add(frame); frame.add(pose); pose.add(airframe);
  // Only the apparatus is magnified; position/altitude stay in model metres.
  airframe.scale.setScalar(4);
  housing(airframe, 'avionics-body', [.24, .013, .27], [0, -.025, 0], carbon);
  for(const x of [-.09,.09])for(const z of [-.10,.10]) {
    cylinder(airframe,`avionics-standoff-${x}-${z}`,.009,.065,[x,.01,z],aluminium);
    fasteners(airframe,`avionics-screw-${x}-${z}`,.005,[x,.049,z],1,.004);
  }
  housing(airframe,'flight-controller',[.12,.022,.13],[0,.01,0],finish('paint',{color:0x39534b}));
  housing(airframe, 'flight-controller-cover', [.24, .012, .27], [0, .052, 0], carbon);
  housing(airframe, 'battery-pack', [.13, .045, .18], [0, .087, 0], finish('paint',{color:0xb0b7b2}));
  box(airframe, 'battery-strap', [.032, .051, .185], [0, .087, 0], finish('rubber'));
  for (const [side, x] of [['left', -.25], ['right', .25]]) {
    for (const [depth, z] of [['front', .19], ['rear', -.19]]) {
      const key = `${side}-${depth}`;
      rod(airframe, `rotor-arm-${key}`, [Math.sign(x) * .06, 0, Math.sign(z) * .06], [x, 0, z], .018, carbon);
      rod(airframe, `arm-top-rail-${key}`, [Math.sign(x) * .06, .02, Math.sign(z) * .06], [x, .02, z], .006, aluminium);
      cylinder(airframe, `motor-stator-${key}`, .027,.024,[x,.029,z],finish('copper'));
      turned(airframe, `motor-pod-${key}`, [[.029,0],[.036,.006],[.036,.025],[.030,.032],[.009,.032]], [x,.04,z], aluminium);
      flange(airframe,`motor-mount-${key}`,.046,.009,[x,.003,z],dark,.012);
      fasteners(airframe,`motor-fasteners-${key}`,.036,[x,.010,z],4,.004);
      for(let i=0;i<8;i++){
        const a=i*Math.PI/4;
        rod(airframe,`bell-rib-${key}-${i}`,[x+.029*Math.cos(a),.012,z+.029*Math.sin(a)],
          [x+.029*Math.cos(a),.045,z+.029*Math.sin(a)],.003,dark);
      }
      cable(airframe,`motor-lead-${key}`,[[x,.008,z],[x*.80,.026,z*.8],[x*.45,.031,z*.45],[x*.28,.012,z*.3]],.004);
      cylinder(airframe, `motor-cap-${key}`, .031, .016, [x, .076, z], dark);
      cylinder(airframe, `rotor-disc-${key}`, .126, .006, [x, .09, z], finish('glass', { opacity:.10 }));
      const rim = ring(airframe, `rotor-swept-rim-${key}`, .126, .003, [x, .09, z], finish('glass',{opacity:.24}));
      rim.rotation.x = Math.PI / 2;
      const blade=plate(airframe, `static-blade-${key}`, [[-.12,-.008],[-.105,-.018],[-.028,-.012],[.018,-.007],[.12,.008],[.105,.018],[.028,.012],[-.018,.007]], .004, carbon);
      blade.position.set(x,.095,z);blade.rotation.y=depth==='front'?.25:-.25;
      cylinder(airframe, `rotor-hub-${key}`, .014, .02, [x, .102, z], aluminium);
    }
    for (const z of [-.10, .10])
      rod(airframe, `landing-strut-${side}-${z}`, [Math.sign(x) * .075, -.025, z], [Math.sign(x) * .14, -.15, z], .009, aluminium);
    rod(airframe, `landing-skid-${side}`, [Math.sign(x) * .14, -.15, -.17], [Math.sign(x) * .14, -.15, .17], .012, finish('rubber'));
  }
  cable(airframe,'battery-lead',[[.065,.09,-.06],[.11,.082,-.11],[.105,.025,-.09],[.04,.016,-.05]],.005,0x795444);
  housing(airframe,'battery-connector',[.025,.016,.018],[.09,.05,-.1],finish('ceramic',{color:0xcbb16c}));
  sphere(airframe, 'underside-sensor', .027, [0, -.065, .07], C.ink);
  sphere(airframe, 'sensor-lens', .013, [0, -.077, .09], C.blue);
  const left = arrow(pose, 'left-pair-thrust'), right = arrow(pose, 'right-pair-thrust');
  left.position.set(-1, .5, 0); right.position.set(1, .5, 0);
  const altitude = line(root, 'altitude-target', [[-2.6, 0, -.75], [2.6, 0, -.75]], C.amber, true);
  const roll = line(root, 'roll-target', [[-1.15, 0, -.8], [1.15, 0, -.8]], C.amber, true);
  const plumb = rod(root, 'altitude-plumb', [0, 0, -.8], [0, 1, -.8], .008, C.teal);
  targetMarker(root, 'ground-projection', [0, .012, -.8], .14, C.teal);
  rod(root, 'altitude-scale', [-2.7, 0, -.75], [-2.7, 5.5, -.75], .009, aluminium);
  for (let i = 0; i <= 11; i++)
    line(root, `altitude-tick-${i}`, [[-2.7, i / 2, -.75], [-2.7 + (i % 2 ? .1 : .2), i / 2, -.75]], C.metal);
  const groundMarks = [];
  for (let i = 0; i < 14; i++) groundMarks.push(box(root, `ground-mark-${i}`, [.022, .015, 2.8], [i / 2 - 3.5, .01, 0], C.metal));
  // Fixed-location presentation copy; flight-frame retains the real horizontal-follow coordinates.
  const detail = group('attitude-detail');
  detail.position.set(9.5, 6.3, 0); detail.scale.setScalar(3); root.add(detail);
  housing(detail, 'detail-backplate', [3.9, 3.8, .035], [0, 0, -1.5], finish('ceramic', { color: 0xf1f2ec }));
  line(detail, 'detail-border', [[-1.95,-1.9,-1.47],[1.95,-1.9,-1.47],[1.95,1.9,-1.47],[-1.95,1.9,-1.47],[-1.95,-1.9,-1.47]], C.metal);
  const enlarged = pose.clone(true);
  enlarged.traverse(part => { part.name = `detail-${part.name}`; });
  detail.add(enlarged);
  // An inset is not an object in the flight volume and must not cast a second ground shadow.
  detail.traverse(part => { part.castShadow = false; part.receiveShadow = false; });
  const detailLeft = enlarged.getObjectByName('detail-left-pair-thrust');
  const detailRight = enlarged.getObjectByName('detail-right-pair-thrust');
  const readouts=[annotation('altitude',pose,'비행 · 고도','Flight · altitude','left'),
    annotation('roll',enlarged.getObjectByName('detail-avionics-body'),'자세 확대 3배 · 롤','Detail 3x · roll','right')];
  return {
    root, readouts: () => readouts,
    camera: { position: [9.5, 11.8, 18], target: [5.5, 5.8, 0], span: 23.5 },
    legend: {
      ko: '왼쪽: x-z 비행 · 수평 추적 · 기체 4배. 오른쪽: 동일 기체의 자세 확대 3배(왼쪽 기체 기준). 청록: 실제 좌/우 로터 쌍 합 추력 · 황색: 목표 · 로터는 고정 도식입니다.',
      en: 'Left: x-z flight, horizontal follow; airframe 4x. Right: attitude detail 3x the overview airframe (same craft). Teal: actual rotor-pair thrust; amber: targets. Static rotors.',
    },
    update(state, params) {
      readouts[0].value=`${state.z.toFixed(2)} m`;readouts[1].value=`${state.roll.toFixed(2)} rad`;
      pose.position.set(state.x, state.z, 0);
      pose.rotation.z = enlarged.rotation.z = state.roll;
      frame.position.x = -state.x;
      altitude.position.y = params.altitude;
      roll.position.y = state.z;
      roll.rotation.z = params.rollTarget;
      setRod(plumb, [0, 0, -.8], [0, state.z, -.8]);
      for (const [indicator, thrust] of [[left, state.left], [right, state.right],
        [detailLeft, state.left], [detailRight, state.right]]) {
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

// Closed symmetric sections taper in thickness as well as planform; no flap dynamics are invented.
function airfoil(parent,name,root,tip,surface) {
  const vertices=[], indices=[], sections=6, samples=24;
  for(let j=0;j<=sections;j++) {
    const t=j/sections, leading=root[0]+(tip[0]-root[0])*t, trailing=root[1]+(tip[1]-root[1])*t;
    const chord=leading-trailing,z=root[2]+(tip[2]-root[2])*t;
    for(let i=0;i<samples;i++) {
      const a=i*Math.PI*2/samples,u=(1-Math.cos(a))/2;
      const thickness=.60*chord*(.2969*Math.sqrt(u)-.126*u-.3516*u*u+.2843*u*u*u-.1036*u*u*u*u);
      vertices.push(leading-chord*u,Math.sign(Math.sin(a))*thickness,z);
    }
  }
  for(let j=0;j<sections;j++)for(let i=0;i<samples;i++){
    const a=j*samples+i,b=j*samples+(i+1)%samples,c=a+samples,d=b+samples;
    indices.push(a,c,b,b,c,d);
  }
  for(let i=1;i<samples-1;i++) indices.push(0,i,i+1,sections*samples,sections*samples+i+1,sections*samples+i);
  if(tip[2]>root[2])for(let i=0;i<indices.length;i+=3)[indices[i],indices[i+1]]=[indices[i+1],indices[i]];
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(vertices,3));
  geometry.setIndex(indices);geometry.computeVertexNormals();return mesh(parent,name,geometry,surface);
}

function aircraft() {
  const root = group('aircraft-pitch-rig');
  const skin=finish('paint',{color:0xe0e3dc,roughness:.38}), aluminium=finish('aluminium');
  const dark=finish('dark-metal'), controlSkin=finish('paint',{color:0x6c8a80});
  floor(root, 6, 4.7);
  const pose = group('aircraft-pose');
  pose.position.y = 2;
  root.add(pose);
  const profile = [[.025, -1.85], [.09, -1.62], [.16, -1.25], [.20, -.7], [.21, .6], [.18, 1.05], [.10, 1.45], [0, 1.65]];
  const hull = new T.LatheGeometry(profile.map(([radius, x]) => new T.Vector2(radius, x)), 48);
  hull.rotateZ(-Math.PI / 2);
  const fuselage=mesh(pose, 'fuselage', hull, skin);
  const nose = group('nose-tip'); nose.position.x = 1.65; pose.add(nose);
  const cockpit = sphere(pose, 'cockpit-glazing', 1, [.93, .13, 0], finish('glass',{color:0x23393e,opacity:.93}));
  cockpit.scale.set(.30, .105, .18);
  for (const side of [-1, 1]) {
    const sideName = side < 0 ? 'left' : 'right';
    airfoil(pose, `main-wing-${sideName}`, [.30,-.54,side*.13], [-.30,-.79,side*1.65], skin);
    const fairing=sphere(pose,`wing-root-fairing-${sideName}`,1,[-.28,-.035,side*.19],skin);
    fairing.scale.set(.54,.095,.17);
    line(pose,`wing-flap-seam-${sideName}`,[[-.36,.026,side*.28],[-.60,.019,side*1.02],[-.69,.014,side*1.51]],0x777f7a);
    for(const z of [.52,.82,1.12]) {
      const cover=sphere(pose,`flap-track-fairing-${sideName}-${z}`,1,[-.52-z*.11,-.025,side*z],aluminium);
      cover.scale.set(.16,.035,.027);
    }
    plate(pose, `wing-tip-${sideName}`,
      [[-.30, side * 1.52], [-.35, side * 1.65], [-.79, side * 1.61], [-.77, side * 1.49]], .032, controlSkin);
    airfoil(pose, `horizontal-tail-${sideName}`, [-1.17,-1.62,side*.07], [-1.44,-1.62,side*.68], skin);
    const bearing=cylinder(pose,`elevator-bearing-${sideName}`,.026,.11,[-1.62,.015,side*.45],aluminium);
    bearing.rotation.x=Math.PI/2;
    for (let i = 0; i < 7; i++) {
      const window = sphere(pose, `cabin-window-${sideName}-${i}`, .038, [.55 - i * .2, .075, side * .19], C.ink);
      window.scale.set(.85, 1, .25);
    }
    rod(pose, `attitude-stripe-${sideName}`, [-1.24, -.015, side * .16], [1.17, -.015, side * .16], .012, controlSkin);
    housing(pose, `engine-pylon-${sideName}`, [.27, .16, .055], [-.05, -.12, side * .7], skin);
    const nacelle=turned(pose,`engine-nacelle-${sideName}`,[[.065,-.25],[.092,-.20],[.115,.06],[.108,.24],[.098,.25],[.08,.22],[.08,.12]], [.04,-.24,side*.7],aluminium);
    nacelle.rotation.z=-Math.PI/2;
    const fan=group(`intake-fan-${sideName}`);fan.position.set(.23,-.24,side*.7);pose.add(fan);
    for(let i=0;i<12;i++){
      const blade=housing(fan,`fan-vane-${i}`,[.008,.066,.014],[0,0,0],dark);
      const a=i*Math.PI/6;blade.position.set(0,.043*Math.cos(a),.043*Math.sin(a));blade.rotation.x=a+.25;
    }
    const spinner=turned(fan,`fan-spinner-${sideName}`,[[.022,-.02],[.023,0],[.015,.027],[0,.055]],[0,0,0],aluminium);spinner.rotation.z=-Math.PI/2;
    const intake = cylinder(pose, `engine-intake-${sideName}`, .075, .012, [.16, -.24, side * .7], dark);
    intake.rotation.z = Math.PI / 2;
    const intakeRim = ring(pose, `engine-rim-${sideName}`, .09, .009, [.29, -.24, side * .7], aluminium);
    intakeRim.rotation.y = Math.PI / 2;
  }
  plate(pose, 'vertical-tail', [[-1.7, .11], [-1.66, .75], [-1.38, .75], [-.98, .12]], .042, skin, false);
  plate(pose, 'tail-identification-panel', [[-1.65, .32], [-1.62, .66], [-1.4, .66], [-1.17, .32]], .045, controlSkin, false);
  const elevator = group('elevator-hinge');
  elevator.position.set(-1.62, .015, 0);
  pose.add(elevator);
  plate(elevator, 'elevator-surface', [[0, -.65], [-.23, -.62], [-.23, .62], [0, .65]], .026, controlSkin);
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
  const readouts=[annotation('pitch',fuselage,'피치각','Pitch','left'),
    annotation('elevator',elevator,'승강타','Elevator','right')];
  return {
    root, readouts: () => readouts,
    camera: { position: [5.64, 3.93, 8.82], target: [.24, 2.03, -.18], span: 5.65 },
    legend: {
      ko: '종방향 트림 모델 · 청록: 피치/승강타 · 황색: 목표 피치 · 청색: 비행 경로각 θ−α · 속도/고도 운동은 생략합니다.',
      en: 'Longitudinal trim model · teal: pitch / elevator · amber: pitch target · blue: flight-path angle theta-alpha. No airspeed or altitude dynamics.',
    },
    update(state, params) {
      readouts[0].value=`${(state.theta/rad).toFixed(1)}°`;
      readouts[1].value=`${(state.elevator/rad).toFixed(1)}°`;
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
  const steel=finish('steel'), aluminium=finish('aluminium'), dark=finish('dark-metal');
  const skin=finish('paint',{color:0xdbded4,roughness:.47});
  cylinder(pose, `${prefix}rocket-body`, .52, 1.92, [0, .16, 0], skin);
  cylinder(pose, `${prefix}body-band`, .526, .19, [0, .325, 0], steel);
  turned(pose,`${prefix}nose-cone`,[[.52,1.12],[.48,1.35],[.38,1.59],[.23,1.82],[.09,1.95],[0,2]],[0,0,0],skin);
  flange(pose,`${prefix}nose-bulkhead`,.531,.055,[0,1.12,0],aluminium,.47);
  fasteners(pose,`${prefix}bulkhead-fasteners`,.50,[0,1.16,0],12,.018);
  const nose = group(`${prefix}nose-tip`); nose.position.y = 2; pose.add(nose);
  cylinder(pose, `${prefix}engine-deck`, .55, .14, [0, -.73, 0], dark);
  for (const y of [-.5, .87, 1.12]) {
    const seam = ring(pose, `${prefix}tank-seam-${y}`, .523, .017, [0, y, 0], steel);
    seam.rotation.x = Math.PI / 2;
  }
  for (const side of [-1, 1]) {
    rod(pose, `${prefix}body-rail-${side}`, [side * .35, -.6, .39], [side * .35, .95, .39], .024, C.metal);
    for (const y of [-.5, .6, .9]) sphere(pose, `${prefix}rail-fastener-${side}-${y}`, .028, [side * .35, y, .42], C.ink);
  }
  const window = cylinder(pose, `${prefix}service-port`, .12, .025, [0, .77, .52], C.ink);
  window.rotation.x = Math.PI / 2;
  housing(pose,`${prefix}engine-thrust-frame`,[1.40,.10,.30],[0,-.65,0],dark);
  for(const [name,side] of [['left',-1],['right',1]]){
    plate(pose,`${prefix}fin-${name}`,[[side*.47,.08],[side*.69,-.32],[side*.70,-.65],[side*.48,-.59]],.035,aluminium,false);
    for(const z of [-.18,.18]) rod(pose,`${prefix}engine-truss-${name}-${z}`,[side*.35,-.37,z],[side*.6,-.67,0],.026,steel);
  }
  const ports = [];
  for (const [name, side] of [['left', -1], ['right', 1]]) {
    const foot = group(`${prefix}${name}-foot`);
    foot.position.set(side * .9, -1.5, 0); pose.add(foot);
    rod(pose, `${prefix}${name}-landing-strut`, [side * .42, -.45, 0], [side * .88, -1.45, 0], .045, dark);
    rod(pose, `${prefix}${name}-landing-brace`, [side * .5, -1.05, 0], [side * .88, -1.45, 0], .027, steel);
    rod(pose,`${prefix}${name}-leg-cylinder`,[side*.42,-.45,0],[side*.66,-.97,0],.064,aluminium);
    for(const z of [-.13,.13]) rod(pose,`${prefix}${name}-leg-fork-${z}`,[side*.46,-.50,z],[side*.85,-1.45,z],.019,steel);
    box(pose, `${prefix}${name}-footpad`, [.22, .05, .42], [side * .79, -1.475, 0], dark);
    sphere(pose, `${prefix}${name}-leg-pivot`, .07, [side * .42, -.45, 0], C.metal);
    const engine = group(`${prefix}${name}-engine`);
    engine.position.set(side * .6, -1.1, 0); pose.add(engine);
    turned(engine,`${prefix}${name}-nozzle-bell`,[[.207,0],[.22,0],[.207,.08],[.176,.17],[.13,.28],[.081,.36],[.09,.45],[.077,.45],[.069,.36],[.118,.28],[.164,.17],[.195,.08],[.207,0]],
      [0,0,0],finish('dark-metal',{side:T.DoubleSide,roughness:.31}));
    ring(engine,`${prefix}${name}-cooling-manifold`,.104,.018,[0,.43,0],finish('copper')).rotation.x=Math.PI/2;
    pipe(engine,`${prefix}${name}-feed-line`,[[.10,.40,0],[.16,.52,0],[.12,.63,-.07],[0,.68,-.08]],.017,steel);
    flange(engine,`${prefix}${name}-chamber-flange`,.145,.035,[0,.54,0],steel,.10);
    fasteners(engine,`${prefix}${name}-chamber-bolts`,.124,[0,.565,0],8,.014);
    const lip = ring(engine, `${prefix}${name}-nozzle-rim`, .22, .022, [0, .01, 0], C.ink);
    lip.rotation.x = Math.PI / 2;
    cylinder(engine, `${prefix}${name}-combustion-chamber`, .12, .25, [0, .51, 0], steel);
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
  cylinder(pad, 'landing-deck', 1.7, .16, [0, -.08, 0], finish('dark-metal'));
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
  detail.position.set(50.5, 37, 0); detail.scale.setScalar(12); root.add(detail);
  housing(detail, 'detail-backplate', [5.4, 5.5, .035], [0, -.3, -.85], finish('ceramic',{color:0xf1f2ec}));
  line(detail, 'detail-border', [[-2.7,-3.05,-.82],[2.7,-3.05,-.82],[2.7,2.45,-.82],[-2.7,2.45,-.82],[-2.7,-3.05,-.82]], C.metal);
  const enlarged = rocketHardware(detail, 'detail-');
  detail.traverse(part => { part.castShadow = false; part.receiveShadow = false; });
  const readouts=[annotation('height',hardware.pose.getObjectByName('rocket-body'),'동체 고도','Body altitude','left'),
    annotation('tilt',enlarged.pose.getObjectByName('detail-rocket-body'),'자세 확대 12배 · 기울기','Detail 12x · tilt','right')];
  return {
    root, readouts: () => readouts,
    camera: { position: [48, 45.5, 100], target: [33, 33.5, 0], span: 113.5 },
    legend: {
      ko: '왼쪽: 고정 축척 비행/착륙 패드. 오른쪽: 동일 기체의 자세 확대 12배(위치는 생략). 황색: 패드 목표 · 불꽃/청록 화살표: 실제 좌/우 추력 · 노즐은 고정입니다.',
      en: 'Left: fixed-scale flight / landing pad. Right: same craft, attitude detail 12x (position omitted). Amber: pad target; plumes / teal arrows: actual left/right thrust. Fixed nozzles.',
    },
    update(state, params) {
      readouts[0].value=`${state.y.toFixed(2)} m`;readouts[1].value=`${state.theta.toFixed(2)} rad`;
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
