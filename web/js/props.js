// Rocks, cliff boulders, driftwood and the rope-lined path down the ravine.
import {rnd} from './util.js';
import {LAKE,SEA,GULLY,coastEdge,heightAt,pathDist} from './world.js';
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
