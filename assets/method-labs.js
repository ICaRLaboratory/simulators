import {setupLanguage} from './i18n.js';
import {setupPlantControls} from './plant-controls.js';
import {labs} from './method-labs-content.js';
import {plot,trace} from './method-plots.js';
import {Y_SCALES} from './plot-scale.js';
const id=document.body.dataset.method, config=labs[id];
const loaders={'ddc-lti':()=>import('./models/ddc-lti.js'),'smc-lti':()=>import('./models/smc-lti.js'),'tdc-lti':()=>import('./models/tdc-lti.js')};
const {simulate}=await loaders[id]();
const ddc=id==='ddc-lti',smc=id==='smc-lti', $=s=>document.getElementById(s);
const tr=(ko,en)=>document.documentElement.lang==='en'?en:ko;
const bindings=[...document.querySelectorAll('[data-en]')].map(e=>[e,e.textContent]);
const field=key=>$('method-'+key);const plantUI=setupPlantControls(update);
let result,options;
function draw(){
 if(!result)return;
 const {samples}=result,axis=tr('시간 (s)','Time (s)'),empty=tr('폐루프 실험 없음','No closed-loop run');
 const states=result.finalState?[...samples,{...result.finalState,r:1}]:samples;
 const last=states.at(-1),onset=options.disturbance?result.disturbanceStart:null,time={axis,empty,marker:onset};
 const target=smc?{name:'target',points:last?[[0,1],[last.t,1]]:[]}:trace('target',states,'r');
 const ys=last?[trace('output',states,'y'),target]:[];plot($('response-plot'),ys,{...time,yScale:Y_SCALES.output});
 if(ddc){const record=result.record;plot($('diag-plot'),[trace('record-u',record,'u',{step:true}),trace('record-y',record,'y'),trace('record-v',record,'v')],{axis,empty:tr('측정 기록 없음','No recorded samples'),yScale:Y_SCALES.record});}
 else if(smc){const e=samples.map(s=>s.e),ext=[Math.min(0,...e),Math.max(0,...e)];plot($('diag-plot'),[{name:'surface',points:ext.map(x=>[x,-options.lambda*x])},trace('phase',samples,'v',{x:'e'})],{axis:tr('추종 오차 e','Tracking error e'),empty,yScale:Y_SCALES.velocity});}
 else {const holds=[...samples,{...samples.at(-1),t:last.t}];plot($('diag-plot'),[trace('unknown',holds,'f',{step:true}),trace('estimate',holds,'fHat',{step:true})],{...time,yScale:Y_SCALES.residual});}
 const zoom=smc&&$('input-zoom').checked,window=zoom?samples.filter(s=>s.t>=4-1e-9&&s.t<=4.4+1e-9):samples;
 // Close the last held interval without plotting an unused command at the final instant.
 const control=trace('input',window.filter(s=>s!==last),'u',{step:true});if(last&&control.points.length&&!zoom&&control.points.at(-1)[0]<last.t)control.points.push([last.t,control.points.at(-1)[1]]);
 plot($('input-plot'),[control],{...time,domain:zoom?[4,4.4]:null,yScale:Y_SCALES.input});
}
function update(){
 const plant=plantUI.refresh();options=Object.fromEntries(config.settings.map(({key})=>[key,Number(field(key).value)]));options.disturbance=plant.disturbance;result=simulate({...options,plant});
 for(const {key,range} of config.settings){if(!range)continue;const el=field(key),display=String(options[key]);el.previousElementSibling.textContent=display;el.setAttribute('aria-valuetext',display);}
 const rows=result.samples,last=result.finalState||rows.at(-1),ts=result.dt;
 const applied=result.finalState?rows:rows.slice(0,-1);
 $('method-final').textContent=last?last.y.toFixed(3):'—';$('method-peak').textContent=last?Math.max(...applied.map(s=>Math.abs(s.u))).toFixed(3):'—';
 if(ddc){
  const {ready,rank,requiredRank,K,rho}=result;
  $('method-stat').textContent=`${rank} / ${requiredRank}`;
  $('method-gain').textContent=ready?`[${K.map(k=>k.toFixed(3)).join(', ')}]`:'—';
  $('method-rho').textContent=ready?rho.toFixed(3):'—';
  $('method-status').textContent=ready?tr('기록에서 구한 이득 K를 목표 평형점에 대한 상태 편차에 적용합니다.','The gain K from the record acts on state deviations from the target equilibrium.'):
   rank<requiredRank?tr('데이터 행렬의 랭크가 부족하여 피드백 이득을 구하지 않았습니다. 수집 입력을 바꾸면 폐루프 실험을 실행할 수 있습니다.','Insufficient data rank: no gain was designed and no closed-loop run was made. Select varying input to run the experiment.'):
   tr('안정화 조건을 확인할 수 없어 폐루프 실험을 실행하지 않았습니다.','The stabilization condition could not be verified; no closed-loop run was made.');
 }else{
  $('method-stat').textContent=smc?last.s.toFixed(3):`${Number((options.delay*ts).toFixed(4))} s`;
  $('method-status').textContent=tr(`샘플 주기 ${ts}초.`,`Sample period: ${ts} s.`)+' '+(options.disturbance?tr('세로 점선은 외란을 가하는 시점입니다.','The vertical dotted line marks disturbance onset.'):tr('외란은 0입니다.','No disturbance is applied.'));
 }
 draw();
}
function localize(){for(const [el,ko] of bindings)el.textContent=tr(ko,el.dataset.en);document.querySelector('meta[name=description]').content=tr(...config.intro);update();}
for(const {key} of config.settings)field(key).addEventListener('input',update);
$('input-zoom')?.addEventListener('change',draw);
$('method-reset').addEventListener('click',()=>{for(const {key,range} of config.settings){const el=field(key);if(range)el.value=el.defaultValue;else el.selectedIndex=0;}if(smc)$('input-zoom').checked=false;plantUI.reset();update();});
 document.addEventListener('icar:lang',localize);setupLanguage();for(const button of document.querySelectorAll('.language-switch button'))button.disabled=false;
const resize=new ResizeObserver(draw);for(const el of document.querySelectorAll('main svg'))resize.observe(el);
