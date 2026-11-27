// Serve the exact source tree: python3 -m http.server 8765 --bind 127.0.0.1
// SIM_BASE=http://127.0.0.1:8765/ node scripts/capture-startup-posters.mjs [--check]
// Use Chromium from the lockfile's Playwright (npx playwright install chromium).
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdir, readFile, writeFile} from 'node:fs/promises';
import {chromium} from 'playwright';
import {catalog} from '../assets/catalog.js';

const args = process.argv.slice(2);
if (args.length && !(args.length === 1 && args[0] === '--check')) throw Error('Usage: capture-startup-posters.mjs [--check]');
const check = args.includes('--check');
const base = process.env.SIM_BASE || 'http://127.0.0.1:8765/';
const out = new URL('../assets/startup-posters/', import.meta.url);
const items = catalog.filter(item => item.view === 'apparatus' && !item.external);
const viewports = {desktop: {width: 1280, height: 900}, narrow: {width: 390, height: 844}};
const quality = 0.90;

async function capture(browser, item, variant) {
  const page = await browser.newPage({viewport: viewports[variant], deviceScaleFactor: 1,
    locale: 'en-US', reducedMotion: 'reduce', colorScheme: 'light'});
  try {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const source = `${item.href}?lang=en`;
    const response = await page.goto(new URL(source, base).href);
    assert.ok(response?.ok(), `HTTP ${response?.status()}: ${source}`);
    const canvas = page.locator('canvas#apparatus[data-renderer="three"]');
    await canvas.waitFor({state: 'visible'});
    // There are no clicks, simulated frames or camera actions. Let stylesheet/resize
    // observers settle, then read only the preserved framebuffer (no HTML labels).
    await page.evaluate(async () => {
      await document.fonts.ready;
      await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
    });
    const {dataURL, ...observed} = await canvas.evaluate((node, {id, quality}) => {
      const dataset = document.body.dataset;
      if ((dataset.experiment || dataset.simulator) !== id) throw Error('Wrong experiment');
      const clock = document.querySelector('#sim-time').textContent;
      if (clock !== '0.00' || document.querySelector('#run-status').textContent !== 'Paused' ||
          document.querySelector('#start-pause').disabled) throw Error(`Not paused at startup: ${clock}`);
      const gl = node.getContext('webgl2');
      if (!(gl instanceof WebGL2RenderingContext) || gl.isContextLost() ||
          !/^three\.js r\d+$/.test(node.dataset.engine)) throw Error('Missing live Three.js WebGL2 renderer');
      const driver = gl.getParameter(gl.getExtension('WEBGL_debug_renderer_info').UNMASKED_RENDERER_WEBGL);
      if (!driver.includes('SwiftShader')) throw Error(`Unexpected renderer: ${driver}`);
      const {width, height} = node;
      if (width < 200 || height < 200 || width !== gl.drawingBufferWidth || height !== gl.drawingBufferHeight) {
        throw Error(`Invalid drawing buffer: ${width} x ${height}`);
      }
      const rgba = new Uint8Array(width * height * 4), colors = new Set();
      gl.readPixels(0, 0, width, height, gl.RGBA, gl.UNSIGNED_BYTE, rgba);
      // A small car in a full-track view can be missed by a sparse sampling stride.
      for (let i = 0; i < rgba.length && colors.size < 100; i += 4) {
        if (rgba[i + 3]) colors.add((rgba[i] << 16) | (rgba[i + 1] << 8) | rgba[i + 2]);
      }
      if (colors.size < 100) throw Error(`Empty or flat framebuffer: ${colors.size} sampled colors`);
      return {dataURL: node.toDataURL('image/webp', quality), clock, renderer: node.dataset.renderer,
        engine: node.dataset.engine, webgl: gl.getParameter(gl.VERSION), driver, width, height};
    }, {id: item.id, quality});
    const prefix = 'data:image/webp;base64,';
    assert.ok(dataURL.startsWith(prefix), 'Browser did not encode WebP');
    assert.deepEqual(errors, []);
    const bytes = Buffer.from(dataURL.slice(prefix.length), 'base64');
    const file = `${item.id}${variant === 'narrow' ? '-narrow' : ''}.webp`;
    return {bytes, record: {id: item.id, variant, file, source, ...observed, bytes: bytes.length,
      sha256: createHash('sha256').update(bytes).digest('hex')}};
  } catch (cause) {
    throw new Error(`${item.id}/${variant}: ${cause.message}`, {cause});
  } finally {
    await page.close();
  }
}

const browser = await chromium.launch({executablePath: process.env.CHROMIUM_PATH,
  args: ['--enable-webgl', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--js-flags=--random-seed=42']});
const manifest = {browser: `Chromium ${browser.version()}`, deviceScaleFactor: 1, quality, viewports, images: []};
const outputs = new Map();
try {
  for (const item of items) for (const variant of Object.keys(viewports)) {
    const {record, bytes} = await capture(browser, item, variant);
    outputs.set(record.file, bytes);
    manifest.images.push(record);
  }
} finally {
  await browser.close();
}
assert.ok(items.length && new Set(manifest.images.map(r => r.sha256)).size === items.length * 2, 'Missing or duplicate images');
outputs.set('manifest.json', Buffer.from(JSON.stringify(manifest, null, 2) + '\n'));
if (!check) await mkdir(out, {recursive: true});
for (const [file, bytes] of outputs) {
  const path = new URL(file, out);
  if (check) assert.ok(bytes.equals(await readFile(path)), `Recapture differs: ${file}`);
  else await writeFile(path, bytes);
}
console.log(`${check ? 'Verified byte-for-byte' : 'Captured'}: ${manifest.images.length} startup posters, ${items.length} apparatuses, ${manifest.browser}.`);
