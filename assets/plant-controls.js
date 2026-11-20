import {coefficients,ranges} from './models/second-order.js';
import {localizedHref} from './i18n.js';

const labels={wn:['고유진동수 ωₙ','Natural frequency ωₙ'],zeta:['감쇠비 ζ','Damping ratio ζ'],gain:['정상상태 이득 K','DC gain K']};
const keys=Object.keys(labels);
const fmt=n=>String(Number(n.toFixed(4)));
export const plantLabel=p=>`ωₙ=${p.wn} rad/s · ζ=${p.zeta} · K=${p.gain}`;
export function setupPlantControls(notify,linkId,destination){
  const field=document.getElementById('plant-controls'),link=document.getElementById(linkId);
  const controls={},query=new URLSearchParams(location.search);
  for(const key of keys){
    const [min,max,initial]=ranges[key];
    const label=document.createElement('label'),name=document.createElement('span'),v=document.createElement('output'),input=document.createElement('input');
    input.id=`plant-${key}`;input.type='range';input.min=min;input.max=max;input.step=.1;input.defaultValue=initial;
    const requested=Number(query.get(key));if(Number.isFinite(requested)&&requested>=min&&requested<=max)input.value=requested;
    label.htmlFor=input.id;v.setAttribute('for',input.id);label.append(name,v);const group=document.createElement('div');group.append(label,input);field.append(group);
    controls[key]={name,v,input};input.addEventListener('input',()=>{syncAddress();notify();});
  }
  function settings(){return Object.fromEntries(keys.map(k=>[k,Number(controls[k].input.value)]));}
  function applyParams(params){for(const [key,v] of Object.entries(settings())){if(v===ranges[key][2])params.delete(key);else params.set(key,String(v));}}
  function syncAddress(){const url=new URL(location.href);applyParams(url.searchParams);if(url.href!==location.href)history.replaceState(history.state,'',url);}
  function refresh(){
    const plant=settings(),en=document.documentElement.lang==='en';
    for(const key of keys){const {name,v,input}=controls[key];name.textContent=labels[key][Number(en)];v.textContent=`${plant[key]}${key==='wn'?' rad/s':''}`;input.setAttribute('aria-valuetext',v.textContent);}
    const {a0,a1,b}=coefficients(plant);document.getElementById('plant-equation').textContent=`G(s) = ${fmt(b)} / (s² + ${a1===1?'':fmt(a1)}s + ${fmt(a0)})`;
    const params=new URLSearchParams(localizedHref(destination).split('?')[1]);applyParams(params);link.setAttribute('href',destination+'?'+params);
    return plant;
  }
  function reset(){for(const {input} of Object.values(controls))input.value=input.defaultValue;syncAddress();}
  return {refresh,reset,settings};
}
