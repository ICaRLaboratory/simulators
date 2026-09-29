import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveLanguage, localizedHref, translate} from '../assets/i18n.js';
import {catalog, filterCatalog} from '../assets/catalog.js';
test('explicit supported locale wins; invalid locale falls back to preference then Korean',()=>{
 assert.equal(resolveLanguage('?lang=ko','en'),'ko');
 assert.equal(resolveLanguage('?lang=en','ko'),'en');
 assert.equal(resolveLanguage('?lang=fr','en'),'en');
 assert.equal(resolveLanguage('?lang=fr','fr'),'ko');
 assert.equal(resolveLanguage('','en'),'en');
 assert.equal(resolveLanguage(),'ko');
});
test('links preserve Research simulator and anchor while synchronizing locale',()=>{
 for(const item of catalog.filter(item=>item.external)){
  const url=new URL(localizedHref(item.href,'en'));
  assert.equal(url.searchParams.get('lang'),'en');
  assert.equal(url.searchParams.get('sim'),new URL(item.href).searchParams.get('sim'));
  assert.equal(url.hash,'#interactive');
 }
 assert.equal(localizedHref('ball-and-beam/','en'),'ball-and-beam/?lang=en');
});
test('every catalog field is translated and searchable in both languages',()=>{
 for(const item of catalog){
  for(const value of [item.name,item.description,item.category,item.sourceName,...item.features]){
   assert.doesNotMatch(translate(value),/[가-힣]/,value);
   assert.equal(translate(value,'ko'),value);
  }
  assert.ok(filterCatalog({query:item.name}).includes(item));
  assert.ok(filterCatalog({query:translate(item.description)}).includes(item));
 }
});
