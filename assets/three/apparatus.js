import {createView} from './view.js';

// Keep the original canvas and its 2D context intact for unavailable/lost WebGL.
export function upgradeApparatus(canvas, model, options = {}) {
  canvas.dataset.renderer = 'canvas2d';
  const host = options.host || document.createElement('div');
  if (!options.host) {
    host.className = 'three-apparatus';
    if (canvas.getBoundingClientRect().height >= 400) host.dataset.large = 'true';
    canvas.before(host);
  }
  const id = canvas.id, originalDisplay = canvas.style.display;
  let view;
  function fallback() {
    const old = view; view = null;
    old?.dispose(); host.remove();
    canvas.id = id; canvas.style.display = originalDisplay; canvas.removeAttribute('aria-hidden');
    options.onFallback?.();
  }
  view = createView(host, model, {label: options.label || (() => canvas.getAttribute('aria-label')),
    lang: document.documentElement.lang, onContextLost: fallback});
  if (!view) { host.remove(); return null; }
  canvas.id = `${id}-fallback`; canvas.style.display = 'none'; canvas.setAttribute('aria-hidden', 'true');
  view.canvas.id = id;
  return {
    update(state, params, extras) { if (!view) return false; view.update(state, params, extras); return true; },
    render() { view?.render(); },
    setLanguage(lang) { view?.setLanguage(lang); },
    dispose: fallback,
  };
}
