// The far world beyond the mountains: yurt camp on the plain, river water, pass cairns, plain trees and grass.
// Imported LAST in main.js, so the seeded rnd() layout of the rest of the world is unchanged.
import {isMobile,rnd,hash,smooth} from './util.js';
import {SEA,coastEdge,RIVERS,FAR_TRAIL,riverDist,riverAt,heightAt,pathDist} from './world.js';
import {scene} from './renderer.js';
import {std,weatherize} from './materials.js';
import {CIRCLES} from './collision.js';
import {add,logMat} from './cabin.js';
import {canvasTex} from './textures.js';
import {water} from './terrain.js';
import {treeCrown,treeTrunk,treeCrownMat} from './trees.js';
import {grassBlade,grassMat} from './grass.js';
import {addEmitter} from './effects.js';
import {state,cur} from './state.js';

export const CAMP={x:468,z:16};
const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),P=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0),c=new THREE.Color();

// ---------- yurts ----------
const latticeTex=canvasTex(128,128,(g,w,h)=>{   // wooden lattice wall
  g.fillStyle='#a8895f';g.fillRect(0,0,w,h);
  g.strokeStyle='#6b4f30';g.lineWidth=3;
  for(let i=-h;i<w+h;i+=16){g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();g.beginPath();g.moveTo(i+h,0);g.lineTo(i,h);g.stroke();}
  g.globalAlpha=.22;g.fillStyle='#3a2a18';for(let i=0;i<50;i++)g.fillRect(Math.random()*w,Math.random()*h,6+Math.random()*22,1);});
latticeTex.wrapS=latticeTex.wrapT=THREE.RepeatWrapping;
const yurtWallMat=weatherize(std(0xffffff,{map:latticeTex,side:THREE.DoubleSide}),'yurt');
const yurtRoofMat=weatherize(std(0xcfc8b6,{roughness:1}),'yurt');
function yurt(x,z){
  const y=heightAt(x,z),g=new THREE.Group();g.position.set(x,y,z);
  g.rotation.y=Math.atan2(CAMP.x-x,CAMP.z-z);   // door faces the camp center
  scene.add(g);
  add(new THREE.CylinderGeometry(3,3,2.2,24,1,true),yurtWallMat,0,1.1,0,g);       // lattice wall
  add(new THREE.ConeGeometry(3.7,2.4,24,1,true),yurtRoofMat,0,3.4,0,g);            // felt roof
  add(new THREE.CylinderGeometry(.34,.34,.55,12),std(0x8a6f4d),0,4.75,0,g);         // crown ring (toono)
  add(new THREE.BoxGeometry(.95,1.75,.09),std(0x5a3d24),0,.88,3.03,g);             // door
  CIRCLES.push([x,z,3.3]);
  return {g,x,y,z};}
const yurts=[];
for(let k=0;k<6;k++){
  for(let t=0;t<24;t++){
    const a=rnd()*6.283,rr=11+rnd()*9,x=CAMP.x+Math.cos(a)*rr,z=CAMP.z+Math.sin(a)*rr;
    if(riverDist(x,z)<7.5||pathDist(x,z)<5.5||Math.hypot(x,z)>700)continue;
    yurts.push(yurt(x,z));break;}}
if(yurts.length>=2){addEmitter('smoke',yurts[0].x,yurts[0].y+5.1,yurts[0].z);addEmitter('smoke',yurts[1].x,yurts[1].y+5.1,yurts[1].z);}

// ---------- fence around the camp ----------
const postMat=std(0x5a3d24),ropeMat=new THREE.LineBasicMaterial({color:0x8a7656});
{const FR=30,NP=Math.floor(6.283*FR/2.2),postGeo=new THREE.CylinderGeometry(.06,.08,1.35,6);
  const posts=new THREE.InstancedMesh(postGeo,postMat,NP);
  const rope=[];
  for(let i=0;i<NP;i++){const a=i/NP*6.283,x=CAMP.x+Math.cos(a)*FR,z=CAMP.z+Math.sin(a)*FR,y=heightAt(x,z);
    P.set(x,y+.67,z);M.compose(P,Q.identity(),S.set(1,1,1));posts.setMatrixAt(i,M);
    rope.push(new THREE.Vector3(x,y+.72,z),new THREE.Vector3(x,y+1.12,z));}
  posts.castShadow=true;scene.add(posts);
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rope),ropeMat));
  for(let i=0;i<NP;i+=3){const a=i/NP*6.283;CIRCLES.push([CAMP.x+Math.cos(a)*FR,CAMP.z+Math.sin(a)*FR,.14]);}}

// ---------- fire pits; the central one burns (flame + smoke + light) ----------
const stoneMat=std(0x7d7a74,{flatShading:true}),charMat=std(0x3b2a1e);
function firePit(x,z,burn){
  const y=heightAt(x,z),g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
  for(let i=0;i<9;i++){const a=i/9*6.283,s=add(new THREE.DodecahedronGeometry(.26+rnd()*.1,0),stoneMat,Math.cos(a)*.95,.12,Math.sin(a)*.95,g);s.rotation.set(rnd()*3,rnd()*3,0);}
  for(let i=0;i<3;i++){const l=add(new THREE.CylinderGeometry(.09,.11,1.1,6),charMat,0,.28,0,g);l.rotation.set(1.1,i*2.1,0);}
  CIRCLES.push([x,z,1.1]);
  if(burn){addEmitter('flame',x,.3,z);addEmitter('smoke',x,1.5,z);
    campLight.position.set(x,1.2,z);}
  return [x,z];}
const campLight=new THREE.PointLight(0xff8a3a,2,22,2);campLight.castShadow=false;scene.add(campLight);
firePit(CAMP.x+4.5,CAMP.z+3,true);
firePit(CAMP.x-6,CAMP.z-4,false);

// ---------- river water (ribbons sharing the lake material, so day/night colors apply) ----------
for(const R of RIVERS){
  const pos=[],idx=[];let vi=0,prev=-1;
  for(let i=0;i<R.pts.length;i++){
    const [x,z,bed,dep]=R.pts[i],wy=bed+dep-.35;
    const a=R.pts[Math.max(i-1,0)],b=R.pts[Math.min(i+1,R.pts.length-1)];
    let nx=-(b[1]-a[1]),nz=b[0]-a[0];const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
    // only where both banks hold the water — no floating edges on steep slopes
    if(heightAt(x-nx*(R.w+1),z-nz*(R.w+1))<wy-.2||heightAt(x+nx*(R.w+1),z+nz*(R.w+1))<wy-.2){prev=-1;continue;}
    pos.push(x-nx*R.w,wy,z-nz*R.w, x+nx*R.w,wy,z+nz*R.w);
    if(prev>=0)idx.push(prev,prev+1,vi, prev+1,vi+1,vi);
    prev=vi;vi+=2;}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
  g.setIndex(idx);
  const nor=new Float32Array(pos.length/3*3);for(let i=0;i<nor.length;i+=3){nor[i+1]=1;}
  g.setAttribute('normal',new THREE.BufferAttribute(nor,3));
  const m=new THREE.Mesh(g,water.material);m.frustumCulled=false;scene.add(m);}

// ---------- plain trees ----------
{const NT=isMobile?150:320;
  const pc=new THREE.InstancedMesh(treeCrown,treeCrownMat,NT),pt=new THREE.InstancedMesh(treeTrunk,std(0x4d3624),NT);
  let n=0,tries=0;
  while(n<NT&&tries<8000){tries++;
    const a=rnd()*6.283,r=355+Math.pow(rnd(),.9)*285,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(x-coastEdge(z)<60)continue;                                  // inland only, the sea stays west
    if(riverDist(x,z)<7||pathDist(x,z)<4.5)continue;
    if(Math.hypot(x-CAMP.x,z-CAMP.z)<34)continue;
    const y=heightAt(x,z);
    if(y<SEA+2||y>30)continue;
    if(Math.abs(heightAt(x+2,z)-heightAt(x-2,z))>.9||Math.abs(heightAt(x,z+2)-heightAt(x,z-2))>.9)continue;
    const s=.7+rnd()*.9;
    P.set(x,y-.2,z);Q.setFromAxisAngle(UP,rnd()*6.28);S.set(s,s*(.9+rnd()*.3),s);M.compose(P,Q,S);
    pc.setMatrixAt(n,M);pt.setMatrixAt(n,M);
    c.setHSL(.27+rnd()*.07,.35+rnd()*.2,.17+rnd()*.1);pc.setColorAt(n,c);
    CIRCLES.push([x,z,.35*s]);n++;}
  pc.count=pt.count=n;pc.castShadow=pt.castShadow=true;pc.receiveShadow=true;
  pc.frustumCulled=pt.frustumCulled=false;scene.add(pc,pt);}

// ---------- plain grass ----------
{const NG=isMobile?6000:14000;
  const pg=new THREE.InstancedMesh(grassBlade,grassMat,NG);
  let gi=0,tries=0;
  while(gi<NG&&tries<40000){tries++;
    const a=rnd()*6.283,r=352+Math.sqrt(rnd())*298,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(x-coastEdge(z)<60)continue;
    if(riverDist(x,z)<2.2||pathDist(x,z)<1)continue;
    if(Math.hypot(x-CAMP.x,z-CAMP.z)<30)continue;
    const y=heightAt(x,z);if(y<SEA+2||y>26)continue;
    const h=.3+rnd()*.45;
    P.set(x,y-.05,z);Q.setFromAxisAngle(UP,rnd()*6.28);S.set(1,h,1);M.compose(P,Q,S);pg.setMatrixAt(gi,M);
    c.setHSL(.2+rnd()*.08,.45+rnd()*.15,.3+rnd()*.12);
    if(rnd()<.02)c.setHSL(rnd()<.5?.13:.75,.7,.65);   // little flowers
    pg.setColorAt(gi,c);gi++;}
  pg.count=gi;pg.receiveShadow=true;pg.frustumCulled=false;scene.add(pg);}
// lusher grass around the camp and along the pass trail (the wide plain stays sparse steppe)
{const NG2=isMobile?3500:12000;
  const pg2=new THREE.InstancedMesh(grassBlade,grassMat,NG2);
  let gi=0,tries=0;
  while(gi<NG2&&tries<40000){tries++;
    let x,z;
    if(rnd()<.6){const a=rnd()*6.283,rr=Math.sqrt(rnd())*95;x=CAMP.x+Math.cos(a)*rr;z=CAMP.z+Math.sin(a)*rr;}
    else{const p=FAR_TRAIL.pts[(rnd()*FAR_TRAIL.pts.length)|0],a=rnd()*6.283,rr=rnd()*12;x=p[0]+Math.cos(a)*rr;z=p[1]+Math.sin(a)*rr;}
    if(x-coastEdge(z)<60)continue;
    if(riverDist(x,z)<2.2||pathDist(x,z)<1)continue;
    let nearYurt=false;for(const yu of yurts)if(Math.hypot(x-yu.x,z-yu.z)<4.2){nearYurt=true;break;}
    if(nearYurt)continue;
    const y=heightAt(x,z);if(y<SEA+2||y>26)continue;
    const h=.3+rnd()*.45;
    P.set(x,y-.05,z);Q.setFromAxisAngle(UP,rnd()*6.28);S.set(1,h,1);M.compose(P,Q,S);pg2.setMatrixAt(gi,M);
    c.setHSL(.2+rnd()*.08,.45+rnd()*.15,.3+rnd()*.12);
    if(rnd()<.02)c.setHSL(rnd()<.5?.13:.75,.7,.65);
    pg2.setColorAt(gi,c);gi++;}
  pg2.count=gi;pg2.receiveShadow=true;pg2.frustumCulled=false;scene.add(pg2);}

// ---------- riverbank boulders (hash-based, keeps the rnd() sequence of this module's own content only) ----------
const bankRockMat=weatherize(std(0x807b73,{flatShading:true}),'rock');
for(const R of RIVERS)for(let i=0;i<R.pts.length;i+=2){
  const [x,z]=R.pts[i];
  const a=R.pts[Math.max(i-1,0)],b=R.pts[Math.min(i+1,R.pts.length-1)];
  let nx=-(b[1]-a[1]),nz=b[0]-a[0];const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
  for(const s of [-1,1]){
    const off=R.w+1+hash(i*2+s,3)*4,px=x+nx*off*s,pz=z+nz*off*s;
    const [rd,rw]=riverAt(px,pz);if(rd>R.w+6||pathDist(px,pz)<4)continue;
    const y=heightAt(px,pz);if(y<rw)continue;
    const sz=.3+hash(i+s,7)*1.1;
    const m=add(new THREE.DodecahedronGeometry(sz,0),bankRockMat,px,y+sz*.25,pz,scene);
    m.rotation.set(hash(i,1)*3,hash(i,2)*3,hash(i,3)*3);m.scale.y=.6+hash(i,4)*.7;
    if(Math.hypot(px-CAMP.x,pz-CAMP.z)<120)CIRCLES.push([px,pz,sz*.8]);}}

// ---------- cairns mark the pass trail ----------
const cairnMat=weatherize(std(0x8d877d,{flatShading:true}),'rock');
{const pts=FAR_TRAIL.pts;
  for(let i=6;i<pts.length-3;i+=7){
    const p=pts[i],q=pts[Math.min(i+1,pts.length-1)];
    let nx=-(q[1]-p[1]),nz=q[0]-p[0];const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
    const side=((i/7)|0)%2?1:-1,x=p[0]+nx*2.6*side,z=p[1]+nz*2.6*side;
    const y=heightAt(x,z),n=2+(i%3===0?1:0),s=.32+hash(i,7)*.12;
    for(let k=0;k<n;k++){const ss=s*(1-k*.26);
      add(new THREE.DodecahedronGeometry(ss,0),cairnMat,x,y+.3*k+ss*.45,z,scene).rotation.set(k,k*1.7,k*.6);}
    CIRCLES.push([x,z,.3]);}}

// ---------- per-frame: camp fire light flicker ----------
export function updateValley(dt,env){
  const fireScale=1-cur.rain*.55;
  campLight.intensity=(1.3+env.night*1.6)*fireScale*(.82+.18*Math.sin(state.T*13)*Math.sin(state.T*7.3+1)+.06*Math.random());
}
