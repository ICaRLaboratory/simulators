import {upgradeApparatus} from './apparatus.js';

const mechanisms = ['cruise-control', 'dc-motor', 'ball-and-beam', 'inverted-pendulum', 'rotary-pendulum', 'ball-and-plate'];
const robots = ['robot-arm', 'parking', 'path-tracking'];
const processes = ['heat-exchanger', 'drone', 'suspension', 'cstr', 'aircraft-pitch', 'rocket-landing'];
export const EXPERIMENT_IDS = Object.freeze([...mechanisms, ...robots, 'impedance-robot', ...processes]);

export async function attachApparatus(canvas, id, options = {}) {
  canvas.dataset.renderer = 'canvas2d';
  let model;
  if (mechanisms.includes(id)) model = (await import('./mechanism-scenes.js')).createMechanismScene(id);
  else if (id === 'impedance-robot') model = (await import('./gen3-scene.js')).createImpedanceScene();
  else if (robots.includes(id)) model = (await import('./robot-scenes.js')).createRobotScene(id);
  else if (processes.includes(id)) model = (await import('./process-scenes.js')).createProcessScene(id);
  else throw new Error(`No Three.js scene for ${id}`);
  return upgradeApparatus(canvas, model, options);
}
