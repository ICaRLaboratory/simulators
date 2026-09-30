import {setupLanguage,translateDOM} from './i18n.js';
const loaders={
 'rotary-pendulum':()=>import('./models/rotary-pendulum.js'),
 'ball-and-plate':()=>import('./models/ball-and-plate.js'),
 'robot-arm':()=>import('./models/robot-arm.js'),
 parking:()=>import('./models/parking.js'),
 'heat-exchanger':()=>import('./models/heat-exchanger.js'),
 drone:()=>import('./models/drone.js'),
 'impedance-robot':()=>import('./models/impedance-robot.js'),
 'path-tracking':()=>import('./models/path-tracking.js'),
 suspension:()=>import('./models/suspension.js'),
 cstr:()=>import('./models/cstr.js'),
 'aircraft-pitch':()=>import('./models/aircraft-pitch.js'),
};
const $=id=>document.getElementById(id);
const localized=pair=>pair[document.documentElement.lang==='en'?1:0];
const copy={ready:['시작을 누르고 목표 또는 이득을 조절하세요.','Press Start, then adjust the target or gains.'],start:['시작','Start'],pause:['일시정지','Pause'],paused:['일시정지','Paused'],running:['실행 중','Running'],failed:['실험이 정지했습니다. 초기화하세요.','Experiment stopped. Reset to try again.'],complete:['목표에 도달하여 정지했습니다. 초기화하여 다시 실행하세요.','Goal reached. Paused; reset to run again.'],completed:['완료','Complete'],hidden:['탭이 숨겨져 일시정지했습니다. 시작을 눌러 재개하세요.','Paused because this tab was hidden. Press Start to resume.'],unavailable:['모델을 불러올 수 없습니다. 페이지를 새로고침하세요.','Model unavailable. Reload this page to try again.']};
// Capture original Korean before shared i18n sees any text. Never replace containers.
const bindings=[...document.querySelectorAll('[data-en],[data-en-aria],[data-en-content],[data-en-title]')].map(node=>({node,text:node.hasAttribute('data-en')?node.textContent:null,aria:node.getAttribute('aria-label'),content:node.getAttribute('content'),title:node.getAttribute('title')}));
let updateLocale=()=>{};
function localize(){
 translateDOM();const english=document.documentElement.lang==='en';
 for(const b of bindings){if(b.text!==null)b.node.textContent=english?b.node.dataset.en:b.text;for(const [attr,key] of [['aria-label','aria'],['content','content'],['title','title']]){const data=key==='aria'?'enAria':key==='content'?'enContent':'enTitle';if(b.node.dataset[data]!==undefined)b.node.setAttribute(attr,english?b.node.dataset[data]:b[key]);}}
 updateLocale();
}
document.addEventListener('icar:lang',localize);setupLanguage();
try{
 const load=loaders[document.body.dataset.experiment];if(!load)throw Error('Unknown experiment');
 const module=await load();boot(module);
}catch(error){
 console.error('Experiment unavailable:',error);
 updateLocale=()=>{$('run-status').textContent=localized(['사용 불가','Unavailable']);$('simulation-message').textContent=localized(copy.unavailable);for(const id of ['start-pause','disturb','reset'])$(id).disabled=true;};updateLocale();
}
function boot({definition:d,Simulation,draw:drawModel}){
 const simulation=new Simulation(),history=[],STEP=.005;
 let running=false,accumulator=0,previous=null,lastDraw=0,notice='ready';
 const reducedMotion=matchMedia('(prefers-reduced-motion: reduce)');
 const parameterLabels=[];
 for(const p of d.parameters){
  const container=document.createElement('div');container.className='parameter';
  const label=document.createElement('label');label.htmlFor=p.key;
  const span=document.createElement('span');parameterLabels.push([span,p.label.map(s=>`${s} · ${p.unit}`)]);
  const output=document.createElement('output');output.id=`${p.key}-value`;output.htmlFor=p.key;output.textContent=String(simulation.params[p.key]);
  label.append(span,output);
  const input=document.createElement('input');Object.assign(input,{id:p.key,type:'range',min:p.min,max:p.max,step:p.step,value:simulation.params[p.key]});
  const limits=document.createElement('div');limits.className='range-limits';for(const value of [p.min,p.max]){const n=document.createElement('span');n.textContent=`${value} ${p.unit}`;limits.append(n);}
  input.addEventListener('input',()=>{const value=Number(input.value);if(!Number.isFinite(value))return;simulation.params[p.key]=Math.max(p.min,Math.min(p.max,value));output.textContent=String(simulation.params[p.key]);render();});
  container.append(label,input,limits);$('parameter-controls').append(container);
 }
 function status(){
  const s=simulation.state;const blocked=s.failed||s.complete;
  $('run-status').textContent=localized(copy[s.failed?'failed':s.complete?'completed':running?'running':'paused']);
  $('start-pause').textContent=localized(copy[running?'pause':'start']);
  $('start-pause').disabled=Boolean(blocked);$('disturb').disabled=Boolean(blocked);$('reset').disabled=false;
  const message=s.failed?(d.failureMessages?.[s.failure]||copy.failed):s.complete?copy.complete:notice==='impulse'?d.disturbance:copy[notice];
  $('simulation-message').textContent=localized(message);$('simulation-message').classList.toggle('error',Boolean(s.failed));
 }
 updateLocale=()=>{for(const [node,pair] of parameterLabels)node.textContent=localized(pair);$('apparatus').textContent=localized(d.description);$('reset').title=localized(['초기화','Reset']);status();apparatus();};
 function sample(){history.push({...simulation.observe()});while(history.length>1&&history[1].t<simulation.state.t-15)history.shift();}
 function context(id){const canvas=$(id),box=canvas.getBoundingClientRect(),dpr=Math.min(devicePixelRatio||1,2);const width=Math.round(box.width*dpr),height=Math.round(box.height*dpr);if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}const ctx=canvas.getContext('2d');ctx.setTransform(dpr,0,0,dpr,0,0);ctx.clearRect(0,0,box.width,box.height);return {ctx,w:box.width,h:box.height};}
 function apparatus(){const {ctx,w,h}=context('apparatus');ctx.save();drawModel(ctx,simulation.state,simulation.params,w,h,document.documentElement.lang);ctx.restore();}
 function plot(p,i){
  const {ctx:c,w,h}=context(`plot-${i}`);c.font='12px "Pretendard Variable", sans-serif';
  const [min,max]=p.range,format=v=>Math.abs(v)>=1000?v.toExponential(1):Number(v.toPrecision(3)).toString();
  const ticks=[min,(min+max)/2,max],left=Math.max(44,...ticks.map(v=>c.measureText(format(v)).width+12)),right=w-22,top=18,bottom=h-30;
  const end=Math.max(15,simulation.state.t),start=end-15,X=t=>left+(t-start)/15*(right-left),Y=v=>bottom-(v-min)/(max-min)*(bottom-top);
  c.lineWidth=1;c.setLineDash([]);c.textAlign='right';
  for(const value of ticks){c.strokeStyle='#e5e5e3';c.beginPath();c.moveTo(left,Y(value));c.lineTo(right,Y(value));c.stroke();c.fillStyle='#55555c';c.fillText(format(value),left-7,Y(value)+4);}
  c.textAlign='center';for(let j=0;j<=3;j++)c.fillText((start+j*5).toFixed(1),left+j/3*(right-left),h-9);
  c.save();c.beginPath();c.rect(left,top,right-left,bottom-top);c.clip();
  for(const series of p.series){c.beginPath();c.strokeStyle=series.color;c.lineWidth=2;c.setLineDash(series.dash?[6,4]:[]);history.forEach((point,j)=>{const x=X(point.t),y=Y(point[series.key]);j?c.lineTo(x,y):c.moveTo(x,y);});c.stroke();}c.restore();
 }
 function render(){const observation=simulation.observe();$('sim-time').textContent=observation.t.toFixed(2);for(const m of d.metrics)$(`metric-${m.key}`).textContent=observation[m.key].toFixed(m.digits??2);apparatus();d.plots.forEach(plot);}
 function pause(){running=false;accumulator=0;previous=null;status();}
 $('start-pause').addEventListener('click',()=>{if(simulation.state.failed||simulation.state.complete)return;if(running)pause();else{running=true;previous=null;status();}});
 $('reset').addEventListener('click',()=>{pause();simulation.reset();history.length=0;notice='ready';sample();status();render();});
 $('disturb').addEventListener('click',()=>{if(simulation.state.failed||simulation.state.complete)return;simulation.disturb();notice='impulse';sample();if(simulation.state.failed||simulation.state.complete)pause();status();render();});
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&running){notice='hidden';pause();render();}});
 // Locale-only changes redraw the schematic, not graph pixels/history.
 const sizes=new WeakMap();const observer=new ResizeObserver(entries=>{let changed=false;for(const e of entries){const size=`${e.contentRect.width}:${e.contentRect.height}`;if(sizes.get(e.target)!==size){sizes.set(e.target,size);changed=true;}}if(changed)render();});
 observer.observe($('apparatus'));d.plots.forEach((_,i)=>observer.observe($(`plot-${i}`)));
 function frame(now){if(running&&!document.hidden){if(previous!==null)accumulator=Math.min(.1,accumulator+Math.max(0,(now-previous)/1000));previous=now;while(accumulator>=STEP&&running){simulation.step(STEP);accumulator-=STEP;sample();if(simulation.state.failed||simulation.state.complete)pause();}if(!reducedMotion.matches||now-lastDraw>=100||!running){render();lastDraw=now;}}else previous=null;requestAnimationFrame(frame);}
 sample();localize();render();requestAnimationFrame(frame);
}
