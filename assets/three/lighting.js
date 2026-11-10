import * as T from '../vendor/three.js';

// A small local softbox studio supplies real image-based reflections to metals.
// It is rendered once per view; it does not create an animation loop.
export function studioEnvironment(renderer) {
  const room=new T.Scene();room.background=new T.Color(0x929c9d);
  const surfaces=[];
  function panel(w,h,position,intensity,color=0xffffff){
    const material=new T.MeshBasicMaterial({color,side:T.DoubleSide,toneMapped:false});
    material.color.multiplyScalar(intensity);
    const mesh=new T.Mesh(new T.PlaneGeometry(w,h),material);
    mesh.position.fromArray(position);mesh.lookAt(0,0,0);room.add(mesh);surfaces.push(mesh);
  }
  panel(7,5,[0,5,0],2.8);
  panel(3,6,[-5,1.5,2],1.9);
  panel(1.2,5,[4,2,-3],2.4);
  panel(5,2,[0,.5,6],.7,0xe3edee);
  panel(16,16,[0,-4,0],.2,0x737b79);
  // PMREMGenerator.fromScene and CubeCamera.update restore these only on success.
  const previous={target:renderer.getRenderTarget(),face:renderer.getActiveCubeFace(),mipmap:renderer.getActiveMipmapLevel(),
    autoClear:renderer.autoClear,autoClearColor:renderer.autoClearColor,autoClearDepth:renderer.autoClearDepth,
    autoClearStencil:renderer.autoClearStencil,xrEnabled:renderer.xr.enabled};
  const generator=new T.PMREMGenerator(renderer);
  try{return generator.fromScene(room,0,.1,30,{size:128});}
  finally{
    renderer.autoClear=previous.autoClear;renderer.autoClearColor=previous.autoClearColor;
    renderer.autoClearDepth=previous.autoClearDepth;renderer.autoClearStencil=previous.autoClearStencil;
    renderer.xr.enabled=previous.xrEnabled;
    try{renderer.setRenderTarget(previous.target,previous.face,previous.mipmap);}
    finally{
      generator.dispose();
      for(const mesh of surfaces){mesh.geometry.dispose();mesh.material.dispose();}
    }
  }
}
