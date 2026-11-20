// Regenerate only the marked formula runs in the four handwritten apparatus pages.
// node scripts/build-handwritten-math.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { math } from './paper-math.mjs';

const tex = String.raw;
const pid = tex`K_p e+I-K_d\dot y`;
const pidRuns = {
  law: [pid], error: ['e=r-y'], rate: [tex`\dot y`], derivativeGain: ['(-K_d)'],
  controller: ['e=r-y', `q=${pid}`, tex`u=\operatorname{clip}(q,-L,L)`],
  candidate: [tex`\Delta t=0.005\,\mathrm{s}`, tex`\Delta I=K_i e\,\Delta t`, tex`q^{*}=K_p e-K_d\dot y+I+\Delta I`],
  integrate: [tex`\lvert q^{*}\rvert\le L\quad\lor\quad q^{*}\Delta I<0`],
  clear: [tex`K_i=0\ \Rightarrow\ I\gets0`],
};
const beam = tex`\ddot x=\frac{5g}{7}\sin\theta-0.15\dot x`;
const motor = tex`\ddot x+10\dot x=10(u-d)`;
const cruise = tex`1000\dot v=F-50v-d`;
const gravity = tex`g=9.81\,\mathrm{m/s^2}`;
const feedback = tex`k_x(x-r)+k_v v+k_{\theta}\theta+k_{\omega}\omega`;
const pages = {
  'ball-and-beam': {
    ...pidRuns,
    disturbance: [tex`\dot x\gets\dot x+0.6\,\mathrm{m/s}`],
    output: [tex`y=x\;(\mathrm{m})`],
    plant: [beam], signals: ['y=x', tex`\dot y=\dot x`],
    limits: [tex`u=\theta`, tex`L=0.25\,\mathrm{rad}`, gravity],
    stop: [tex`\lvert x\rvert\ge1\,\mathrm m`],
    summary: [beam, gravity, tex`\lvert\theta\rvert\le0.25\,\mathrm{rad}`, tex`x_{\mathrm{rail}}=\pm1\,\mathrm m`],
  },
  'dc-motor': {
    ...pidRuns,
    disturbance: [tex`d\in\{0,2\}`],
    output: [tex`y=x\;(\mathrm{rad})`],
    plant: [motor], signals: [tex`y=x=\theta`, tex`\dot y=\dot x`],
    limits: ['L=100'],
    summary: [motor, tex`\lvert u\rvert\le100`, tex`d\in\{0,2\}`],
  },
  'cruise-control': {
    ...pidRuns,
    disturbance: [tex`d\in\{0,600\}\,\mathrm N`],
    output: [tex`y=v\;(\mathrm{m/s})`],
    plant: [cruise], signals: ['y=v', tex`\dot y=\dot v`],
    limits: ['u=F', tex`L=8000\,\mathrm N`],
    summary: [cruise, tex`\lvert F\rvert\le8000\,\mathrm N`, tex`d\in\{0,600\}\,\mathrm N`],
  },
  'inverted-pendulum': {
    law: [feedback], disturbance: [tex`\Delta\omega=+0.5\,\mathrm{rad/s}`],
    plant: [tex`D=M+m\sin^2\theta`,
      tex`\dot v=\frac{u-bv+m\ell\omega^2\sin\theta-mg\sin\theta\cos\theta}{D}`,
      tex`\dot\omega=\frac{g\sin\theta-\dot v\cos\theta}{\ell}`, tex`\dot x=v`, tex`\dot\theta=\omega`],
    parameters: [tex`M=1\,\mathrm{kg}`, tex`m=0.2\,\mathrm{kg}`, tex`\ell=0.5\,\mathrm m`,
      tex`b=0.1\,\mathrm{N\!\cdot\!s/m}`, gravity],
    controller: [`F=${feedback}`, tex`u=\operatorname{clip}(F,-20,20)\,\mathrm N`],
    stop: [tex`\lvert\theta\rvert\ge\frac{\pi}{3}\,\mathrm{rad}\quad\lor\quad\lvert x\rvert\ge2\,\mathrm m`],
  },
};

const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== '--check')) throw Error('Expected [--check]');
for (const [id, runs] of Object.entries(pages)) {
  const file = new URL(`../${id}/index.html`, import.meta.url);
  const before = await readFile(file, 'utf8');
  const remaining = new Set(Object.keys(runs));
  const after = before.replace(/(<!--math:([\w-]+)-->)[\s\S]*?(<!--\/math-->)/g, (_, start, key, end) => {
    if (!remaining.delete(key)) throw Error(`${id}: unknown or duplicate math run ${key}`);
    return start + runs[key].map(math).join(' ') + end;
  });
  if (remaining.size) throw Error(`${id}: missing math runs: ${[...remaining].join(', ')}`);
  if (before !== after) {
    if (args.includes('--check')) throw Error(`${id}: stale math; run node scripts/build-handwritten-math.mjs`);
    await writeFile(file, after);
  }
}
