import {isMobile,rnd} from './util.js';
import {scene} from './renderer.js';
import {particles} from './particles.js';
import {target} from './controls.js';
import {state,cur} from './state.js';

// ---------- rain & snow ----------
const BOX=34,RAIN=isMobile?2500:5000,SNOW=isMobile?1800:3200;
const rainGeo=new THREE.BufferGeometry();const rainPos=new Float32Array(RAIN*6);
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xb8c6d6,transparent:true,opacity:0,depthWrite:false}));
rain.frustumCulled=false;scene.add(rain);
const drops=[...Array(RAIN)].map(()=>[(rnd()-.5)*2*BOX,rnd()*30,(rnd()-.5)*2*BOX,16+rnd()*8]);
const snow=particles(SNOW,.28,{opacity:0});
(function(){const col=snow.geometry.attributes.color;for(let i=0;i<SNOW;i++)col.setXYZ(i,1,1,1);})();
const flakes=[...Array(SNOW)].map(()=>[(rnd()-.5)*2*BOX,rnd()*26,(rnd()-.5)*2*BOX,rnd()*10,.8+rnd()*.8]);

export function updatePrecipitation(dt,env){
  const {day}=env;
  // rain
  const pBase=Math.min(0,target.y-8);
  rain.material.opacity=cur.rain*.42;
  if(cur.rain>.01){const slant=cur.wind*4;
    for(let i=0;i<RAIN;i++){const d=drops[i];d[1]-=d[3]*dt;d[0]+=slant*dt;
      if(d[1]<0){d[1]=26+Math.random()*4;d[0]=(Math.random()-.5)*2*BOX;d[2]=(Math.random()-.5)*2*BOX;}
      const x=target.x+d[0],z=target.z+d[2],o=i*6;
      const yy=d[1]+pBase;
      if(yy<5.4&&Math.abs(x)<4.3&&z>-3.6&&z<4.8){rainPos[o+1]=rainPos[o+4]=-60;continue;}
      rainPos[o]=x;rainPos[o+1]=yy;rainPos[o+2]=z;rainPos[o+3]=x-slant*.05;rainPos[o+4]=yy+.65;rainPos[o+5]=z;}
    rainGeo.attributes.position.needsUpdate=true;}
  rain.material.color.setRGB(.45+.4*day,.5+.4*day,.58+.4*day);

  // snow
  snow.material.opacity=cur.snow*.95;
  if(cur.snow>.01){const p=snow.geometry.attributes.position;
    for(let i=0;i<SNOW;i++){const f=flakes[i];f[1]-=dt*f[4];f[0]+=dt*(cur.wind*2.2+Math.sin(state.T+f[3])*.4);f[2]+=dt*Math.cos(state.T*.7+f[3])*.3;
      if(f[1]<0){f[1]=24+Math.random()*3;f[0]=(Math.random()-.5)*2*BOX;f[2]=(Math.random()-.5)*2*BOX;}
      if(f[0]>BOX)f[0]-=2*BOX;
      const sx=target.x+f[0],sz=target.z+f[2];const yy=f[1]+pBase;p.setXYZ(i,sx,(yy<5.4&&Math.abs(sx)<4.3&&sz>-3.6&&sz<4.8)?-60:yy,sz);}
    p.needsUpdate=true;
    const v=.45+.55*day;snow.material.color.setRGB(v,v,v*1.05);}
}
