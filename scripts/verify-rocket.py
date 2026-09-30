"""Independent DOP853 check of the planar rocket's SI dynamics and held control."""
from pathlib import Path
import json
import subprocess
import numpy as np
from scipy.integrate import solve_ivp

ROOT = Path(__file__).resolve().parents[1]
JS = """
import {Simulation,integrateHeld} from './assets/models/rocket-landing.js';
const held=[];
for(const thrust of [[0,0],[4.905,4.905],[7,3]]){
 const initial=thrust[0]===4.905?[-2,18,0,0,0,0]:[-2,18,.12,.3,-.4,.05];
 let y=[...initial];for(let i=0;i<200;i++)y=integrateHeld(y,...thrust,.005);
 held.push({thrust,initial,y});
}
const controlled=[];
for(const changes of [{},{targetX:6,impulse:2},{targetX:-6,impulse:-2,descentSpeed:.5}]){
 const s=new Simulation();Object.assign(s.params,changes);
 for(let i=0;i<1000;i++){if(i===400)s.disturb();s.step(.005);}
 controlled.push({params:s.params,state:s.state});
}
console.log(JSON.stringify({held,controlled}));
"""
actual = json.loads(subprocess.check_output(['node','--input-type=module','-e',JS],cwd=ROOT,text=True))
def rhs(_t,y,left,right):
    x,z,theta,vx,vz,omega=y
    return [vx,vz,omega,(left+right)*np.sin(theta),(left+right)*np.cos(theta)-9.81,1.2*(left-right)]
def solve(y,left,right,dt):
    return solve_ivp(rhs,[0,dt],y,args=(left,right),method='DOP853',rtol=2e-13,atol=2e-14).y[:,-1]
def clip(x,lo,hi):
    return min(hi,max(lo,x))
def control(y,p):
    x,z,theta,vx,vz,omega=y
    height=z-1.5*np.cos(theta)-.9*abs(np.sin(theta))
    vz_ref=-min(p['descentSpeed'],.25+.6*max(height,0))
    ax=clip(p['kpX']*(p['targetX']-x)-1.3*vx,-4,4)
    az=p['kpV']*(vz_ref-vz)
    angle=clip(np.arctan2(ax,max(2,9.81+az)),-.35,.35)
    total=clip((9.81+az)/max(.5,np.cos(theta)),0,24)
    torque=.5*(12*(angle-theta)-6*omega)
    authority=min(total,24-total)
    difference=clip(torque/.6,-authority,authority)
    return (total+difference)/2,(total-difference)/2
errors=[]
for row in actual['held']:
    ref=solve(row['initial'],row['thrust'][0],row['thrust'][1],1)
    errors.append(float(np.max(np.abs(np.array(row['y'])-ref))))
for row in actual['controlled']:
    p,s=row['params'],row['state'];assert not s['failed'] and not s['complete'],s
    y=np.array([-5.,18.,0.,0.,0.,0.])
    for i in range(1000):
        if i==400:y[3]+=p['impulse']
        y=solve(y,*control(y,p),.005)
    observed=np.array([s[k] for k in ['x','y','theta','vx','vy','omega']])
    errors.append(float(np.max(np.abs(observed-y))))
assert max(errors)<2e-8,errors
print(json.dumps({'cases':len(errors),'max_error':max(errors),'tolerance':2e-8,'passed':True}))
