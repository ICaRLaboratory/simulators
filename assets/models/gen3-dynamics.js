// Gen3 sagittal reduction, coordinates q = [q2,q4,q6]. At the fixed odd
// joint angles each pair of moving bodies is one compound rigid body.
// Derived from GEN3_FOR_URDF_ARM_V11_MOD: [mass, COM x,z relative to pitch
// axis at q=0, centroidal moment about that axis] in kg, m, kg m². Tiny
// deviations from orthogonal URDF twist angles are neglected in the inertia.
const bodies = [
  [2.327327, -1.3234e-10, .21392565608, .05281182299], // HalfArm1 + HalfArm2
  [1.608393, .00000998951127, .15846455522, .02511892068], // ForeArm + Wrist1
  [1.178763, -.004843356315, .08435733966, .004661172872], // Wrist2 + Bracelet
];
const axis = [1,-1,-1]; // pitch about world +y (URDF z-up)
const spacing = [.42076,.31436,0];
const g = 9.8067;

export function dynamics(q,dq) {
  const M=[[0,0,0],[0,0,0],[0,0,0]], C=[0,0,0], G=[0,0,0];
  const jointX=[], jointZ=[];
  let x=0,z=0,ax=0,az=0,angle=0,omega=0;
  for(let i=0;i<3;i++) {
    jointX.push(x); jointZ.push(z);
    angle+=axis[i]*q[i]; omega+=axis[i]*dq[i];
    const cos=Math.cos(angle),sin=Math.sin(angle),w2=omega*omega;
    const [m,rx,rz,I]=bodies[i];
    const cx=cos*rx+sin*rz, cz=-sin*rx+cos*rz;
    // Bias acceleration of the COM with all generalized accelerations zero.
    const bx=ax-w2*cx, bz=az-w2*cz;
    for(let j=0;j<=i;j++) {
      const jx=axis[j]*(z+cz-jointZ[j]), jz=-axis[j]*(x+cx-jointX[j]);
      G[j]+=m*g*jz;
      C[j]+=m*(jx*bx+jz*bz);
      for(let k=0;k<=i;k++) {
        const kx=axis[k]*(z+cz-jointZ[k]), kz=-axis[k]*(x+cx-jointX[k]);
        M[j][k]+=m*(jx*kx+jz*kz)+I*axis[j]*axis[k];
      }
    }
    const dx=spacing[i]*sin,dz=spacing[i]*cos;
    x+=dx; z+=dz; ax-=w2*dx; az-=w2*dz;
  }
  return {M,C,G};
}
