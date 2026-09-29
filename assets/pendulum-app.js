import {setupLanguage, t, translateDOM} from './i18n.js';
import {PendulumSimulation} from './pendulum-physics.js';

const $ = id => document.getElementById(id);
const simulation = new PendulumSimulation();
const STEP = 0.005;
let running = false, accumulator = 0, previous = null, lastDraw = 0;
let notice = 'ready';
const history = [];
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const copy = {
  ready: ['시작을 누르고 목표 또는 이득을 조절하세요.', 'Press Start, then adjust the target or gains.'],
  impulse: ['각속도에 +0.5 rad/s를 한 번 더했습니다.', 'Added +0.5 rad/s to angular velocity once.'],
  hidden: ['탭이 숨겨져 일시정지했습니다. 시작을 눌러 재개하세요.', 'Paused because this tab was hidden. Press Start to resume.'],
  angle: ['진자가 넘어졌습니다: |θ| ≥ π/3. 초기화하여 다시 실험하세요.', 'Balance lost: |θ| ≥ π/3. Reset to try again.'],
  rail: ['카트가 레일 한계에 도달했습니다: |x| ≥ 2 m. 초기화하세요.', 'Cart reached the rail limit: |x| ≥ 2 m. Reset to try again.'],
  failed: ['실험이 정지했습니다. 초기화하세요.', 'Experiment stopped. Please reset.'],
  running: ['실행 중', 'Running'], paused: ['일시정지', 'Paused'],
  start: ['시작', 'Start'], pause: ['일시정지', 'Pause'],
};
const labels = {
  target: ['목표 위치 r · m', 'Target position r · m'],
  kx: ['위치 이득 kx · N/m', 'Position gain kx · N/m'],
  kv: ['속도 이득 kv · N·s/m', 'Velocity gain kv · N·s/m'],
  ktheta: ['각도 이득 kθ · N/rad', 'Angle gain kθ · N/rad'],
  komega: ['각속도 이득 kω · N·s/rad', 'Angular-rate gain kω · N·s/rad'],
};
const localized = pair => pair[document.documentElement.lang === 'en' ? 1 : 0];
// Capture canonical Korean before shared translation; never replace containers.
const bindings = [...document.querySelectorAll('[data-en],[data-en-aria]')].map(node => ({
  node, ko: node.hasAttribute('data-en') ? node.textContent : null,
  aria: node.getAttribute('aria-label'),
}));
for (const [key, pair] of Object.entries(labels)) {
  const [min, max, step] = simulation.config.ranges[key];
  const container = document.createElement('div'); container.className = 'parameter';
  const label = document.createElement('label'); label.htmlFor = key;
  const text = document.createElement('span'); text.textContent = pair[0]; text.dataset.parameterLabel = key;
  const output = document.createElement('output'); output.id = `${key}-value`; output.htmlFor = key;
  output.textContent = simulation.params[key].toFixed(2);
  label.append(text, output);
  const input = document.createElement('input');
  Object.assign(input, {id:key, type:'range', min, max, step, value:simulation.params[key]});
  const limits = document.createElement('div'); limits.className = 'range-limits';
  for (const value of [min, max]) { const span = document.createElement('span'); span.textContent = value; limits.append(span); }
  input.addEventListener('input', () => {
    const value = Number(input.value);
    if (!Number.isFinite(value)) return;
    simulation.params[key] = Math.max(min, Math.min(max, value));
    output.textContent = simulation.params[key].toFixed(2);
    draw();
  });
  container.append(label, input, limits); $('parameter-controls').append(container);
}
function updateStatus() {
  const failed = simulation.state.failed;
  $('run-status').textContent = localized(copy[failed ? 'failed' : running ? 'running' : 'paused']);
  $('start-pause').textContent = localized(copy[running ? 'pause' : 'start']);
  $('start-pause').disabled = failed;
  $('disturb').disabled = failed;
  $('simulation-message').textContent = localized(copy[failed ? simulation.state.failure in copy ? simulation.state.failure : 'failed' : notice]);
  $('simulation-message').classList.toggle('error', failed);
}
function localize() {
  translateDOM();
  const english = document.documentElement.lang === 'en';
  for (const {node, ko, aria} of bindings) {
    if (ko !== null) node.textContent = english ? node.dataset.en : ko;
    if (node.hasAttribute('data-en-aria')) node.setAttribute('aria-label', english ? node.dataset.enAria : aria);
  }
  document.querySelector('meta[name="description"]').content = english
    ? 'A full-state feedback experiment for cart position and pendulum balance'
    : '카트 위치와 진자 균형을 조절하는 전상태 피드백 실험';
  for (const node of document.querySelectorAll('[data-parameter-label]')) node.textContent = localized(labels[node.dataset.parameterLabel]);
  $('reset').title = t('초기화');
  updateStatus();
}
document.addEventListener('icar:lang', localize);
setupLanguage();
$('reset').disabled = false;

function sample() {
  const s = simulation.state;
  history.push({t:s.t, x:s.x, theta:s.theta, target:simulation.params.target});
  while (history.length > 1 && history[1].t < s.t - 15) history.shift();
}
function canvasContext(id) {
  const canvas = $(id), box = canvas.getBoundingClientRect();
  const dpr = Math.min(devicePixelRatio || 1, 2);
  const width = Math.round(box.width*dpr), height = Math.round(box.height*dpr);
  if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr,0,0,dpr,0,0); ctx.clearRect(0,0,box.width,box.height);
  return {ctx,w:box.width,h:box.height};
}
function apparatus() {
  const {ctx:c,w,h} = canvasContext('apparatus');
  const s = simulation.state, scale = (w-80)/4, center = w/2+s.x*scale, pivot = h-70;
  const length = Math.min(120, h-105), tipX = center+length*Math.sin(s.theta), tipY = pivot-length*Math.cos(s.theta);
  const line = (x,y,X,Y,color,width=2,dash=[]) => {c.beginPath(); c.strokeStyle=color; c.lineWidth=width; c.setLineDash(dash); c.moveTo(x,y); c.lineTo(X,Y); c.stroke(); c.setLineDash([]);};
  line(40,pivot+34,w-40,pivot+34,'#777');
  for (const x of [-2,-1,0,1,2]) {
    line(w/2+x*scale,pivot+29,w/2+x*scale,pivot+40,'#777',1);
    c.fillStyle='#55555c'; c.font='12px "Pretendard Variable", sans-serif'; c.textAlign='center'; c.fillText(`${x}`,w/2+x*scale,pivot+56);
  }
  line(w/2+simulation.params.target*scale,25,w/2+simulation.params.target*scale,pivot+35,'#c56b31',2,[5,5]);
  line(center,pivot,center,pivot-length,'#999',1,[4,4]);
  c.fillStyle='#0a0a0a'; c.fillRect(center-25,pivot,50,23);
  for (const dx of [-16,16]) {c.beginPath(); c.arc(center+dx,pivot+27,6,0,Math.PI*2);c.fill();}
  line(center,pivot,tipX,tipY,'#087f74',5);
  c.fillStyle='#087f74';c.beginPath();c.arc(tipX,tipY,10,0,Math.PI*2);c.fill();
}
function plot(id, key, limit) {
  const {ctx:c,w,h} = canvasContext(id), left=45, right=w-16, top=16, bottom=h-30;
  const end=Math.max(15,simulation.state.t), start=end-15;
  const X=t=>left+(t-start)/15*(right-left), Y=v=>bottom-(v+limit)/(2*limit)*(bottom-top);
  c.font='12px "Pretendard Variable", sans-serif'; c.lineWidth=1; c.textAlign='right';
  for(const value of [-limit,0,limit]) {
    c.strokeStyle='#e5e5e3'; c.beginPath();c.moveTo(left,Y(value));c.lineTo(right,Y(value));c.stroke();
    c.fillStyle='#55555c';c.fillText(value.toFixed(2),left-7,Y(value)+4);
  }
  c.textAlign='center';
  for(let i=0;i<=3;i++) c.fillText((start+i*5).toFixed(1),left+i/3*(right-left),h-9);
  c.save();c.beginPath();c.rect(left,top,right-left,bottom-top);c.clip();
  const series=(get,color,dash)=>{
    c.beginPath();c.strokeStyle=color;c.lineWidth=2;c.setLineDash(dash);
    history.forEach((point,index)=>{const x=X(point.t),y=Y(get(point));index?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();
  };
  series(point=>key==='x'?point.target:0,'#c56b31',[6,4]);
  series(point=>point[key],'#087f74',[]);c.restore();
}
function draw() {
  const s=simulation.state;
  $('sim-time').textContent=s.t.toFixed(2); $('sim-output').textContent=s.x.toFixed(3);
  $('sim-angle').textContent=s.theta.toFixed(3); $('sim-input').textContent=s.u.toFixed(2);
  apparatus();plot('response','x',2);plot('angle-response','theta',Math.PI/3);
}
function pause() {running=false;accumulator=0;previous=null;updateStatus();}
$('start-pause').addEventListener('click',()=>{
  if (simulation.state.failed) return;
  if(running) pause(); else {running=true;previous=null;updateStatus();}
});
$('reset').addEventListener('click',()=>{
  pause();simulation.reset();history.length=0;notice='ready';sample();updateStatus();draw();
});
$('disturb').addEventListener('click',()=>{simulation.disturb();notice='impulse';updateStatus();draw();});
document.addEventListener('visibilitychange',()=>{
  if(document.hidden && running){notice='hidden';pause();draw();}
});
new ResizeObserver(draw).observe($('apparatus'));
function frame(now) {
  if(running && !document.hidden) {
    if(previous !== null) accumulator=Math.min(0.1,accumulator+Math.max(0,(now-previous)/1000));
    previous=now;
    while(accumulator>=STEP && running) {
      simulation.step(STEP);accumulator-=STEP;sample();
      if(simulation.state.failed) pause();
    }
    if(!reducedMotion.matches || now-lastDraw>=100 || !running){draw();lastDraw=now;}
  } else previous=null;
  requestAnimationFrame(frame);
}
sample();draw();requestAnimationFrame(frame);
