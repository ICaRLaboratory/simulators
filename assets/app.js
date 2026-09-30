import {setupPlaybackPreference} from './playback-preference.js';
import { catalog, filterCatalog } from './catalog.js';
import { motionDistance } from './motion.js';
import {setupLanguage, translateDOM, t, getLanguage, localizedHref} from './i18n.js';
setupLanguage();

const $ = selector => document.querySelector(selector);
const TEAL = '#087f74', ORANGE = '#c56b31', INK = '#0a0a0a', MUTED = '#666670';

function schematic(item) {
  // Real apparatus captures, not category-level icons shared by unrelated experiments.
  return `<img class="card-preview" src="assets/previews/${item.id}-${getLanguage()}.png" alt="" loading="lazy" decoding="async" width="640" height="340">`;
}

function setupCatalog() {
  let category = '';
  const categories = [...new Set(catalog.map(item => item.category))];
  $('#total-count').textContent = catalog.length;
  $('#ready-count').textContent = catalog.filter(item => item.status === 'ready').length;
  $('#category-filters').innerHTML = ['',...categories].map(name => `<button type="button" data-category="${name}" aria-pressed="${name === ''}">${name || '전체'}<span>${name ? catalog.filter(item => item.category === name).length : catalog.length}</span></button>`).join('');
  function render() {
    const filtered = filterCatalog({query:$('#search').value,category,ready:$('#ready-only').checked});
    $('#catalog-grid').innerHTML = filtered.map(item => `<article class="sim-card" data-id="${item.id}"><div class="card-visual"><span class="card-number">EXP. ${String(catalog.indexOf(item) + 1).padStart(2,'0')}</span><span class="card-status ${item.status}">${item.status === 'ready' ? '실행 가능' : '준비 중'}</span>${schematic(item)}</div><div class="card-body"><p class="card-category">${item.category}</p><h3>${item.name}</h3><p class="english-name">${item.english}</p><p class="card-description">${item.description}</p><div class="features" aria-label="${item.status === 'ready' ? '조절 가능한 항목' : '구현 예정 항목'}">${item.features.map(feature => `<span>${feature}</span>`).join('')}</div><div class="card-footer"><a class="source-link" href="${item.external ? localizedHref(item.source) : item.source}" target="_blank" rel="noopener noreferrer" aria-label="${item.name} ${item.external ? '관련 연구 시뮬레이션' : '관련 MATLAB 프로젝트'} · 새 탭">관련 프로젝트 · ${item.sourceName} ↗</a>${item.href ? `<a class="launch" data-launch href="${localizedHref(item.href)}" ${item.external ? `aria-label="${item.name} · 연구 실험 열기 · 외부 사이트"` : ''}>${item.external ? '연구 실험 열기' : '실험 시작'} <span aria-hidden="true">${item.external ? '↗' : '→'}</span></a>` : '<span class="planned-label">브라우저 실험 준비 중</span>'}</div></div></article>`).join('');
    $('#result-count').innerHTML = getLanguage()==='en' ? `<strong>${filtered.length}</strong> experiments <span>/ ${catalog.length} total</span>` : `<strong>${filtered.length}</strong>개 실험 <span>/ 전체 ${catalog.length}개</span>`;
    $('#empty-state').hidden = filtered.length !== 0;
    document.querySelectorAll('[data-category]').forEach(button => button.setAttribute('aria-pressed', String(button.dataset.category === category)));
    translateDOM();
  }
  window.addEventListener('icar:lang',render);
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
  const scale = Math.min((w-24)/480,(h-100)/200,1);
  const slate='#334155', edge='#94a3b8', pale='#e2e8f0';
  const line = (x1,y1,x2,y2,color=slate,width=2) => {c.lineWidth=width;c.strokeStyle=color;c.beginPath();c.moveTo(x1,y1);c.lineTo(x2,y2);c.stroke();};
  const circle = (x,y,r,fill,stroke=slate) => {c.beginPath();c.arc(x,y,r,0,Math.PI*2);c.fillStyle=fill;c.fill();c.strokeStyle=stroke;c.lineWidth=2;c.stroke();};
  const box = (x,y,width,height,fill,r=4) => {c.beginPath();c.roundRect(x,y,width,height,r);c.fillStyle=fill;c.fill();c.strokeStyle=slate;c.lineWidth=2;c.stroke();};
  const polygon = (points,fill) => {c.beginPath();points.forEach(([x,y],i)=>i?c.lineTo(x,y):c.moveTo(x,y));c.closePath();c.fillStyle=fill;c.fill();c.strokeStyle=slate;c.lineWidth=2;c.stroke();};
  // Typography stays in CSS pixels; only mechanical geometry is scaled.
  const text = (label,y,color=MUTED) => {c.font='12px "JetBrains Mono", "Pretendard Variable", monospace';c.fillStyle=color;c.textAlign='center';c.fillText(t(label),w/2,y);};
  c.save();c.translate(w/2,h/2);c.scale(scale,scale);c.lineCap='round';c.lineJoin='round';
  if (sim.kind === 'cruise-control') {
    box(-238,58,476,32,'#f1f5f9');
    const offset=(sceneDistance*3)%55;
    c.save();c.beginPath();c.rect(-236,59,472,30);c.clip();
    for(let x=-290;x<290;x+=55) line(x-offset,76,x+25-offset,76,edge,3);
    c.restore();
    polygon([[-151,24],[-148,-12],[-105,-24],[-65,-65],[45,-65],[93,-24],[139,-14],[154,9],[151,33],[-150,33]],'#fff');
    polygon([[-95,-24],[-59,-57],[-13,-57],[-13,-24]],pale);
    polygon([[-3,-57],[39,-57],[79,-24],[-3,-24]],pale);
    line(-5,-19,-5,23,edge,1);line(-132,15,133,15,TEAL,4);
    line(12,-11,28,-11,slate,3);line(-76,-11,-61,-11,slate,3);
    box(132,-9,18,10,pale,2);box(-150,-8,10,13,slate,2);
    for(const x of [-92,96]) {
      circle(x,34,24,slate);circle(x,34,16,pale);circle(x,34,5,'#fff');
      // Road travel and wheel rotation use the same integrated distance.
      const angle=sceneDistance*3/24;
      for(let i=0;i<5;i++){const a=angle+i*Math.PI*2/5;line(x+6*Math.cos(a),34+6*Math.sin(a),x+13*Math.cos(a),34+13*Math.sin(a),slate,2);}
    }
    line(176,-17,221,-17,TEAL,3);line(212,-25,221,-17,TEAL,3);line(212,-9,221,-17,TEAL,3);
  } else if (sim.kind === 'dc-motor') {
    box(-199,55,141,13,pale);box(-178,37,24,20,slate);box(-105,37,24,20,slate);
    box(-200,-49,120,97,pale,12);box(-205,-38,15,74,slate,5);
    for(let x=-179;x<-91;x+=14) line(x,-33,x,32,edge,4);
    box(-173,-67,48,18,'#fff');circle(-80,0,41,'#f8fafc');
    for(const y of [-26,26]) circle(-82,y,4,edge);
    box(-66,-8,99,16,edge,3);line(-58,-4,26,-4,'#fff',2);
    circle(107,0,82,slate);circle(107,0,75,'#fff');circle(107,0,58,pale);
    for(let i=0;i<24;i++){const a=i*Math.PI/12;line(107+65*Math.cos(a),65*Math.sin(a),107+71*Math.cos(a),71*Math.sin(a),edge,i%6===0?3:1);}
    c.save();c.translate(107,0);c.rotate(-sim.state.y);
    for(let i=0;i<3;i++){c.rotate(Math.PI*2/3);box(15,-7,34,14,'#cbd5e1',5);}
    c.restore();
    c.setLineDash([5,4]);line(107,0,107+72*Math.cos(-sim.params.target),72*Math.sin(-sim.params.target),ORANGE,3);c.setLineDash([]);
    line(107,0,107+57*Math.cos(-sim.state.y),57*Math.sin(-sim.state.y),TEAL,5);circle(107,0,10,TEAL);circle(107,0,3,'#fff');
  } else {
    box(-72,77,144,12,pale);polygon([[0,15],[-37,76],[37,76]],'#cbd5e1');
    circle(0,24,12,slate);circle(0,24,5,'#fff');
    c.save();c.translate(0,15);c.rotate(sim.state.u);
    // Positive input slopes down to the right, matching +sin(theta).
    box(-220,0,440,14,slate,3);line(-216,1,216,1,'#cbd5e1',3);
    for(let x=-210;x<=210;x+=21)line(x,5,x,10,edge,1);
    const target=sim.params.target*210;
    c.setLineDash([5,4]);line(target,-42,target,22,ORANGE,2);c.setLineDash([]);
    polygon([[target-7,24],[target+7,24],[target,17]],ORANGE);
    const ball=sim.state.y*210;
    circle(ball,-19,19,TEAL);circle(ball-6,-26,5,'#d9f7f2',TEAL);
    c.restore();
  }
  c.restore();
  if(sim.kind==='cruise-control') {
    text(`v = ${sim.state.y.toFixed(2)} m/s`,25,TEAL);
    text(`목표 ${sim.params.target.toFixed(1)} m/s`,h-18,ORANGE);
    if(sim.state.disturbance)text('← 부하 외란',44,ORANGE);
  } else if(sim.kind==='dc-motor') {
    text(`θ = ${sim.state.y.toFixed(2)} rad`,25,TEAL);
    text('DC MOTOR',h-18);
    text('0 rad →',h-38);
    if(sim.state.disturbance)text('부하 외란 적용',44,ORANGE);
  } else {
    text(`θ = ${sim.state.u.toFixed(3)} rad`,25);
    text(`x = ${sim.state.y.toFixed(3)} m`,h-18,TEAL);
    c.font='12px "Pretendard Variable", sans-serif';c.fillStyle=MUTED;
    c.textAlign='left';c.fillText('−1 m',12,h-42);c.textAlign='right';c.fillText('+1 m',w-12,h-42);
  }
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
  c.font='12px "JetBrains Mono", monospace';c.lineWidth=1;
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
  const reducedMotion=setupPlaybackPreference();
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
    render();translateDOM();
  }
  function fail(error) {
    sim.state.failed=true;setRunning(false);
    message.classList.add('error');message.textContent=`실험이 정지되었습니다. ${error} 초기화 후 이득을 낮추어 다시 실행하세요.`;
    $('#start-pause').disabled=true;$('#disturb').disabled=true;translateDOM();
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
    render();translateDOM();
  });
  window.addEventListener('icar:lang',render);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&running)setRunning(false,'탭이 숨겨져 자동 일시정지했습니다. 시작을 누르면 재개됩니다.');});
  new ResizeObserver(render).observe($('.experiment'));
  setRunning(false,'준비되었습니다. 시작을 눌러 실험을 실행하세요.');
}

if(document.body.dataset.page==='catalog')setupCatalog();
if(document.body.dataset.simulator)setupSimulation(document.body.dataset.simulator).catch(error=>{
  $('#simulation-message').textContent='모델을 불러오지 못했습니다. 페이지를 새로 고침해 주세요.';
  $('#simulation-message').classList.add('error');translateDOM();console.error(error);
});
