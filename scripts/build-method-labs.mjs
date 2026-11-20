// Build the three graph-lab shells; numerical models remain independent of the DOM.
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {labs,labels,diagnostics} from '../assets/method-labs-content.js';
import {catalog} from '../assets/catalog.js';
const escape=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const bi=([ko,en])=>`data-en="${escape(en)}">${escape(ko)}`;
const legend=keys=>`<div class="legend pid-legend">${keys.map(k=>`<span class="key-${k}" ${bi(labels[k])}</span>`).join('')}</div>`;
const plot=(key,section,title,keys,tail='')=>`<section class="panel ${section}" id="method-${key}-panel"><div class="panel-heading"><h2 id="${key}-title" ${bi(title)}</h2></div>${legend(keys)}<svg id="${key}-plot" role="img" aria-labelledby="${key}-title"></svg>${tail}</section>`;
function control({key,label,range,choices}){
 const id=`method-${key}`,forLabel=`<label for="${id}" ${bi(label)}</label>`;
 if(choices)return `<div>${forLabel}<select id="${id}">${choices.map(([k,ko,en])=>`<option value="${k}" ${bi([ko,en])}</option>`).join('')}</select></div>`;
 const [min,max,step,value]=range;return `<div>${forLabel}<output for="${id}">${value}</output><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"></div>`;
}
for(const [id,lab] of Object.entries(labs)){
 const item=catalog.find(x=>x.id===id);if(!item)throw Error(`Catalog entry required: ${id}`);
 const deep=id==='deepc-lti',smc=id==='smc-lti';
 const related=['pid-lti','mpc-lti',...Object.keys(labs)].filter(k=>k!==id).map(k=>`<a data-plant-link="../${k}/" href="../${k}/">${({'pid-lti':'PID','mpc-lti':'MPC','deepc-lti':'DeePC','smc-lti':'SMC','tdc-lti':'TDC'})[k]} →</a>`).join(' · ');
 const title=[item.name,item.english], stat=(id,title)=>`<div><span ${bi(title)}</span><strong id="${id}">—</strong></div>`;
 const tech=deep?['입력 행켈 행렬 랭크 / 필요 랭크','Input Hankel rank / required rank']:smc?['종료 시 슬라이딩 변수 s','Final sliding variable s']:['추정 지연 시간','Estimation lag'];
 const html=`<!doctype html>
<html lang="ko"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title ${bi(title.map(x=>x+' · Control Simulators'))}</title><meta name="description" content="${escape(lab.intro[0])}">
<link rel="stylesheet" href="../assets/site.css"><link rel="stylesheet" href="../assets/pid-lti.css"><link rel="stylesheet" href="../assets/method-labs.css"><script type="module" src="../assets/method-labs.js"></script></head>
<body data-method="${id}"><a class="skip" href="#main" data-en="Skip to content">본문으로 건너뛰기</a>
<header class="site-header"><a class="brand" href="../" aria-label="Control Simulators 홈"><span class="brand-mark" aria-hidden="true"><img src="../assets/lab-logo.png" alt=""></span><span class="brand-label">CONTROL<br>SIMULATORS</span></a><div class="language-switch" role="group" aria-label="언어 선택"><button type="button" data-lang="ko" aria-pressed="true" lang="ko" disabled>한국어</button><button type="button" data-lang="en" aria-pressed="false" lang="en" disabled>EN</button></div></header>
<main id="main" class="container pid-lab"><a class="back-link" href="../" data-en="← All experiments">← 모든 실험</a><div class="sim-heading"><div><h1 ${bi(title)}</h1><p ${bi(lab.intro)}</p></div></div>
<noscript>실험을 조작하려면 JavaScript를 켜세요.</noscript><section class="panel plant-panel"><div class="panel-heading"><h2 data-en="Second-order plant">2차 시스템 설정</h2><span id="plant-equation">G(s) = 1 / (s² + s + 1)</span></div><div id="plant-controls"></div></section>
<div class="pid-layout method-layout">${plot('response','pid-output',lab.response,['output','target'])}
<section class="panel pid-settings"><div class="panel-heading"><h2 data-en="Controller settings">제어기 설정</h2></div><div class="method-controls">${lab.settings.map(control).join('')}<button type="button" id="method-reset" class="primary" data-en="Reset">초기화</button></div></section>
${plot('diag','method-diagnostic',lab.diag,diagnostics[id],`<p class="method-caption" ${bi(lab.diagnosticNote)}</p>`)}
<aside class="panel pid-guide"><div class="panel-heading"><h2 data-en="Try this">실험해 보기</h2></div><p class="method-caption" ${bi(lab.task)}</p><p id="method-status" role="status"></p></aside>
${plot('input','method-input',['적용 제어입력','Applied control input'],['input'],smc?'<label class="zoom"><input type="checkbox" id="input-zoom"><span data-en="Zoom to 4–4.4 s">4–4.4초 확대</span></label>':'')}
<div class="pid-metrics">${stat('method-final',['종료 시 출력 y','Final output y'])}${stat('method-peak',['최대 적용 |u|','Peak applied |u|'])}${stat('method-stat',tech)}</div></div>
<details class="panel pid-model"><summary data-en="Model, control law and assumptions">모델·제어식·가정</summary><div><p class="eq">G(s) = b / (s² + a₁s + a₀),　b = Kωₙ²,　a₁ = 2ζωₙ,　a₀ = ωₙ²</p>${lab.equations.map(s=>`<p class="eq">${escape(s)}</p>`).join('')}<p ${bi(lab.assumptions)}</p></div></details>
<p class="pid-source"><span data-en="Other labs with this plant">같은 시스템으로 다른 제어 실험</span>: ${related}</p>
<p class="pid-source"><span data-en="Concept reference">원리 참고 문헌</span>: <a href="${escape(item.source)}" target="_blank" rel="noopener noreferrer">${escape(item.sourceName)} ↗</a></p></main>
<footer class="site-footer"><span><strong>Control Simulators</strong><span class="footer-tag">Interactive Control Lab</span></span><a href="../" data-en="Back to experiments ↑">실험 목록으로 돌아가기 ↑</a></footer></body></html>\n`;
 const dir=new URL(`../${id}/`,import.meta.url),url=new URL('index.html',dir);
 if(process.argv.includes('--check')){if(await readFile(url,'utf8')!==html)throw Error(`Regenerate ${id}`);}else{await mkdir(dir,{recursive:true});await writeFile(url,html);}
}
