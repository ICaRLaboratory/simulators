// node scripts/build-pid-lti-comparison.mjs [--check]
// This fragment belongs to the standalone PID lab, not the apparatus or MPC pages.
import {readFile, writeFile} from 'node:fs/promises';
import {copy} from './fundamentals-math.mjs';
import {math} from './paper-math.mjs';
import {INPUT_LIMIT, DISTURBANCE_START} from '../assets/models/fundamentals-conditions.js';

const tex = String.raw;
const integral = tex`K_i\int_0^t e(\tau)\,\mathrm{d}\tau`;
const req = tex`u_{\mathrm{req}}`;
const plantInput = tex`u_{\mathrm{plant}}`;
const rect = (x,y,w,h,cls='block') => `<rect class="${cls}" x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>`;
const label = (x,y,w,h,html) => `<foreignObject x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" class="pid-label">${html}</div></foreignObject>`;
const signal = (x,y,w,h,formula) => label(x,y,w,h,math(formula));
const dot = (x,y) => `<circle class="tap" cx="${x}" cy="${y}" r="3.5"/>`;
const sum = (x,y) => `<circle class="junction" cx="${x}" cy="${y}" r="15"/>${signal(x-12,y-13,24,26,tex`\Sigma`)}`;
const standard = {
  title: ['1. 표준 PID · 오차 미분','1. Standard PID · derivative on error'],
  desc: ['목표와 출력의 차가 세 병렬 경로로 나뉩니다. 비례 항은 현재 오차, 적분 항은 누적 오차, 미분 항은 오차 변화율에 각 이득을 곱합니다. 세 항의 합을 플랜트에 전달하고 출력을 음의 피드백으로 되돌립니다.',
    'The reference minus the output feeds three parallel branches. P weights the present error, I its integral, and D its derivative. Their sum drives the plant; its output returns as negative feedback.'],
};
const experiment = {
  title: ['2. LTI 실험 · 출력 미분','2. LTI experiment · derivative on output'],
  desc: ['단위 목표와 출력의 차가 P와 I에 입력됩니다. D는 오차 대신 출력 속도에 음의 미분 이득을 곱해 목표 변경에 따른 미분 킥을 피합니다. 끈 항의 이득은 0입니다. 적분 항은 포화 중에도 갱신됩니다. 구동기는 요구 입력을 ±4로 제한하며, 외란은 그 뒤에 더해집니다.',
    'The unit reference minus the output feeds P and I. D uses negative gain times output velocity, avoiding derivative kick at the reference step. Disabled terms have zero gain. The integral contribution continues to evolve during saturation. The actuator clips the requested sum to ±4 before the disturbance is added.'],
};

function diagram(actual) {
  const view = actual ? 'experiment' : 'standard';
  const {title, desc} = actual ? experiment : standard;
  const id = `pid-${view}`, endY = actual ? 474 : 404;
  const wire = d => `<path class="wire" d="${d}" marker-end="url(#${id}-arrow)"/>`;
  const branch = (name,cy,formula,height=48) => `<g data-branch="${name}">${rect(219,cy-height/2,195,height)}${signal(220,cy-height/2,193,height,formula)}</g>`;
  // e fans out to all three branches only in the standard diagram. In the
  // experiment the velocity state leaves the plant and enters D from below.
  const controller = `<g data-controller="${view}">
${rect(158,8,344,endY-39,'frame')}
${label(163,12,334,31,copy('strong',actual ? ['선택한 제어 항','Selectable terms'] : ['병렬 PID 제어기','Parallel PID controller']))}
${wire('M92 140H218')}${wire('M195 140V74H218')}${dot(195,140)}
${actual ? wire('M898 173V248H317V231') : wire('M195 140V206H218')}
${branch('P',74,'P=K_p e')}
${branch('I',140,actual ? tex`\dot I=K_i e,\quad I(0)=0` : `I=${integral}`,actual ? 48 : 58)}
${branch('D',206,actual ? 'D=-K_d v' : tex`D=K_d\dot e`)}
${wire('M414 74H458V124')}${wire('M414 140H442')}${wire('M414 206H458V156')}${sum(458,140)}
${signal(92,107,66,28,actual ? 'e=1-y' : 'e=r-y')}
${actual ? label(161,254,338,181,
    math(`${req}=P+I+D`) + math(`${req}=K_p e+I-K_d\\dot y`) + math(tex`\dot r=0\;\Rightarrow\;\dot e=-\dot y`) +
    copy('p',['D항은 출력을 미분하므로 목표 변경 시 미분 킥이 없습니다. 점선 항은 꺼져 있어 이득이 0입니다. 포화 중에도 $I$는 $K_i e$를 적분합니다.',
      'D uses output velocity, avoiding derivative kick at the reference step. Dashed branches are off (zero gain). $I$ integrates $K_i e$ even during saturation.']))
  : label(161,234,338,133,math('u=P+I+D') + math(`u=K_p e+${integral}+K_d\\dot e`) +
    copy('p',['세 항은 각각 현재 오차, 누적 오차, 오차 변화율에 비례합니다.',
      'The terms weight the present error, its integral and its rate of change.']))}
</g>`;
  const actuator = `${wire('M473 140H539')}${signal(502,105,37,30,req)}
${rect(540,105,178,69)}${label(541,106,176,67,copy('strong',['구동기 포화','Actuator saturation']) + math(`u=\\operatorname{clip}(${req},-${INPUT_LIMIT},${INPUT_LIMIT})`))}
${wire('M718 140H743')}${signal(719,110,27,24,'u')}
${sum(759,140)}${wire('M759 72V124')}${label(667,35,184,35,copy('span',['입력 외란 $d$','Input disturbance $d$']))}
${signal(769,92,22,23,'+')}${wire('M774 140H845')}${signal(775,105,70,30,plantInput)}
${signal(725,160,120,32,`${plantInput}=u+d`)}${signal(706,212,135,30,tex`v=\dot y`)}`;
  const svg = `<svg viewBox="0 0 1040 ${endY+16}" role="img" aria-labelledby="${id}-caption" aria-describedby="${id}-desc">
${copy('desc',desc,` id="${id}-desc"`)}
<defs><marker id="${id}-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z"/></marker></defs>
${controller}
${wire('M12 140H61')}${signal(5,92,49,25,actual ? 'r=1' : 'r')}${sum(77,140)}${signal(43,113,21,21,'+')}${signal(82,159,22,21,'-')}
${actual ? actuator : wire('M473 140H845') + signal(632,104,47,30,'u')}
${rect(846,107,110,66)}${label(847,108,108,64,copy('strong',['플랜트','Plant']) + math('G(s)'))}
${wire('M956 140H1023')}${signal(969,104,40,29,'y')}${dot(986,140)}${wire(`M986 140V${endY}H77V156`)}
</svg>`;
  return `<figure data-pid-view="${view}">
${copy('figcaption',title,` id="${id}-caption"`)}
<div class="pid-flow-scroll" role="region" tabindex="0" aria-labelledby="${id}-caption">${svg}</div>
</figure>`;
}

const fragment = `<section class="panel pid-lti-comparison" aria-labelledby="pid-compare-title">
<div class="panel-heading">${copy('h2',['제어 구조 비교','Compare the control loops'],' id="pid-compare-title"')}</div>
${copy('p',['작은 화면에서는 각 구조도를 좌우로 스크롤하세요.','On small screens, scroll each diagram horizontally.'],' class="pid-pan-hint"')}
${diagram(false)}
${diagram(true)}
${copy('p',[`외란은 기본값이 0이며, 설정하면 ${DISTURBANCE_START}초부터 플랜트 입력에 더해집니다. 그래프는 0.01초 간격의 값을 기록하지만 RK4는 각 단계에서 제어입력을 다시 계산합니다. 구간 내에서 일정하게 유지하는 것은 외란이지 제어입력이 아닙니다.`,
  `The disturbance is zero by default; a selected step adds to the plant input from ${DISTURBANCE_START} s. The plots record values every 0.01 s, but RK4 evaluates the controller at each of its four stages. The disturbance, not the command, is held over the interval.`],' class="pid-clock-note"')}
</section>`;

const args = process.argv.slice(2);
if (args.length && args.join(' ') !== '--check') throw Error('Expected [--check]');
const file = new URL('../pid-lti/index.html', import.meta.url);
const before = await readFile(file,'utf8');
const region = /<!--pid-lti-comparison-->[\s\S]*?<!--\/pid-lti-comparison-->/g;
if ([...before.matchAll(region)].length !== 1) throw Error('Expected one PID comparison region');
const after = before.replace(region, () => `<!--pid-lti-comparison-->\n${fragment}\n<!--/pid-lti-comparison-->`);
if (after !== before) {
  if (args.length) throw Error('Stale PID comparison: run node scripts/build-pid-lti-comparison.mjs');
  await writeFile(file,after);
}
