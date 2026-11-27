import {mkdir,readFile,writeFile,access} from 'node:fs/promises';
import {apparatusEquations} from './apparatus-equations.mjs';
import {apparatusPidPair} from './apparatus-pid-pair.mjs';
import {math} from './paper-math.mjs';
import {apparatusCopy,escapeHTML as esc} from './apparatus-copy.mjs';
const root=new URL('../',import.meta.url);
export const ids=['rotary-pendulum','ball-and-plate','robot-arm','parking','heat-exchanger','drone','impedance-robot','path-tracking','suspension','cstr','aircraft-pitch','rocket-landing'];
const richText=(id,tag,pair,attrs='',field='')=>{
 const parts=apparatusCopy(id,pair,field);
 return parts ? `<${tag} ${attrs}>${parts[0]}<template data-copy-en>${parts[1]}</template></${tag}>` : text(tag,pair,attrs);
};
const text=(tag,pair,attrs='')=>`<${tag} ${attrs} data-en="${esc(pair[1])}">${esc(pair[0])}</${tag}>`;
const aria=pair=>`aria-label="${esc(pair[0])}" data-en-aria="${esc(pair[1])}"`;
// Omit href to link the related project already named by definition.source.
const modelSources={
 'aircraft-pitch':[
  {
   label:['MathWorks 공식 문서: 항공기 피치 상태공간 모델 ↗','MathWorks documentation: aircraft pitch state-space model ↗'],
   note:['예제 모델(aircraftPitchSSModel.mat)의 두 번째 상태 x₂를 피치율 q_web = 56.7 x₂ (rad/s)로 환산하면 이 실험과 같은 상태방정식을 얻습니다.',
         'Rescaling the second state x₂ of the example model (aircraftPitchSSModel.mat) to pitch rate q_web = 56.7 x₂ (rad/s) gives the state equations used in this experiment.']},
  {href:'https://www.mathworks.com/matlabcentral/fileexchange/40798-aircraft-pitch-control',label:['관련 MATLAB 프로젝트: Rick Hill의 피치 제어 앱 ↗','Related MATLAB project: Rick Hill’s pitch control app ↗'],
   note:['File Exchange 앱은 같은 모델에 LQR 상태 피드백을 적용합니다. 이 실험은 승강타 각도를 제한한 PID 제어를 사용합니다.',
         'The File Exchange app applies LQR state feedback to the same plant. This experiment uses PID control with a limit on elevator deflection.']}
 ],
 cstr:[
  {label:['관련 MATLAB 프로젝트: Amir Amini의 CSTR 제어 예제 ↗','Related MATLAB project: Amir Amini’s CSTR control example ↗'],
   note:['Amini의 File Exchange 예제는 반응물 농도, 반응 온도, 냉각수 온도의 세 상태를 계산합니다. 이 실험의 반응기 모델은 농도와 반응 온도의 두 상태만 계산하며, PI 제어기가 재킷 온도를 직접 지정합니다.',
         'Amini’s File Exchange example integrates three states: reactant concentration, reactor temperature and coolant temperature. The browser plant has two states: concentration and reactor temperature. Its PI controller sets jacket temperature directly.']},
  {href:'https://apmonitor.com/wiki/index.php/Apps/StirredReactor',
   label:['비교 모델: APMonitor의 교반 반응기 벤치마크 ↗','Comparison model: APMonitor stirred-reactor benchmark ↗'],
   note:['APMonitor가 소개한 Henson–Seborg 벤치마크와 물질·열수지 구조, 공급 온도(350 K), 활성화 온도(E/R = 8750 K)가 같습니다. 이 실험에서는 350 K에서 반응 속도 상수가 1/60 s⁻¹이 되도록 보정했습니다.',
         'The Henson–Seborg benchmark documented by APMonitor has the same mass and energy balance structure, feed temperature (350 K) and activation temperature (E/R = 8750 K). This experiment calibrates the rate constant to 1/60 s⁻¹ at 350 K.']}
 ]
};
function sourceNotes(d){
 const link=(label,href)=>text('a',label,`href="${esc(href)}" target="_blank" rel="noopener noreferrer"`);
 const records=modelSources[d.id];
 if(!records&&d.source.startsWith('https://www.mathworks.com/help/'))return text('h2',['공식 문서','Official documentation'])+link(['MathWorks 공식 문서 ↗','Official MathWorks documentation ↗'],d.source);
 if(!records)return text('h2',['관련 프로젝트','Related project'])+link(['관련 MATLAB 프로젝트 ↗','Related MATLAB project ↗'],d.source);
 return text('h2',['모델과 참고 자료','Model and references'])+records.map(({href,label,note})=>
  `<p>${link(label,href??d.source)}<br>${richText(d.id,'span',note)}</p>`).join('');
}
function loop(d){
 const pair=apparatusPidPair(d,richText,aria);
 if(pair)return pair;
 // Compact 1040-wide loop that fits the desktop container without scrolling,
 // shaped like the hand-made diagrams: the reference is a dashed labelled
 // wire (not a box), and the plant output bends straight into the feedback
 // return instead of dangling off the right edge.
 // Inset each label from its own box/wire. HTML inside the SVG lets native
 // math and prose share a baseline and wrap together, even without JS.
 const regions={reference:[10,67,182,68],controller:[211,91,258,103],actuator:[511,91,208,103],plant:[761,91,238,103],feedback:[465,219,430,44],disturbance:[755,4,250,53]};
 const labels=Object.entries(regions).map(([key,[x,y,w,h]])=>
  `<foreignObject data-loop-label="${key}" x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" class="loop-label">${richText(d.id,'span',d.loop[key],'','diagram')}</div></foreignObject>`).join('');
 return `<div class="loop-viewport" role="region" tabindex="0" ${aria([d.title[0]+'의 제어 구조',d.title[1]+' control structure'])} aria-describedby="loop-scroll-help"><svg class="loop-diagram" viewBox="0 0 1040 300" role="img" aria-labelledby="loop-svg-title loop-svg-desc">${text('title',[d.title[0]+' 피드백 제어',d.title[1]+' feedback control'],'id="loop-svg-title"')}${text('desc',['목표와 측정 상태가 제어기에 전달됩니다. 구동기 출력은 제어 대상을 구동하며 외란은 제어 대상에 직접 작용합니다.','Reference and measured states enter the controller. The actuator drives the plant; disturbance enters the plant directly.'],'id="loop-svg-desc"')}<defs><marker id="loop-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z"/></marker></defs><g class="loop-wires"><path class="loop-target" d="M15 142H203" marker-end="url(#loop-arrow)"/><rect x="205" y="85" width="270" height="115" rx="7"/><path d="M475 142H503" marker-end="url(#loop-arrow)"/><rect x="505" y="85" width="220" height="115" rx="7"/><path d="M725 142H753" marker-end="url(#loop-arrow)"/><rect x="755" y="85" width="250" height="115" rx="7"/><path data-signal="feedback" d="M1005 142H1022V268H340V202" marker-end="url(#loop-arrow)"/><path data-signal="disturbance" d="M880 60V83" marker-end="url(#loop-arrow)"/></g>${labels}</svg></div>`;
}
function equationBlocks(d){
 const blocks=apparatusEquations[d.id];
 if(blocks?.length!==d.equations.length)throw Error(`Equation block count mismatch: ${d.id}`);
 return blocks.map(clauses=>`<p class="loop-equation">${clauses.map((tex,i)=>math(tex+(i+1<clauses.length?';':''))).join(' ')}</p>`).join('');
}
function posterStage(d){
 const src=`../assets/startup-posters/${esc(d.id)}`;
 return `<div class="apparatus-stage" data-view="poster"${d.id==='impedance-robot'?' data-large="true"':''}><picture class="apparatus-poster" role="img" ${aria([d.title[0]+' · 장치 미리보기',d.title[1]+' · Apparatus preview'])}><source media="(max-width: 600px)" srcset="${src}-narrow.webp"><img src="${src}.webp" alt="" loading="eager" fetchpriority="high"></picture><p class="apparatus-loading" role="status" data-en="Loading…">로딩 중…</p></div>`;
}
function page(d){
 const rich=(tag,pair,attrs='',field='')=>richText(d.id,tag,pair,attrs,field);
 const disturbanceHelp=d.disturbanceHelp.map((copy,i)=>copy+' '+[
  '외란은 목표값과 별개로 시스템에 가하는 변화입니다. 설정과 작동 한계에 따라 복귀가 보장되지는 않습니다. 일시정지 중에는 시작을 눌러 이후 응답을 관찰하세요.',
  'A disturbance changes the system independently of the target. Recovery is not guaranteed; it depends on settings and operating limits. When paused, press Start to observe the subsequent response.'
 ][i]);
 const metrics=[{key:'t',label:['시간','Time'],unit:'s',digits:2},...d.metrics];
 return `<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="description" content="${esc(d.description[0])}" data-en-content="${esc(d.description[1])}">${text('title',d.title.map(s=>s+' · Control Simulators'))}<link rel="stylesheet" href="../assets/site.css"><link rel="stylesheet" href="../assets/experiment.css"><link rel="stylesheet" href="../assets/three/view.css"><script type="module" src="../assets/experiment-app.js"></script></head>
<body data-experiment="${esc(d.id)}">${text('a',['본문으로 건너뛰기','Skip to content'],'class="skip" href="#main"')}<header class="site-header"><a class="brand" href="../" ${aria(['Control Simulators 홈','Control Simulators home'])}><span class="brand-mark" aria-hidden="true"><img src="../assets/lab-logo.png" alt=""></span><span class="brand-label">CONTROL<br>SIMULATORS</span></a><div class="language-switch" role="group" ${aria(['언어 선택','Language'])}><button type="button" data-lang="ko" aria-pressed="true" lang="ko">한국어</button><button type="button" data-lang="en" aria-pressed="false" lang="en">EN</button></div></header>
<main id="main" class="container sim-container">${text('a',['← 모든 실험','← All experiments'],'class="back-link" href="../"')}<div class="sim-heading"><div>${text('h1',d.title)}${text('p',d.description)}${d.explanation?rich('p',d.explanation,'id="concept-help" class="control-help"'):''}</div><span id="run-status" class="status" role="status">일시정지</span></div>
<div class="sim-layout"><section class="experiment" ${aria(['실험 시각화','Experiment visualization'])}><div class="panel apparatus-panel"><div class="panel-heading">${text('h2',d.title)}<span class="mono">0.005 s</span></div>${posterStage(d)}<canvas id="apparatus" role="img" ${aria(d.title)} data-en="${esc(d.description[1])}">${esc(d.description[0])}</canvas></div><div class="metrics">${metrics.map(m=>`<div>${rich('span',m.label)}<strong><output id="${m.key==='t'?'sim-time':'metric-'+esc(m.key)}">—</output> <small>${esc(m.unit)}</small></strong></div>`).join('')}</div>
${d.plots.map((p,i)=>`<div class="panel graph-panel"><div class="panel-heading">${rich('h2',p.label.map(s=>s+' · '+p.unit))}<div class="legend">${p.series.map(s=>rich('span',s.label,`class="${s.dash?'target-line':'actual-line'}" style="--series:${esc(s.color)}"`)).join('')}</div></div><canvas class="response" id="plot-${i}" role="img" ${aria(p.label.map(s=>s+' · '+p.unit))}></canvas>${text('p',[`최근 15초 · 시간 (s) · 고정 범위 ${p.range.join(' … ')} ${p.unit}`,`Last 15 seconds · time (s) · fixed range ${p.range.join(' … ')} ${p.unit}`],'class="canvas-caption"')}</div>`).join('')}</section>
<aside class="panel controls" aria-labelledby="controls-title"><div class="panel-heading">${text('h2',['실험 설정','Experiment settings'],'id="controls-title"')}</div><div class="action-buttons"><button id="start-pause" class="primary" type="button" disabled>시작</button>${text('button',['초기화','Reset'],'id="reset" type="button" disabled')}</div>${d.disturbanceParameters?.length?`<fieldset class="disturbance-controls">${text('legend',['외란','Disturbance'])}<div id="disturbance-parameters"></div>`:''}${rich('button',d.disturbance,'id="disturb" class="disturb-button" type="button" aria-describedby="disturbance-help" disabled')}${rich('p',disturbanceHelp,'id="disturbance-help" class="control-help"')}${d.disturbanceParameters?.length?'</fieldset>':''}${text('p',['초기화하면 일시정지하며 설정은 유지됩니다.','Reset pauses the experiment and keeps your settings.'],'class="control-help"')}<div id="parameter-controls"></div><p id="simulation-message" class="simulation-message" role="status" aria-live="polite">모델을 불러오는 중입니다.</p><noscript>JavaScript를 켜면 실험을 실행할 수 있습니다.</noscript></aside></div>
<section class="control-loop panel" aria-labelledby="loop-title"><div class="panel-heading">${text('h2',['제어 구조','Control structure'],'id="loop-title"')}</div>${text('p',['그림에 초점을 맞춘 뒤 방향키로 좌우로 스크롤하세요.','Focus the diagram and use arrow keys to scroll horizontally.'],'id="loop-scroll-help" class="loop-scroll-help"')}${loop(d)}<details class="loop-notes">${text('summary',['모델·제어식·단위·실험 범위','Model, equations, units and limits'])}<div class="loop-details"><div>${text('h3',['모델과 제어식','Model and control equations'])}${equationBlocks(d)}</div><div>${text('h3',['실험 범위와 단위','Limits and units'])}${d.notes.map(n=>rich('p',n,'','notes')).join('')}${text('p',['고정 계산 간격 0.005 s. 숨겨진 탭은 일시정지합니다.','Fixed integration step: 0.005 s. Hidden tabs pause.'])}<ul>${d.parameters.map(p=>`<li>${rich('span',p.label,`data-parameter-label="${esc(p.key)}"`)}: ${esc(p.min)} … ${esc(p.max)} ${esc(p.unit)}</li>`).join('')}</ul></div></div></details></section>
<section class="model-notes panel">${sourceNotes(d)}</section></main><footer class="site-footer"><span><strong>Control Simulators</strong><span class="footer-tag">Interactive Control Lab</span></span>${text('a',['실험 목록으로 돌아가기 ↑','Back to experiments ↑'],'href="../"')}</footer></body></html>
`;
}
const missing=[],definitions=[];
for(const id of ids){const url=new URL(`assets/models/${id}.js`,root);try{await access(url);}catch{missing.push(id);continue;}const {definition:d}=await import(url);if(!d&&process.argv.includes('--available')){missing.push(id);continue;}if(!d)throw Error(`Incomplete definition: ${id}`);if(d.id!==id)throw Error(`Definition id mismatch: ${id}`);if(!/^https:\/\//.test(d.source))throw Error(`Invalid source: ${id}`);definitions.push(d);}
if(missing.length&&!process.argv.includes('--available'))throw Error(`Missing model modules: ${missing.join(', ')}`);
const check=process.argv.includes('--check');
for(const d of definitions){
 const file=new URL(`${d.id}/index.html`,root), html=page(d);
 if(check){
  if(await readFile(file,'utf8')!==html)throw Error(`Stale ${d.id}/index.html; run node scripts/build-experiment-pages.mjs`);
 }else{
  await mkdir(new URL(`${d.id}/`,root),{recursive:true});await writeFile(file,html);
 }
}
console.log(`${check?'Checked':'Generated'} ${definitions.length}/${ids.length} experiment pages${missing.length?'; awaiting '+missing.join(', '):''}.`);
