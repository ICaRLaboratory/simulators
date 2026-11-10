import * as T from '../vendor/three.js';
import {createApparatusCamera,resizeApparatusCamera} from './camera.js';
import {studioEnvironment} from './lighting.js';
import {createReadoutLayer} from './readouts.js';

let nextId = 0;
function stylesheet() {
  const href = new URL('./view.css', import.meta.url).href;
  if (Array.from(document.querySelectorAll('link[rel="stylesheet"]')).some(link => link.href === href)) return;
  const link = document.createElement('link'); link.rel = 'stylesheet'; link.href = href;
  document.head.append(link);
}

// This renderer only consumes snapshots. It never advances a model or starts a frame loop.
export function createView(host, model, options = {}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('webgl2', {antialias: true, alpha: false, preserveDrawingBuffer: true});
  if (!context) return null;
  stylesheet();
  let renderer;
  try { renderer = new T.WebGLRenderer({canvas, context, antialias: true, preserveDrawingBuffer: true}); }
  catch { return null; }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFSoftShadowMap;
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1;

  const scene = new T.Scene(); scene.background = new T.Color(0xe6eae8); scene.add(model.root);
  let environment;
  try { environment=studioEnvironment(renderer);scene.environment=environment.texture;scene.environmentIntensity=.85; }
  catch { /* Direct lighting remains usable when environment-map creation is unavailable. */ }
  // Context loss may precede its DOM event; do not let an adapter hide the 2D view.
  if(context.isContextLost()){environment?.dispose();renderer.dispose();return null;}
  scene.add(new T.HemisphereLight(0xeaf0ef, 0x687473, .85));
  const span = model.camera.span || 5;
  scene.fog=new T.Fog(0xe6eae8,span*2,span*6);
  const light = new T.DirectionalLight(0xfff8ee, 2.6);
  light.position.set(span * 0.6, span * 1.4, span * 0.8);
  light.castShadow = true; light.shadow.mapSize.set(1024, 1024);
  Object.assign(light.shadow.camera, {left:-span, right:span, top:span, bottom:-span, near:0.1, far:span * 8});
  light.shadow.bias = -0.0001; light.shadow.normalBias = 0.006;light.shadow.radius=3;
  scene.add(light);
  const fill = new T.DirectionalLight(0xdce8ef, .6); fill.position.set(-span, span * 0.4, -span); scene.add(fill);
  const camera = createApparatusCamera(model.camera);
  const controls = new T.OrbitControls(camera, canvas);
  controls.target.fromArray(model.camera.target);
  controls.enableDamping = false; controls.minZoom = 0.45; controls.maxZoom = 4;
  if(camera.isPerspectiveCamera){
    const distance=camera.position.distanceTo(controls.target);
    controls.minDistance=distance/4;controls.maxDistance=distance/.45;
  }
  controls.minPolarAngle = 0.05; controls.maxPolarAngle = Math.PI * 0.86;
  controls.update(); controls.saveState();

  const element = document.createElement('div'); element.className = 'three-view';
  element.classList.toggle('three-view--compact',!!options.compactControls);
  const viewport = document.createElement('div'); viewport.className = 'three-viewport';
  const toolbar = document.createElement('div'); toolbar.className = 'three-toolbar';
  const help = document.createElement('p'); help.className = 'three-help'; help.id = `three-help-${++nextId}`;
  const reset = document.createElement('button'); reset.type = 'button'; reset.className = 'three-reset';
  if (options.compactControls) {
    reset.classList.add('three-reset--icon');
    reset.innerHTML = '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M3 10a9 9 0 1 1 2.6 8.4M3 4v6h6"/></svg>';
  }
  const legend = document.createElement('p'); legend.className = 'three-legend';
  canvas.dataset.renderer = 'three'; canvas.tabIndex = 0; canvas.setAttribute('role', 'img');
  canvas.setAttribute('aria-describedby', help.id);
  canvas.style.cssText = 'display:block;width:100%;height:100%;touch-action:none';
  viewport.append(canvas); toolbar.append(help, reset); element.append(viewport, toolbar, legend); host.append(element);
  const readouts=createReadoutLayer(viewport,model,!!options.compactControls);
  host.dataset.renderer = 'three';
  let disposed = false, lost = false, width = 0, height = 0;
  let currentLanguage=options.lang||document.documentElement.lang;

  function render() {
    if (disposed || lost || !canvas.isConnected) return;
    const rect = viewport.getBoundingClientRect();
    if (rect.width < 2 || rect.height < 2) return;
    if (rect.width !== width || rect.height !== height) {
      width = rect.width; height = rect.height;
      renderer.setSize(width, height, false);
      resizeApparatusCamera(camera,model.camera,width/height);
    }
    renderer.render(scene, camera);
    readouts.update(camera,width,height,currentLanguage);
  }
  function update(state, params, extras = {}) {
    if (disposed) return;
    model.update(state, params, extras);
    render();
  }
  function setLanguage(lang) {
    currentLanguage=lang;
    const english = lang === 'en';
    help.textContent = english ? 'Drag to orbit · Scroll to zoom' : '드래그로 회전 · 스크롤로 확대';
    help.title = english ? 'Keyboard: arrows orbit, + / - zoom, Home resets the view.' : '키보드: 방향키 회전, + / - 확대·축소, Home 시점 초기화';
    const resetLabel = english ? 'Reset view' : '시점 초기화';
    reset.setAttribute('aria-label', resetLabel); reset.title = resetLabel;
    if (!options.compactControls) reset.textContent = resetLabel;
    const label = typeof options.label === 'function' ? options.label(lang)
      : options.label && typeof options.label === 'object' ? options.label[english ? 'en' : 'ko'] : options.label;
    canvas.setAttribute('aria-label', `${label || (english ? '3D apparatus' : '3D 장치')}. ${help.title}`);
    legend.textContent = model.legend?.[english ? 'en' : 'ko'] || '';
    legend.hidden = !legend.textContent;
    element.lang = english ? 'en' : 'ko';
    if(width&&height)readouts.update(camera,width,height,currentLanguage);
  }
  function keydown(event) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (event.key === 'Home') { event.preventDefault(); controls.reset(); render(); return; }
    if (['+', '=', '-', '_'].includes(event.key)) {
      event.preventDefault();
      camera.zoom = T.MathUtils.clamp(camera.zoom * (['+', '='].includes(event.key) ? 1.12 : 1 / 1.12), controls.minZoom, controls.maxZoom);
      camera.updateProjectionMatrix(); controls.update(); render(); return;
    }
    const horizontal = {ArrowLeft: -0.12, ArrowRight: 0.12}[event.key];
    const vertical = {ArrowUp: -0.1, ArrowDown: 0.1}[event.key];
    if (horizontal === undefined && vertical === undefined) return;
    event.preventDefault();
    const offset = camera.position.clone().sub(controls.target);
    const spherical = new T.Spherical().setFromVector3(offset);
    spherical.theta += horizontal || 0;
    spherical.phi = T.MathUtils.clamp(spherical.phi + (vertical || 0), controls.minPolarAngle, controls.maxPolarAngle);
    camera.position.copy(controls.target).add(offset.setFromSpherical(spherical));
    controls.update(); render();
  }
  function resetCamera() { controls.reset(); render(); }
  function languageChanged() { setLanguage(document.documentElement.lang); }
  function contextLost(event) { event.preventDefault(); lost = true; options.onContextLost?.(event); }
  function contextRestored() { lost = false; render(); }
  function pageHide(event) { if (!event.persisted) dispose(); }
  controls.addEventListener('change', render);
  reset.addEventListener('click', resetCamera);
  canvas.addEventListener('keydown', keydown);
  canvas.addEventListener('webglcontextlost', contextLost);
  canvas.addEventListener('webglcontextrestored', contextRestored);
  document.addEventListener('icar:lang', languageChanged);
  window.addEventListener('pagehide', pageHide);
  const observer = new ResizeObserver(render); observer.observe(viewport);
  function dispose() {
    if (disposed) return;
    disposed = true; observer.disconnect();
    controls.removeEventListener('change', render); controls.dispose();
    reset.removeEventListener('click', resetCamera); canvas.removeEventListener('keydown', keydown);
    canvas.removeEventListener('webglcontextlost', contextLost); canvas.removeEventListener('webglcontextrestored', contextRestored);
    document.removeEventListener('icar:lang', languageChanged); window.removeEventListener('pagehide', pageHide);
    const geometries = new Set(), materials = new Set();
    model.root.traverse(node => { if (node.geometry) geometries.add(node.geometry);
      for (const mat of Array.isArray(node.material) ? node.material : node.material ? [node.material] : []) materials.add(mat); });
    geometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose());
    light.shadow.map?.dispose();environment?.dispose(); renderer.dispose(); renderer.forceContextLoss();
    element.remove(); delete host.dataset.renderer;
  }
  setLanguage(options.lang || document.documentElement.lang); render();
  return {update, render, resize: render, dispose, setLanguage, canvas, element};
}
