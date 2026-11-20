// Render sampled curves without letting their values move the Y ticks.
import {boundPlot} from './plot-scale.js';
const ns='http://www.w3.org/2000/svg';
const styles={output:['#08796f'],target:['#9c552a','6 4'],input:['#244e75'],'record-u':['#73568d','4 2'],'record-y':['#08796f'],'record-v':['#a34a24','7 3'],phase:['#08796f'],surface:['#9c552a','6 4'],unknown:['#38495c'],estimate:['#be5d23','5 3']};
const label=n=>String(Number(n.toPrecision(8)));
function scale(min,max,count){
 if(min===max){const pad=Math.max(1,Math.abs(min)*.1);min-=pad;max+=pad;}
 const raw=(max-min)/count,mag=10**Math.floor(Math.log10(raw));const step=([1,2,2.5,5,10].find(v=>v*mag>=raw)||10)*mag;
 return [Math.floor(min/step+1e-11)*step,Math.ceil(max/step-1e-11)*step,step];
}
export const trace=(name,rows,key,{x='t',step=false}={})=>({name,step,points:rows.filter(r=>Number.isFinite(r[key])&&Number.isFinite(r[x])).map(r=>[r[x],r[key]])});
export function plot(svg,lines,{axis,empty,marker=null,domain=null,yScale}){
 const w=svg.clientWidth,h=svg.clientHeight;if(!w||!h)return;
 const fragment=document.createDocumentFragment();
 function add(tag,attrs,text){const el=document.createElementNS(ns,tag);for(const [k,v] of Object.entries(attrs))el.setAttribute(k,v);if(text!==undefined)el.textContent=text;fragment.append(el);}
 const points=lines.flatMap(l=>l.points),left=w<400?44:52,right=w-17,top=16,bot=h-41;
  const xs=points.map(p=>p[0]),ys=points.map(p=>p[1]);
  const [xmin,xmax,xstep]=scale(...(domain||(xs.length?[Math.min(...xs),Math.max(...xs)]:[0,20])),w<420?4:6);
  const [ymin,ymax,ystep]=yScale;
  const clip=boundPlot(svg,fragment,{left,right,top,bottom:bot,low:ymin,high:ymax,min:Math.min(...ys),max:Math.max(...ys)});
  const X=x=>left+(right-left)*(x-xmin)/(xmax-xmin),Y=y=>bot-(bot-top)*(y-ymin)/(ymax-ymin);
  const text=(x,y,value,anchor='middle')=>add('text',{x,y,'text-anchor':anchor},value);
  for(let j=0;j<=Math.round((ymax-ymin)/ystep);j++){const n=ymin+j*ystep,y=Y(n);add('line',{x1:left,x2:right,y1:y,y2:y,stroke:'#d7dcda'});text(left-6,y+4,label(Math.abs(n)<ystep*1e-8?0:n),'end');}
  for(let j=0;j<=Math.round((xmax-xmin)/xstep);j++){const n=xmin+j*xstep;text(X(n),bot+16,label(Math.abs(n)<xstep*1e-8?0:n));}
  text((left+right)/2,h-4,axis);
  if(points.length&&marker!==null&&marker>=xmin&&marker<=xmax)add('line',{'data-onset':marker,x1:X(marker),x2:X(marker),y1:top,y2:bot,stroke:'#777','stroke-dasharray':'2 4'});
  for(const {name,points,step} of lines){if(!points.length)continue;let d='';for(const [i,[x,y]] of points.entries()){const a=X(x).toFixed(2),b=Y(y).toFixed(2);d+=i?(step?`H${a}V${b}`:`L${a} ${b}`):`M${a} ${b}`;}
   const [stroke,dash]=styles[name];add('path',{d,'data-series':name,stroke,fill:'none','clip-path':clip,'stroke-width':dash?1.8:2,'stroke-dasharray':dash||'none','stroke-linejoin':'round'});
  }
  if(!points.length)add('text',{x:w/2,y:h/2,'text-anchor':'middle'},empty);
 svg.setAttribute('viewBox',`0 0 ${w} ${h}`);svg.replaceChildren(fragment);
}
