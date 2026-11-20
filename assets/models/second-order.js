// G(s) = b/(s² + a1 s + a0); gain is the plant DC gain, not Kp.
export const ranges=Object.freeze({wn:[.5,2,1],zeta:[.1,2,.5],gain:[.5,2,1]});
export function coefficients(params={}){
  const plant={};
  for(const [key,[min,max,initial]] of Object.entries(ranges)){
    const v=params[key]===undefined?initial:params[key];
    if(!Number.isFinite(v)||v<min||v>max)throw new RangeError(`Invalid plant ${key}`);
    plant[key]=v;
  }
  const {wn,zeta,gain}=plant,a0=wn*wn;
  return {...plant,a0,a1:2*zeta*wn,b:gain*a0};
}
// Closed form exp(A T), including the repeated-pole limit at critical damping.
export function heldInputStep(params,dt){
  const {wn,zeta,gain,a0}=coefficients(params),alpha=zeta*wn;
  const w=wn*Math.sqrt(Math.abs((zeta-1)*(zeta+1))),x=w*dt,decay=Math.exp(-alpha*dt);
  const c=decay*(zeta>1?Math.cosh(x):Math.cos(x));
  const s=decay*(w===0?dt:(zeta>1?Math.sinh(x):Math.sin(x))/w);
  const p=c+alpha*s,q=c-alpha*s;
  return ([y,v],u)=>[p*y+s*v+(1-p)*gain*u,a0*s*(gain*u-y)+q*v];
}
