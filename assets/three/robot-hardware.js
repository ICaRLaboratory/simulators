import * as T from '../vendor/three.js';
import { finish } from './engineering.js';

const RINGS = 40;
const SIDES = 40;
const CAP_RINGS = 13;
const profiles = new WeakMap();

// Shape-preserving cubic Hermite interpolation in normalized body coordinates.
// Zero end slopes meet the ellipsoidal caps smoothly; harmonic interior slopes
// avoid overshoot even for a short casing whose tip is as wide as its root.
function taperProfile(values) {
  const stations = [0, .25, .64, 1], slopes = [0];
  for (let i = 1; i < stations.length - 1; i++) {
    const before = stations[i] - stations[i - 1], after = stations[i + 1] - stations[i];
    const left = (values[i] - values[i - 1]) / before, right = (values[i + 1] - values[i]) / after;
    const w1 = 2 * after + before, w2 = after + 2 * before;
    slopes.push(left * right > 0 ? (w1 + w2) / (w1 / left + w2 / right) : 0);
  }
  slopes.push(0);
  return u => {
    const i = u <= stations[1] ? 0 : u <= stations[2] ? 1 : 2;
    const span = stations[i + 1] - stations[i], v = (u - stations[i]) / span;
    const v2 = v * v, v3 = v2 * v;
    return (2 * v3 - 3 * v2 + 1) * values[i] + (v3 - 2 * v2 + v) * span * slopes[i]
      + (-2 * v3 + 3 * v2) * values[i + 1] + (v3 - v2) * span * slopes[i + 1];
  };
}

// Closed cast casings along +X; the revolute axis is local Z. These are
// presentation meshes, not added joints, masses or collision bodies.
function populate(geometry, length, { rootRadius: r, tipRadius: t, depth }) {
  const d = depth / 2;
  const radiusAt = taperProfile([r, r * .82, t * 1.04, t]);
  const depthAt = taperProfile([d, d * .96, d * .84, d * .74]);
  const bodyRings = RINGS - 2 * CAP_RINGS;
  const position = geometry.attributes.position;
  position.setXYZ(0, -r, 0, 0);
  for (let i = 0; i < RINGS; i++) {
    let x, y, z;
    if (i < CAP_RINGS) {
      const angle = (i + 1) / CAP_RINGS * Math.PI / 2;
      // Include x=0 exactly, rather than measuring between cap/body samples.
      x = i === CAP_RINGS - 1 ? 0 : -r * Math.cos(angle);
      y = r * Math.sin(angle); z = d * Math.sin(angle);
    } else if (i < CAP_RINGS + bodyRings) {
      const u = (i - CAP_RINGS + 1) / (bodyRings + 1);
      x = length * u; y = radiusAt(u); z = depthAt(u);
    } else {
      const angle = (i - CAP_RINGS - bodyRings) / CAP_RINGS * Math.PI / 2;
      // Include x=length; the downstream cap only translates during resizing.
      x = length + t * Math.sin(angle);
      y = t * Math.cos(angle); z = d * .74 * Math.cos(angle);
    }
    // Length participates only in X. Every corresponding Y/Z stays identical.
    for (let j = 0; j < SIDES; j++) {
      const angle = j * Math.PI * 2 / SIDES, c = Math.cos(angle), s = Math.sin(angle);
      position.setXYZ(1 + i * SIDES + j, x,
        y * Math.sign(c) * Math.abs(c) ** (2 / 3),
        z * Math.sign(s) * Math.abs(s) ** (2 / 3));
    }
  }
  position.setXYZ(position.count - 1, length + t, 0, 0);
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
}

export function sculptedLink(parent, name, length, options = {}) {
  const profile = { rootRadius: .18, tipRadius: .12, depth: .22, ...options };
  if (![length, profile.rootRadius, profile.tipRadius, profile.depth].every(n => Number.isFinite(n) && n > 0)) {
    throw new RangeError('Sculpted link dimensions must be positive finite numbers');
  }
  const geometry = new T.BufferGeometry();
  geometry.setAttribute('position', new T.Float32BufferAttribute(new Float32Array((RINGS * SIDES + 2) * 3), 3));
  const uv = new Float32Array((RINGS * SIDES + 2) * 2);
  const indices = [];
  for (let i = 0; i < RINGS; i++) for (let j = 0; j < SIDES; j++) {
    const a = 1 + i * SIDES + j, b = 1 + i * SIDES + (j + 1) % SIDES;
    uv[a * 2] = (i + 1) / (RINGS + 1); uv[a * 2 + 1] = j / SIDES;
    if (!i) indices.push(0, b, a);
    if (i < RINGS - 1) indices.push(a, b, a + SIDES, b, b + SIDES, a + SIDES);
    else indices.push(RINGS * SIDES + 1, a, b);
  }
  uv[uv.length - 2] = 1;
  geometry.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geometry.setIndex(indices);
  populate(geometry, length, profile);
  const body = new T.Mesh(geometry, options.material || finish('paint', { color: 0xdde3e1 }));
  body.name = name;
  body.castShadow = true; body.receiveShadow = true;
  profiles.set(body, { length, profile });
  parent.add(body);
  return body;
}

export function resizeSculptedLink(body, length) {
  const state = profiles.get(body);
  if (!state) throw new TypeError('Unknown sculpted link');
  if (!Number.isFinite(length) || length <= 0) throw new RangeError('Sculpted link length must be a positive finite number');
  if (state.length === length) return false;
  populate(body.geometry, length, state.profile);
  state.length = length;
  return true;
}
