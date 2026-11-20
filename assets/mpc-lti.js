import {setupLanguage} from './i18n.js';
import {setupPlantControls} from './plant-controls.js';
import {simulateMPC} from './models/mpc-lti.js';

const $=id=>document.getElementById(id);
const tr=(ko,en)=>document.documentElement.lang==='en'?en:ko;
const textBindings=[...document.querySelectorAll('[data-en]')].map(el=>[el,el.textContent]);
const optionKeys=['horizon','weight','limit'];
const input=name=>$('mpc-'+name);
const num=name=>Number(input(name).value);
let run;
const plantUI=setupPlantControls(simulate,'pid-lab-link','../pid-lti/');
const svgNS='http://www.w3.org/2000/svg';
function element(tag,attrs,text){
  const e=document.createElementNS(svgNS,tag);for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);
  if(text!==undefined)e.textContent=text;return e;
}
const colors={y:'#087f74',u:'#087f74',prediction:'#1d56a3',ref:'#a8551d'};
const dashes={prediction:'2 4',ref:'6 4'};

function chart(key,step,series,ref,maxTime,selectedTime){
  const svg=$(`mpc-${key}-plot`),w=svg.clientWidth,h=svg.clientHeight;
  if(!w||!h)return;
  const left=44,right=w-16,top=14,bottom=h-36;
  const values=[0,...ref,...series.flatMap(line=>line.points.map(p=>p.v))];
  const min=Math.min(...values),max=Math.max(...values),raw=(max-min)/4;
  const mag=10**Math.floor(Math.log10(raw)),dy=([1,2,2.5,5,10].find(m=>m*mag>=raw)??10)*mag;
  const low=dy*Math.floor(min/dy),high=dy*Math.ceil(max/dy);
  const X=t=>left+(right-left)*t/maxTime,Y=v=>top+6+(bottom-top-12)*(high-v)/(high-low);
  const frag=document.createDocumentFragment(),add=(tag,attrs,text)=>frag.append(element(tag,attrs,text));
  for(let j=0;j<=Math.round((high-low)/dy);j++){
    const v=low+j*dy,y=Y(v);add('line',{x1:left,x2:right,y1:y,y2:y,stroke:'#d6dad8'});
    add('text',{x:left-6,y:y+4,'text-anchor':'end'},Number(v.toFixed(3)));
  }
  for(let t=0;t<=maxTime;t+=5){const x=X(t);add('text',{x,y:bottom+15,'text-anchor':'middle'},t);}
  add('text',{x:(left+right)/2,y:h-3,'text-anchor':'middle'},tr('시간 (s)','Time (s)'));
  for(const v of ref)add('path',{d:`M${left},${Y(v)}H${right}`,stroke:colors.ref,'stroke-dasharray':dashes.ref,fill:'none','stroke-width':1.5});
  const selected=X(selectedTime);add('line',{x1:selected,x2:selected,y1:top,y2:bottom,stroke:'#6a717a','stroke-dasharray':'2 4'});
  for(const {name,points} of series){
    let d='';for(const [k,p] of points.entries()){
      const x=X(p.t).toFixed(2),y=Y(p.v).toFixed(2);d+=k?(step?`H${x}V${y}`:`L${x},${y}`):`M${x},${y}`;
    }
    add('path',{d,'data-series':name,stroke:colors[name],'stroke-width':name==='prediction'?3:2,'stroke-dasharray':dashes[name]??'none','stroke-linejoin':'round','stroke-linecap':name==='prediction'?'round':'butt',fill:'none'});
    if(name==='prediction')add('circle',{cx:selected,cy:Y(points[0].v),r:3.4,fill:'white',stroke:colors.prediction,'stroke-width':2});
  }
  svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.replaceChildren(frag);
}
function draw(){
  if(!run)return;
  const k=num('time'),{samples,plans}=run,plan=plans[k],t=samples[k].t;
  const ts=samples[1].t-samples[0].t,tf=t+ts*plan.u.length,maxTime=Math.max(samples.at(-1).t,Math.ceil(tf/5)*5);
  function lines(key){
    const pred=plan[key].map((v,j)=>({t:t+j*ts,v}));
    if(key==='u')pred.push({t:tf,v:pred.at(-1).v});
    return [{name:key,points:samples.map(s=>({t:s.t,v:s[key]}))},{name:'prediction',points:pred}];
  }
  chart('output',false,lines('y'),[1],maxTime,t);
  chart('input',true,lines('u'),[-num('limit'),num('limit')],maxTime,t);
  $('mpc-time-value').textContent=t.toFixed(1)+' s';input('time').setAttribute('aria-valuetext',$('mpc-time-value').textContent);
  $('mpc-first-u').textContent=plan.u[0].toFixed(3);
}
function simulate(){
  const plant=plantUI.refresh();
  run=simulateMPC({...Object.fromEntries(optionKeys.map(key=>[key,num(key)])),plant});
  for(const key of optionKeys){
    const val=key==='horizon'?`${num(key)} (${(num(key)*run.samples[1].t).toFixed(1)} s)`:num(key).toFixed(2);
    $(`mpc-${key}-value`).textContent=val;input(key).setAttribute('aria-valuetext',val);
  }
  $('mpc-final-y').textContent=run.samples.at(-1).y.toFixed(3);
  $('mpc-peak-u').textContent=Math.max(...run.samples.map(s=>Math.abs(s.u))).toFixed(2);
  const required=1/plant.gain,need=Number(required.toFixed(3));
  $('mpc-limit-hint').textContent=num('limit')*plant.gain<1-1e-12
    ?tr(`목표 유지 불가: 출력 1을 유지하는 데 필요한 입력(1/K ≈ ${need})이 입력 한계보다 큽니다.`,`MPC cannot hold the target: the required input (1/K ≈ ${need}) exceeds the limit.`)
    :tr(`출력 1을 유지하는 데 필요한 입력(1/K ≈ ${need})은 입력 한계 안에 있습니다.`,`The input required to hold the target (1/K ≈ ${need}) is within the selected limit.`);
  draw();
}
function localize(){
  for(const [el,ko] of textBindings)el.textContent=tr(ko,el.dataset.en);
  document.querySelector('meta[name=description]').content=tr('2차 시스템에서 MPC의 예측 구간과 입력 한계를 바꾸며 계단응답과 예측 궤적을 살펴봅니다.','Explore the MPC step response and predicted trajectory of a second-order system by varying the prediction horizon and input limit.');
  simulate();
}
for(const key of optionKeys)input(key).addEventListener('input',simulate);
input('time').addEventListener('input',draw);
$('mpc-reset').addEventListener('click',()=>{for(const key of [...optionKeys,'time'])input(key).value=input(key).defaultValue;plantUI.reset();simulate();});
document.addEventListener('icar:lang',localize);setupLanguage();
for(const button of document.querySelectorAll('.language-switch button'))button.disabled=false;
const resize=new ResizeObserver(draw);for(const id of ['mpc-output-plot','mpc-input-plot'])resize.observe($(id));
