// Animals: birds over the clearing, gulls over the sea, a fox and a deer herd on land, and
// dolphins that occasionally leap out of the water. Built from primitives when this module is
// evaluated — imported last in main.js, so the seeded rnd() sequence of the world stays intact.
import {$,isMobile,rnd,lerp,smooth} from './util.js';
import {LAKE,SEA,FIRE,coastEdge,heightAt} from './world.js';
import {CIRCLES,WALK_R} from './collision.js';
import {scene} from './renderer.js';
import {std,weatherize} from './materials.js';
import {state,cur} from './state.js';
import {player,setMode,rideCtl,moveAxes} from './controls.js';
import {particles} from './particles.js';
import {CHIMNEY_TOP} from './interior.js';
import {RIDGE} from './house.js';

// ---------- materials (all share the 'animal' weatherize key: snow cover + wetness, no vertex edits) ----------
const fur=c=>weatherize(std(c,{flatShading:true}),'animal');
const mFox=fur(0xb0522a),mCream=fur(0xe9e2d6),mDeer=fur(0x8a6a48),mDeerD=fur(0x6b4f36),mDark=fur(0x2f2620),
      mGull=fur(0xe9edf0),mGullW=fur(0x8d97a1),mBird=fur(0x3a4150),mBeak=fur(0xd8a03c),mDolph=fur(0x5d7484),mDolphL=fur(0x9db0be);

function part(geo,parent,x,y,z,mat){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}

// ---------- builders (all models face +z) ----------
function makeBird(bodyM,wingM,beakM,s){
  const g=new THREE.Group();
  const b=part(new THREE.SphereGeometry(.09,6,5),g,0,.1,0,bodyM);b.scale.set(1,.8,1.45);
  part(new THREE.SphereGeometry(.055,6,5),g,0,.175,.1,bodyM);
  const bk=part(new THREE.ConeGeometry(.02,.07,5),g,0,.17,.17,beakM);bk.rotation.x=Math.PI/2;
  const tl=part(new THREE.ConeGeometry(.035,.15,4),g,0,.09,-.14,bodyM);tl.rotation.x=-Math.PI/2;
  const wlG=new THREE.Group(),wrG=new THREE.Group();wlG.position.set(0,.12,.01);wrG.position.set(0,.12,.01);g.add(wlG,wrG);
  part(new THREE.BoxGeometry(.17,.012,.1),wlG,.095,0,0,wingM);
  part(new THREE.BoxGeometry(.17,.012,.1),wrG,-.095,0,0,wingM);
  g.scale.setScalar(s);
  return {g,wlG,wrG};
}
function makeFox(){
  const g=new THREE.Group();
  const body=part(new THREE.SphereGeometry(.14,8,7),g,0,.23,0,mFox);body.scale.set(1,.85,1.7);
  part(new THREE.SphereGeometry(.095,7,6),g,0,.19,.08,mCream).scale.set(.75,.5,1);      // chest
  const tailG=new THREE.Group();tailG.position.set(0,.26,-.23);g.add(tailG);
  const tl=part(new THREE.ConeGeometry(.06,.42,6),tailG,0,.19,0,mFox);tl.rotation.x=-.5;
  part(new THREE.SphereGeometry(.058,6,5),tailG,0,.39,0,mCream);                        // white tail tip
  tailG.rotation.x=-.8;
  const head=new THREE.Group();head.position.set(0,.35,.22);g.add(head);
  part(new THREE.SphereGeometry(.088,8,7),head,0,.01,.02,mFox);                          // big head
  part(new THREE.SphereGeometry(.05,6,5),head,-.048,-.025,.055,mCream);                 // cheeks
  part(new THREE.SphereGeometry(.05,6,5),head,.048,-.025,.055,mCream);
  const sn=part(new THREE.ConeGeometry(.03,.11,6),head,0,-.035,.1,mCream);sn.rotation.x=Math.PI/2;
  part(new THREE.SphereGeometry(.021,5,4),head,0,-.035,.148,mDark);                      // nose
  part(new THREE.SphereGeometry(.017,5,4),head,-.04,.025,.08,mDark);                     // eyes
  part(new THREE.SphereGeometry(.017,5,4),head,.04,.025,.08,mDark);
  const eL=part(new THREE.ConeGeometry(.033,.13,4),head,-.052,.085,-.005,mFox);eL.rotation.z=.4;
  const eR=part(new THREE.ConeGeometry(.033,.13,4),head,.052,.085,-.005,mFox);eR.rotation.z=-.4;
  const legs=[];
  for(const [x,z] of [[-.06,.12],[-.06,-.12],[.06,.12],[.06,-.12]])
    legs.push(part(new THREE.CylinderGeometry(.02,.024,.24,5).translate(0,-.12,0),g,x,.23,z,mFox));
  return {g,head,legs,tailG,kind:'fox',anchor:head,eyeOff:new THREE.Vector3(0,.03,.12)};
}
function makeDeer(stag){
  const g=new THREE.Group();
  const body=part(new THREE.SphereGeometry(.24,10,8),g,0,.55,0,mDeer);body.scale.set(1,.92,1.85);
  part(new THREE.SphereGeometry(.135,8,6),g,0,.47,.38,mDeer).scale.set(.85,.7,.95);      // chest
  const neck=new THREE.Group();neck.position.set(0,.68,.38);g.add(neck);
  part(new THREE.SphereGeometry(.088,8,7),neck,0,.15,.07,mDeer);                         // head
  const sn=part(new THREE.ConeGeometry(.036,.13,6),neck,0,.11,.2,mDeerD);sn.rotation.x=Math.PI/2;
  part(new THREE.SphereGeometry(.017,5,4),neck,0,.11,.26,mDark);                         // nose
  part(new THREE.SphereGeometry(.021,5,4),neck,-.045,.18,.09,mDark);                     // big eyes
  part(new THREE.SphereGeometry(.021,5,4),neck,.045,.18,.09,mDark);
  const eL=part(new THREE.ConeGeometry(.026,.11,4),neck,-.07,.24,.02,mDeer);eL.rotation.z=.5;
  const eR=part(new THREE.ConeGeometry(.026,.11,4),neck,.07,.24,.02,mDeer);eR.rotation.z=-.5;
  if(stag)for(const s of[-1,1]){const a=new THREE.Group();a.position.set(s*.05,.26,.02);neck.add(a);
    part(new THREE.CylinderGeometry(.012,.017,.18,4),a,0,.09,0,mDark);
    const b1=part(new THREE.CylinderGeometry(.01,.013,.14,4),a,.05,.2,0,mDark);b1.rotation.z=-.7;
    const b2=part(new THREE.CylinderGeometry(.01,.013,.12,4),a,-.045,.21,0,mDark);b2.rotation.z=.6;}
  const tailG=new THREE.Group();tailG.position.set(0,.62,-.45);g.add(tailG);
  const tl=part(new THREE.ConeGeometry(.035,.17,4),tailG,0,.04,0,mCream);tl.rotation.x=-1.25;   // white tail
  const legs=[];
  for(const [x,z] of [[-.1,.28],[-.1,-.28],[.1,.28],[.1,-.28]])
    legs.push(part(new THREE.CylinderGeometry(.026,.021,.5,5).translate(0,-.25,0),g,x,.55,z,mDeerD));
  return {g,neck,legs,tailG,kind:'deer',anchor:neck,eyeOff:new THREE.Vector3(0,.17,.1)};
}
function makeDolphin(){
  const g=new THREE.Group();
  const body=part(new THREE.SphereGeometry(.24,14,10),g,0,0,0,mDolph);body.scale.set(.72,.6,2.15);
  part(new THREE.SphereGeometry(.2,12,9),g,0,-.07,.02,mDolphL).scale.set(.6,.45,1.8);   // light belly
  part(new THREE.SphereGeometry(.15,12,9),g,0,.045,.34,mDolph).scale.set(.95,.85,1);     // melon (forehead)
  const bk=part(new THREE.ConeGeometry(.042,.24,8),g,0,-.015,.52,mDolph);bk.rotation.x=Math.PI/2;   // slim beak
  part(new THREE.SphereGeometry(.016,5,4),g,-.075,.03,.4,mDark);                        // eyes
  part(new THREE.SphereGeometry(.016,5,4),g,.075,.03,.4,mDark);
  const fin=part(new THREE.ConeGeometry(.06,.3,6),g,0,.17,.02,mDolph);fin.scale.z=.35;fin.rotation.x=-.45;  // dorsal fin
  for(const s of[-1,1]){const f=part(new THREE.ConeGeometry(.05,.26,6),g,s*.18,-.06,.02,mDolph);f.scale.z=.4;f.rotation.z=s*.85;f.rotation.x=.5;}  // pectoral fins
  const st=part(new THREE.CylinderGeometry(.04,.07,.24,6),g,0,0,-.5,mDolph);st.rotation.x=Math.PI/2;         // tail stock
  for(const s of[-1,1]){const f=part(new THREE.BoxGeometry(.15,.022,.09),g,s*.085,0,-.58,mDolph);f.rotation.y=-s*.45;} // tail fluke
  return {g,kind:'dolphin',anchor:g,eyeOff:new THREE.Vector3(0,.07,.42)};
}

// ---------- land animals (fox + deer herd) ----------
function landOK(x,z){
  if(Math.hypot(x,z)>105)return false;
  if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+2.5)return false;
  if(x-coastEdge(z)<7)return false;                               // keep out of the sea/beach
  if(Math.abs(x)<7.5&&Math.abs(z)<9)return false;               // cabin, balcony, porch
  if(Math.hypot(x-FIRE.x,z-FIRE.z)<4.5)return false;              // campfire
  for(const c of CIRCLES){const dx=x-c[0],dz=z-c[1],r=c[2]+.6;if(dx*dx+dz*dz<r*r)return false;}   // trees, rocks, path posts
  return heightAt(x,z)>SEA+.6;
}
function pickSpot(hx,hz,r){for(let i=0;i<14;i++){const a=rnd()*6.283,d=1+rnd()*r,x=hx+Math.cos(a)*d,z=hz+Math.sin(a)*d;if(landOK(x,z))return[x,z];}return[hx,hz];}
const land=[];
function addLand(a,hx,hz){if(!landOK(hx,hz)){const s=pickSpot(hx,hz,20);hx=s[0];hz=s[1];}
  a.x=hx;a.z=hz;a.y=heightAt(hx,hz);a.tx=null;a.tz=0;a.mode='graze';a.t=1+rnd()*2;a.flee=0;a.moving=false;a.seed=rnd()*6.28;a.home=[hx,hz];a.g.position.set(a.x,a.y,a.z);scene.add(a.g);land.push(a);}
addLand(makeFox(),-16,11);
for(let i=0;i<8;i++)addLand(makeDeer(i===0),24+(rnd()-.5)*14,-4+(rnd()-.5)*14);

function step(a,dt,sp){const dx=a.tx-a.x,dz=a.tz-a.z,d=Math.hypot(dx,dz);a.moving=d>.05;
  if(a.moving){const s=Math.min(sp*dt,d)/d,nx=a.x+dx*s,nz=a.z+dz*s;
    if(!landOK(nx,nz)){a.moving=false;return;}   // never walk through trees/rocks/lake/cabin
    a.x=nx;a.z=nz;a.g.rotation.y=Math.atan2(dx,dz);}}

// ridden: W/S walk forward/back, A/D or drag turn, Shift runs; obstacles block per axis so the animal slides along them
function rideLand(a,dt,inp){
  const h=a.g.rotation.y-(inp.r*2.4*dt)+rideCtl.turn;rideCtl.turn=0;a.g.rotation.y=h;
  const sp=inp.f*(inp.f<0?1:inp.run?5:a.kind==='fox'?1.6:1.9)*dt,nx=a.x+Math.sin(h)*sp,nz=a.z+Math.cos(h)*sp,ok=(x,z)=>landOK(x,z)||!landOK(a.x,a.z);
  a.moving=Math.abs(inp.f)>.05||Math.abs(inp.r)>.3;a.mode=inp.run&&inp.f>0?'flee':'ride';
  if(ok(nx,a.z))a.x=nx;if(ok(a.x,nz))a.z=nz;}
function updateLand(dt,env){
  const fp=state.mode==='fp';
  for(const a of land){
    if(!a.g.visible)continue;
    if(a===state.rider){rideLand(a,dt,moveAxes());animLand(a,dt,false);continue;}
    const pd=fp?Math.hypot(player.x-a.x,player.z-a.z):1e9,fr=a.kind==='fox'?6:8;
    if(pd<fr){a.mode='flee';a.flee=2.6;const d=Math.max(.001,pd);
      let tx=a.x+(a.x-player.x)/d*20,tz=a.z+(a.z-player.z)/d*20;
      if(!landOK(tx,tz)){tx=a.x-(a.x-player.x)/d*20;tz=a.z-(a.z-player.z)/d*20;}
      a.tx=tx;a.tz=tz;}
    const sleep=a.kind==='fox'&&smooth(.78,.4,env.day)<.3;
    if(a.mode==='flee'){a.flee-=dt;step(a,dt,4.4);if(a.flee<=0){a.mode='graze';a.t=1+Math.random()*2;}}
    else if(sleep)a.moving=false;
    else if(a.mode==='wander'){
      if(a.tx===null){const s=pickSpot(a.home[0],a.home[1],15);a.tx=s[0];a.tz=s[1];}
      step(a,dt,1.15);
      if(!a.moving){a.mode='graze';a.t=1.5+Math.random()*4;}
    }else{a.moving=false;a.t-=dt;if(a.t<=0){a.mode='wander';const s=pickSpot(a.home[0],a.home[1],15);a.tx=s[0];a.tz=s[1];}}
    animLand(a,dt,sleep);
  }
}
function animLand(a,dt,sleep){
  a.y=heightAt(a.x,a.z);a.g.position.set(a.x,sleep?a.y-.07:a.y,a.z);
  // animation: leg swing, tail wag, head/neck pitch (grazing = head down)
  const t=state.T,mv=a.moving?1:0;
  a.legs.forEach((l,i)=>l.rotation.x=mv*Math.sin(t*(a.mode==='flee'?13:8)+i*1.6)*.45);
  a.tailG.rotation.y=Math.sin(t*5+a.seed)*.3*(mv?1.8:1);
  const pitch=a.mode==='graze'?.8:sleep?1.15:Math.sin(t*1.8+a.seed)*.07;
  const h=a.kind==='fox'?a.head:a.neck;h.rotation.x=lerp(h.rotation.x,pitch,Math.min(1,dt*6));
}

// ---------- birds over the clearing (perch on roof ridge / chimney at night or in rain) ----------
// sit on top of the surfaces: ridge cap top is RIDGE+.32, chimney top is CHIMNEY_TOP.y; a bird's lowest point is .028 above its origin
const perch=[...[-3.8,-2.6,-1.4,0,1.4,2.6,3.8].map(x=>[x,RIDGE+.32-.03,0]),[CHIMNEY_TOP.x,CHIMNEY_TOP.y-.03,CHIMNEY_TOP.z]];
const NB=isMobile?8:12,birds=[];
for(let i=0;i<NB;i++){const o=Object.assign(makeBird(mBird,mBird,mBeak,1),
    {cx:(rnd()-.5)*60,cz:-8+(rnd()-.5)*60,cy:9+rnd()*9,r:5+rnd()*11,w:(.2+rnd()*.35)*(rnd()<.5?-1:1),ph:rnd()*6.28,perch:perch[i%perch.length],land:0,kind:'bird'});
  o.anchor=o.g;o.eyeOff=new THREE.Vector3(0,.12,.05);o.g.rotation.order='YXZ';
  o.g.position.set(o.cx+Math.cos(o.ph)*o.r,o.cy,o.cz+Math.sin(o.ph)*o.r);scene.add(o.g);birds.push(o);}
// ridden flight: always gliding forward, W/S speed, A/D or drag turn, drag up/down pitches the climb, Space/E up, Q/C down
function rideFly(b,dt,inp){
  const p=b.g.position,h=b.g.rotation.y-inp.r*1.6*dt+rideCtl.turn;rideCtl.turn=0;b.g.rotation.y=h;
  b.spd=lerp(b.spd||4,(4+inp.f*3)*(inp.run?1.7:1),Math.min(1,dt*2));
  const pt=rideCtl.pitch,hz=b.spd*Math.cos(pt);
  p.x+=Math.sin(h)*hz*dt;p.z+=Math.cos(h)*hz*dt;p.y+=(b.spd*Math.sin(pt)+inp.up*3)*dt;
  const r=Math.hypot(p.x,p.z);if(r>WALK_R){p.x*=WALK_R/r;p.z*=WALK_R/r;}   // the whole mountain ring and the far plain are open to fly over
  const lo=Math.max(heightAt(p.x,p.z),SEA)+.8;if(p.y<lo){p.y=lo;if(pt<0)rideCtl.pitch=lerp(pt,0,Math.min(1,dt*4));}p.y=Math.min(p.y,85);
  b.g.rotation.x=lerp(b.g.rotation.x,-pt*.7,Math.min(1,dt*5));
  b.g.rotation.z=lerp(b.g.rotation.z,inp.r*.45,Math.min(1,dt*4));
  const flap=inp.f>0||inp.up>0||pt>.15;b.fp=(b.fp||0)+dt*(flap?13:9);const fl=Math.sin(b.fp)*(flap?.75:.18);
  b.wlG.rotation.z=fl;b.wrG.rotation.z=-fl;b.land=0;}
function updateBirds(dt,env){
  const t=state.T,hide=env.night>.55||cur.rain>.55||cur.storm>.4;
  for(const b of birds){
    if(!b.g.visible)continue;
    if(b===state.rider){rideFly(b,dt,moveAxes());continue;}
    b.ph+=b.w*dt*(.6+cur.wind*.8);
    let tx=b.cx+Math.cos(b.ph)*b.r,ty=b.cy+Math.sin(b.ph*2.1)*.9,tz=b.cz+Math.sin(b.ph)*b.r;
    if(hide){tx=b.perch[0];ty=b.perch[1];tz=b.perch[2];}
    b.land=lerp(b.land,hide?1:0,Math.min(1,dt*1.4));
    const k=Math.min(1,dt*2.2),p=b.g.position,ox=p.x,oz=p.z;
    p.x=lerp(p.x,tx,k);p.y=lerp(p.y,ty,k);p.z=lerp(p.z,tz,k);
    const dx=p.x-ox,dz=p.z-oz;if(dx*dx+dz*dz>1e-7)b.g.rotation.y=Math.atan2(dx,dz);
    if(b.land>.5)b.g.rotation.y=lerp(b.g.rotation.y,Math.round(b.g.rotation.y/Math.PI)*Math.PI,Math.min(1,dt*3));   // perched: face along the ridge
    const fl=Math.sin(t*11+b.ph*3)*(.2+.5*(1-b.land))*(.55+.45*Math.sin(t*.7+b.ph));
    b.wlG.rotation.z=fl*(1-b.land)+1.15*b.land;
    b.wrG.rotation.z=-fl*(1-b.land)-1.15*b.land;
  }
}

// ---------- gulls over the sea ----------
const NG=isMobile?10:16,gulls=[];
for(let i=0;i<NG;i++){const z=-130+rnd()*190;
  const o=Object.assign(makeBird(mGull,mGullW,mBeak,1.7),{cx:coastEdge(z)-30-rnd()*30,cz:z,cy:SEA+7+rnd()*8,r:5+rnd()*9,w:(.22+rnd()*.3)*(rnd()<.5?-1:1),ph:rnd()*6.28,kind:'gull'});
  o.anchor=o.g;o.eyeOff=new THREE.Vector3(0,.2,.08);o.g.rotation.order='YXZ';
  o.g.position.set(o.cx+Math.cos(o.ph)*o.r,o.cy,o.cz+Math.sin(o.ph)*o.r);scene.add(o.g);gulls.push(o);}
function updateGulls(dt){
  const t=state.T;
  for(const g of gulls){
    if(!g.g.visible)continue;
    if(g===state.rider){rideFly(g,dt,moveAxes());continue;}
    g.ph+=g.w*dt*(.6+cur.wind);
    const k=Math.min(1,dt*1.6),p=g.g.position,ox=p.x,oz=p.z;
    p.x=lerp(p.x,g.cx+Math.cos(g.ph)*g.r,k);
    p.y=lerp(p.y,g.cy+Math.sin(g.ph*1.7)*.7,k);
    p.z=lerp(p.z,g.cz+Math.sin(g.ph)*g.r,k);
    const dx=p.x-ox,dz=p.z-oz;if(dx*dx+dz*dz>1e-7)g.g.rotation.y=Math.atan2(dx,dz);
    const glide=.5+.5*Math.sin(t*.5+g.ph*2),fl=Math.sin(t*7+g.ph)*.5*(.3+.7*glide);
    g.wlG.rotation.z=fl;g.wrG.rotation.z=-fl;
  }
}

// ---------- dolphins: cruise at the surface, occasionally leap out ----------
// the surf/foam band in sea.js reaches out to x = coast(z)-25.5; keep the whole swim circle and every jump in open water
const WATER_X=z=>coastEdge(z)-30;
const ND=isMobile?4:6,dolphins=[];
for(let i=0;i<ND;i++){const z=-90+rnd()*170,r=5+rnd()*8;
  const o=Object.assign(makeDolphin(),{cx:coastEdge(z)-r-32-rnd()*18,cz:z,r,w:(.18+rnd()*.2)*(rnd()<.5?-1:1),ph:rnd()*6.28,jump:false,jt:0,next:15+rnd()*45});
  o.g.position.set(Math.min(o.cx,WATER_X(z)),SEA,o.cz);o.g.rotation.order='YXZ';scene.add(o.g);dolphins.push(o);}
const SP=48,splash=particles(SP,.4,{opacity:.9});
{const sp=splash.geometry.attributes.position;for(let i=0;i<SP;i++)sp.setXYZ(i,0,SEA-60,0);}
const spData=[...Array(SP)].map(()=>({life:1,x:0,y:0,z:0,vx:0,vy:0,vz:0}));let spI=0;
function burst(x,z,n){for(let i=0;i<n;i++){const s=spData[spI++%SP];s.life=0;s.x=x;s.y=SEA;s.z=z;
  const a=Math.random()*6.28,r=.8+Math.random()*2.2;s.vx=Math.cos(a)*r;s.vz=Math.sin(a)*r;s.vy=2.2+Math.random()*2.6;}}
function updateDolphins(dt){
  const t=state.T;
  for(const d of dolphins){
    if(!d.g.visible)continue;
    const p=d.g.position;
    if(d.jump){
      d.jt+=dt;const u=Math.min(1,d.jt/1.2);
      p.z=d.jz+Math.cos(d.jh)*5.5*d.jt;
      p.x=Math.min(d.jx+Math.sin(d.jh)*5.5*d.jt,WATER_X(p.z));   // a leap never carries them onto the beach
      p.y=SEA+d.apex*Math.sin(u*Math.PI);
      d.g.rotation.y=d.jh;d.g.rotation.x=-Math.atan2(d.apex*Math.PI*Math.cos(u*Math.PI)/1.2,5.5);
      if(u>=1){d.jump=false;d.g.rotation.x=0;d.next=t+35+Math.random()*55;burst(p.x,p.z,12);}
    }else if(d===state.rider){   // ridden: W/S swim speed, A/D or drag turn, Space or tap leaps
      const inp=moveAxes(),h=d.g.rotation.y-inp.r*1.5*dt+rideCtl.turn;rideCtl.turn=0;d.g.rotation.y=h;
      d.spd=lerp(d.spd||0,Math.max(0,inp.f)*(inp.run?10:5.5),Math.min(1,dt*1.5));
      p.z+=Math.cos(h)*d.spd*dt;p.x=Math.min(p.x+Math.sin(h)*d.spd*dt,WATER_X(p.z));
      const r=Math.hypot(p.x,p.z);if(r>230){p.x*=230/r;p.z*=230/r;}
      d.sw=(d.sw||0)+dt*(2+d.spd*.4);   // accumulated phase: a speed-dependent frequency times absolute time would jump wildly
      p.y=SEA+Math.sin(t*1.3+d.ph)*.02;d.g.rotation.x=Math.sin(d.sw)*(.03+d.spd*.006);
      if(rideCtl.jump||inp.up>0){rideCtl.jump=false;d.jump=true;d.jt=0;d.jx=p.x;d.jz=p.z;d.jh=h;d.apex=2.6+Math.random()*1.6;burst(p.x,p.z,10);}
    }else{
      d.ph+=d.w*dt;
      const z=d.cz+Math.sin(d.ph)*d.r,x=Math.min(d.cx+Math.cos(d.ph)*d.r,WATER_X(z)),ox=p.x,oz=p.z;
      p.x=x;p.z=z;p.y=SEA+Math.sin(t*1.3+d.ph)*.02;
      const dx=x-ox,dz=z-oz;if(dx*dx+dz*dz>1e-8)d.g.rotation.y=Math.atan2(dx,dz);
      d.g.rotation.x=Math.sin(t*2+d.ph)*.06;
      if(t>d.next){d.jump=true;d.jt=0;d.jx=x;d.jz=z;d.jh=Math.atan2(dx,dz)||Math.random()*6.28;d.apex=2.6+Math.random()*1.6;burst(x,z,10);}
    }
  }
}

// ---------- per-frame ----------
export const animals={birds,gulls,land,dolphins};
// how many animals are active at the current slider fraction (fox counts as the first land animal)
export function animalCount(){const f=state.animalFrac;
  return Math.round(f*NB)+Math.round(f*NG)+Math.round(f*ND)+(f<=0?0:1+Math.round(f*(land.length-1)));}
// hand a ridden animal back to its own behaviour, starting from where the rider left it
let ridden=null;
function release(a){const p=a.g.position;
  if(a.home){a.home=[a.x,a.z];a.mode='graze';a.t=1.5+Math.random()*2;a.tx=null;a.flee=0;return;}
  a.g.rotation.x=a.g.rotation.z=0;a.spd=0;
  a.cx=p.x-Math.cos(a.ph)*a.r;a.cz=p.z-Math.sin(a.ph)*a.r;if(a.cy!==undefined)a.cy=p.y;}
export function updateAnimals(dt,env){
  const f=state.animalFrac,nB=Math.round(f*NB),nG=Math.round(f*NG),nD=Math.round(f*ND),nL=f<=0?0:1+Math.round(f*(land.length-1));
  birds.forEach((b,i)=>b.g.visible=i<nB);
  gulls.forEach((g,i)=>g.g.visible=i<nG&&cur.storm<.75);
  dolphins.forEach((d,i)=>d.g.visible=i<nD);
  land.forEach((a,i)=>a.g.visible=i<nL);
  if(state.rider&&!state.rider.g.visible)state.rider=null;   // ridden animal hidden by the slider -> back to plain fp
  if(ridden!==state.rider){if(ridden)release(ridden);ridden=state.rider;rideCtl.jump=false;}
  syncBtns();
  updateBirds(dt,env);updateGulls(dt);updateLand(dt,env);updateDolphins(dt);
  const sp=splash.geometry.attributes.position,sc=splash.geometry.attributes.color;
  for(let i=0;i<SP;i++){const s=spData[i];
    if(s.life<1){s.life+=dt*1.5;
      if(s.life>=1){sp.setXYZ(i,s.x,SEA-60,s.z);sc.setXYZ(i,0,0,0);}
      else{s.vy-=9*dt;s.x+=s.vx*dt;s.y=Math.max(SEA,s.y+s.vy*dt);s.z+=s.vz*dt;
        sp.setXYZ(i,s.x,s.y,s.z);const f=(1-s.life)*.9;sc.setXYZ(i,f,f*.98,f*.88);}}}
  sp.needsUpdate=sc.needsUpdate=true;
}

// ---------- UI: "Tiere" slider in the panel (sets state.animalFrac, applied per frame above) ----------
{const aIn=$('animals'),aVal=$('animalsVal');
  aIn.addEventListener('input',()=>{state.animalFrac=aIn.value/100;aVal.textContent=animalCount();syncBtns();});
  aVal.textContent=animalCount();}

// ---------- UI: one first-person button per kind below the "Tiere" slider ----------
const ALL=[...land,...birds,...gulls,...dolphins];
const KINDS=[{id:'fox',icon:'🦊',name:'Fuchs'},{id:'deer',icon:'🦌',name:'Reh'},{id:'bird',icon:'🐦',name:'Vogel'},
  {id:'gull',icon:'🕊️',name:'Möwe'},{id:'dolphin',icon:'🐬',name:'Delfin'}]
  .map(k=>({...k,arr:ALL.filter(a=>a.kind===k.id)}));
const vis=k=>k.arr.filter(a=>a.g.visible);
function syncBtns(){for(const k of KINDS){k.btn.disabled=!vis(k).length;
  k.btn.setAttribute('aria-pressed',!!(state.rider&&state.rider.kind===k.id&&state.rider.g.visible)+'');}}
const HOW={land:['W A S D zum Laufen, Shift zum Rennen','Joystick zum Laufen'],fly:['W A S D zum Fliegen, Leertaste/Q steigen/sinken, Ziehen zum Neigen','Joystick zum Fliegen, Ziehen zum Steigen/Sinken'],
  swim:['W A S D zum Schwimmen, Leertaste zum Springen','Joystick zum Schwimmen, Tippen zum Springen']};
function attach(a){if(state.mode!=='fp')setMode('fp');state.rider=a;state.watch=null;rideCtl.turn=0;rideCtl.pitch=0;
  if(document.activeElement&&document.activeElement.blur)document.activeElement.blur();   // so Space doesn't re-press the animal button
  const kn=KINDS.find(k=>k.id===a.kind),h=$('hint'),how=HOW[a.home?'land':a.kind==='dolphin'?'swim':'fly'][isMobile?1:0];
  h.textContent='Du steuerst: '+kn.name+' – '+how+(isMobile?' · „Rundblick“ zum Loslassen':' · Esc für Rundblick');h.classList.remove('gone');
  clearTimeout(attach.t);attach.t=setTimeout(()=>h.classList.add('gone'),8000);syncBtns();}
function onKind(k){const v=vis(k);if(!v.length)return;
  if(state.rider&&state.rider.kind===k.id){const i=v.indexOf(state.rider);attach(v[(i+1)%v.length]);}  // same kind again -> next animal of this kind
  else attach(v[0]);}
{const box=$('animalBtns');
  for(const k of KINDS){const b=document.createElement('button');b.className='abtn';b.type='button';
    b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Erste-Person-Ansicht: '+k.name);
    b.innerHTML='<span>'+k.icon+'</span>'+k.name;
    b.addEventListener('click',()=>onKind(k));box.append(b);k.btn=b;}}
syncBtns();
