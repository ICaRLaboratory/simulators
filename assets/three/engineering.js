import * as T from '../vendor/three.js';

// Procedural surface grain: no network assets, canvas APIs or scene-owned clocks.
let brushedGrain;
function grain() {
  if (brushedGrain) return brushedGrain;
  const width=128, height=64, data=new Uint8Array(width*height*4);
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
    const noise=((x*73+y*151+(x*y)%47)%31)/31;
    const value=Math.round(202+27*Math.sin(y*2.3)+17*noise), i=(y*width+x)*4;
    data[i]=data[i+1]=data[i+2]=value;data[i+3]=255;
  }
  brushedGrain=new T.DataTexture(data,width,height,T.RGBAFormat);
  brushedGrain.name='directional-machining-grain';
  brushedGrain.wrapS=brushedGrain.wrapT=T.RepeatWrapping;
  brushedGrain.magFilter=T.LinearFilter;brushedGrain.minFilter=T.LinearMipmapLinearFilter;
  brushedGrain.generateMipmaps=true;brushedGrain.repeat.set(3,2);brushedGrain.needsUpdate=true;
  return brushedGrain;
}
const finishes={
  steel:{color:0x929b9f,metalness:.88,roughness:.25},
  aluminium:{color:0xc9ced0,metalness:.84,roughness:.34},
  'dark-metal':{color:0x353e43,metalness:.72,roughness:.38},
  paint:{color:0xd6dcda,metalness:.08,roughness:.58},
  rubber:{color:0x272b2b,metalness:0,roughness:.92},
  copper:{color:0xb5784f,metalness:.9,roughness:.3},
  ceramic:{color:0xe8e9e2,metalness:0,roughness:.7},
  glass:{color:0xd4e3e4,metalness:.06,roughness:.14,transparent:true,opacity:.2,depthWrite:false},
};
export function finish(kind='paint',options={}) {
  if(!finishes[kind])throw new Error(`Unknown engineering finish: ${kind}`);
  const metallic=finishes[kind].metalness>.5;
  const material=new T.MeshStandardMaterial({...finishes[kind],
    ...(metallic?{roughnessMap:grain(),bumpMap:grain(),bumpScale:.00045}:{}),...options});
  material.name=`engineering-${kind}`;material.userData.finish=kind;return material;
}
function attach(parent,name,geometry,position,role) {
  const mesh=new T.Mesh(geometry,role?.isMaterial?role:finish(role));
  mesh.name=name;mesh.position.fromArray(position);mesh.castShadow=true;mesh.receiveShadow=true;
  parent.add(mesh);return mesh;
}
export function housing(parent,name,size,position,role='paint') {
  if(!size.every(n=>Number.isFinite(n)&&n>0))throw new Error('Positive housing dimensions required');
  const [w,h,d]=size,b=Math.min(...size)*.035;
  const shape=new T.Shape();
  shape.moveTo(-w/2+b,-h/2+b);shape.lineTo(w/2-b,-h/2+b);
  shape.lineTo(w/2-b,h/2-b);shape.lineTo(-w/2+b,h/2-b);shape.closePath();
  const geometry=new T.ExtrudeGeometry(shape,{depth:d-2*b,bevelEnabled:true,
    bevelSegments:1,steps:1,bevelSize:b,bevelThickness:b,curveSegments:1});
  geometry.center();geometry.computeBoundingBox();
  const actual=geometry.boundingBox.getSize(new T.Vector3());
  geometry.scale(w/actual.x,h/actual.y,d/actual.z);
  return attach(parent,name,geometry,position,role);
}
export function turned(parent,name,profile,position,role='steel') {
  return attach(parent,name,new T.LatheGeometry(profile.map(p=>new T.Vector2(...p)),48),position,role);
}
export function flange(parent,name,radius,depth,position,role='steel',bore=radius*.42) {
  const shape=new T.Shape();shape.absarc(0,0,radius,0,Math.PI*2,false);
  const hole=new T.Path();hole.absarc(0,0,bore,0,Math.PI*2,true);shape.holes.push(hole);
  const geometry=new T.ExtrudeGeometry(shape,{depth,bevelEnabled:false,steps:1,curveSegments:24});
  geometry.translate(0,0,-depth/2);geometry.rotateX(-Math.PI/2);
  const mesh=attach(parent,name,geometry,position,role);mesh.userData.bore=bore;return mesh;
}
export function fasteners(parent,name,radius,position,count=6,headRadius=radius*.085) {
  const group=new T.Group();group.name=name;group.position.fromArray(position);parent.add(group);
  const head=new T.CylinderGeometry(headRadius,headRadius,headRadius*.65,6);
  const socket=new T.CylinderGeometry(headRadius*.42,headRadius*.42,headRadius*.035,6);
  const steel=finish('steel'), recess=finish('dark-metal');
  for(let i=0;i<count;i++){
    const bolt=new T.Group();bolt.name=`${name}-${i}`;
    const angle=i*Math.PI*2/count;bolt.position.set(radius*Math.cos(angle),0,radius*Math.sin(angle));
    attach(bolt,'hex-head',head,[0,0,0],steel);
    attach(bolt,'socket',socket,[0,headRadius*.34,0],recess);group.add(bolt);
  }
  return group;
}
export function cable(parent,name,points,radius=.012,color=0x282d30) {
  const curve=new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p)));
  return attach(parent,name,new T.TubeGeometry(curve,40,radius,8,false),[0,0,0],finish('rubber',{color}));
}
