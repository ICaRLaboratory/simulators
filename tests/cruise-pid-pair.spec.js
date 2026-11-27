import { test, expect } from '@playwright/test';

const root = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
const models = {
  'cruise-control': { signal: 'v', applied: 'F', integral: ['구동·제동 힘', 'drive or braking force'], rate: ['차량 가속도', 'vehicle acceleration'] },
  'dc-motor': { signal: 'x', applied: 'u', integral: ['모델 입력', 'model input units'], rate: ['모터 각속도', 'shaft angular velocity'] },
  'ball-and-beam': { signal: 'x', applied: 'θ', integral: ['빔 각도', 'beam-angle'], rate: ['공의 선속도', 'ball velocity'] },
};

for (const [id, model] of Object.entries(models)) {
  test(`${id}: standard error PID and implemented measurement PID are distinct, visible and described`, async ({ page }) => {
    await page.goto(`${root}${id}/?lang=ko`);
    const figures = page.locator('.control-loop .loop-viewport figure');
    await expect(figures).toHaveCount(2);
    const standard = figures.nth(0), actual = figures.nth(1), image = actual.getByRole('img');
    await expect(standard).toHaveAttribute('data-pid-view', 'standard');
    await expect(actual).toHaveAttribute('data-pid-view', 'experiment');
    await expect(page.locator('.loop-details')).toBeHidden();

    const branches = standard.locator('[data-branch]');
    await expect(branches.locator('.pid-branch-name')).toHaveText(['P', 'I', 'D']);
    await expect(branches.nth(0).locator('math')).toHaveText('Kpe');
    await expect(branches.nth(1)).toContainText('∫');
    await expect(branches.nth(1).locator('mi').filter({hasText:/^e$/})).toHaveCount(1);
    await expect(branches.nth(2).locator('mover > mi')).toHaveText('e');
    await expect(standard.locator('path[data-signal=feedback]')).toHaveCount(1);
    await expect(standard.locator('[data-signal=derivative]')).toHaveCount(0);
    for (const route of ['feedback', 'derivative', 'disturbance']) {
      await expect(actual.locator(`path[data-signal=${route}]`)).toHaveCount(1);
    }

    const block = actual.locator('[data-signal=controller]');
    await expect(block.locator('.pid-law math')).toHaveText('q=Kpe+I−Kdy˙');
    await expect(block.locator('.pid-law mover > mi')).toHaveText('y');
    await expect(block.locator('.pid-reason math')).toHaveText(['e˙=r˙−y˙','r˙=0⇒e˙=−y˙']);
    await expect(block.locator('math:visible').last()).toContainText(`${model.applied}=clip`);
    for (const [lang, width] of [['ko', 1280], ['en', 320], ['ko', 320]]) {
      await page.setViewportSize({width, height: 900});
      await page.locator(`[data-lang=${lang}]`).click();
      await page.evaluate(() => document.fonts.ready);
      const [a,b] = await Promise.all([standard.boundingBox(), actual.boundingBox()]);
      expect(b.y).toBeGreaterThanOrEqual(a.y + a.height - 1);
      expect(Math.abs(a.x - b.x)).toBeLessThan(1);
      const en = lang === 'en', i = Number(en);
      const copy = name => block.locator(`[data-term=${name}] .hw-copy[lang=${lang}]:visible`);
      await expect(copy('P')).toContainText(en ? 'proportional correction' : '현재');
      await expect(copy('I')).toContainText(model.integral[i]);
      await expect(copy('I')).toContainText(en ? 'integral gain' : '적분 이득');
      await expect(copy('I').locator('math')).toHaveText(['Ki', 'ΔI=KieΔt', 'I']);
      await expect(copy('D')).toContainText(model.rate[i]);
      await expect(copy('D').locator('math')).toHaveText(['−Kdy˙', `y˙=${model.signal}˙`]);
      await expect(block.locator(`.hw-copy[lang=${lang}]:visible`).filter({hasText: en ? 'derivative kick' : '미분 킥'})).toBeVisible();
      // A role=img can hide the foreignObject subtree from assistive tech.
      // Check the image's computed description, not just visible labels or raw <desc>.
      await expect(image).toHaveAccessibleDescription(new RegExp(model.integral[i]));
      await expect(image).toHaveAccessibleDescription(en ? /accumulated.*not the integral gain/ : /적분 이득이 아니라.*누적/);
      await expect(image).toHaveAccessibleDescription(en ? /constant target.*negative output rate/ : /목표가 일정하면.*출력 변화율의 음수/);
      await expect(image).toHaveAccessibleDescription(en ? /derivative kick when the target steps/ : /목표값의 계단 변화에 따른 미분 킥/);
    }
  });
}
