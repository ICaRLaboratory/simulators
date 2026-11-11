import { test, expect } from '@playwright/test';
import { writeFile } from 'node:fs/promises';
import { Simulation } from '../assets/models/drone.js';

const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/simulators/';
test.use({ launchOptions: { executablePath: process.env.CHROMIUM_PATH,
  args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-accelerated-2d-canvas'] } });

async function instrument(page) {
  await page.addInitScript(() => {
    const nativeFrame = window.requestAnimationFrame.bind(window);
    window.droneNativeFrame = () => new Promise(resolve => nativeFrame(resolve));
    let next = 0, now = 0;
    const callbacks = new Map();
    window.requestAnimationFrame = callback => { callbacks.set(++next, callback); return next; };
    window.cancelAnimationFrame = id => callbacks.delete(id);
    window.droneClockReset = () => { now = 0; };
    window.droneFrame = () => {
      now += 20;
      const batch = [...callbacks.values()]; callbacks.clear();
      for (const callback of batch) callback(now);
    };
    window.droneRenders = [];
  });
  // Expose a detached snapshot of the actual private app state/history; do not replace its logic.
  await page.route('**/assets/experiment-app.js', async route => {
    const response = await route.fetch(), source = await response.text(), marker = 'function frame(now)';
    expect(source.split(marker)).toHaveLength(2);
    await route.fulfill({ response, body: source.replace(marker,
      `window.droneSnapshot = () => structuredClone({state:simulation.state,params:simulation.params,history});\n ${marker}`) });
  });
  // Three assigns render on the renderer instance, not its prototype. Sample AFTER the real GPU draw.
  await page.route('**/assets/three/view.js', async route => {
    const response = await route.fetch(), source = await response.text();
    const marker = 'renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));';
    expect(source.split(marker)).toHaveLength(2);
    await route.fulfill({ response, body: source.replace(marker, `
      const originalRender = renderer.render;
      let rotorResources;
      renderer.render = function(scene, camera) {
        const result = originalRender.call(this, scene, camera);
        const rig = scene.getObjectByName('drone-rig');
        if (rig) {
          const keys = ['left-front','left-rear','right-front','right-rear'];
          const resources = [];
          const rotors = keys.map(key => {
            const blade = rig.getObjectByName('rotor-blade-' + key);
            const detail = rig.getObjectByName('detail-rotor-blade-' + key);
            const disc = rig.getObjectByName('rotor-disc-' + key);
            const detailDisc = rig.getObjectByName('detail-rotor-disc-' + key);
            for (const object of [blade,detail,disc,detailDisc]) resources.push(object,object.geometry,object.material,
              object.geometry.attributes.position,object.geometry.attributes.position.array,
              object.geometry.attributes.position.array.buffer);
            return {key,local:[...blade.matrix.elements],world:[...blade.matrixWorld.elements],
              angle:blade.rotation.y,detailLocal:[...detail.matrix.elements],detailWorld:[...detail.matrixWorld.elements],
              opacity:disc.material.opacity,visible:disc.visible,
              detailOpacity:detailDisc.material.opacity,detailVisible:detailDisc.visible};
          });
          rotorResources ||= resources;
          const record = {t:window.droneSnapshot().state.t,rotors,
            camera:[...camera.matrixWorld.elements],projection:[...camera.projectionMatrix.elements],
            stableResources:resources.every((resource,i) => resource === rotorResources[i]),
            triangles:renderer.info.render.triangles,drawCalls:renderer.info.render.calls,
            width:renderer.domElement.width,height:renderer.domElement.height};
          window.droneRenders.push(record);
          if (window.droneRenders.length > 100) window.droneRenders.shift();
          window.droneLastRender = record;
        }
        return result;
      };
      ${marker}`) });
  });
}
async function frames(page, count) {
  await page.evaluate(async count => {
    await window.droneNativeFrame();
    for (let i = 0; i < count; i++) {
      window.droneFrame();
      if ((i + 1) % 4 === 0) await window.droneNativeFrame();
    }
    await window.droneNativeFrame();
  }, count);
}
const snapshot = page => page.evaluate(() => window.droneSnapshot());
const rendered = page => page.evaluate(() => window.droneLastRender);
const bladePose = record => record.rotors.map(rotor => rotor.local);
function matchingDetail(record) {
  expect(record.stableResources).toBe(true);
  expect(record.triangles).toBeGreaterThan(0);
  expect(record.drawCalls).toBeGreaterThan(0);
  for (const rotor of record.rotors) {
    // Signed zeros may differ after cloning, but exact element equality remains required.
    expect(rotor.local.every((value, i) => value === rotor.detailLocal[i])).toBe(true);
    expect(rotor.detailOpacity).toBe(rotor.opacity);
    expect(rotor.detailVisible).toBe(rotor.visible);
  }
}

for (const viewport of [{ width: 1360, height: 1000 }, { width: 390, height: 844 }]) {
  for (const motion of ['no-preference', 'reduce']) {
    test(`drone illustrative rotors: actual render playback/pause/reset/camera ${viewport.width}px ${motion}`, async ({ page }, testInfo) => {
      test.setTimeout(60000);
      const errors = [], warnings = [];
      page.on('pageerror', error => errors.push(error.message));
      page.on('console', message => {
        if (message.type() === 'error') errors.push(message.text());
        if (message.type() === 'warning') warnings.push(message.text());
      });
      await page.setViewportSize(viewport); await page.emulateMedia({ reducedMotion: motion });
      await instrument(page);
      await page.goto(`${base}drone/?lang=en`);
      const canvas = page.locator('#apparatus');
      await expect(canvas).toHaveAttribute('data-renderer', 'three');
      await expect(page.locator('#start-pause')).toBeEnabled();
      await page.waitForFunction(() => window.droneLastRender?.t === 0, null, { polling: 50, timeout: 5000 });
      const initial = await snapshot(page), initialRender = await rendered(page);
      matchingDetail(initialRender);
      await frames(page, 6);
      expect(await snapshot(page)).toEqual(initial); // No autoplay, including reduced motion.
      expect(bladePose(await rendered(page))).toEqual(bladePose(initialRender));
      await expect(page.locator('.three-legend')).toContainText('not calculated RPM');
      await page.locator('[data-lang=ko]').click();
      await expect(page.locator('.three-legend')).toContainText('RPM 계산 아님');
      await page.locator('[data-lang=en]').click();
      expect(await snapshot(page)).toEqual(initial);

      await page.evaluate(() => window.droneClockReset());
      await page.locator('#start-pause').click();
      await frames(page, 6);
      const first = await rendered(page);
      expect(first.t).toBeGreaterThan(0);
      expect(bladePose(first)).not.toEqual(bladePose(initialRender));
      const changes = first.rotors.map((rotor, i) => rotor.angle - initialRender.rotors[i].angle);
      expect(changes[0]).toBeGreaterThan(0); expect(changes[0]).toBeLessThan(Math.PI / 4);
      expect(changes[0]).toBeCloseTo(-changes[1], 12);
      expect(changes[0]).toBeCloseTo(-changes[2], 12);
      expect(changes[0]).toBeCloseTo(changes[3], 12);
      await page.locator('.three-view').screenshot({ path: testInfo.outputPath('motion-a.png') });
      await frames(page, 8);
      const second = await rendered(page);
      expect(second.t).toBeGreaterThan(first.t);
      expect(bladePose(second)).not.toEqual(bladePose(first));
      matchingDetail(second);
      await page.locator('.three-view').screenshot({ path: testInfo.outputPath('motion-b.png') });
      await page.locator('#start-pause').click();
      const paused = await snapshot(page), pausedRender = await rendered(page);
      const control = new Simulation();
      for (let i = 0; i < Math.round(paused.state.t / .005); i++) control.step(.005);
      expect(paused.state).toEqual(control.state);
      await frames(page, 6);
      expect(await snapshot(page)).toEqual(paused);
      expect(bladePose(await rendered(page))).toEqual(bladePose(pausedRender));

      await canvas.focus(); await expect(canvas).toBeFocused();
      await canvas.press('ArrowRight'); await canvas.press('+');
      const orbited = await rendered(page);
      expect(orbited.camera).not.toEqual(pausedRender.camera);
      expect(bladePose(orbited)).toEqual(bladePose(pausedRender));
      expect(orbited.rotors.map(rotor => rotor.world)).toEqual(pausedRender.rotors.map(rotor => rotor.world));
      expect(await snapshot(page)).toEqual(paused);
      await page.locator('.three-view').screenshot({ path: testInfo.outputPath('paused-camera.png') });
      for (const width of [viewport.width - 30, viewport.width]) {
        await page.setViewportSize({ width, height: viewport.height });
        // The simulation RAF is controlled; layout polling must not wait on that frozen queue.
        await page.waitForFunction(() => {
          const canvas = document.getElementById('apparatus'), rect = canvas.getBoundingClientRect();
          return Math.abs(canvas.width - rect.width * Math.min(devicePixelRatio, 2)) < 1;
        }, null, { polling: 50, timeout: 5000 });
        expect(await snapshot(page)).toEqual(paused);
        expect(bladePose(await rendered(page))).toEqual(bladePose(pausedRender));
      }
      await page.locator('.three-reset').click();
      expect(await snapshot(page)).toEqual(paused);
      expect(bladePose(await rendered(page))).toEqual(bladePose(pausedRender));
      await page.emulateMedia({ reducedMotion: motion === 'reduce' ? 'no-preference' : 'reduce' });
      await frames(page, 3);
      expect(await snapshot(page)).toEqual(paused);
      expect(bladePose(await rendered(page))).toEqual(bladePose(pausedRender));

      await page.locator('#reset').click();
      expect(await snapshot(page)).toEqual(initial);
      expect(bladePose(await rendered(page))).toEqual(bladePose(initialRender));
      await page.evaluate(() => window.droneClockReset());
      await page.locator('#start-pause').click(); await frames(page, 14);
      await page.locator('#start-pause').click();
      const replay = await snapshot(page), replayRender = await rendered(page);
      expect(replay).toEqual(paused);
      expect(bladePose(replayRender)).toEqual(bladePose(pausedRender));
      const records = await page.evaluate(() => window.droneRenders);
      for (const record of records) matchingDetail(record);
      expect(errors).toEqual([]);
      await writeFile(testInfo.outputPath('render-evidence.json'), JSON.stringify({ viewport, motion,
        method: 'Actual WebGLRenderer instance render interception after original GPU draw; controlled app RAF only',
        initial, paused, replay, first, second, pausedRender, orbited, replayRender, records, errors, warnings }, null, 2));
    });
  }
}
