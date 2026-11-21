// Run inside Chromium after the selected language and fonts have settled.
export function measureApparatusCopy() {
  const issues=[];
  const box = el=>el.getBoundingClientRect();
  let minClearance=Infinity, widestFormula=0, diagramMath=0;
  function contentRects(el) {
    const rects=[...el.querySelectorAll('math, math *')].map(box);
    const walker=document.createTreeWalker(el,NodeFilter.SHOW_TEXT);
    while(walker.nextNode()) {
      const n=walker.currentNode;
      if(!n.textContent.trim() || n.parentElement.closest('math,template'))continue;
      const range=document.createRange();range.selectNodeContents(n);rects.push(...range.getClientRects());
    }
    return rects.filter(r=>r.width&&r.height);
  }
  const regions=[...document.querySelectorAll('.loop-diagram foreignObject[data-loop-label]')];
  for(const region of regions) {
    const b=box(region), key=region.dataset.loopLabel, rects=contentRects(region);
    if(!rects.length)issues.push(`${key}: empty`);
    for(const r of rects){
      const clearance=Math.min(r.left-b.left,b.right-r.right,r.top-b.top,b.bottom-r.bottom);
      minClearance=Math.min(minClearance,clearance);
      if(clearance < -1)issues.push(`${key}: ${clearance.toFixed(1)}px`);
    }
    for(const m of region.querySelectorAll('math')){diagramMath++;widestFormula=Math.max(widestFormula,box(m).width);}
  }
  // Test actual selected text/math against each prose paragraph/list item,
  // not the page width (the panel's overflow:hidden could conceal clipping).
  for(const el of document.querySelectorAll('.loop-details p:not(.loop-equation),.loop-details li,.control-help,.model-notes p')) {
    const b=box(el);
    for(const r of contentRects(el))if(r.left<b.left-1||r.right>b.right+1||r.top<b.top-1||r.bottom>b.bottom+1)
      issues.push(`${el.tagName} ${el.textContent.slice(0,40)}: outside text box`);
  }
  if(document.documentElement.scrollWidth>innerWidth)issues.push('page overflow');
  return {regions:regions.length,diagramMath,widestFormula,minClearance,issues};
}
