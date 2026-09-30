// A page-local display preference only; the fixed-step simulation stays untouched.
export function setupPlaybackPreference() {
  const media = window.matchMedia('(prefers-reduced-motion: reduce)');
  let smooth = !media.matches;
  const container = document.createElement('div');
  container.className = 'playback-preference';
  const label = document.createElement('label');
  const checkbox = document.createElement('input');
  checkbox.type = 'checkbox';
  checkbox.checked = smooth;
  checkbox.setAttribute('aria-describedby', 'playback-preference-help');
  const text = document.createElement('span');
  const help = document.createElement('p');
  help.id = 'playback-preference-help';
  label.append(checkbox, text);
  container.append(label, help);
  document.querySelector('.action-buttons').after(container);
  let userChosen = false;
  checkbox.addEventListener('change', () => {
    userChosen = true;
    smooth = checkbox.checked;
  });
  media.addEventListener('change', () => {
    if (userChosen) return;
    smooth = !media.matches;
    checkbox.checked = smooth;
  });
  function localize() {
    const english = document.documentElement.lang === 'en';
    text.textContent = english ? 'Smooth playback' : '부드러운 재생';
    help.textContent = english
      ? 'When enabled, display updates follow your screen’s refresh rate. Simulation speed stays the same.'
      : '켜면 화면 주사율에 맞춰 표시합니다. 계산 속도는 그대로입니다.';
  }
  document.addEventListener('icar:lang', localize);
  localize();
  return { get matches() { return !smooth; } };
}
