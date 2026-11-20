// Regenerate the published math font, stylesheet and their notices.
import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';

const out = new URL('../assets/vendor/paper-math/', import.meta.url);
const pkg = new URL('../node_modules/temml/', import.meta.url);
const raw = 'https://raw.githubusercontent.com/';
const files = [
  ['STIXTwoMath.woff2', raw + 'ronkok/Temml/4ffdf0e56577c426375d0b2818f8895edb5e5030/site/assets/STIXTwoMath.woff2', '77610d8c347e1f71a700ef6e6b970eff3d6383d10fee735572c73e5d2138cd4b'],
  ['STIX-OFL.txt', raw + 'stipub/stixfonts/bea1dc9a3cc2d8b57e412dfd0f448a84382dfe46/OFL.txt', '0c8825913b60d858aacdb33c4ca6660a7d64b0d6464702efbb19313f5765861a'],
  ['Temml-STIX2.css', new URL('dist/Temml-STIX2.css', pkg), 'e8e17549df716ffc30d3a063dcde31aa3199b1309373e4fe54c87375f98826d0'],
  ['Temml-LICENSE.txt', new URL('LICENSE', pkg), '12b4e5592a12baaf50637881f2cb9d66667b26b8d51a73cd8f0d6bcefe176ab6'],
];
await mkdir(out, {recursive:true});
for (const [file, src, hash] of files) {
  let bytes;
  if (src instanceof URL) bytes = await readFile(src);
  else {
    const response = await fetch(src, {signal:AbortSignal.timeout(30000)});
    if (!response.ok) throw Error(`${src}: ${response.status}`);
    bytes = Buffer.from(await response.arrayBuffer());
  }
  if (createHash('sha256').update(bytes).digest('hex') !== hash) throw Error(`Unexpected upstream bytes: ${file}`);
  // Do not alter font data. Text copies differ only in trailing whitespace.
  const content = file.endsWith('.woff2') ? bytes : bytes.toString('utf8').replace(/[ \t]+$/gm, '');
  await writeFile(new URL(file, out), content);
}
