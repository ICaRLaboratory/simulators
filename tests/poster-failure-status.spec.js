import {test, expect} from '@playwright/test';
const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const failedView = {ko:'3D 화면을 불러올 수 없습니다.', en:'3D view unavailable.'};
for (const [id, blocked] of [
  ['inverted-pendulum','three/catalog.js'], ['inverted-pendulum','pendulum-physics.js'],
  ['cruise-control','physics.js'], ['drone','models/drone.js'],
]) test(`${id}: no loading notice after ${blocked} fails, including language switches`, async ({page})=>{
  await page.route('**/assets/'+blocked, route=>route.abort());
  await page.goto(`${base}${id}/?lang=en`);
  const stage=page.locator('.apparatus-stage');
  await expect(stage).toHaveAttribute('data-view','unavailable');
  for (const lang of ['en','ko','en']) {
    await page.locator(`[data-lang="${lang}"]`).click();
    await expect(stage.locator('[role=status]')).toHaveText(failedView[lang]);
    await expect(stage.locator('.apparatus-poster')).toBeVisible();
  }
  if (blocked.startsWith('three/')) await expect(page.locator('#start-pause')).toBeEnabled();
  else await expect(page.locator('#start-pause')).toBeDisabled();
});
