// Keep playback independent of the asynchronous choice of apparatus renderer.
export function startApparatus(canvas, id, redraw) {
  const host = document.createElement('div');
  host.className = 'three-apparatus';
  if (canvas.getBoundingClientRect().height >= 400) host.dataset.large = 'true';
  // Reserve the actual desktop/mobile viewport while the heavier scene loads.
  const style = document.createElement('link');
  style.rel = 'stylesheet'; style.href = new URL('./three/view.css', import.meta.url).href;
  if (![...document.styleSheets].some(sheet => sheet.href === style.href)) document.head.append(style);
  const status = document.createElement('p');
  status.className = 'apparatus-loading'; status.setAttribute('role', 'status');
  function localize() {
    status.textContent = document.documentElement.lang === 'en' ? 'Preparing 3D view…' : '3D 장면 준비 중…';
  }
  localize(); document.addEventListener('icar:lang', localize);
  host.append(status); canvas.before(host); canvas.classList.add('apparatus-standby');

  let pending = true, view = null;
  function finish() {
    pending = false;
    document.removeEventListener('icar:lang', localize);
    status.remove(); canvas.classList.remove('apparatus-standby');
    if (!view) { host.remove(); canvas.dataset.renderer = 'canvas2d'; }
    redraw();
  }
  async function load() {
    try {
      const {attachApparatus} = await import('./three/catalog.js');
      view = await attachApparatus(canvas, id, {host, onFallback() { view = null; finish(); }});
    } catch (error) {
      console.warn('3D view unavailable; using the 2D apparatus.', error);
    }
    finish();
  }
  load();
  // Returning false is the caller's signal to draw its original 2D view.
  return {update(...args) { return pending || (view?.update(...args) ?? false); }};
}
