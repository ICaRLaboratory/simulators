import { catalog, filterCatalog } from './catalog.js';
import { motionDistance } from './motion.js';

const $ = selector => document.querySelector(selector);
const TEAL = '#087f74', ORANGE = '#c56b31', INK = '#0a0a0a', MUTED = '#666670';

function schematic(item) {
  const car = '<path d="M90 88h140v-22l-28-7-17-22h-51l-20 24-24 5z" fill="#e8e8e5"/><path d="M136 43h45l12 18h-73z"/><circle cx="122" cy="88" r="13" fill="#f5f5f3"/><circle cx="204" cy="88" r="13" fill="#f5f5f3"/><path d="M62 105h207M242 60h30m-9-7 9 7-9 7"/>';
  const motor = '<rect x="93" y="47" width="92" height="48" rx="5" fill="#e8e8e5"/><path d="M108 47V37h61v10m-67 48-8 13h88l-8-13m11-36h21"/><circle cx="221" cy="71" r="27" fill="#f5f5f3"/><path d="M221 71l19-19" stroke="#c56b31"/><circle cx="221" cy="71" r="4"/><path d="M119 57v27m13-27v27m13-27v27"/>';
  const beam = '<path d="m72 80 182-17" stroke-width="5"/><path d="m163 74-20 32h40z" fill="#e8e8e5"/><circle cx="135" cy="63" r="12" fill="#087f74"/><path d="M101 112h123M206 49v36" stroke="#c56b31" stroke-dasharray="4 4"/>';
  const pendulum = '<path d="M68 109h193"/><rect x="132" y="86" width="62" height="18" rx="3" fill="#e8e8e5"/><path d="m163 86-23-51" stroke-width="4"/><circle cx="140" cy="35" r="9" fill="#087f74"/><circle cx="143" cy="108" r="5"/><circle cx="184" cy="108" r="5"/><path d="M164 25v52" stroke="#c56b31" stroke-dasharray="4 4"/>';
  const robot = '<path d="M113 110h92m-78 0v-17h32v17m-16-18 24-38 39 5 23-21" stroke-width="9"/><circle cx="143" cy="92" r="8" fill="#e8e8e5"/><circle cx="167" cy="54" r="8" fill="#e8e8e5"/><circle cx="206" cy="59" r="7" fill="#e8e8e5"/><path d="m229 38 12 6 10-12m-22 6-5-11 11-11" stroke="#c56b31"/>';
  const tank = '<path d="M127 39v64q32 18 64 0V39m-64 0q32-14 64 0m-64 22h64M158 22v67m-14-9 28 13m-28 0 28-13M99 48h28m64 46h28"/><path d="M136 99q23 9 46 0V66h-46z" fill="#e8e8e5" stroke="none"/><path d="M158 65v24"/>';
  const drone = '<path d="m131 48 57 48m-57 0 57-48" stroke-width="6"/><rect x="145" y="59" width="30" height="25" rx="6" fill="#e8e8e5"/><ellipse cx="126" cy="43" rx="24" ry="7"/><ellipse cx="192" cy="43" rx="24" ry="7"/><ellipse cx="126" cy="101" rx="24" ry="7"/><ellipse cx="192" cy="101" rx="24" ry="7"/>';
  const plate = '<path d="m97 65 89-31 50 42-88 32z" fill="#e8e8e5"/><path d="m148 108 1 13 33-2 9-27"/><circle cx="166" cy="62" r="10" fill="#087f74"/><path d="m186 57 11 13m-14-3 18-8" stroke="#c56b31"/>';
  const suspension = '<path d="M107 34h105v19H107z" fill="#e8e8e5"/><path d="M126 53v7l-8 7 16 9-16 9 16 9-8 6v10m63-57v12m-8 0h16v26h-16zm8 26v19M101 110h114M158 110v8"/><circle cx="158" cy="119" r="9"/>';
  const aircraft = '<path d="m82 76 160-14-1 10-71 16-47 24-16-2 20-22-44-2z" fill="#e8e8e5"/><path d="m113 77-17-28 12-2 36 27m36-8-24-33 13-2 42 33M76 101h177"/><path d="M210 40q28 7 30 22" stroke="#c56b31"/>';
  let drawing = robot;
  if (['cruise-control','parking','path-tracking'].includes(item.id)) drawing = car;
  if (item.id === 'dc-motor') drawing = motor;
  if (item.id === 'ball-and-beam') drawing = beam;
  if (item.id.includes('pendulum')) drawing = pendulum;
  if (item.id === 'ball-and-plate') drawing = plate;
  if (['heat-exchanger','cstr'].includes(item.id)) drawing = tank;
  if (item.id === 'drone') drawing = drone;
  if (item.id === 'suspension') drawing = suspension;
  if (item.id === 'aircraft-pitch') drawing = aircraft;
  return `<svg viewBox="0 0 320 145" aria-hidden="true" fill="none" stroke="${INK}" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${drawing}</svg>`;
}

function setupCatalog() {
  let category = '';
  const categories = [...new Set(catalog.map(item => item.category))];
  $('#total-count').textContent = catalog.length;
  $('#ready-count').textContent = catalog.filter(item => item.status === 'ready').length;
  $('#category-filters').innerHTML = ['',...categories].map(name => `<button type="button" data-category="${name}" aria-pressed="${name === ''}">${name || '전체'}<span>${name ? catalog.filter(item => item.category === name).length : catalog.length}</span></button>`).join('');
  function render() {
    const filtered = filterCatalog({query:$('#search').value,category,ready:$('#ready-only').checked});
    $('#catalog-grid').innerHTML = filtered.map(item => `<article class="sim-card" data-id="${item.id}"><div class="card-visual"><span class="card-number">EXP. ${String(catalog.indexOf(item) + 1).padStart(2,'0')}</span><span class="card-status ${item.status}">${item.status === 'ready' ? '실행 가능' : '준비 중'}</span>${schematic(item)}</div><div class="card-body"><p class="card-category">${item.category}</p><h3>${item.name}</h3><p class="english-name">${item.english}</p><p class="card-description">${item.description}</p><div class="features" aria-label="${item.status === 'ready' ? '조절 가능한 항목' : '구현 예정 항목'}">${item.features.map(feature => `<span>${feature}</span>`).join('')}</div><div class="card-footer"><a class="source-link" href="${item.source}" target="_blank" rel="noopener noreferrer" aria-label="${item.name} 관련 MATLAB 프로젝트 · 새 탭">관련 프로젝트 · ${item.sourceName} ↗</a>${item.href ? `<a class="launch" data-launch href="${item.href}">실험 시작 <span aria-hidden="true">→</span></a>` : '<span class="planned-label">브라우저 실험 준비 중</span>'}</div></div></article>`).join('');
    $('#result-count').innerHTML = `<strong>${filtered.length}</strong>개 실험 <span>/ 전체 ${catalog.length}개</span>`;
    $('#empty-state').hidden = filtered.length !== 0;
    document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
  }
  $('#search').addEventListener('input',render);
  $('#ready-only').addEventListener('change',render);
  $('#category-filters').addEventListener('click',event => {
    const button = event.target.closest('[data-category]');
    if (button) { category = button.dataset.category; render(); }
  });
  $('#clear-filters').addEventListener('click',() => { category = ''; $('#search').value = ''; $('#ready-only').checked = false; render(); $('#search').focus(); });
  render();
}

function canvasContext(canvas) {
  const width = canvas.clientWidth, height = canvas.clientHeight;
  const ratio = Math.min(window.devicePixelRatio || 1,2);
  if (canvas.width !== Math.round(width * ratio) || canvas.height !== Math.round(height * ratio)) {
    canvas.width = Math.round(width * ratio); canvas.height = Math.round(height * ratio);
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(ratio,0,0,ratio,0,0);
  ctx.clearRect(0,0,width,height);
  return {ctx,width,height};
}

function apparatus(canvas, sim, sceneDistance) {
  const {ctx:c,width:w,height:h} = canvasContext(canvas);
  c.save(); c.translate(w / 2,h / 2); c.scale(Math.min(w / 570,1),Math.min(w / 570,1));
  c.lineCap = 'round'; c.lineJoin = 'round'; c.lineWidth = 2; c.strokeStyle = INK; c.fillStyle = '#e8e8e5';
  const line = (x1,y1,x2,y2,color=INK) => { c.strokeStyle=color;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke(); };
  const circle = (x,y,r,fill) => {c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();c.strokeStyle=INK;c.stroke();};
  const text = (label,x,y,color=MUTED) => {c.font='12px "JetBrains Mono", "Pretendard Variable", monospace';c.fillStyle=color;c.textAlign='center';c.fillText(label,x,y);};
  if (sim.kind === 'cruise-control') {
    c.strokeStyle='#bdbdbd'; line(-240,53,240,53,'#bdbdbd');
    const offset = (sceneDistance * 3) % 55;
    for(let x=-260;x<270;x+=55) line(x-offset,69,x+25-offset,69,'#d6d6d3');
    c.beginPath();c.moveTo(-103,24);c.lineTo(-103,-9);c.lineTo(-68,-19);c.lineTo(-39,-51);c.lineTo(42,-51);c.lineTo(74,-20);c.lineTo(106,-9);c.lineTo(106,24);c.closePath();c.fillStyle='#e8e8e5';c.fill();c.strokeStyle=INK;c.stroke();
    line(-58,-20,60,-20);line(-26,-44,-42,-24);line(7,-45,7,-23);
    circle(-63,28,23,'#f5f5f3');circle(65,28,23,'#f5f5f3');
    for (const x of [-63,65]) { const theta=sceneDistance/2;line(x,28,x+15*Math.cos(theta),28+15*Math.sin(theta),TEAL); }
    line(135,-12,206,-12,TEAL);line(197,-19,206,-12,TEAL);line(197,-5,206,-12,TEAL);
    text(`v = ${sim.state.y.toFixed(2)} m/s`,0,-78,TEAL);
    text(`목표 ${sim.params.target.toFixed(1)} m/s`,0,102,ORANGE);
    if (sim.state.disturbance) text('← 부하 외란',-171,-39,ORANGE);
  } else if (sim.kind === 'dc-motor') {
    c.fillStyle='#e8e8e5';c.fillRect(-188,-47,109,94);c.strokeStyle=INK;c.strokeRect(-188,-47,109,94);
    for(let x=-170;x<-90;x+=18) line(x,-31,x,31,'#a7a7ae');
    line(-79,0,-8,0);circle(76,0,65,'#f5f5f3');
    c.setLineDash([5,5]); line(76,0,76+60*Math.cos(-sim.params.target),60*Math.sin(-sim.params.target),ORANGE);c.setLineDash([]);
    line(76,0,76+57*Math.cos(-sim.state.y),57*Math.sin(-sim.state.y),TEAL);circle(76,0,7,TEAL);
    text('DC MOTOR',-133,77);text(`θ = ${sim.state.y.toFixed(2)} rad`,76,100,TEAL);
    text('0 rad →',182,5);if(sim.state.disturbance)text('부하 외란 적용',-130,-69,ORANGE);
  } else {
    c.beginPath();c.moveTo(0,18);c.lineTo(-28,70);c.lineTo(28,70);c.closePath();c.fillStyle='#e8e8e5';c.fill();c.strokeStyle=INK;c.stroke();
    line(-75,77,75,77,'#a7a7ae');
    c.save();c.translate(0,15);c.rotate(sim.state.u);
    c.lineWidth=7;line(-218,0,218,0);c.lineWidth=2;
    const target = sim.params.target * 210;
    c.setLineDash([4,4]);line(target,-38,target,22,ORANGE);c.setLineDash([]);
    circle(sim.state.y*210,-19,15,TEAL);
    text('−1 m',-220,30);text('+1 m',220,30);c.restore();
    text(`θ = ${sim.state.u.toFixed(3)} rad`,0,-73);
    text(`x = ${sim.state.y.toFixed(3)} m`,0,102,TEAL);
  }
  c.restore();
}

function drawGraph(canvas, history, sim) {
  const {ctx:c,width:w,height:h} = canvasContext(canvas);
  const pad={left:48,right:19,top:23,bottom:27};
  const leftTime=Math.max(0,sim.state.t-15),rightTime=Math.max(15,sim.state.t);
  const points=history.filter(p=>p.t>=leftTime);
  const vals=points.flatMap(p=>[p.y,p.target]).concat([sim.params.target,sim.state.y,0]);
  let low=Math.min(...vals),high=Math.max(...vals);
  const margin=Math.max((high-low)*.17,.1); low-=margin;high+=margin;
  const x=t=>pad.left+(t-leftTime)/(rightTime-leftTime)*(w-pad.left-pad.right);
  const y=value=>h-pad.bottom-(value-low)/(high-low)*(h-pad.top-pad.bottom);
  c.font='10px "JetBrains Mono", monospace';c.lineWidth=1;
  for(let i=0;i<=4;i++) {
    const value=low+(high-low)*i/4,py=y(value);
    c.strokeStyle='#ededeb';c.beginPath();c.moveTo(pad.left,py);c.lineTo(w-pad.right,py);c.stroke();
    c.fillStyle=MUTED;c.textAlign='right';c.fillText(value.toFixed(Math.abs(high-low)<3?2:1),pad.left-8,py+3);
    const time=leftTime+(rightTime-leftTime)*i/4;
    c.textAlign='center';c.fillText(time.toFixed(1),x(time),h-7);
  }
  c.save();c.beginPath();c.rect(pad.left,pad.top,w-pad.left-pad.right,h-pad.top-pad.bottom);c.clip();
  for (const [key,color,dash] of [['target',ORANGE,[5,4]],['y',TEAL,[]]]) {
    c.strokeStyle=color;c.lineWidth=2;c.setLineDash(dash);c.beginPath();
    points.forEach((point,index)=>{if(index===0)c.moveTo(x(point.t),y(point[key]));else c.lineTo(x(point.t),y(point[key]));});c.stroke();
    if(points.length===1){c.fillStyle=color;c.beginPath();c.arc(x(points[0].t),y(points[0][key]),3,0,Math.PI*2);c.fill();}
  }
  c.restore();
}

async function setupSimulation(kind) {
  const { Simulation } = await import('./physics.js');
  const sim = new Simulation(kind);
  const labels = {target:['목표값','도달하고 싶은 출력입니다. 그래프의 주황 점선으로 표시됩니다.'],kp:['비례 이득 Kp','현재 오차에 반응합니다. 크기를 바꾸며 응답 속도를 비교하세요.'],ki:['적분 이득 Ki','누적된 오차에 반응합니다. 잔류 오차와 오버슈트를 함께 관찰하세요.'],kd:['미분 이득 Kd','출력 변화율에 반응합니다. 진동을 줄이는 감쇠 역할을 비교하세요.']};
  $('#parameter-controls').innerHTML=Object.entries(labels).map(([key,[label,help]])=>{
    const [min,max,step]=sim.config.ranges[key];
    return `<div class="parameter"><label for="${key}">${label}${key==='target'?` (${sim.config.unit})`:''}<output id="${key}-value" for="${key}">${sim.params[key]}</output></label><input id="${key}" type="range" min="${min}" max="${max}" step="${step}" value="${sim.params[key]}" aria-describedby="${key}-help"><div class="range-limits" aria-hidden="true"><span>${min}</span><span>${max}</span></div><p id="${key}-help">${help}</p></div>`;
  }).join('');
  document.querySelectorAll('.unit').forEach(node=>node.textContent=sim.config.unit);
  $('#model-description').textContent=sim.config.model;
  $('#model-limits').textContent=kind==='cruise-control' ? '단순 질량·선형 저항 모델입니다. 기어, 엔진 지연, 공기저항의 비선형성은 제외합니다. 외란 버튼은 일정한 부하를 켜고 끕니다.' : kind==='dc-motor' ? '단순화한 2차 위치 모델입니다. 전기 회로, 마찰 비선형성 및 기어 백래시는 제외합니다. 외란 버튼은 일정한 부하를 켜고 끕니다.' : '공은 미끄러짐 없이 구르는 구로 근사합니다. 빔 구동기 지연은 제외하며, ±1 m 레일 끝에 도달하면 실험을 정지합니다. 외란 버튼으로 공의 움직임을 교란합니다.';
  let running=false,lastFrame=0,accumulator=0,raf=0,lastSample=0,lastDraw=0,sceneDistance=0;
  const STEP=.005, MAX_ACCUMULATOR=.1;
  const reducedMotion=window.matchMedia('(prefers-reduced-motion: reduce)');
  let history=[{t:0,y:sim.state.y,target:sim.params.target}];
  const message=$('#simulation-message');
  function render() {
    $('#sim-time').textContent=sim.state.t.toFixed(2);
    $('#sim-output').textContent=sim.state.y.toFixed(3);
    $('#sim-error').textContent=(sim.params.target-sim.state.y).toFixed(3);
    $('#sim-input').textContent=sim.state.u.toFixed(3);
    apparatus($('#apparatus'),sim,sceneDistance);drawGraph($('#response'),history,sim);
  }
  function setRunning(value,reason='') {
    running=value;accumulator=0;lastFrame=0;
    cancelAnimationFrame(raf);
    $('#start-pause').textContent=running?'일시정지':'시작';
    $('#start-pause').setAttribute('aria-pressed',String(running));
    $('#run-status').textContent=sim.state.failed?'실험 정지 · STOPPED':running?'실행 중 · RUNNING':'일시정지 · PAUSED';
    if(reason) message.textContent=reason;
    if(running) raf=requestAnimationFrame(frame);
    render();
  }
  function fail(error) {
    sim.state.failed=true;setRunning(false);
    message.classList.add('error');message.textContent=`실험이 정지되었습니다. ${error} 초기화 후 이득을 낮추어 다시 실행하세요.`;
    $('#start-pause').disabled=true;$('#disturb').disabled=true;
  }
  function frame(timestamp) {
    if(!running)return;
    if(document.hidden){setRunning(false,'탭이 숨겨져 자동 일시정지했습니다. 시작을 누르면 재개됩니다.');return;}
    if(lastFrame) accumulator=Math.min(MAX_ACCUMULATOR,accumulator+Math.max(0,(timestamp-lastFrame)/1000));
    lastFrame=timestamp;
    try {
      while(accumulator>=STEP&&running) {
        const previousVelocity=sim.state.y;
        sim.step(STEP);accumulator-=STEP;
        if(![sim.state.t,sim.state.y,sim.state.v,sim.state.u].every(Number.isFinite)){fail('수치 계산 범위를 벗어났습니다.');return;}
        if(kind==='cruise-control')sceneDistance=motionDistance(sceneDistance,previousVelocity,sim.state.y,STEP);
        if(sim.state.failed){fail(kind==='ball-and-beam'?'공이 레일 범위를 벗어났습니다.':'모델의 안전 범위를 벗어났습니다.');return;}
        if(sim.state.t-lastSample>=.05){history.push({t:sim.state.t,y:sim.state.y,target:sim.params.target});lastSample=sim.state.t;}
      }
      while(history.length>1&&history[1].t<sim.state.t-15)history.shift();
      if(!reducedMotion.matches||timestamp-lastDraw>=100){render();lastDraw=timestamp;}
      raf=requestAnimationFrame(frame);
    } catch(error) { fail('계산 오류가 발생했습니다.'); console.error(error); }
  }
  for(const key of Object.keys(labels)) {
    $(`#${key}`).addEventListener('input',event=>{
      sim.params[key]=Number(event.target.value);$(`#${key}-value`).textContent=event.target.value;
      if(key==='target')history.push({t:sim.state.t,y:sim.state.y,target:sim.params.target});
      render();
    });
  }
  $('#start-pause').disabled=false;$('#reset').disabled=false;$('#disturb').disabled=false;
  $('#start-pause').addEventListener('click',()=>setRunning(!running,running?'일시정지했습니다. 설정을 바꾸거나 다시 시작할 수 있습니다.':'실험 실행 중 · 목표와 이득을 바꾸어 응답을 관찰하세요.'));
  $('#reset').addEventListener('click',()=>{
    setRunning(false);sim.reset();lastSample=0;sceneDistance=0;history=[{t:0,y:sim.state.y,target:sim.params.target}];
    message.classList.remove('error');$('#start-pause').disabled=false;$('#disturb').disabled=false;
    $('#disturb').textContent='외란 가하기 ↗';setRunning(false,'초기화했습니다. 목표와 이득은 유지됩니다. 시작을 눌러 실행하세요.');
  });
  $('#disturb').addEventListener('click',()=>{
    sim.disturb();
    if(kind!=='ball-and-beam')$('#disturb').textContent=sim.state.disturbance?'외란 제거하기 ↗':'외란 가하기 ↗';
    message.textContent=kind==='ball-and-beam'?'공에 외란을 가했습니다. 실행 후 회복을 관찰하세요.':sim.state.disturbance?'부하 외란을 적용했습니다. 회복 응답을 관찰하세요.':'부하 외란을 제거했습니다.';
    render();
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)setRunning(false,'탭이 숨겨져 자동 일시정지했습니다. 시작을 누르면 재개됩니다.');});
  new ResizeObserver(render).observe($('.experiment'));
  setRunning(false,'준비되었습니다. 시작을 눌러 실험을 실행하세요.');
}

if(document.body.dataset.page==='catalog')setupCatalog();
if(document.body.dataset.simulator)setupSimulation(document.body.dataset.simulator).catch(error=>{
  $('#simulation-message').textContent='모델을 불러오지 못했습니다. 페이지를 새로 고침해 주세요.';
  $('#simulation-message').classList.add('error');console.error(error);
});
