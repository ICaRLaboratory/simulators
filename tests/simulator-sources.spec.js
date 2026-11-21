import { test, expect } from '@playwright/test';
import { catalog } from '../assets/catalog.js';

const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';

test('aircraft: the numerical plant and the control app remain distinct in both languages', async ({ page }) => {
  await page.goto(`${base}aircraft-pitch/?lang=ko`);
  const sources = page.locator('.model-notes');
  const model = catalog.find(item => item.id === 'aircraft-pitch').source;
  for (const lang of ['ko', 'en', 'ko']) {
    await page.locator(`[data-lang=${lang}]`).click();
    await expect(sources.getByRole('link', { name: /MathWorks/ })).toHaveAttribute('href',
      'https://www.mathworks.com/help/control/ref/dynamicsystem.compreal.html#mw_e9be8f40-d51f-4bd0-89db-cf2ea697e2cf');
    await expect(sources.getByRole('link', { name: /MathWorks/ })).toHaveAttribute('href', model);
    await expect(sources.getByRole('link', { name: /Rick Hill/ })).toHaveAttribute('href', 'https://www.mathworks.com/matlabcentral/fileexchange/40798-aircraft-pitch-control');
    const scaling=sources.locator('math').filter({hasText:'56.7'});
    await expect(scaling).toHaveText('qweb=56.7x2');
    expect(await scaling.locator('msub').allTextContents()).toEqual(['qweb','x2']);
    for (const term of ['rad/s', 'File Exchange', 'LQR', 'PID']) await expect(sources).toContainText(term);
    await expect(sources).toContainText(lang === 'en' ? /pitch rate/i : /피치율/);
  }
});

test('CSTR: compare the example, the local calibration and the published benchmark', async ({ page }) => {
  await page.goto(`${base}cstr/?lang=ko`);
  const sources = page.locator('.model-notes');
  const project = catalog.find(item => item.id === 'cstr').source;
  for (const lang of ['ko', 'en', 'ko']) {
    await page.locator(`[data-lang=${lang}]`).click();
    await expect(sources.getByRole('link', { name: /Amini/ })).toHaveAttribute('href', project);
    await expect(sources.getByRole('link', { name: /APMonitor/ })).toHaveAttribute('href',
      'https://apmonitor.com/wiki/index.php/Apps/StirredReactor');
    for (const term of ['Henson', 'Seborg', '350 K', 'PI']) await expect(sources).toContainText(term);
    expect(await sources.locator('mfrac').allTextContents()).toEqual(['ER','160']);
    expect(await sources.locator('mfrac > :last-child').allTextContents()).toEqual(['R','60']);
    for (const pattern of lang === 'en' ? [/three states/i, /two states/i, /coolant temperature/i] : [/세 상태/, /두 상태/, /냉각수 온도/]) {
      await expect(sources).toContainText(pattern);
    }
  }
});
