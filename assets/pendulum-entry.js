import {setupLanguage} from './i18n.js';
import {markPosterUnavailable} from './apparatus-start.js';

// A failed static physics import prevents the pendulum app itself from starting.
try {
  await import('./pendulum-app.js');
} catch (error) {
  const showError = () => {
    const en = document.documentElement.lang === 'en';
    document.getElementById('run-status').textContent = en ? 'Unavailable' : '사용 불가';
    document.getElementById('simulation-message').textContent = en
      ? 'Model unavailable. Reload this page to try again.' : '모델을 불러올 수 없습니다. 페이지를 새로고침하세요.';
  };
  for (const id of ['start-pause', 'disturb', 'reset']) document.getElementById(id).disabled = true;
  document.addEventListener('icar:lang', showError);
  setupLanguage();
  markPosterUnavailable();
  console.error('Experiment unavailable:', error);
}
