// Gen3 V11 joint origins (metres), in URDF coordinates: +X into wall, +Z up.
// See assets/vendor/kinova/NOTICE.md. Nominal right angles replace rounded CAD rpy.
const origins = [
  [.000061995, 0, .15643, -2], [0, .005375, -.12838, 1],
  [0, -.21038, -.006375, -1], [0, .006375, -.21038, 1],
  [0, -.20843, -.006375, -1], [0, .00017505, -.10593, 1],
  [0, -.10593, -.00017505, -1], [0, 0, -.061525, 2],
];
export const HOME = Object.freeze([15, -130, 55].map(d => d*Math.PI/180));
const lengths = [-(origins[2][1]+origins[3][2]), -(origins[4][1]+origins[5][2]), -(origins[6][1]+origins[7][2])];

// Sagittal restriction of exactly the same chain, for the integrator's inner loop.
export function gen3Planar(q) {
  const a=q[0], b=a-q[1], c=b-q[2], [l1,l2,l3]=lengths;
  const x3=l3*Math.sin(c), x2=l2*Math.sin(b)+x3, x1=l1*Math.sin(a)+x2;
  const z3=l3*Math.cos(c), z2=l2*Math.cos(b)+z3, z1=l1*Math.cos(a)+z2;
  return {x:origins[0][0]+x1, z:origins[0][2]-origins[1][2]+z1, pitch:c-Math.PI/2,
    J:[[z1,-z2,-z3],[-x1,x2,x3],[1,-1,-1]]};
}

// Fixed origin followed by joint rotation about local Z (not its parent's Z).
export function gen3Pose(q) {
  const angles=[0,q[0],Math.PI,q[1],0,q[2],Math.PI/2,0];
  let p=[0,0,0], r=[1,0,0,0,1,0,0,0,1];
  const frames=[{p,r}];
  origins.forEach(([x,y,z,turn],i) => {
    const cx=turn%2===0?-1:0, sx=turn%2, ct=Math.cos(angles[i]), st=Math.sin(angles[i]);
    const next=[];
    p=p.map((v,j)=>v+r[3*j]*x+r[3*j+1]*y+r[3*j+2]*z);
    for (let j=0;j<9;j+=3) {
      const u=r[j], v=r[j+1], w=r[j+2], m=v*cx+w*sx;
      next.push(u*ct+m*st, -u*st+m*ct, -v*sx+w*cx);
    }
    r=next;frames.push({p,r});
  });
  return {...gen3Planar(q),x:p[0],y:p[1],z:p[2],frames};
}
