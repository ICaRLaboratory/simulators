import {english} from './translations.js';
export const validLanguage = value => value === 'ko' || value === 'en';
export function resolveLanguage(search = '', stored = null) {
  const explicit = new URLSearchParams(search).get('lang');
  return validLanguage(explicit) ? explicit : validLanguage(stored) ? stored : 'ko';
}
const phrases = Object.keys(english).sort((a,b)=>b.length-a.length);
const pattern = new RegExp(phrases.map(key=>key.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|'),'g');
export function translate(text, language = 'en') {
  return language === 'ko' ? text : english[text] ?? text.replace(pattern, key=>english[key]);
}
let language = 'ko';
export const getLanguage = () => language;
export const t = text => translate(text, language);
export function localizedHref(href, lang = language) {
  const url = new URL(href, 'https://icarlaboratory.github.io/simulators/');
  url.searchParams.set('lang',lang);
  if (/^https?:/.test(href)) return url.href;
  return href.split(/[?#]/)[0] + '?' + url.searchParams.toString() + url.hash;
}
// Bind text nodes, not innerHTML: controls, disclosure state and listeners survive translation.
// Replaced dynamic nodes acquire a fresh source; unchanged nodes retain their Korean source.
const bindings = new WeakMap();
function apply(node, key, read, write) {
  let records=bindings.get(node);
  if(!records){records=new Map();bindings.set(node,records);}
  const current=read();
  let record=records.get(key);
  if(!record || current!==record.last) record={source:current};
  const next=t(record.source);
  if(current!==next)write(next);
  record.last=next;records.set(key,record);
}
export function translateDOM(root = document.documentElement) {
  const walker=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
  while(walker.nextNode()) {
    const node=walker.currentNode;
    if(node.parentElement?.closest('script,style,noscript,.language-switch'))continue;
    apply(node,'text',()=>node.nodeValue,value=>{node.nodeValue=value;});
  }
  for(const node of root.querySelectorAll('[aria-label],[placeholder],meta[name="description"]')) {
    for(const attr of ['aria-label','placeholder','content']) if(node.hasAttribute(attr))
      apply(node,attr,()=>node.getAttribute(attr),value=>node.setAttribute(attr,value));
  }
}
function syncLinks(){
  document.querySelectorAll('a.brand,a.back-link,.site-footer a').forEach(link=>{
    link.setAttribute('href',localizedHref(link.getAttribute('href')));
  });
}
export function setLanguage(value, {persist = true, updateURL = true} = {}) {
  if(!validLanguage(value))return;
  language=value;document.documentElement.lang=value;
  if(persist){try{localStorage.setItem('icar-lang',value);}catch{/* Storage may be blocked. */}}
  if(updateURL){const url=new URL(location.href);url.searchParams.set('lang',value);history.replaceState(null,'',url);}
  document.querySelectorAll('[data-lang]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.lang===value)));
  translateDOM();syncLinks();
  document.dispatchEvent(new CustomEvent('icar:lang',{bubbles:true,detail:{lang:value}}));
}
export function setupLanguage(){
  let stored=null;try{stored=localStorage.getItem('icar-lang');}catch{/* Korean fallback. */}
  setLanguage(resolveLanguage(location.search,stored),{persist:false,updateURL:false});
  document.querySelectorAll('[data-lang]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.lang)));
}
