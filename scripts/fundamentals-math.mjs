// Static fragments for the five graph labs. Each array in a row is a set of
// clauses that may wrap independently without breaking a fraction or matrix.
import {math} from './paper-math.mjs';
import {coefficients} from '../assets/models/second-order.js';
import {DURATION, DISTURBANCE_START, INPUT_LIMIT} from '../assets/models/fundamentals-conditions.js';
import {plantEquation} from '../assets/plant-equation.js';

export const defaultPlant = plantEquation(coefficients());
export const eq = (...clauses) => `<p class="eq">${clauses.map(math).join(' ')}</p>`;
const tex = String.raw;
export const plantRow = (ddc=false) => eq(tex`G(s)=\frac{b}{s^2+a_1s+a_0},`,
  ddc ? tex`b=K_{\mathrm{DC}}\omega_n^2,` : tex`b=K\omega_n^2,`,
  tex`a_1=2\zeta\omega_n,`, tex`a_0=\omega_n^2`);

export const classicalRows = {
  pid: plantRow() + '\n' + eq(tex`u_{\mathrm{req}}=K_p e+K_i\int e\,\mathrm{d}t-K_d\dot y,`, 'e=r-y'),
  mpc: eq(tex`G(s)=\frac{K\omega_n^2}{s^2+2\zeta\omega_n s+\omega_n^2}`)
    + '\n' + eq(tex`J=\sum_{j=1}^{N}(\hat y_j-1)^2`, tex`{}+\lambda\big[(u_0-u_{-1})^2+(u_1-u_0)^2\big]`),
};

export const escape = s => String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
function inline(source) {
  const parts=source.split('$');
  if(parts.length%2!==1) throw Error(`Unclosed inline formula in ${source}`);
  return parts.map((s,i)=>i%2 ? math(s) : escape(s)).join('');
}
// Keep both word orders intact. Only the selected copy is in the reading tree;
// its English template is inert until the existing language switch selects it.
export function copy(tag, [ko,en], attrs='') {
  if(!ko.includes('$') && !en.includes('$'))return `<${tag}${attrs} data-en="${escape(en)}">${escape(ko)}</${tag}>`;
  return `<${tag}${attrs}>${inline(ko)}</${tag}><template data-math-en>${inline(en)}</template>`;
}
export function plantNote(lab) {
  const clock={mpc:'0.2',ddc:'0.2',smc:'0.02',tdc:'0.02'}[lab];
  const ko=clock?`제어기: 이산시간, $T_s=${clock}$초.`:'제어기: 연속시간 PID (RK4 적분 간격 0.01초).';
  const en=clock?`Controller: sampled, $T_s=${clock}\\,\\mathrm{s}$.`:'Controller: continuous PID (RK4 step 0.01 s).';
  return copy('p',[
    `공통 조건: $y(0)=v(0)=0$, $r=1$, ${DURATION}초, 측정 잡음 없음. 구동기 입력 $u$의 한계는 $\\pm${INPUT_LIMIT}$입니다. 플랜트 입력은 $u+d$이며, 입력 외란 $d$는 ${DISTURBANCE_START}초부터 @value@입니다. ${ko}`,
    `Shared plant: $y(0)=v(0)=0$, $r=1$, ${DURATION} s, no measurement noise. The actuator limits $u$ to $\\pm${INPUT_LIMIT}$. The plant receives $u+d$; the input disturbance steps from 0 to @value@ at ${DISTURBANCE_START} s. ${en}`,
  ],' id="plant-conditions" class="method-caption" hidden').replaceAll('@value@','<span data-disturbance-value>0</span>');
}

export const classicalNotes={
  pid:[
    copy('p',[
      tex`모든 초기 상태는 0이며 목표값은 0에서 1로 바뀝니다. $K$는 제어기 비례 이득 $K_p$와 구별되는 플랜트의 정상상태 이득입니다.`,
      tex`All initial states are zero. The reference steps from 0 to 1. $K$ is the plant DC gain, distinct from the controller gain $K_p$.`,
    ]),
    copy('p',[
      tex`D항은 측정 출력의 미분에 작용하므로 목표 변경 순간의 미분 킥은 없습니다. 구동기는 요구 입력의 합을 $\pm4$로 제한하며, 입력 외란은 그 뒤에 더해집니다. 포화 중에도 오차를 적분합니다(안티와인드업 미적용).`,
      tex`D acts on the measured output derivative, avoiding derivative kick. The actuator clips the requested sum to $\pm4$ before the external disturbance is added. The integral continues to accumulate during saturation (no anti-windup).`,
    ]),
    copy('p',[
      tex`포화와 외란이 없는 선형 폐루프에서 $K_i=0$이면 정상상태 오차는 $\frac{1}{1+K\cdot K_p}$입니다. $K_i>0$일 때는 $(a_1+b\cdot K_d)(a_0+b\cdot K_p)>b\cdot K_i$이면 안정하며 정상상태 오차가 0입니다. 끈 항의 이득은 0입니다.`,
      tex`For the unsaturated, disturbance-free loop with $K_i=0$, the steady-state error is $\frac{1}{1+K\cdot K_p}$. With $K_i>0$ it is zero if $(a_1+b\cdot K_d)(a_0+b\cdot K_p)>b\cdot K_i$. Disabled terms have zero effective gain.`,
    ]),
  ].join('\n'),
  mpc:[
    copy('p',[
      tex`시스템은 정지 상태에서 시작하고 MPC는 단위 계단 입력을 20초간 추종합니다. 샘플 주기는 0.2초이며, 구간마다 입력을 일정하게 유지한 정확 이산 모델을 사용합니다. 위치와 속도는 잡음 없이 측정합니다. MPC는 외란이 없는 모델로 예측하며, 실제 플랜트에만 $u+d$가 작용합니다. 계획 입력 한계는 고정된 구동기 한계 $\pm4$보다 좁게 설정할 수 있습니다.`,
      tex`The plant starts at rest. MPC tracks a unit step for 20 s using an exact zero-order-hold model at a 0.2 s sample period. MPC measures position and velocity without noise. It predicts with no disturbance; only the real plant receives $u+d$. The planning bound may be tighter than the fixed $\pm4$ actuator limit.`,
    ]),
    copy('p',[
      tex`MPC는 매 시점에서 입력 한계를 만족하는 두 값, 즉 다음 한 구간의 입력과 그 뒤 예측 구간 끝까지 유지할 입력을 선택합니다. 위 목적함수를 최소화한 뒤 첫 입력만 적용합니다. $u_{-1}$은 직전에 적용한 입력이며 초깃값은 0입니다. 종단 비용과 종단 제약은 없습니다.`,
      tex`At each instant MPC chooses two inputs within the bounds: one for the next interval and a second held for the rest of the prediction horizon. It minimizes the objective above, applies the first input only, and repeats. The last applied input is $u_{-1}$ (initially zero). There is no terminal penalty or terminal constraint.`,
    ]),
  ].join('\n'),
};

export const panelMath={
  pid:{
    output:copy('span',['출력 $y$','Output $y$'],' class="actual-line"'),
    applied:copy('span',['적용 입력 $u$','Applied $u$'],' class="sum-key"'),
    error:copy('span',[tex`공칭 정상상태 오차 $e_\infty$`,tex`Nominal steady-state error $e_\infty$`]),
    compareGain:copy('li',['P만 켠 채 $K_p$를 높여 상승 속도와 20초 시점 출력을 비교하세요.','With P alone, increase $K_p$ and compare the rise speed and the output at 20 s.']),
    effort:math(tex`u_{\mathrm{req}}=P+I+D`),
    target:copy('span',['목표 $r=1$','Reference $r=1$'],' class="target-line"'),
  },
  mpc:{
    horizon:copy('label',['예측 구간 $N$','Prediction horizon $N$'],' for="mpc-horizon"'),
    weight:copy('label',['입력 변화 가중치 $λ$','Move penalty $λ$'],' for="mpc-weight"'),
    compareWeight:copy('li',['가중치 $λ$를 높여 보세요. 입력 변화를 더 억제하면 계단 모양의 입력은 어떻게 바뀌나요?','Increase $λ$. How does penalizing changes affect the input steps?']),
    peak:copy('span',[tex`MPC 최대 적용 $\lvert u\rvert$`,tex`Maximum applied $\lvert u\rvert$ · MPC`]),
    target:math('r=1'), clock:math(tex`T_s=0.2\,\mathrm{s}`), input:math('u'),
    bound:copy('label',[tex`MPC 계획 입력 한계 $\lvert u\rvert\le$`,tex`MPC planning bound $\lvert u\rvert\le$`],' for="mpc-limit"'),
  },
};
