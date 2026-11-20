import {setupLanguage} from './i18n.js';
import {setupPlantControls,plantLabel} from './plant-controls.js';
import {stepResponse} from './models/pid-lti.js';

const $=id=>document.getElementById(id), keys=['p','i','d'];
const svgNS='http://www.w3.org/2000/svg';
const english=()=>document.documentElement.lang==='en';
const local=(ko,en)=>english()?en:ko;
const enabled=k=>$('enable-'+k).checked;
const effective=()=>Object.fromEntries(keys.map(k=>['k'+k,enabled(k)?Number($('gain-'+k).value):0]));
const activeNames=g=>keys.filter(k=>g['k'+k]>0).join('').toUpperCase()||local('제어 없음','Off');
const binding=[...document.querySelectorAll('[data-en], [data-en-aria], [data-en-content]')].map(el=>({el,text:el.textContent,aria:el.getAttribute('aria-label'),content:el.getAttribute('content')}));
let run, gains, saved=null;
const plantUI=setupPlantControls(render,'mpc-lab-link','../mpc-lti/');

function node(tag,attrs,text) {
  const el=document.createElementNS(svgNS,tag);
  for(const [key,value] of Object.entries(attrs))el.setAttribute(key,value);
  if(text!==undefined)el.textContent=text;
  return el;
}
const styles={y:['#087f74',''],saved:['#5d5389','8 5'],target:['#ad581e','5 4'],p:['#087f74',''],i:['#b45923','8 4'],d:['#4b5aa1','3 4'],u:['#25252a','']};

function chart(id,curves,output) {
  const svg=$(id),width=Math.max(160,svg.clientWidth),height=svg.clientHeight;
  if(!height)return;
  const left=44,right=width-16,top=15,bottom=height-39;
  // Preserve a stable scale for ordinary responses and expand it for diverging cases.
  let low=0,high=output?1.35:1;
  for(const c of curves)for(const s of c.samples){const v=s[c.key];low=Math.min(low,v);high=Math.max(high,v);}
  const raw=(high-low)/4,power=10**Math.floor(Math.log10(raw));
  const step=([1,2,2.5,5,10].find(k=>k*power>=raw)||10)*power;
  const lo=Math.floor(low/step)*step,hi=Math.ceil(high/step)*step;
  const X=t=>left+t/20*(right-left),Y=v=>bottom-(v-lo)/(hi-lo)*(bottom-top);
  const frag=document.createDocumentFragment();
  const add=(tag,attrs,text)=>frag.append(node(tag,attrs,text));
  const line=(x1,y1,x2,y2,color)=>add('line',{x1,y1,x2,y2,stroke:color});
  for(let j=0;j<=Math.round((hi-lo)/step);j++){
    const v=lo+j*step,y=Y(v);
    line(left,y,right,y,v===0?'#a3a5a4':'#d9ddda');
    add('text',{x:left-7,y:y+4,'text-anchor':'end'},Math.abs(v)>=10000?v.toExponential(0):String(+v.toFixed(3)));
  }
  for(let t=0;t<=20;t+=5){const x=X(t);line(x,bottom,x,bottom+4,'#868a89');add('text',{x,y:bottom+16,'text-anchor':'middle'},t);}
  add('text',{x:(right+left)/2,y:height-4,'text-anchor':'middle'},local('시간 (s)','Time (s)'));
  if(output){const [stroke,dash]=styles.target;add('path',{d:`M${left},${Y(1)}H${right}`,fill:'none',stroke,'stroke-width':1.7,'stroke-dasharray':dash});}
  for(const {name,key,samples} of curves){
    const [stroke,dash]=styles[name];let path='';
    for(const [j,s] of samples.entries())path+=`${j?'L':'M'}${X(s.t).toFixed(2)},${Y(s[key]).toFixed(2)}`;
    add('path',{'data-series':name,d:path,fill:'none',stroke,'stroke-width':name==='u'?3:2.1,'stroke-dasharray':dash||'none','stroke-linejoin':'round'});
  }
  svg.setAttribute('viewBox',`0 0 ${width} ${height}`);svg.replaceChildren(frag);
}

function render(){
  gains=effective();run=stepResponse({...gains,plant:plantUI.refresh()});
  for(const k of keys){$('gain-'+k).disabled=!enabled(k);$('value-'+k).textContent=$('gain-'+k).value;}
  $('mode-label').textContent=activeNames(gains);
  $('steady-error').textContent=run.steadyError===null?'—':run.steadyError.toFixed(3);
  $('end-value').textContent=run.samples.at(-1).y.toFixed(3);
  $('peak-value').textContent=run.stability==='stable'?run.peakAboveTarget.toFixed(1)+'%':'—';
  const states={stable:local('안정','Stable'),marginal:local('한계 안정','Marginal'),unstable:local('불안정','Unstable')};
  $('stability').dataset.stability=run.stability;$('stability').textContent=states[run.stability];
  $('clear-pin').disabled=!saved;$('saved-key').hidden=!saved;
  if(saved){
    const label=`${activeNames(saved.gains)} (${keys.map(k=>saved.gains['k'+k]).join(', ')})`;
    $('saved-key').textContent=local('고정: ','Pinned: ')+label;
    $('pin-info').textContent=local('고정한 응답: ','Pinned response: ')+label+' · '+plantLabel(saved.plant);
  }else $('pin-info').textContent=local('현재 응답을 고정하면 이득을 바꾼 결과와 겹쳐 볼 수 있습니다.','Pin a response to overlay it with the next setting.');
  draw();
}
function draw(){
  if(!run)return;
  const curve=(name,key=name,samples=run.samples)=>({name,key,samples});
  chart('pid-output-plot',[curve('y'),...(saved?[curve('saved','y',saved.samples)]:[])],true);
  chart('pid-terms-plot',[curve('u'),...keys.filter(k=>enabled(k)).map(k=>curve(k))],false);
}
function localize(){

  for(const {el,text,aria,content} of binding){
    if(el.hasAttribute('data-en'))el.textContent=local(text,el.dataset.en);
    if(aria!==null)el.setAttribute('aria-label',local(aria,el.dataset.enAria));
    if(content!==null)el.setAttribute('content',local(content,el.dataset.enContent));
  }
  render();
}
for(const k of keys){$('enable-'+k).addEventListener('change',render);$('gain-'+k).addEventListener('input',render);}
$('pin-response').addEventListener('click',()=>{saved={gains:{...gains},plant:plantUI.settings(),samples:run.samples};render();});
$('clear-pin').addEventListener('click',()=>{saved=null;render();});
$('pid-reset').addEventListener('click',()=>{
  for(const k of keys){$('enable-'+k).checked=$('enable-'+k).defaultChecked;$('gain-'+k).value=$('gain-'+k).defaultValue;}
  plantUI.reset();saved=null;render();
});
document.addEventListener('icar:lang',localize);setupLanguage();
for(const button of document.querySelectorAll('.language-switch button'))button.disabled=false;
const observer=new ResizeObserver(draw);
for(const id of ['pid-output-plot','pid-terms-plot'])observer.observe($(id));
