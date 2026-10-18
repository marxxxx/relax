// Particle effects: campfire and hearth flames, dust motes, chimney smoke, fireflies.
import {isMobile,rnd} from './util.js';
import {FIRE,heightAt} from './world.js';
import {particles} from './particles.js';
import {FPX,FPZ} from './interior.js';
import {state,cur} from './state.js';

const FLAMES=70,flames=particles(FLAMES,.75,{blending:THREE.AdditiveBlending,fog:false});
const flameData=[...Array(FLAMES)].map(()=>({life:rnd(),vx:0,vz:0,ox:0,oz:0}));
const HF=40,hearth=particles(HF,.5,{blending:THREE.AdditiveBlending,fog:false});
const hearthData=[...Array(HF)].map(()=>({life:rnd(),ox:0,oz:0}));
const DUST=isMobile?90:180,dust=particles(DUST,.022,{blending:THREE.AdditiveBlending,fog:false,opacity:.5});
const dustData=[...Array(DUST)].map(()=>[(rnd()-.5)*6.3,.4+rnd()*2.5,(rnd()-.5)*4.8,rnd()*10]);
const SMOKE=46,smoke=particles(SMOKE,2.4,{opacity:.32});
const smokeData=[...Array(SMOKE)].map(()=>({life:rnd(),x:0,y:0,z:0}));
const FF=70,flies=particles(FF,.32,{blending:THREE.AdditiveBlending,opacity:0});
const flyData=[...Array(FF)].map(()=>{const a=rnd()*6.28,r=8+rnd()*24;return{x:Math.cos(a)*r,z:Math.sin(a)*r,y:.5+rnd()*2,p:rnd()*10};});
(function(){const col=flies.geometry.attributes.color;for(let i=0;i<FF;i++)col.setXYZ(i,.85,1,.45);})();

export function updateEffects(dt,env){
  const {day,night,cl,glow,fireScale,sunIn}=env;
  {const dp=dust.geometry.attributes.position,dc=dust.geometry.attributes.color,br=.12+sunIn*.5+night*.05;
   for(let i=0;i<DUST;i++){const q=dustData[i];q[3]+=dt*.15;
     dp.setXYZ(i,q[0]+Math.sin(q[3]*1.3)*.25,q[1]+Math.sin(q[3]*.7+i)*.18,q[2]+Math.cos(q[3])*.25);dc.setXYZ(i,br,br*.85,br*.6);}
   dp.needsUpdate=dc.needsUpdate=true;}
  {const hp=hearth.geometry.attributes.position,hc=hearth.geometry.attributes.color;
   for(let i=0;i<HF;i++){const f=hearthData[i];f.life+=dt*(1.5+Math.random()*.6);
     if(f.life>1){f.life=0;f.ox=(Math.random()-.5)*.6;f.oz=(Math.random()-.5)*.25;}
     const l=f.life;hp.setXYZ(i,FPX+f.ox*(1-l*.7),.58+l*.75,FPZ+f.oz);const b=(1-l)*.5;hc.setXYZ(i,b,b*(.5-l*.3),b*.1);}
   hp.needsUpdate=hc.needsUpdate=true;}
  // flames
  const fp=flames.geometry.attributes.position,fc=flames.geometry.attributes.color;
  for(let i=0;i<FLAMES;i++){const f=flameData[i];f.life+=dt*(1.4+Math.random()*.6);
    if(f.life>1){f.life=0;const a=Math.random()*6.28,r=Math.random()*.35;f.ox=Math.cos(a)*r;f.oz=Math.sin(a)*r;}
    const l=f.life;fp.setXYZ(i,FIRE.x+f.ox*(1-l)+cur.wind*l*.4,.25+l*1.5*fireScale,FIRE.z+f.oz*(1-l));
    const b=(1-l)*fireScale*.55;fc.setXYZ(i,b,b*(.5-l*.32),b*.1*(1-l));}
  fp.needsUpdate=fc.needsUpdate=true;

  // smoke from chimney
  const sp=smoke.geometry.attributes.position,sc=smoke.geometry.attributes.color;
  const sLight=.25+.6*day+glow*.08;
  for(let i=0;i<SMOKE;i++){const s=smokeData[i];s.life+=dt*.16;
    if(s.life>1){s.life=0;s.x=FPX+(Math.random()-.5)*.3;s.y=6.45;s.z=-3.17+(Math.random()-.5)*.3;}
    s.y+=dt*(1.1-cur.wind*.4);s.x+=dt*(.2+cur.wind*2.4);s.z+=dt*Math.sin(state.T*.5+i)*.15;
    sp.setXYZ(i,s.x,s.y,s.z);const fade=Math.sin(s.life*Math.PI)*sLight;sc.setXYZ(i,fade,fade,fade*1.04);}
  sp.needsUpdate=sc.needsUpdate=true;
  smoke.material.size=1.6+cur.wind;

  // fireflies
  flies.material.opacity=night*(1-cl)*(1-cur.rain)*(1-cur.snow);
  if(flies.material.opacity>.01){const p=flies.geometry.attributes.position,col=flies.geometry.attributes.color;
    for(let i=0;i<FF;i++){const f=flyData[i];const tt=state.T*.4+f.p;
      p.setXYZ(i,f.x+Math.sin(tt*1.3)*1.5,heightAt(f.x,f.z)+f.y+Math.sin(tt*2.1)*.5,f.z+Math.cos(tt)*1.5);
      const blink=Math.max(0,Math.sin(state.T*1.7+f.p*3));col.setXYZ(i,.8*blink,blink,.4*blink);}
    p.needsUpdate=col.needsUpdate=true;}
}
