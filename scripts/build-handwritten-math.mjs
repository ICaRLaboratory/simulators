// Regenerate only the marked formula runs in the four handwritten apparatus pages.
// node scripts/build-handwritten-math.mjs [--check]
import { readFile, writeFile } from 'node:fs/promises';
import { math } from './paper-math.mjs';

const tex = String.raw;
const pid = tex`K_p e+I-K_d\dot y`;
// A whole sentence owns its word order; never translate a MathML parent via textContent.
// In these authored templates, $...$ delimits inline TeX. Only plain prose is escaped.
function copy(ko, en) {
  const sentence = text => text.split('$').map((part, i) => i % 2 ? math(part) :
    part.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')).join('');
  return [ ['ko', ko], ['en', en] ].map(([lang, text]) =>
    `<span class="hw-copy" lang="${lang}">${sentence(text)}</span>`).join('');
}
const step = tex`0.005\,\mathrm s`;
const sumSigns = { sum: [tex`\Sigma`], positive: ['+'], negative: ['-'] };
const loadSigns = { loadSum: sumSigns.sum, loadPositive: sumSigns.positive, loadNegative: sumSigns.negative };
const pidRuns = {
  ...sumSigns,
  step: [step], errorSignal: ['e'], request: ['q'], feedbackOutput: ['y'],
  integralNote: copy('미분은 오차가 아닌 측정 출력에 적용합니다. $I$는 적분 항의 누적 출력입니다.',
    'The derivative acts on measured output, not error. $I$ is the accumulated integral output.'),
  integrationNote: copy(tex`다음 두 조건 중 하나라도 만족하면 $I\gets I+\Delta I$로 갱신하고, 그 외에는 적분을 보류합니다 (조건부 적분 · anti-windup).`,
    tex`Update $I\gets I+\Delta I$ if either condition below holds; otherwise hold the integral (conditional integration / anti-windup).`),
  clockNote: copy(`고정 적분 간격 $${step}$ · 화면 갱신과 독립적으로 계산합니다. 탭을 숨기면 자동으로 일시정지하며, 다시 시작 버튼을 눌러야 재개됩니다.`,
    `Fixed $${step}$ integration step, independent of rendering. Hiding the tab pauses the experiment; press Start to resume.`),
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
    reference: [tex`r\;(\mathrm m)`], saturation: [tex`\pm0.25\,\mathrm{rad}`], applied: [tex`\theta\;(\mathrm{rad})`],
    disturbanceNote: copy(tex`외란 버튼을 누를 때마다 공의 속도에 $+0.6\,\mathrm{m/s}$를 순간적으로 더합니다. 지속 부하나 일정 가속도가 아니며, $\theta$에서 빼지 않습니다.`,
      tex`Each disturbance click instantly adds $+0.6\,\mathrm{m/s}$ to ball velocity. This is neither a persistent load nor constant acceleration, and is not subtracted from $\theta$.`),
    disturbance: [tex`\dot x\gets\dot x+0.6\,\mathrm{m/s}`],
    output: [tex`y=x\;(\mathrm{m})`],
    plant: [beam], signals: ['y=x', tex`\dot y=\dot x`],
    limits: [tex`u=\theta`, tex`L=0.25\,\mathrm{rad}`, gravity],
    stop: [tex`\lvert x\rvert\ge1\,\mathrm m`],
    summary: [beam, gravity, tex`\lvert\theta\rvert\le0.25\,\mathrm{rad}`, tex`x_{\mathrm{rail}}=\pm1\,\mathrm m`],
  },
  'dc-motor': {
    ...pidRuns, ...loadSigns,
    reference: [tex`r\;(\mathrm{rad})`], saturation: [tex`\pm100`], applied: ['u'],
    disturbanceNote: copy('외란 버튼은 일정 부하 $d$를 켜고 끕니다. $u$와 $d$는 모델의 입력 단위이며, 전압·토크의 물리 단위로 환산하지 않습니다.',
      'The disturbance button toggles a constant load $d$. Both $u$ and $d$ use model input units, not physical voltage or torque units.'),
    unitNote: copy('$u$와 $d$는 모델의 입력 단위이며, 전압·토크의 물리 단위로 환산하지 않습니다.',
      'Both $u$ and $d$ use model input units, not physical voltage or torque units.'),
    disturbance: [tex`d\in\{0,2\}`],
    output: [tex`y=x\;(\mathrm{rad})`],
    plant: [motor], signals: [tex`y=x=\theta`, tex`\dot y=\dot x`],
    limits: ['L=100'],
    summary: [motor, tex`\lvert u\rvert\le100`, tex`d\in\{0,2\}`],
  },
  'cruise-control': {
    ...pidRuns, ...loadSigns,
    reference: [tex`r\;(\mathrm{m/s})`], saturation: [tex`\pm8000\,\mathrm N`], applied: [tex`F\;(\mathrm N)`],
    disturbanceNote: copy('외란 버튼은 저항 부하 $d$를 켜고 끕니다. 힘 $F$에서 $d$를 뺀 뒤 차량에 전달합니다.',
      'The disturbance button toggles resistive load $d$. Subtract $d$ from force $F$ before applying it to the vehicle.'),
    disturbance: [tex`d\in\{0,600\}\,\mathrm N`],
    output: [tex`y=v\;(\mathrm{m/s})`],
    plant: [cruise], signals: ['y=v', tex`\dot y=\dot v`],
    limits: ['u=F', tex`L=8000\,\mathrm N`],
    summary: [cruise, tex`\lvert F\rvert\le8000\,\mathrm N`, tex`d\in\{0,600\}\,\mathrm N`],
  },
  'inverted-pendulum': {
    step: [step], reference: [tex`r\;(\mathrm m)`], request: ['F'], saturation: [tex`\pm20\,\mathrm N`], applied: [tex`u\;(\mathrm N)`],
    state: [tex`x,v,\theta,\omega`], signedError: ['x-r'], reversedError: ['r-x'], angle: [tex`\theta`], fixedStep: [step],
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
    const run = runs[key];
    return start + (Array.isArray(run) ? run.map(math).join(' ') : run) + end;
  });
  if (remaining.size) throw Error(`${id}: missing math runs: ${[...remaining].join(', ')}`);
  if (before !== after) {
    if (args.includes('--check')) throw Error(`${id}: stale math; run node scripts/build-handwritten-math.mjs`);
    await writeFile(file, after);
  }
}
