// Rocks, cliff boulders, driftwood, the rope-lined ravine path and the cairn-marked mountain trails.
import {rnd,hash} from './util.js';
import {LAKE,SEA,GULLY,MTRAILS,SUMMITS,coastEdge,heightAt,pathDist} from './world.js';
import {scene} from './renderer.js';
import {std,weatherize} from './materials.js';
import {CIRCLES} from './collision.js';
import {add} from './cabin.js';

// rocks
for(let i=0;i<40;i++){const a=rnd()*6.28,r=12+rnd()*60,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r||x-coastEdge(z)<3||pathDist(x,z)<2.5)continue;
  const s=.3+rnd()*1.3;const m=add(new THREE.DodecahedronGeometry(s,0),weatherize(std(0x86817a,{flatShading:true}),'rock'),x,heightAt(x,z)+s*.3,z,scene);m.rotation.set(rnd()*3,rnd()*3,rnd()*3);CIRCLES.push([x,z,s*.85]);}

const cliffRockMat=weatherize(std(0x7c776f,{flatShading:true}),'rock');
for(let i=0;i<70;i++){const z=-150+rnd()*300,dx=-2-rnd()*11,x=coastEdge(z)+dx;if(pathDist(x,z)<4)continue;
  const s=.8+rnd()*2.6*(dx<-8?.6:1);const y=heightAt(x,z);
  const m=add(new THREE.DodecahedronGeometry(s,0),cliffRockMat,x,y+s*.2,z,scene);m.scale.set(1,.7+rnd()*.8,1);m.rotation.set(rnd()*3,rnd()*3,rnd()*3);
  if(Math.hypot(x,z)<120)CIRCLES.push([x,z,s*.8]);}
const driftMat=std(0x9a8a76);
for(let i=0;i<9;i++){const z=GULLY[4][1]-30+rnd()*60,x=coastEdge(z)-11-rnd()*3.5;const y=heightAt(x,z);if(y<SEA+.3)continue;
  const l=add(new THREE.CylinderGeometry(.12+rnd()*.1,.15+rnd()*.1,1.8+rnd()*2.2,6),driftMat,x,y+.12,z,scene);l.rotation.set(Math.PI/2,0,rnd()*3.14);}
// path posts with a rope down the ravine, and a little sign at the top
const postMat=std(0x5a3d24),ropeMat=new THREE.LineBasicMaterial({color:0x8a7656});
{const ropePts=[];
 for(let i=0;i<GULLY.length-1;i++){const a=GULLY[i],b=GULLY[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/5));
   const nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L;
   for(let k=0;k<n;k++){const t=k/n,x=a[0]+(b[0]-a[0])*t+nx*1.7,z=a[1]+(b[1]-a[1])*t+nz*1.7,y=heightAt(x,z);
     add(new THREE.CylinderGeometry(.07,.08,1.1,6),postMat,x,y+.55,z,scene);ropePts.push(new THREE.Vector3(x,y+.95,z));CIRCLES.push([x,z,.12]);}}
 scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ropePts),ropeMat));
 const g0=GULLY[0],sx=g0[0]+2.2,sz=g0[1]-1.8,sy=heightAt(sx,sz);
 add(new THREE.CylinderGeometry(.08,.09,1.6,6),postMat,sx,sy+.8,sz,scene);
 const board=add(new THREE.BoxGeometry(.9,.32,.06),std(0x7b5634),sx-.25,sy+1.35,sz,scene);board.rotation.y=.9;CIRCLES.push([sx,sz,.15]);}

// ---------- mountain boulders (hash-based, so the seeded rnd() layout of the rest of the world stays intact) ----------
const mRockMat=weatherize(std(0x807b73,{flatShading:true}),'rock');
for(let gx=-300;gx<=300;gx+=13)for(let gz=-300;gz<=300;gz+=13){
  const x=gx+hash(gx,gz)*11,z=gz+hash(gz,gx)*11,r=Math.hypot(x,z);
  if(r<125||r>300)continue;
  if(x-coastEdge(z)<42)continue;                       // no boulders in the sea
  const y=heightAt(x,z);
  if(y<SEA+3||y>45)continue;
  if(pathDist(x,z)<5)continue;                         // keep the trails clear
  if(hash(gx*.7+3,gz*.7-1)<.5)continue;
  const s=.5+hash(gx+9,gz-4)*2.2;
  const m=add(new THREE.DodecahedronGeometry(s,0),mRockMat,x,y+s*.25,z,scene);
  m.rotation.set(hash(gx,1)*3,hash(gx,2)*3,hash(gx,3)*3);m.scale.y=.6+hash(gx,4)*.7;
  CIRCLES.push([x,z,s*.8]);}

// ---------- cairns mark the mountain paths; a big one stands on every summit ----------
const cairnMat=weatherize(std(0x8d877d,{flatShading:true}),'rock');
MTRAILS.forEach((t,ti)=>{const pts=t.pts;
  for(let i=8;i<pts.length-4;i+=7){
    const p=pts[i],q=pts[Math.min(i+1,pts.length-1)];
    let nx=-(q[1]-p[1]),nz=q[0]-p[0];const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
    const side=((i/7)|0)%2?1:-1,x=p[0]+nx*2.6*side,z=p[1]+nz*2.6*side;
    if(Math.hypot(x,z)<24)continue;                    // not right at the clearing
    const y=heightAt(x,z),n=2+(i%3===0?1:0),s=.32+hash(i,ti)*.12;
    for(let k=0;k<n;k++){const ss=s*(1-k*.26);
      add(new THREE.DodecahedronGeometry(ss,0),cairnMat,x,y+.3*k+ss*.45,z,scene).rotation.set(k,k*1.7,k*.6);}
    CIRCLES.push([x,z,.3]);}});
for(const s of SUMMITS){
  const x=s[0],z=s[1],y=heightAt(x,z);
  for(let j=0;j<4;j++){const ss=.55-j*.11;
    add(new THREE.DodecahedronGeometry(ss,0),cairnMat,x,y+.55*j+ss*.4,z,scene).rotation.set(j*1.3,j*2.1,j*.7);}
  CIRCLES.push([x,z,.45]);}
