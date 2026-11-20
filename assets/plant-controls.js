import {coefficients,ranges} from './models/second-order.js';
import {disturbanceRange, DISTURBANCE_START, DURATION, INPUT_LIMIT} from './models/fundamentals-conditions.js';
import {localizedHref} from './i18n.js';

const paramsRange={...ranges,disturbance:disturbanceRange};
const labels={wn:['고유진동수 ωₙ','Natural frequency ωₙ'],zeta:['감쇠비 ζ','Damping ratio ζ'],gain:['정상상태 이득 K','DC gain K'],disturbance:['입력 외란 d','Input disturbance d']};
const keys=Object.keys(labels);
const fmt=n=>String(Number(n.toFixed(4)));
export const plantLabel=p=>`ωₙ=${p.wn} rad/s · ζ=${p.zeta} · K=${p.gain} · d=${p.disturbance??0}`;
export function setupPlantControls(notify,linkId,destination){
  const field=document.getElementById('plant-controls');
  const note=document.createElement('p');note.id='plant-conditions';note.className='method-caption';field.after(note);
  const links=[...document.querySelectorAll('a[data-plant-link]')].map(link=>[link,link.dataset.plantLink]);
  if(linkId)links.push([document.getElementById(linkId),destination]);
  const controls={},query=new URLSearchParams(location.search);
  for(const key of keys){
    const [min,max,initial]=paramsRange[key];
    const label=document.createElement('label'),name=document.createElement('span'),v=document.createElement('output'),input=document.createElement('input');
    input.id=`plant-${key}`;input.type='range';input.min=min;input.max=max;input.step=.1;input.defaultValue=initial;
    const requested=Number(query.get(key));if(Number.isFinite(requested)&&requested>=min&&requested<=max)input.value=requested;
    label.htmlFor=input.id;v.setAttribute('for',input.id);label.append(name,v);const group=document.createElement('div');group.append(label,input);field.append(group);
    controls[key]={name,v,input};input.addEventListener('input',()=>{syncAddress();notify();});
  }
  function settings(){return Object.fromEntries(keys.map(k=>[k,Number(controls[k].input.value)]));}
  function applyParams(params){for(const [key,v] of Object.entries(settings())){if(v===paramsRange[key][2])params.delete(key);else params.set(key,String(v));}}
  function syncAddress(){const url=new URL(location.href);applyParams(url.searchParams);if(url.href!==location.href)history.replaceState(history.state,'',url);}
  function refresh(){
    const plant=settings(),en=document.documentElement.lang==='en';
    const method=document.body.dataset.method,clock=method==='tdc-lti'||method==='smc-lti'?'0.02':method==='ddc-lti'||document.getElementById('mpc-output-plot')?'0.2':null;
    const timing=clock?(en?`Controller: sampled, Tₛ = ${clock} s.`:`제어기: 이산시간, Tₛ = ${clock}초.`):(en?'Controller: continuous PID (RK4 step 0.01 s).':'제어기: 연속시간 PID (RK4 적분 간격 0.01초).');
    note.textContent=(en?`Shared plant: y(0) = v(0) = 0, r = 1, ${DURATION} s, no measurement noise. The actuator limits u to ±${INPUT_LIMIT}. Plant input = u + d; the input disturbance steps from 0 to ${plant.disturbance} at ${DISTURBANCE_START} s.`:`공통 조건: y(0) = v(0) = 0, r = 1, ${DURATION}초, 측정 잡음 없음. 구동기 입력 u의 한계는 ±${INPUT_LIMIT}입니다. 플랜트 입력은 u + d이며, 입력 외란 d는 ${DISTURBANCE_START}초부터 ${plant.disturbance}입니다.`)+' '+timing;
    for(const key of keys){const {name,v,input}=controls[key];name.textContent=labels[key][Number(en)];v.textContent=`${plant[key]}${key==='wn'?' rad/s':''}`;input.setAttribute('aria-valuetext',v.textContent);}
    const {a0,a1,b}=coefficients(plant);document.getElementById('plant-equation').textContent=`G(s) = ${fmt(b)} / (s² + ${a1===1?'':fmt(a1)}s + ${fmt(a0)})`;
    for(const [link,dest] of links){const params=new URLSearchParams(localizedHref(dest).split('?')[1]);applyParams(params);link.setAttribute('href',dest+'?'+params);}
    return plant;
  }
  function reset(){for(const {input} of Object.values(controls))input.value=input.defaultValue;syncAddress();}
  return {refresh,reset,settings};
}
