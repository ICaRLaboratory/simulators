import * as T from '../vendor/three.js';

export function resizeApparatusCamera(camera, spec, aspect) {
  const span=spec.span||5, vertical=span/Math.min(aspect,1.6);
  if(camera.isOrthographicCamera){
    camera.left=-vertical*aspect/2;camera.right=vertical*aspect/2;
    camera.top=vertical/2;camera.bottom=-vertical/2;
  }else{
    camera.aspect=aspect;
    const base=T.MathUtils.degToRad(spec.fov||32);
    camera.fov=T.MathUtils.radToDeg(2*Math.atan(Math.tan(base/2)*1.6/Math.min(aspect,1.6)));
  }
  camera.updateProjectionMatrix();
}

export function createApparatusCamera(spec, aspect=1.6) {
  const span=spec.span||5, target=new T.Vector3().fromArray(spec.target);
  const camera=spec.projection==='orthographic'
    ? new T.OrthographicCamera(-span,span,span,-span,span*.002,span*60)
    : new T.PerspectiveCamera(spec.fov||32,aspect,span*.002,span*60);
  camera.position.fromArray(spec.position);
  if(camera.isPerspectiveCamera){
    const distance=span/(3.2*Math.tan(T.MathUtils.degToRad(spec.fov||32)/2));
    camera.position.sub(target).normalize().multiplyScalar(distance).add(target);
  }
  camera.lookAt(target);resizeApparatusCamera(camera,spec,aspect);camera.updateMatrixWorld(true);
  return camera;
}
