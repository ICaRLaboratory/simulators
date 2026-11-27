// Generate the paired PID diagrams and marked formula runs in the handwritten pages.
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
  law: [`q=${pid}`], error: ['e=r-y'], rate: [tex`\dot y`], derivativeGain: ['(-K_d)'],
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
    figure: {
      plant: '공과 빔', title: '공과 빔 위치 음의 피드백 제어', caption: '2. 공과 빔 PID · 측정 위치 미분',
      output: 'x', applied: tex`\theta`, errorName: ['위치 오차', 'ball position error'],
      integral: ['빔 각도 명령의 적분 성분', 'the accumulated beam-angle contribution'],
      integralAlt: 'I는 적분 이득이 아니라 빔 각도 명령의 누적 성분입니다.',
      rateName: ['공의 선속도', 'ball velocity'],
      pathNote: '외란 버튼을 누를 때마다 공의 속도에 +0.6 m/s를 순간적으로 더합니다. 지속 부하나 일정 가속도가 아니며, θ에서 빼지 않습니다.',
      disturbanceLabel: '버튼을 누를 때마다 속도 변화',
    },
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
    figure: {
      plant: 'DC 모터', title: 'DC 모터 위치 음의 피드백 제어', caption: '2. DC 모터 PID · 측정 각도 미분',
      output: 'x', applied: 'u', errorName: ['각도 오차', 'shaft angle error'],
      integral: ['모델 입력 명령의 적분 성분', 'the accumulated command in model input units'],
      integralAlt: 'I는 적분 이득이 아니라 모델 입력 단위로 누적한 명령 성분입니다.',
      rateName: ['모터 각속도', 'shaft angular velocity'],
      pathNote: '외란 버튼은 일정 부하 d를 켜고 끕니다. u와 d는 모델의 입력 단위이며, 전압·토크의 물리 단위로 환산하지 않습니다.',
      disturbanceLabel: '입력에서 빼는 부하', load: true,
    },
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
    figure: {
      plant: '차량', title: '차량 속도 음의 피드백 제어', caption: '2. 차량 실험 PID · 측정 속도 미분',
      output: 'v', applied: 'F', errorName: ['속도 오차', 'speed error'],
      integral: ['구동·제동 힘 명령의 적분 성분', 'the accumulated drive or braking force contribution'],
      integralAlt: 'I는 적분 이득이 아니라 구동·제동 힘 명령의 누적 성분입니다.',
      rateName: ['차량 가속도', 'vehicle acceleration'],
      pathNote: '외란 버튼은 저항 부하 d를 켜고 끕니다. 힘 F에서 d를 뺀 뒤 차량에 전달합니다.',
      disturbanceLabel: '구동력에서 빼는 저항 부하', load: true,
    },
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

// The SVG and its math are generated at build time: the two views never need
// a mode switch, and the native Korean figures are complete without scripts.
const slot = name => `<!--math:${name}--><!--/math-->`;
const field = (x, y, width, height, body, attrs = '', css = '') =>
  `<foreignObject ${attrs ? attrs + ' ' : ''}x="${x}" y="${y}" width="${width}" height="${height}"><div xmlns="http://www.w3.org/1999/xhtml"${css ? ` class="${css}"` : ''}>${body}</div></foreignObject>`;
const wire = (arrow, d, attrs = '') => `<path ${attrs ? attrs + ' ' : ''}d="${d}" marker-end="url(#${arrow})"/>`;
const rect = (x, y, width, height) => `<rect x="${x}" y="${y}" width="${width}" height="${height}" rx="7"/>`;
const dot = (x, y) => `<circle class="pid-junction" cx="${x}" cy="${y}" r="3"/>`;
const marker = id => `<defs><marker id="${id}" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z"/></marker></defs>`;

function standardFigure() {
  const path = (d, attrs) => wire('ideal-arrow', d, attrs);
  const branches = [
    ['P', 27, 64, '비례 · 현재 오차', 'K_p e'],
    ['I', 108, 70, '적분 · 누적 오차', tex`K_i\int_0^t e(\tau)\,\mathrm d\tau`],
    ['D', 195, 64, '미분 · 오차 변화율', tex`K_d\dot e`],
  ];
  return `<figure class="pid-comparison" data-pid-view="standard"><figcaption>1. 표준 PID · 오차 미분</figcaption>
<svg class="loop-diagram" viewBox="0 0 1020 296" role="img" aria-labelledby="ideal-pid-title" aria-describedby="ideal-pid-desc">
<title id="ideal-pid-title">오차 입력을 사용하는 표준 PID</title>
<desc id="ideal-pid-desc">목표와 출력의 차이가 세 병렬 경로의 공통 입력입니다. 비례항, 적분항, 오차의 미분항을 더해 제어 대상을 구동합니다.</desc>
${marker('ideal-arrow')}
<g class="loop-wires">
${path('M35 143H119', 'class="loop-target"')}<circle cx="140" cy="143" r="18"/>
${path('M158 143H309')}${path('M255 143V59H309')}${path('M255 143V227H309')}${dot(255,143)}
${branches.map(([,y,h]) => rect(312,y,216,h)).join('')}
${path('M528 59H575V121')}${path('M528 143H554')}${path('M528 227H575V165')}<circle cx="575" cy="143" r="18"/>
${path('M593 143H728')}${rect(733,108,162,70)}${path('M895 143H990')}
${path('M950 143V277H140V164', 'data-signal="feedback"')}${dot(950,143)}
</g><g class="ideal-labels">
${field(26,98,58,38,math('r'))}${field(100,111,20,22,math('+'))}${field(147,160,21,23,math('-'))}${field(125,128,30,30,math(tex`\Sigma`))}
${field(161,102,92,33,math('e=r-y'))}
${branches.map(([name,y,h,meaning,term]) => field(312,y,216,h,
  `<span><b class="pid-branch-name">${name}</b>${meaning}</span>${math(term)}`, `data-branch="${name}"`, 'pid-branch')).join('\n')}
${field(560,128,30,30,math(tex`\Sigma`))}${field(591,101,141,33,math('u=P+I+D'))}
<text x="814" y="148">제어 대상</text>${field(925,99,53,35,math('y'))}
</g></svg></figure>`;
}

function controllerPanel({output, applied, errorName, integral, rateName}) {
  const term = (name, ko, en) => `<div class="pid-term" data-term="${name}"><b>${name}</b><span>${copy(ko, en)}</span></div>`;
  return `<strong>PID 제어기</strong>
<span class="pid-law">${slot('law')}</span>
<span>${math(tex`y=${output},\quad e=r-${output}`)}</span>
${term('P', `$K_p e$: 현재 ${errorName[0]}에 비례하는 명령입니다.`, `The current ${errorName[1]} sets the proportional correction $K_p e$.`)}
${term('I', tex`적분 이득 $K_i$가 증분 $\Delta I=K_i e\,\Delta t$를 정합니다. 입력 한계 안에 있거나 포화를 줄일 때만 이를 더합니다. $I$는 지속 오차를 보정하는 ${integral[0]}입니다.`,
  tex`The integral gain $K_i$ sets $\Delta I=K_i e\,\Delta t$. Add it only within the limit or to oppose saturation. $I$ is ${integral[1]} that corrects persistent error.`)}
${term('D', tex`$-K_d\dot y$는 측정한 ${rateName[0]} $\dot y=\dot ${output}$에 반대 방향으로 작용합니다.`,
  tex`$-K_d\dot y$ opposes the measured ${rateName[1]}, $\dot y=\dot ${output}$.`)}
<span class="pid-reason">${math(tex`\dot e=\dot r-\dot y`)}<br/>${math(tex`\dot r=0\Rightarrow\dot e=-\dot y`)}</span>
<span>${copy('목표값의 계단 변화를 미분하지 않아 미분 킥을 피합니다.', 'Differentiating only the output avoids derivative kick when the target steps.')}</span>
<span>${math(tex`${applied}=\operatorname{clip}(q,-L,L)`)}</span>`;
}

function experimentFigure(model) {
  const path = (d, attrs) => wire('loop-arrow', d, attrs);
  const {load, plant, title, caption, integralAlt, pathNote, disturbanceLabel} = model;
  const distX = load ? 675 : 810;
  const disturbance = load ? `<circle cx="675" cy="200" r="16"/>
${field(663,188,24,24,slot('loadSum'))}${field(634,171,24,24,slot('loadPositive'))}${field(684,155,24,24,slot('loadNegative'))}` : '';
  return `<figure class="pid-comparison" data-pid-view="experiment"><figcaption>${caption}</figcaption>
<svg class="loop-diagram" viewBox="0 0 1020 558" role="img" aria-labelledby="loop-svg-title" aria-describedby="loop-svg-desc">
<title id="loop-svg-title">${title}</title>
<desc id="loop-svg-desc">목표 r에서 출력 y를 빼 오차 e를 만듭니다. 제어기는 오차의 비례·적분 항과 측정 출력 변화율의 음의 미분 항을 합합니다. ${integralAlt} 목표가 일정하면 오차 변화율은 출력 변화율의 음수입니다. 출력만 미분해 목표값의 계단 변화에 따른 미분 킥을 피합니다. 입력 제한을 거쳐 ${plant}에 전달하고 실제 출력을 되먹임합니다. ${pathNote}</desc>
${marker('loop-arrow')}
<g class="loop-wires">
${path('M35 200H118', 'class="loop-target"')}<circle cx="140" cy="200" r="18"/>
${path('M162 200H197')}${path('M474 200H495')}
${load ? path('M615 200H655') + path('M695 200H728') : path('M615 200H728')}
${path('M895 200H990')}${path('M950 200V533H140V221', 'data-signal="feedback"')}${dot(950,200)}
${path('M950 490H335V471', 'data-signal="derivative"')}${dot(950,490)}
${disturbance}${path(`M${distX} 137V${load ? 181 : 166}`, 'data-signal="disturbance"')}
${rect(200,7,274,462)}${rect(500,168,115,70)}${rect(733,168,162,70)}
</g><g class="loop-labels">
${field(128,188,24,24,slot('sum'))}${field(101,167,24,24,slot('positive'))}${field(146,220,24,24,slot('negative'))}
${field(0,133,139,43,'<span>목표</span>'+slot('reference'))}${field(162,161,34,34,slot('errorSignal'))}
${field(201,8,272,460,controllerPanel(model),'data-signal="controller"','pid-explainer')}
${field(475,161,20,34,slot('request'))}<text x="557" y="194">입력 제한</text>${field(502,197,110,34,slot('saturation'))}
${field(load ? 613 : 617,215,load ? 57 : 93,31,slot('applied'),'data-signal="applied"')}
<text x="${distX}" y="91">${disturbanceLabel}</text>${field(distX-100,94,200,42,slot('disturbance'))}
<text x="814" y="197">${plant}</text><text x="814" y="222">플랜트</text>${field(895,140,120,32,slot('output'))}
${field(473,444,400,42,'<span>측정 변화율</span>'+slot('rate')+'<span>→ 미분 항</span>'+slot('derivativeGain'))}
${field(380,492,370,38,copy('출력', 'Output')+slot('feedbackOutput')+copy('→ 음의 피드백 ·', '→ negative feedback ·')+slot('error'))}
</g></svg></figure>`;
}

const args = process.argv.slice(2);
if (args.length && (args.length !== 1 || args[0] !== '--check')) throw Error('Expected [--check]');
for (const [id, { figure, ...runs }] of Object.entries(pages)) {
  const file = new URL(`../${id}/index.html`, import.meta.url);
  const before = await readFile(file, 'utf8');
  const remaining = new Set(Object.keys(runs));
  let template = before;
  if (figure) {
    const region = /<!--pid-pair-->[\s\S]*?<!--\/pid-pair-->/g;
    if ([...before.matchAll(region)].length !== 1) throw Error(`${id}: expected one pid-pair region`);
    template = before.replace(region, () => `<!--pid-pair-->\n${standardFigure()}\n${experimentFigure(figure)}\n<!--/pid-pair-->`);
  }
  const after = template.replace(/(<!--math:([\w-]+)-->)[\s\S]*?(<!--\/math-->)/g, (_, start, key, end) => {
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
