import {math} from './paper-math.mjs';
import {escapeHTML as esc} from './apparatus-copy.mjs';
import {pidModels} from './apparatus-pid-models.mjs';

const t=String.raw;
const words=(pair,tag='span',attrs='')=>`<${tag} ${attrs} data-en="${esc(pair[1])}">${esc(pair[0])}</${tag}>`;
const lines=clauses=>clauses.map(tex=>`<div class="pid-law">${math(tex)}</div>`).join('');
const prose=pair=>{
 const format=str=>str.split('$').map((s,i)=>i%2?math(s):esc(s)).join('');
 return `<p>${format(pair[0])}<template data-copy-en>${format(pair[1])}</template></p>`;
};
const marker=id=>`<defs><marker id="${id}" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10Z"/></marker></defs>`;
const wire=(id,d,attr='')=>`<path ${attr} d="${d}" marker-end="url(#${id})"/>`;
const rect=(x,y,w,h)=>`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="7"/>`;
const dot=(x,y)=>`<circle class="pid-tap" cx="${x}" cy="${y}" r="3"/>`;
const label=(x,y,w,h,html,attr='')=>`<foreignObject ${attr} x="${x}" y="${y}" width="${w}" height="${h}"><div xmlns="http://www.w3.org/1999/xhtml" class="pid-label">${html}</div></foreignObject>`;
const symbol=(x,y,tex,w=60,h=28)=>label(x,y,w,h,math(tex));
const sum=(x,y)=>`<circle cx="${x}" cy="${y}" r="15"/>`;
const sigma=(x,y)=>symbol(x-14,y-14,t`\Sigma`,28);
const signs=(x,y)=>sigma(x,y)+symbol(x-38,y-31,'+',22)+symbol(x+7,y+12,'-',22);
function standardKey(families){
 const kinds=families.map(([k])=>k).join('');
 const terms=[['현재 오차에 비례하는 P항','P responds to current error']];
 if(kinds.includes('I'))terms.push(['오차를 시간에 따라 누적하는 I항','I accumulates error over time']);
 if(kinds.includes('D'))terms.push(['오차의 변화율에 비례하는 D항','D responds to the rate of change of error']);
 return `<div class="pid-key">${prose([`목표 $r$에서 출력 $y$를 뺀 오차 $e$를 사용합니다. ${terms.map(v=>v[0]).join(', ')} 중 각 루프에 표시된 항을 더한 값이 입력 $u$입니다.`,`Subtract output $y$ from reference $r$ to obtain error $e$. ${terms.map(v=>v[1]).join('; ')}. In each loop, the terms shown form input $u$.`])}</div>`;
}
function svg(id,title,desc,h,content){
 return `<svg class="loop-diagram" viewBox="0 0 1040 ${h}" role="img" aria-labelledby="${id}-title" aria-describedby="${id}-desc">${words(title,'title',`id="${id}-title"`)}${words(desc,'desc',`id="${id}-desc"`)}${marker(id+'-arrow')}${content}</svg>`;
}
// One closed scalar teaching loop per distinct family. Draw the error fork
// and summing ports from the same coordinates as the term blocks.
function standard(families){
 const id='pid-standard',arrow=id+'-arrow';let offset=0;
 const rows=families.map(([kind,ko,en])=>{
  const terms=[...kind],n=terms.length,mid=42+n*35,ret=mid+n*35+19;
  const branchY=i=>mid+(i-(n-1)/2)*70;
  const signal=(d,attrs)=>wire(arrow,d,attrs);
  let wires=signal(`M26 ${mid}H132`,'class="loop-target"')+sum(147,mid)+`<path d="M162 ${mid}H275"/>`;
  let labels=signs(147,mid)+symbol(30,mid-34,'r')+symbol(165,mid-34,'e=r-y',94);
  terms.forEach((term,i)=>{
   const y=branchY(i),join=y===mid?`H620`:`H635V${mid+Math.sign(y-mid)*15}`;
   wires+=signal(`M275 ${mid}V${y}H335`,`data-input="${term}"`)+rect(335,y-31,193,62)+signal(`M528 ${y}${n===1?'H720':join}`,`data-output="${term}"`);
   const tex={P:'K_p e',I:t`K_i\int_0^t e(s)\,\mathrm{d}s`,D:t`K_d\dot e`}[term];
   labels+=label(335,y-31,193,62,`<span><b>${term}</b> ${math(tex)}</span>`,`data-branch="${term}"`);
  });
  if(n>1){wires+=dot(275,mid)+sum(635,mid)+signal(`M650 ${mid}H720`);labels+=sigma(635,mid);}
  wires+=rect(720,mid-26,165,52)+signal(`M885 ${mid}H1004`)+signal(`M955 ${mid}V${ret}H147V${mid+15}`,'data-signal="feedback"')+dot(955,mid);
  labels+=label(720,mid-26,165,52,words(['제어 대상','Plant']))+symbol(916,mid-34,'y')+symbol(656,mid-34,'u');
  const start=offset;offset+=ret+20;
  return `<g data-family="${kind}" transform="translate(0 ${start})">${label(18,0,285,32,words([`${ko} · ${kind}`,`${en} · ${kind}`]),'class="pid-row-title"')}<g class="loop-wires">${wires}</g>${labels}</g>`;
 }).join('');
 const desc=families.map(([kind,ko,en])=>[`${ko}: 오차를 ${[...kind].join('·')}항에 전달해 제어 입력을 만듭니다.`,`${en}: error feeds ${[...kind].join(', ')} to form the plant input.`]);
 return svg(id,['오차 입력 표준형','Standard error-input form'],[0,1].map(i=>desc.map(s=>s[i]).join(' ')),offset,rows);
}

function experiment(d,p,rich){
 const id='pid-experiment',signal=(s,a)=>wire(id+'-arrow',s,a),named=(key,x,y,w,h)=>label(x,y,w,h,rich(d.id,'span',d.loop[key],'','diagram'),`data-loop-label="${key}"`);
 const land=d.id==='rocket-landing',mid=156,base=338;
 // The plant exposes a state bus: positions return to the subtraction
 // port, while measured rates (and compensation states) bypass that port.
 const plantX=844,plantW=153,actX=land?606:573,actW=plantX-32-actX;
 let wires=rect(actX,90,actW,145)+signal(`M${actX+actW} ${mid}H${plantX}`)+rect(plantX,108,plantW,96)+signal('M920 75V108','data-signal="disturbance"');
 let labels=named('disturbance',800,10,230,63)+named('plant',plantX+5,110,plantW-10,92)+named('actuator',actX+4,94,actW-8,45)+named('feedback',548,base-38,240,34);
 if(land){
  // Position PD / descent-speed P -> tilt reference and total thrust ->
  // attitude PD -> thrust allocator. T bypasses the torque law.
  wires+=signal(`M14 ${mid}H131`,'class="loop-target"')+rect(131,74,234,166)+rect(408,90,157,132)
    +signal('M365 156H408')+signal('M565 156H606')+signal('M365 104H385V55H580V108H606')
    +signal(`M997 ${mid}H1016V${base}H250V240`,'data-signal="feedback"')
    +signal(`M1016 278H486V222`,'data-signal="derivative"')+dot(1016,278);
  labels+=named('reference',4,70,122,75)+named('controller',120,1,262,45)
    +label(134,77,228,154,words(['수평 위치 PD · 하강 속도 P','Position PD · descent-speed P'])+lines(['e_x=x_r-x',t`a_x=\mathrm{clip}(K_x e_x-1.3v_x,-4,4)`,'a_y=K_v(v_r(h)-v_y)',t`(a_x,a_y,\theta)\mapsto(\theta_r,T)`]))
    +label(409,94,155,120,words(['자세 PD','Attitude PD'])+lines([t`e_\theta=\theta_r-\theta`,t`\tau=J(12e_\theta-6\omega)`])+words(['각속도 감쇠','Rate opposes rotation']))
    +symbol(364,126,t`\theta_r`,45)+symbol(565,128,t`\tau`,41)+symbol(480,25,'T')
    +label(actX+3,140,actW-6,90,lines([t`A=\min(T,24-T)`,t`\Delta=\mathrm{clip}(\tau/\ell,-A,A)`,t`F^{L,R}=(T\pm\Delta)/2`]))
    +symbol(458,246,t`\theta,\omega`,95)+symbol(262,300,t`x,v_x,h,v_y,\theta`,175);
 }else{
  wires+=signal(`M14 ${mid}H131`,'class="loop-target"')+sum(146,mid)+signal(`M161 ${mid}H231`)+rect(231,66,294,180)
    +signal(`M525 ${mid}H${actX}`)+signal(`M997 ${mid}H1016V${base}H146V171`,'data-signal="feedback"');
  if(p.state)wires+=signal('M1016 285H380V246','data-signal="derivative"')+dot(1016,285);
  labels+=named('reference',4,65,125,74)+signs(146,mid)+symbol(153,mid-41,p.error.split('=')[0],76,35)
    +named('controller',239,68,278,44)+label(237,113,282,126,lines(p.laws)+words(p.rate,'span','class="pid-function"'))
    +symbol(526,mid-38,p.command,46)+label(actX+3,142,actW-6,88,lines(p.actuation))
    +symbol(178,base-36,p.measured,84);
  if(p.state)labels+=symbol(386,250,p.state,112);
 }
 const desc=[0,1].map(i=>[d.loop.reference[i],d.loop.controller[i],d.loop.actuator[i],d.loop.plant[i]].join(' → ')+'. '+p.rate[i]+' '+(i?'Feedback: ':'되먹임: ')+d.loop.feedback[i]+'. '+(i?'Disturbance: ':'외란: ')+d.loop.disturbance[i]+'.');
 return svg(id,d.title.map((s,i)=>s+(i?' implemented feedback':' 실험의 피드백')),desc,base+14,`<g class="loop-wires">${wires}</g>${labels}`);
}

const integratedBias=[t`$I$에는 $K_i e\Delta t$를 더합니다. 지령이 한계 안에 있거나 오차가 포화를 줄이는 방향일 때만 누적하며, $K_i=0$이면 기억을 지웁니다.`,t`The stored contribution $I$ increases by $K_i e\Delta t$ only while the request is within limits or the error unwinds saturation. Setting $K_i=0$ clears it.`];
const measuredRate=[t`목표가 고정되면 $\dot e=-\dot y$입니다. 실제 제어기는 측정 속도를 사용하므로 목표만 갑자기 바뀌어도 미분 킥이 생기지 않습니다.`,t`At fixed reference, $\dot e=-\dot y$. Using the measured rate avoids a derivative kick when only the reference steps.`];
function controller(d,p){
 const defaults=Object.fromEntries(d.parameters.map(v=>[v.key,v.default]));
 const gains=p.gains.map(tex=>tex.replace(/@(\w+)/g,(_,k)=>{if(!(k in defaults))throw Error(`${d.id}: unknown gain ${k}`);return defaults[k];}));
 const eq=arr=>`<div class="pid-relations">${arr.map(math).join(' ')}</div>`;
 const rate=p.families.some(([kind])=>kind.includes('D'));
 return `<div class="pid-controller">${words(['제어식 읽기','Reading the controller'],'h3')}${eq([...(p.error?[p.error]:[]),...p.laws,...(p.guidance??[]),...(p.inner??[])])}${prose(p.terms)}${prose(p.rate)}${rate?prose(measuredRate):''}${p.memory||p.families[0][0].includes('I')?prose(p.memory??integratedBias):''}${words(['구동기 출력 · clip은 표시된 하한과 상한으로 제한합니다.','Actuator output · clip limits the request to its lower and upper bounds.'],'h4')}${eq(p.actuation)}${words(['기본 설정 · 이득은 실험 설정을 따릅니다.','Defaults · gains follow the experiment settings.'],'h4')}${eq(gains)}${words(p.watch,'p','class="pid-watch"')}</div>`;
}
export function apparatusPidPair(d,rich,aria){
 const p=pidModels[d.id];if(!p)return null;
 const kinds=p.families.map(([kind])=>kind).join(' / ');
 return `<div class="loop-viewport pid-pair" role="region" tabindex="0" ${aria([d.title[0]+'의 제어 구조',d.title[1]+' control structure'])} aria-describedby="loop-scroll-help"><figure data-pid-view="standard">${words([`1. 표준 ${kinds} · 오차 입력`,`1. Standard ${kinds} · error input`],'figcaption')}${standardKey(p.families)}${standard(p.families)}</figure><figure data-pid-view="experiment">${words([`2. ${d.title[0]} 실험 · 실제 제어기`,`2. ${d.title[1]} experiment · implemented controller`],'figcaption')}${experiment(d,p,rich)}${controller(d,p)}</figure></div>`;
}
