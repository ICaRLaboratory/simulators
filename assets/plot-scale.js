// Fixed teaching windows, not constraints on the plant or its measurements.
export const Y_SCALES=Object.freeze({
  output:Object.freeze([-.5,2,.5]), input:Object.freeze([-4,4,2]),
  record:Object.freeze([-2,2,1]), velocity:Object.freeze([-3,3,1]),
  residual:Object.freeze([-4,4,2]),
});

// Clip paint rather than clamping the data: a curve outside the window
// must not appear to ride its edge. Keep the extrema available in text.
export function boundPlot(svg,fragment,{left,right,top,bottom,low,high,min,max}){
  const ns='http://www.w3.org/2000/svg',id=svg.id+'-clip';
  const defs=document.createElementNS(ns,'defs'),clip=document.createElementNS(ns,'clipPath'),rect=document.createElementNS(ns,'rect');
  clip.id=id;
  for(const [key,value] of Object.entries({x:left,y:top,width:right-left,height:bottom-top}))rect.setAttribute(key,value);
  clip.append(rect);defs.append(clip);fragment.append(defs);
  const noteId=svg.id+'-range-note';let note=document.getElementById(noteId);
  if(!note){note=document.createElement('p');note.id=noteId;note.className='plot-range-note';svg.after(note);}
  const fmt=n=>String(+n.toPrecision(4));const en=document.documentElement.lang==='en',parts=[];
  if(min<low)parts.push((en?'minimum ':'최솟값 ')+fmt(min));
  if(max>high)parts.push((en?'maximum ':'최댓값 ')+fmt(max));
  const text=parts.length?(en?'Outside the fixed Y range: ':'고정 Y축 범위 밖: ')+parts.join(', '):'';
  if(note.textContent!==text)note.textContent=text;
  note.hidden=!text;
  return `url(#${id})`;
}
