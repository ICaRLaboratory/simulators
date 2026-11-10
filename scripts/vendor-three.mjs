// Regenerate the self-hosted vendor from exact external development packages.
import {readFile, writeFile, mkdir, copyFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL} from 'node:url';

const deps = process.env.THREE_DEPS;
if (!deps) throw new Error('Set THREE_DEPS to an external directory containing three@0.187.0 and esbuild@0.28.2');
const packageRoot = resolve(deps, 'node_modules/three');
const meta = JSON.parse(await readFile(resolve(packageRoot, 'package.json'), 'utf8'));
if (meta.version !== '0.187.0') throw new Error('Expected three@0.187.0');
const esbuild = await import(pathToFileURL(resolve(deps, 'node_modules/esbuild/lib/main.js')));
if (esbuild.version !== '0.28.2') throw new Error('Expected esbuild@0.28.2');
const out = new URL('../assets/vendor/', import.meta.url);
await mkdir(out, {recursive: true});
const file = new URL('three.js', out);
await esbuild.build({
  stdin: {contents: "export * from 'three'; export {OrbitControls} from 'three/addons/controls/OrbitControls.js';", resolveDir: resolve(deps)},
  outfile: file.pathname, bundle: true, format: 'esm', minify: true,
  charset: 'ascii', legalComments: 'none', target: 'es2022',
});
await copyFile(resolve(packageRoot, 'LICENSE'), new URL('THREE-LICENSE.txt', out));
const bytes = await readFile(file);
const manifest = {name: 'three', version: meta.version, license: meta.license,
  source: 'https://registry.npmjs.org/three/-/three-0.187.0.tgz',
  integrity: 'sha512-Qiu7R+Cmh8CstZsY1uJOSWnVlfo7ZtNLV7mF8Jltk3LB3AtDu9cRZlcnRKkAk8Y4z6KKw35z7Y7Urd7jWY8etA==',
  bundler: 'esbuild@0.28.2', sha256: createHash('sha256').update(bytes).digest('hex')};
await writeFile(new URL('three-manifest.json', out), JSON.stringify(manifest, null, 2) + '\n');
console.log(JSON.stringify({...manifest, bytes: bytes.length}));
