// Animals: birds over the clearing, gulls over the sea, a fox and a deer herd on land, and
// dolphins that occasionally leap out of the water. Built from primitives when this module is
// evaluated — imported last in main.js, so the seeded rnd() sequence of the world stays intact.
import {$,isMobile,rnd,lerp,smooth} from './util.js';
import {LAKE,SEA,FIRE,coastEdge,heightAt} from './world.js';
import {scene} from './renderer.js';
import {std,weatherize} from './materials.js';
import {state,cur} from './state.js';
import {player,setMode} from './controls.js';
import {particles} from './particles.js';
import {CHIMNEY_TOP} from './interior.js';
import {RIDGE} from './house.js';

// ---------- materials (all share the 'animal' weatherize key: snow cover + wetness, no vertex edits) ----------
const fur=c=>weatherize(std(c,{flatShading:true}),'animal');
const mFox=fur(0xb0522a),mCream=fur(0xe9e2d6),mDeer=fur(0x8a6a48),mDeerD=fur(0x6b4f36),mDark=fur(0x2f2620),
      mGull=fur(0xe9edf0),mGullW=fur(0x8d97a1),mBird=fur(0x3a4150),mBeak=fur(0xd8a03c),mDolph=fur(0x5d7484);

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
  const body=part(new THREE.SphereGeometry(.15,7,6),g,0,.26,0,mFox);body.scale.set(1,.9,1.8);
  part(new THREE.SphereGeometry(.1,6,5),g,0,.21,.1,mCream).scale.set(.8,.55,1.1);
  const tailG=new THREE.Group();tailG.position.set(0,.28,-.27);g.add(tailG);
  const tl=part(new THREE.ConeGeometry(.05,.34,5),tailG,0,.15,0,mFox);tl.rotation.x=-.45;
  part(new THREE.SphereGeometry(.045,5,4),tailG,0,.32,0,mCream);
  tailG.rotation.x=-.85;
  const head=new THREE.Group();head.position.set(0,.37,.25);g.add(head);
  part(new THREE.SphereGeometry(.075,7,6),head,0,0,.02,mFox);
  const sn=part(new THREE.ConeGeometry(.035,.13,5),head,0,-.02,.11,mCream);sn.rotation.x=Math.PI/2;
  part(new THREE.SphereGeometry(.02,4,3),head,0,-.02,.15,mDark);
  const eL=part(new THREE.ConeGeometry(.028,.1,4),head,-.045,.075,-.01,mFox);eL.rotation.z=.35;
  const eR=part(new THREE.ConeGeometry(.028,.1,4),head,.045,.075,-.01,mFox);eR.rotation.z=-.35;
  const legs=[];
  for(const [x,z] of [[-.07,.15],[-.07,-.15],[.07,.15],[.07,-.15]])
    legs.push(part(new THREE.CylinderGeometry(.022,.026,.26,5).translate(0,-.13,0),g,x,.26,z,mFox));
  return {g,head,legs,tailG,kind:'fox',anchor:head,eyeOff:new THREE.Vector3(0,.04,.07)};
}
function makeDeer(stag){
  const g=new THREE.Group();
  const body=part(new THREE.SphereGeometry(.26,8,6),g,0,.56,0,mDeer);body.scale.set(1,.95,1.9);
  part(new THREE.SphereGeometry(.15,6,5),g,0,.48,.42,mDeer).scale.set(.9,.75,1);
  const neck=new THREE.Group();neck.position.set(0,.7,.4);g.add(neck);
  part(new THREE.SphereGeometry(.09,7,6),neck,0,.17,.1,mDeer);
  const sn=part(new THREE.ConeGeometry(.04,.15,5),neck,0,.14,.23,mDeerD);sn.rotation.x=Math.PI/2;
  part(new THREE.SphereGeometry(.018,4,3),neck,0,.14,.3,mDark);
  part(new THREE.ConeGeometry(.03,.1,4),neck,-.06,.26,.02,mDeer);
  part(new THREE.ConeGeometry(.03,.1,4),neck,.06,.26,.02,mDeer);
  if(stag)for(const s of[-1,1]){const a=new THREE.Group();a.position.set(s*.05,.27,.03);neck.add(a);
    part(new THREE.CylinderGeometry(.012,.017,.17,4),a,0,.085,0,mDark);
    const b1=part(new THREE.CylinderGeometry(.01,.013,.13,4),a,.05,.19,0,mDark);b1.rotation.z=-.7;
    const b2=part(new THREE.CylinderGeometry(.01,.013,.11,4),a,-.045,.2,0,mDark);b2.rotation.z=.6;}
  const tailG=new THREE.Group();tailG.position.set(0,.64,-.5);g.add(tailG);
  const tl=part(new THREE.ConeGeometry(.03,.15,4),tailG,0,.05,0,mDeerD);tl.rotation.x=-1.3;
  const legs=[];
  for(const [x,z] of [[-.11,.3],[-.11,-.3],[.11,.3],[.11,-.3]])
    legs.push(part(new THREE.CylinderGeometry(.028,.022,.52,5).translate(0,-.26,0),g,x,.56,z,mDeerD));
  return {g,neck,legs,tailG,kind:'deer',anchor:neck,eyeOff:new THREE.Vector3(0,.2,.12)};
}
function makeDolphin(){
  const g=new THREE.Group();
  const body=part(new THREE.SphereGeometry(.22,8,6),g,0,0,0,mDolph);body.scale.set(.75,.6,2.1);
  const fin=part(new THREE.ConeGeometry(.05,.24,4),g,0,.14,.02,mDolph);fin.scale.z=.3;fin.rotation.x=-.35;
  const bk=part(new THREE.ConeGeometry(.06,.24,5),g,0,-.02,.4,mDolph);bk.rotation.x=Math.PI/2;
  part(new THREE.SphereGeometry(.03,4,3),g,0,-.02,.5,mDark);
  for(const s of[-1,1]){const f=part(new THREE.ConeGeometry(.05,.22,4),g,s*.17,-.04,.02,mDolph);f.scale.z=.35;f.rotation.z=s*.8;f.rotation.x=.5;}
  const st=part(new THREE.CylinderGeometry(.05,.08,.2,5),g,0,0,-.4,mDolph);st.rotation.x=Math.PI/2;
  part(new THREE.BoxGeometry(.22,.025,.1),g,0,.01,-.52,mDolph);
  return {g,kind:'dolphin',anchor:g,eyeOff:new THREE.Vector3(0,.06,.35)};
}

// ---------- land animals (fox + deer herd) ----------
function landOK(x,z){
  if(Math.hypot(x,z)>105)return false;
  if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r+2.5)return false;
  if(x-coastEdge(z)<7)return false;
  if(Math.abs(x)<7.5&&Math.abs(z)<9)return false;               // cabin
  if(Math.hypot(x-FIRE.x,z-FIRE.z)<4.5)return false;              // campfire
  return heightAt(x,z)>SEA+.6;
}
function pickSpot(hx,hz,r){for(let i=0;i<14;i++){const a=rnd()*6.283,d=1+rnd()*r,x=hx+Math.cos(a)*d,z=hz+Math.sin(a)*d;if(landOK(x,z))return[x,z];}return[hx,hz];}
const land=[];
function addLand(a,hx,hz){a.x=hx;a.z=hz;a.y=heightAt(hx,hz);a.tx=null;a.tz=0;a.mode='graze';a.t=1+rnd()*2;a.flee=0;a.moving=false;a.seed=rnd()*6.28;a.home=[hx,hz];a.g.position.set(a.x,a.y,a.z);scene.add(a.g);land.push(a);}
addLand(makeFox(),-16,11);
for(let i=0;i<8;i++)addLand(makeDeer(i===0),24+(rnd()-.5)*14,-4+(rnd()-.5)*14);

function step(a,dt,sp){const dx=a.tx-a.x,dz=a.tz-a.z,d=Math.hypot(dx,dz);a.moving=d>.05;
  if(a.moving){const s=Math.min(sp*dt,d)/d;a.x+=dx*s;a.z+=dz*s;a.g.rotation.y=Math.atan2(dx,dz);}}

function updateLand(dt,env){
  const fp=state.mode==='fp';
  for(const a of land){
    if(!a.g.visible)continue;
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
    a.y=heightAt(a.x,a.z);a.g.position.set(a.x,sleep?a.y-.07:a.y,a.z);
    // animation: leg swing, tail wag, head/neck pitch (grazing = head down)
    const t=state.T,mv=a.moving?1:0;
    a.legs.forEach((l,i)=>l.rotation.x=mv*Math.sin(t*(a.mode==='flee'?13:8)+i*1.6)*.45);
    a.tailG.rotation.y=Math.sin(t*5+a.seed)*.3*(mv?1.8:1);
    const pitch=a.mode==='graze'?.8:sleep?1.15:Math.sin(t*1.8+a.seed)*.07;
    const h=a.kind==='fox'?a.head:a.neck;h.rotation.x=lerp(h.rotation.x,pitch,Math.min(1,dt*6));
  }
}

// ---------- birds over the clearing (perch on roof ridge / chimney at night or in rain) ----------
const perch=[...[-3.8,-2.6,-1.4,0,1.4,2.6,3.8].map(x=>[x,RIDGE+.06,0]),[CHIMNEY_TOP.x,CHIMNEY_TOP.y+.06,CHIMNEY_TOP.z]];
const NB=isMobile?8:12,birds=[];
for(let i=0;i<NB;i++){const o=Object.assign(makeBird(mBird,mBird,mBeak,1),
    {cx:(rnd()-.5)*60,cz:-8+(rnd()-.5)*60,cy:9+rnd()*9,r:5+rnd()*11,w:(.2+rnd()*.35)*(rnd()<.5?-1:1),ph:rnd()*6.28,perch:perch[i%perch.length],land:0,kind:'bird'});
  o.anchor=o.g;o.eyeOff=new THREE.Vector3(0,.12,.05);
  o.g.position.set(o.cx+Math.cos(o.ph)*o.r,o.cy,o.cz+Math.sin(o.ph)*o.r);scene.add(o.g);birds.push(o);}
function updateBirds(dt,env){
  const t=state.T,hide=env.night>.55||cur.rain>.55||cur.storm>.4;
  for(const b of birds){
    if(!b.g.visible)continue;
    b.ph+=b.w*dt*(.6+cur.wind*.8);
    let tx=b.cx+Math.cos(b.ph)*b.r,ty=b.cy+Math.sin(b.ph*2.1)*.9,tz=b.cz+Math.sin(b.ph)*b.r;
    if(hide){tx=b.perch[0];ty=b.perch[1];tz=b.perch[2];}
    b.land=lerp(b.land,hide?1:0,Math.min(1,dt*1.4));
    const k=Math.min(1,dt*2.2),p=b.g.position,ox=p.x,oz=p.z;
    p.x=lerp(p.x,tx,k);p.y=lerp(p.y,ty,k);p.z=lerp(p.z,tz,k);
    const dx=p.x-ox,dz=p.z-oz;if(dx*dx+dz*dz>1e-7)b.g.rotation.y=Math.atan2(dx,dz);
    const fl=Math.sin(t*11+b.ph*3)*(.2+.5*(1-b.land))*(.55+.45*Math.sin(t*.7+b.ph));
    b.wlG.rotation.z=fl*(1-b.land)+1.15*b.land;
    b.wrG.rotation.z=-fl*(1-b.land)-1.15*b.land;
  }
}

// ---------- gulls over the sea ----------
const NG=isMobile?10:16,gulls=[];
for(let i=0;i<NG;i++){const z=-130+rnd()*190;
  const o=Object.assign(makeBird(mGull,mGullW,mBeak,1.7),{cx:coastEdge(z)-30-rnd()*30,cz:z,cy:SEA+7+rnd()*8,r:5+rnd()*9,w:(.22+rnd()*.3)*(rnd()<.5?-1:1),ph:rnd()*6.28,kind:'gull'});
  o.anchor=o.g;o.eyeOff=new THREE.Vector3(0,.2,.08);
  o.g.position.set(o.cx+Math.cos(o.ph)*o.r,o.cy,o.cz+Math.sin(o.ph)*o.r);scene.add(o.g);gulls.push(o);}
function updateGulls(dt){
  const t=state.T;
  for(const g of gulls){
    if(!g.g.visible)continue;
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
const ND=isMobile?4:6,dolphins=[];
for(let i=0;i<ND;i++){const z=-90+rnd()*170;
  const o=Object.assign(makeDolphin(),{cx:coastEdge(z)-16-rnd()*22,cz:z,r:5+rnd()*8,w:(.18+rnd()*.2)*(rnd()<.5?-1:1),ph:rnd()*6.28,jump:false,jt:0,next:15+rnd()*45});
  o.g.position.set(o.cx,SEA,o.cz);scene.add(o.g);dolphins.push(o);}
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
      p.x=d.jx+Math.cos(d.jh)*5.5*d.jt;p.z=d.jz+Math.sin(d.jh)*5.5*d.jt;
      p.y=SEA+d.apex*Math.sin(u*Math.PI);
      d.g.rotation.y=d.jh;d.g.rotation.x=-Math.atan2(d.apex*Math.PI*Math.cos(u*Math.PI)/1.2,5.5);
      if(u>=1){d.jump=false;d.next=t+35+Math.random()*55;burst(p.x,p.z,12);}
    }else{
      d.ph+=d.w*dt;
      const x=d.cx+Math.cos(d.ph)*d.r,z=d.cz+Math.sin(d.ph)*d.r,ox=p.x,oz=p.z;
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
export function updateAnimals(dt,env){
  const f=state.animalFrac,nB=Math.round(f*NB),nG=Math.round(f*NG),nD=Math.round(f*ND),nL=f<=0?0:1+Math.round(f*(land.length-1));
  birds.forEach((b,i)=>b.g.visible=i<nB);
  gulls.forEach((g,i)=>g.g.visible=i<nG&&cur.storm<.75);
  dolphins.forEach((d,i)=>d.g.visible=i<nD);
  land.forEach((a,i)=>a.g.visible=i<nL);
  if(state.rider&&!state.rider.g.visible)state.rider=null;   // ridden animal hidden by the slider -> back to plain fp
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
function attach(a){if(state.mode!=='fp')setMode('fp');state.rider=a;state.watch=null;
  const kn=KINDS.find(k=>k.id===a.kind),h=$('hint');
  h.textContent='Du folgst dem '+kn.name+' – Esc für Rundblick';h.classList.remove('gone');
  clearTimeout(attach.t);attach.t=setTimeout(()=>h.classList.add('gone'),5000);syncBtns();}
function onKind(k){const v=vis(k);if(!v.length)return;
  if(state.rider&&state.rider.kind===k.id){const i=v.indexOf(state.rider);attach(v[(i+1)%v.length]);}  // same kind again -> next animal of this kind
  else attach(v[0]);}
{const box=$('animalBtns');
  for(const k of KINDS){const b=document.createElement('button');b.className='abtn';b.type='button';
    b.setAttribute('aria-pressed','false');b.setAttribute('aria-label','Erste-Person-Ansicht: '+k.name);
    b.innerHTML='<span>'+k.icon+'</span>'+k.name;
    b.addEventListener('click',()=>onKind(k));box.append(b);k.btn=b;}}
syncBtns();
