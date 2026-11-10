import {Vector3} from '../vendor/three.js';

export function createReadoutLayer(viewport,model,compact=false) {
  const namespace='http://www.w3.org/2000/svg';
  const layer=document.createElement('div');layer.className='three-readouts';layer.setAttribute('aria-hidden','true');
  const leaders=document.createElementNS(namespace,'svg');leaders.classList.add('three-leaders');
  leaders.setAttribute('aria-hidden','true');layer.append(leaders);viewport.append(layer);
  const nodes=new Map(),point=new Vector3(),range=document.createRange();
  const contains=(outer,inner)=>inner.left>=outer.left&&inner.right<=outer.right&&inner.top>=outer.top&&inner.bottom<=outer.bottom;
  function update(camera,width,height,lang) {
    const rem=parseFloat(getComputedStyle(document.documentElement).fontSize)||16;
    const condensed=(compact&&width<300)||(width<400&&rem>20);
    const all=typeof model.readouts==='function'?model.readouts():[];
    const entries=(compact&&(height<85||width<140)?[]:all||[]).slice(0,condensed?1:3);
    const active=new Set(),rows={left:0,right:0};
    const padding=condensed?8:12,labelWidth=Math.min(condensed?width-2*padding:width*.42,Math.max(112,rem*8));
    const rowHeight=condensed?rem*1.7:Math.max(58,rem*4.5);
    const viewportBounds=viewport.getBoundingClientRect();
    leaders.setAttribute('viewBox',`0 0 ${width} ${height}`);
    for(const entry of entries){
      if(!entry.anchor?.isObject3D)continue;
      const id=String(entry.id);active.add(id);
      let node=nodes.get(id);
      if(!node){
        const box=document.createElement('div');box.className='three-readout';box.dataset.readout=id;
        const label=document.createElement('span');label.className='three-readout__label';
        const value=document.createElement('span');value.className='three-readout__value';
        box.append(label,value);layer.append(box);
        const line=document.createElementNS(namespace,'line');line.classList.add('three-leader');leaders.append(line);
        node={box,label,value,line};nodes.set(id,node);
      }
      const side=entry.side==='right'?'right':'left',row=rows[side]++;
      entry.anchor.getWorldPosition(point);point.project(camera);
      const visible=(row===0||(row+1)*rowHeight+padding<=height)&&Number.isFinite(point.x)&&Number.isFinite(point.y)&&Math.abs(point.x)<=1&&Math.abs(point.y)<=1&&Math.abs(point.z)<=1;
      node.box.hidden=!visible;node.line.style.display=visible?'':'none';
      if(!visible)continue;
      const x=side==='left'?padding:width-padding-labelWidth;
      const y=Math.max(padding,Math.min(height-rowHeight-padding,padding+row*rowHeight));
      node.box.style.cssText=`left:${x}px;top:${y}px;width:${labelWidth}px;visibility:hidden`;
      node.box.classList.toggle('is-condensed',condensed&&!entry.retainLabel);
      const label=typeof entry.label==='object'?entry.label[lang==='en'?'en':'ko']:entry.label;
      if(node.label.textContent!==String(label||''))node.label.textContent=label||'';
      const value=String(entry.value??'');if(node.value.textContent!==value)node.value.textContent=value;
      // These are supplementary annotations: keep primary metrics, never shrink text.
      // Measure the first row too; wrapping/glyph bounds can exceed nominal rowHeight.
      const boxBounds=node.box.getBoundingClientRect();
      const fits=contains(viewportBounds,boxBounds)&&[node.label,node.value].every(child=>{
        if(!child.getClientRects().length)return true;
        range.selectNodeContents(child);
        return [...range.getClientRects()].every(rect=>contains(boxBounds,rect));
      });
      node.box.hidden=!fits;node.box.style.visibility='';node.line.style.display=fits?'':'none';
      if(!fits)continue;
      node.line.setAttribute('x1',((point.x+1)*width/2).toFixed(2));
      node.line.setAttribute('y1',((1-point.y)*height/2).toFixed(2));
      node.line.setAttribute('x2',String(side==='left'?x+labelWidth:x));
      node.line.setAttribute('y2',String(y+(condensed?rem*.65:rem*1.3)));
    }
    for(const [id,node] of nodes)if(!active.has(id)){node.box.remove();node.line.remove();nodes.delete(id);}
  }
  return {update};
}
