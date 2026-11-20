import {gen3Pose, gen3Planar, HOME} from './gen3.js';
import {wallX, contactForce, referenceX} from './impedance-robot.js';

const homeZ=gen3Planar(HOME).z;
const shells=['#a9bdd0','#dba6a4','#c7cf93','#d9ae76','#a9bdd0','#dba6a4','#c7cf93','#d9ae76'];

// A sagittal elevation of the same rigid frames as the CAD scene; no view-side IK.
export function draw(ctx,state,params,w,h,language) {
  if(w<2||h<2)return;
  const pose=gen3Pose(state.q), goalX=referenceX(state.t,params), en=language==='en';
  const force=contactForce(pose.x,pose.J[0].reduce((sum,j,i)=>sum+j*state.dq[i],0),params.wallStiffness);
  const minX=Math.min(-.085,...pose.frames.map(f=>f.p[0]-.06)),maxX=Math.max(wallX+.155,...pose.frames.map(f=>f.p[0]+.06));
  const lowZ=Math.min(-.035,...pose.frames.map(f=>f.p[2]-.045)),highZ=Math.max(.82,...pose.frames.map(f=>f.p[2]+.06));
  const scale=Math.max(1,Math.min((w-36)/(maxX-minX),(h-66)/(highZ-lowZ)));
  const X=x=>w/2+(x-(minX+maxX)/2)*scale,Z=z=>h/2+7-(z-(lowZ+highZ)/2)*scale;
  const line=(x,y,u,v,color,width)=>{ctx.strokeStyle=color;ctx.lineWidth=width;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(u,v);ctx.stroke();};
  const circle=(x,y,r,color)=>{ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,r,0,2*Math.PI);ctx.fill();};
  ctx.save();
  const wx=X(wallX),top=Z(.81),floor=Z(0);
  ctx.fillStyle='#abc9df';ctx.fillRect(wx,top,.12*scale,floor-top);
  line(wx,top,wx,floor,'#456e8b',2);
  line(X(-.07),floor,X(wallX+.14),floor,'#718294',1);
  ctx.lineCap='round';
  const diameters=[.084,.085,.085,.085,.077,.067,.065,.065];
  for(let i=0;i<8;i++) {
    const [x,,z]=pose.frames[i].p,[u,,v]=pose.frames[i+1].p;
    const width=Math.max(3,diameters[i]*scale), inset=i===0?width/2:0;
    line(X(x),Z(z)-inset,X(u),Z(v),'#596773',width);
    line(X(x),Z(z)-inset,X(u),Z(v),shells[i],Math.max(1,width-2));
    if(i>0) circle(X(x),Z(z),Math.max(1,width/2-1),shells[i]);
  }
  const gx=X(goalX),gz=Z(homeZ),tx=X(pose.x),tz=Z(pose.z),r=Math.max(3,.0125*scale);
  circle(tx,tz,r,'#374957');
  if(Math.hypot(gx-tx,gz-tz)<2*r){
    ctx.strokeStyle='#c43339';ctx.lineWidth=1.5;ctx.beginPath();ctx.arc(gx,gz,r+2,0,2*Math.PI);ctx.stroke();
    ctx.fillStyle='#c43339';ctx.beginPath();ctx.arc(gx,gz,1.4,0,2*Math.PI);ctx.fill();
  } else circle(gx,gz,Math.max(2.5,.008*scale),'#c43339');
  if(force>0) {
    const y=tz+r+7, left=tx-Math.min(55,11+4*force);
    line(tx,y,left,y,'#006d68',2.5);line(left,y,left+5,y-3,'#006d68',2);line(left,y,left+5,y+3,'#006d68',2);
  }
  ctx.font='13px "Pretendard Variable", sans-serif';ctx.fillStyle='#233b50';ctx.textAlign='left';
  ctx.fillText(`${en?'Contact force':'접촉력'}  ${force.toFixed(2)} N`,12,21);
  ctx.fillStyle='#943038';ctx.fillText(en?'Red: reference position':'빨강: 목표 위치',12,h-8);
  ctx.restore();
}
