import * as T from '../vendor/three.js';

export const C = Object.freeze({ink: 0x243442, metal: 0x8596a5, light: 0xe3e9ee,
  white: 0xfafafa, teal: 0x087f74, amber: 0xc56b31, red: 0xb42318, blue: 0x386b99});
export function group(name = '') { const node = new T.Group(); node.name = name; return node; }
export function material(color, options = {}) {
  return color?.isMaterial ? color : new T.MeshStandardMaterial({color, roughness: 0.46, metalness: 0.28, ...options});
}
function mesh(parent, name, geometry, position, color, options) {
  const node = new T.Mesh(geometry, material(color, options));
  node.name = name; node.position.fromArray(position); node.castShadow = true; node.receiveShadow = true;
  parent.add(node); return node;
}
export function box(parent, name, size, position, color, options = {}) {
  return mesh(parent, name, new T.BoxGeometry(...size), position, color, options);
}
export function cylinder(parent, name, radius, height, position, color, options = {}) {
  return mesh(parent, name, new T.CylinderGeometry(radius, radius, height, 32), position, color, options);
}
export function sphere(parent, name, radius, position, color, options = {}) {
  return mesh(parent, name, new T.SphereGeometry(radius, 24, 16), position, color, options);
}
const up = new T.Vector3(0, 1, 0), a = new T.Vector3(), b = new T.Vector3(), direction = new T.Vector3();
export function setRod(node, start, end) {
  a.fromArray(start); b.fromArray(end); direction.subVectors(b, a);
  const length = direction.length();
  node.position.copy(a).add(b).multiplyScalar(0.5);
  node.scale.y = length;
  node.visible = length > 1e-10;
  if (node.visible) node.quaternion.setFromUnitVectors(up, direction.divideScalar(length));
  return node;
}
export function rod(parent, name, start, end, radius, color) {
  const node = cylinder(parent, name, radius, 1, [0, 0, 0], color);
  return setRod(node, start, end);
}
export function line(parent, name, points, color, dashed = false) {
  const geometry = new T.BufferGeometry();
  const lineMaterial = dashed
    ? new T.LineDashedMaterial({color, dashSize: 0.12, gapSize: 0.08})
    : new T.LineBasicMaterial({color});
  const node = new T.Line(geometry, lineMaterial); node.name = name;
  updateLine(node, points); parent.add(node); return node;
}
export function updateLine(node, points) {
  let buffer = node.geometry.getAttribute('position');
  if (!buffer || buffer.count !== points.length) {
    buffer = new T.Float32BufferAttribute(points.length * 3, 3);
    node.geometry.setAttribute('position', buffer);
  }
  for (let i = 0; i < points.length; i++) buffer.setXYZ(i, ...points[i]);
  buffer.needsUpdate = true;
  node.geometry.computeBoundingSphere();
  if (node.material.isLineDashedMaterial) node.computeLineDistances();
  return node;
}
export function floor(root, width = 6, depth = 4, y = 0) {
  const stage = group('stage'); root.add(stage);
  const surface=mesh(stage,'stage-surface',new T.PlaneGeometry(width*4,depth*4),
    [0,y-.006,0],0xdfe4e0,{roughness:.95,metalness:0});
  surface.rotation.x=-Math.PI/2;surface.castShadow=false;
  surface.userData.environment=true;
  return stage;
}
export function targetMarker(parent, name, position, radius = 0.15, color = C.amber) {
  const node = group(name); node.position.fromArray(position); parent.add(node);
  const ring = new T.Mesh(new T.TorusGeometry(radius, radius * 0.07, 8, 40), material(color));
  ring.rotation.x = -Math.PI / 2; node.add(ring);
  line(node, `${name}-cross-x`, [[-radius * 1.4, 0, 0], [radius * 1.4, 0, 0]], color);
  line(node, `${name}-cross-z`, [[0, 0, -radius * 1.4], [0, 0, radius * 1.4]], color);
  return node;
}
