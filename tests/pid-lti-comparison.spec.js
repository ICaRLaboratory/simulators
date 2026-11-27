import {test, expect} from '@playwright/test';
const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';

test('the static pair shows which signal each derivative uses', async ({browser}) => {
  const context = await browser.newContext({javaScriptEnabled:false, viewport:{width:320,height:800}});
  try {
    const page = await context.newPage();
    await page.goto(`${base}pid-lti/`);
    const figures = page.locator('[data-pid-view]');
    await expect(figures).toHaveCount(2);
    const [standard, actual] = [figures.nth(0), figures.nth(1)];
    await expect(standard).toHaveAttribute('data-pid-view','standard');
    await expect(actual).toHaveAttribute('data-pid-view','experiment');
    await expect(standard.locator('[data-branch="D"] mover > mi')).toHaveText('e');
    await expect(actual.locator('[data-branch="D"] math')).toHaveText('D=−Kdv');
    await expect(actual.locator('[data-branch="I"] mover > mi')).toHaveText('I');
    await expect(actual.locator('[data-branch="I"]')).toContainText('I(0)=0');
    await expect(actual.getByRole('img')).toHaveAccessibleDescription(/출력.*미분 킥/);
    const blocks = actual.locator('g[data-controller]');
    await expect(blocks).toContainText('미분 킥');
    await expect(actual.locator('svg')).toContainText('uplant=u+d');
  } finally { await context.close(); }
});

test('KO → EN → KO: both loops stay legible and only the lab branches follow the controls', async ({page}) => {
  await page.goto(`${base}pid-lti/?lang=ko&disturbance=2`);
  const standard = page.locator('[data-pid-view="standard"]'), actual = page.locator('[data-pid-view="experiment"]');
  for (const [lang,width] of [['ko',1280],['en',320],['ko',320]]) {
    await page.setViewportSize({width,height:800});
    await page.locator(`[data-lang=${lang}]`).click();
    await page.evaluate(() => document.fonts.ready);
    await expect(actual.getByRole('img')).toHaveAccessibleDescription(lang === 'ko' ? /미분 킥/ : /derivative kick/);
    const [a,b] = await Promise.all([standard.boundingBox(),actual.boundingBox()]);
    expect(b.y).toBeGreaterThanOrEqual(a.y+a.height-1);
    expect(b.x).toBe(a.x);
    for (const figure of [standard,actual]) {
      await expect(figure.locator('figcaption')).toContainText(lang === 'ko' ? /미분/ : /derivative/);
      const overflow = await figure.locator('foreignObject').evaluateAll(labels => labels.flatMap(label => {
        const box=label.getBoundingClientRect(), walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT);
        const bad=[];
        for (let n; (n=walker.nextNode());) {
          const r=document.createRange(); r.selectNodeContents(n);
          if ([...r.getClientRects()].some(t=>t.width && (t.top<box.top-1 || t.bottom>box.bottom+1 || t.left<box.left-1 || t.right>box.right+1))) bad.push(n.textContent);
        }
        return bad;
      }));
      expect(overflow).toEqual([]);
      if (width===320) {
        expect(await figure.getByRole('region').evaluate(el=>{
          el.scrollLeft=el.scrollWidth;
          return el.scrollLeft>0 && el.querySelector('svg').getBoundingClientRect().right<=el.getBoundingClientRect().right+1;
        })).toBe(true);
      }
    }
    expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
    await expect(page.locator('.pid-clock-note')).toContainText(lang==='ko' ? /각 단계/ : /four stages/);
  }
  for (const name of ['P','I','D']) {
    const key=name.toLowerCase(), check=page.locator(`#enable-${key}`);
    const branch=actual.locator(`[data-branch="${name}"] rect`);
    await check.uncheck();
    await expect(branch).not.toHaveCSS('stroke-dasharray','none');
    await expect(page.locator(`#pid-terms-plot [data-series="${key}"]`)).toHaveCount(0);
    await expect(standard.locator(`[data-branch="${name}"] rect`)).toHaveCSS('stroke-dasharray','none');
    await check.check();
    await expect(branch).toHaveCSS('stroke-dasharray','none');
    await expect(page.locator(`#pid-terms-plot [data-series="${key}"]`)).toBeVisible();
  }
});
