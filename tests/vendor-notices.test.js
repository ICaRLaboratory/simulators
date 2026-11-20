import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>readFileSync(new URL('../assets/vendor/'+name,import.meta.url),'utf8');
const digest=s=>createHash('sha256').update(s).digest('hex');
test('standalone renderer copies retain full pinned license texts, shader credits, and the original runtime',()=>{
 const bundle=read('three.js');
 assert.ok(bundle.startsWith('/*!\nThird-party notices'), 'the downloadable module itself must carry the notices');
 const notice=read('THIRD-PARTY-NOTICES.txt');
 for(const [name,sha] of Object.entries({
  "Three.js MIT": "7f05fc2885cd764e3a2fbe9cd64b6e99a423d284c718e5f909a4ee83c89433f3",
  "Mapbox ISC": "324139c19d87af03fda38afea1590e00ca354c4159bdb2ae9e9cec070cfa46a8",
  "AgX minimal MIT": "c8dd74c0e0a4d2ed9237bcfa1c574cb6d132882a64c5df9f326a575df56f52ad",
  "LTC project terms": "7a9dfa5a6ed9866d0ba60cc4616af6add1b175747342779d154361d2a735ff45",
  "Apache License 2.0": "5ba8009b947bcc8e36e007e7eaeab7d19feb3ce560000ef2420062600367d61f"
})){
  const text=notice.split('--- '+name+' ---\n')[1]?.split('--- end ---')[0];
  assert.ok(text, name);assert.equal(digest(text),sha,name+' license text changed');
 }
 for(const credit of ['Copyright (C) 2021 The Android Open Source Project','Copyright 2024 The Khronos Group, Inc.','Benjamin Wrensch','Real-Time Polygonal-Light Shading with Linearly Transformed Cosines.'])assert.ok(notice.includes(credit),credit);
 const banner='/*!\n'+notice+'*/\n';assert.ok(bundle.startsWith(banner),'banner and readable sidecar differ');
 // A notice-only fix for r187: the executable body must still be the known bundle.
 assert.equal(digest(bundle.slice(banner.length)),'86a852f22bf981c8f025b4c23c1e860f9cac24b01af2046f7d1f19975091b4d1');
 const mf=JSON.parse(read('three-manifest.json'));assert.equal(digest(bundle),mf.sha256);assert.equal(digest(notice),mf.notices.sha256);assert.equal(mf.notices.file,'THIRD-PARTY-NOTICES.txt');
});
