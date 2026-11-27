function localizePoster(stage) {
  const status = stage.querySelector('.apparatus-loading');
  const english = document.documentElement.lang === 'en';
  status.textContent = stage.dataset.view === 'unavailable'
    ? (english ? '3D view unavailable.' : '3D 화면을 불러올 수 없습니다.')
    : (english ? 'Loading…' : '로딩 중…');
}

// Apply the current state after page-specific document translation has run.
window.addEventListener('icar:lang', () => {
  const stage = document.querySelector('.apparatus-stage');
  if (stage) localizePoster(stage);
});

export function markPosterUnavailable(stage = document.querySelector('.apparatus-stage')) {
  if (!stage) return;
  stage.dataset.view = 'unavailable';
  localizePoster(stage);
}

// The static HTML poster owns the first paint. Playback never waits for WebGL.
export function startApparatus(canvas, id, redraw) {
  const stage = canvas.previousElementSibling;
  const host = document.createElement('div');
  host.className = 'three-apparatus';
  stage.append(host);
  let view = null;

  function unavailable() {
    view = null;
    host.remove();
    markPosterUnavailable(stage);
  }
  localizePoster(stage);
  async function load() {
    try {
      const {attachApparatus} = await import('./three/catalog.js');
      view = await attachApparatus(canvas, id, {host, onFallback: unavailable});
      if (!view) { unavailable(); return; }
      redraw(); // The user may already have adjusted or started the simulation.
      if (view) stage.dataset.view = 'three';
    } catch (error) {
      console.warn('3D view unavailable.', error);
      view?.dispose();
      unavailable();
    }
  }
  load();
  return {update(...args) { view?.update(...args); }};
}
