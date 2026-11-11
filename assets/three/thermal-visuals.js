import * as T from '../vendor/three.js';

// One fixed Celsius scale for both plants, clamped outside 0..100 C.
// These are false-color FLUID states, never calculated metal/wall temperatures.
// Linear-light interpolation keeps the same Celsius value identical everywhere.
export const THERMAL_PALETTE = Object.freeze([
  Object.freeze([0, 0x1764dc]), Object.freeze([25, 0x12a5c9]),
  Object.freeze([50, 0xedb62e]), Object.freeze([75, 0xe96622]),
  Object.freeze([100, 0xc92339]),
]);
const stops = THERMAL_PALETTE.map(([celsius, hex]) => ({ celsius, color: new T.Color(hex) }));
export function tintFluid(object, celsius) {
  const t = Math.max(0, Math.min(100, celsius));
  const index = Math.min(3, Math.floor(t / 25)), a = stops[index], b = stops[index + 1];
  object.material.color.lerpColors(a.color, b.color, (t - a.celsius) / 25);
  object.userData.temperatureC = celsius;
}

// Static arrows: direction and bounded width only, never particles, velocity or a clock.
export function thermalArrow(parent, name, start, end, color) {
  const arrow = new T.Group(); arrow.name = name; parent.add(arrow);
  const surface = new T.MeshStandardMaterial({ color, metalness: 0, roughness: .65 });
  const shaft = new T.Mesh(new T.CylinderGeometry(.031,.031,.72,12), surface);
  shaft.name = `${name}-shaft`; shaft.position.y = .36;
  const head = new T.Mesh(new T.ConeGeometry(.105,.28,16), surface);
  head.name = `${name}-head`; head.position.y = .86; arrow.add(shaft,head);
  const a = new T.Vector3(...start), delta = new T.Vector3(...end).sub(a);
  arrow.position.copy(a); arrow.scale.y = delta.length();
  arrow.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),delta.normalize());
  return arrow;
}
export function setThermalArrow(arrow, value, reference) {
  arrow.visible = Math.abs(value) > 1e-12;
  const width = .45 + 1.05 * Math.min(1, Math.abs(value) / reference);
  arrow.scale.x = arrow.scale.z = width;
  arrow.userData.value = value;
}

// Algebraic decomposition of assets/models/cstr.js, not a second thermal model.
// V=100 L, rho=1000 g/L, cp=.239 J/(g K): capacity=23.9 kJ/K.
// -dH=50000 J/mol; UA=50000 J/(min K); residence time=60 s.
// Positive kW adds heat to the reactor. No integration or coolant outlet state.
export function cstrHeatBalance(state, result) {
  const reaction = Math.exp(8750 * (1 / 350 - 1 / state.temperature)) / 60 * state.concentration;
  result.feedKW = 23.9 * (350 - state.temperature) / 60;
  result.reactionKW = 5000 * reaction;
  result.jacketKW = (50000 / 60 / 1000) * (state.coolant - state.temperature);
  result.rate = (result.feedKW + result.reactionKW + result.jacketKW) / 23.9;
  return result;
}
