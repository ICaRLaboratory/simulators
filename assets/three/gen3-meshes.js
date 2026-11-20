import encoded from '../vendor/kinova/mesh-data.js';

function unpack(text, signed) {
  const bytes=atob(text), values=signed?new Float32Array(bytes.length/2):new Uint16Array(bytes.length/2);
  for(let i=0;i<values.length;i++) {
    const n=bytes.charCodeAt(2*i) | (bytes.charCodeAt(2*i+1)<<8);
    values[i]=signed ? ((n<<16)>>16)/1e5 : n;
  }
  return values;
}

export function makeGen3Geometry(THREE,index) {
  const [positions,faces]=encoded[index];
  const geometry=new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.BufferAttribute(unpack(positions,true),3));
  geometry.setIndex(new THREE.BufferAttribute(unpack(faces,false),1));
  geometry.computeVertexNormals();
  return geometry;
}
