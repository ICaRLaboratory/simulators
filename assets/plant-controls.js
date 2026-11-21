import {coefficients,ranges} from './models/second-order.js';
import {plantEquation} from './plant-equation.js';
import {disturbanceRange} from './models/fundamentals-conditions.js';
import {localizedHref} from './i18n.js';

const paramsRange={...ranges,disturbance:disturbanceRange};
const labels={
  wn:['고유진동수','Natural frequency','<msub><mi>ω</mi><mi>n</mi></msub>'],
  zeta:['감쇠비','Damping ratio','<mi>ζ</mi>'], gain:['정상상태 이득','DC gain','<mi>K</mi>'],
  disturbance:['입력 외란','Input disturbance','<mi>d</mi>'],
};
const keys=Object.keys(labels);

export function setupPlantControls(notify,linkId,destination){
  const field=document.getElementById('plant-controls');
  // Capture Korean before setupLanguage translates text nodes. Swap only
  // the prose leaves, never their parent control, label or disclosure.
  const copies=[...document.querySelectorAll('template[data-math-en]')].map(en=>{
    const target=en.previousElementSibling, ko=target.cloneNode(true);
    return {target,ko,en:en.content};
  });
  document.addEventListener('icar:lang',()=>{
    const lang=document.documentElement.lang;
    for(const copy of copies)copy.target.replaceChildren(...copy[lang].cloneNode(true).childNodes);
  });
  const note=document.getElementById('plant-conditions');note.hidden=false;
  const links=[...document.querySelectorAll('a[data-plant-link]')].map(link=>[link,link.dataset.plantLink]);
  if(linkId)links.push([document.getElementById(linkId),destination]);
  const controls={},query=new URLSearchParams(location.search);
  for(const key of keys){
    const [min,max,initial]=paramsRange[key];
    const label=document.createElement('label'),name=document.createElement('span'),v=document.createElement('output'),input=document.createElement('input');
    input.id=`plant-${key}`;input.type='range';input.min=min;input.max=max;input.step=.1;input.defaultValue=initial;
    const requested=Number(query.get(key));if(Number.isFinite(requested)&&requested>=min&&requested<=max)input.value=requested;
    const symbol=key==='gain'&&document.body.dataset.method==='ddc-lti'?'<msub><mi>K</mi><mi>DC</mi></msub>':labels[key][2];
    name.innerHTML=`<math>${symbol}</math>`;
    const caption=document.createTextNode('');name.prepend(caption);
    label.htmlFor=input.id;v.setAttribute('for',input.id);label.append(name,v);const group=document.createElement('div');group.append(label,input);field.append(group);
    controls[key]={caption,v,input};input.addEventListener('input',()=>{syncAddress();notify();});
  }
  function settings(){return Object.fromEntries(keys.map(k=>[k,Number(controls[k].input.value)]));}
  function applyParams(params){for(const [key,v] of Object.entries(settings())){if(v===paramsRange[key][2])params.delete(key);else params.set(key,String(v));}}
  function syncAddress(){const url=new URL(location.href);applyParams(url.searchParams);if(url.href!==location.href)history.replaceState(history.state,'',url);}
  function refresh(){
    const plant=settings(),en=document.documentElement.lang==='en';
    note.querySelector('[data-disturbance-value]').textContent=plant.disturbance;
    for(const key of keys){const {caption,v,input}=controls[key];caption.data=labels[key][Number(en)]+' ';v.textContent=`${plant[key]}${key==='wn'?' rad/s':''}`;input.setAttribute('aria-valuetext',v.textContent);}
    document.getElementById('plant-equation').innerHTML=plantEquation(coefficients(plant));
    for(const [link,dest] of links){const params=new URLSearchParams(localizedHref(dest).split('?')[1]);applyParams(params);link.setAttribute('href',dest+'?'+params);}
    return plant;
  }
  function reset(){for(const {input} of Object.values(controls))input.value=input.defaultValue;syncAddress();}
  return {refresh,reset,settings};
}
