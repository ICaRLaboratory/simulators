import test from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {existsSync, readFileSync, readdirSync} from 'node:fs';
import {catalog} from '../assets/catalog.js';

const root = new URL('../assets/startup-posters/', import.meta.url);
const apparatus = catalog.filter(item => item.view === 'apparatus' && !item.external);

test('startup posters cover only the internal apparatuses, at both viewport sizes', () => {
  const expected = apparatus.flatMap(({id}) => [`${id}.webp`, `${id}-narrow.webp`]).sort();
  assert.ok(existsSync(root), 'startup poster directory missing');
  assert.deepEqual(readdirSync(root).sort(), ['manifest.json', ...expected].sort());
  const {images, browser, viewports} = JSON.parse(readFileSync(new URL('manifest.json', root)));
  assert.match(browser, /^Chromium [\d.]+$/);
  assert.deepEqual(images.map(entry => entry.file).sort(), expected);
  assert.deepEqual(viewports, {desktop: {width: 1280, height: 900}, narrow: {width: 390, height: 844}});
  assert.equal(new Set(images.map(entry => entry.sha256)).size, expected.length, 'duplicate image');
  for (const entry of images) {
    const {id, variant, file, source, clock, renderer, engine, webgl, driver, width, height, sha256} = entry;
    assert.equal(file, `${id}${variant === 'narrow' ? '-narrow' : ''}.webp`);
    assert.ok(Object.hasOwn(viewports, variant));
    assert.equal(source, `${id}/?lang=en`);
    assert.equal(clock, '0.00', file);
    assert.equal(renderer, 'three');
    assert.match(engine, /^three\.js r\d+$/);
    assert.match(webgl, /^WebGL 2\.0/);
    assert.match(driver, /SwiftShader/);
    const image = readFileSync(new URL(file, root));
    assert.equal(image.toString('ascii', 0, 4), 'RIFF', file);
    assert.equal(image.readUInt32LE(4) + 8, image.length, file);
    assert.equal(image.toString('ascii', 8, 12), 'WEBP', file);
    // Chromium can insert VP8X and a color profile before the lossy keyframe.
    let offset = 12;
    while (offset + 8 <= image.length && image.toString('ascii', offset, offset + 4) !== 'VP8 ') {
      const length = image.readUInt32LE(offset + 4);
      offset += 8 + length + length % 2;
    }
    assert.ok(offset + 18 <= image.length, `${file}: missing VP8 keyframe`);
    assert.equal(image.readUInt16LE(offset + 14) & 0x3fff, width, file);
    assert.equal(image.readUInt16LE(offset + 16) & 0x3fff, height, file);
    assert.ok(width > 200 && height > 200 && width <= viewports[variant].width, file);
    assert.equal(createHash('sha256').update(image).digest('hex'), sha256, file);
    assert.equal(image.length, entry.bytes, file);
  }
});
