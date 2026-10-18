import {scene} from './renderer.js';
import {std,weatherize} from './materials.js';
import {logTex} from './textures.js';
import {BOXES,CIRCLES} from './collision.js';

// ---------- cabin ----------
export const cabin=new THREE.Group();scene.add(cabin);
export function add(geo,mat,x,y,z,parent=cabin){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const wallMat=std(0xffffff,{map:logTex});
// walls with consistent log UVs, built around openings so the cabin is hollow
function wallBox(x0,x1,y0,y1,z0,z1,collide){
  const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  const pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv;
  for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
    if(Math.abs(na.getY(i))>.5)ua.setXY(i,x*.35,z*.35);else ua.setXY(i,(Math.abs(na.getX(i))>.5?z:x)*.35,y/3);}
  const m=new THREE.Mesh(g,wallMat);m.castShadow=m.receiveShadow=true;cabin.add(m);
  if(collide!==false&&y0<1.4)BOXES.push([x0,x1,z0,z1]);return m;}
const T_=.25,HX=3.5,HZ=2.75,WH=3;
wallBox(-HX,-2.15,0,WH,-HZ,-HZ+T_);wallBox(-1.05,HX,0,WH,-HZ,-HZ+T_);   // back, around window
wallBox(-2.15,-1.05,0,1.3,-HZ,-HZ+T_);wallBox(-2.15,-1.05,2.2,WH,-HZ,-HZ+T_);
wallBox(-HX,-HX+T_,0,WH,-HZ+T_,HZ-T_);                   // left
wallBox(HX-T_,HX,0,WH,-HZ+T_,-.5);wallBox(HX-T_,HX,0,WH,.5,HZ-T_);   // right, around window
wallBox(HX-T_,HX,0,1.3,-.5,.5);wallBox(HX-T_,HX,2.2,WH,-.5,.5);
// front: door at |x|<.55, windows at 1.45<|x|<2.55
[[-HX,-2.55],[-1.45,-.55],[.55,1.45],[2.55,HX]].forEach(a=>wallBox(a[0],a[1],0,WH,HZ-T_,HZ));
[[-2.55,-1.45],[1.45,2.55]].forEach(a=>{wallBox(a[0],a[1],0,1.25,HZ-T_,HZ);wallBox(a[0],a[1],2.25,WH,HZ-T_,HZ);});
wallBox(-.55,.55,2.2,WH,HZ-T_,HZ);
add(new THREE.BoxGeometry(7.4,.35,5.9),std(0x6b6660),0,.12,0);
// gable (its underside is the ceiling)
const gs=new THREE.Shape();gs.moveTo(-2.75,0);gs.lineTo(2.75,0);gs.lineTo(0,2.1);gs.lineTo(-2.75,0);
const gg=new THREE.ExtrudeGeometry(gs,{depth:6.9,bevelEnabled:false});gg.rotateY(Math.PI/2);gg.translate(-3.45,3,0);
add(gg,std(0x6e4a2b),0,0,0);
// roof
const roofMat=weatherize(std(0x4a3b33,{flatShading:true}),'roof');
const ang=Math.atan2(2.1,2.75),rl=Math.hypot(2.75,2.1)+.75;
const rf=add(new THREE.BoxGeometry(8.2,.24,rl),roofMat,0,4.05+.05,1.55);rf.rotation.x=ang;
const rb=add(new THREE.BoxGeometry(8.2,.24,rl),roofMat,0,4.05+.05,-1.55);rb.rotation.x=-ang;

// door, open onto the porch
const doorPivot=new THREE.Group();doorPivot.position.set(-.55,0,2.78);doorPivot.rotation.y=-1.75;cabin.add(doorPivot);
add(new THREE.BoxGeometry(1.1,2.1,.08),std(0x4a2f1a),.55,1.36,0,doorPivot);
add(new THREE.SphereGeometry(.06,8,6),std(0xc9a24a,{metalness:.6,roughness:.4}),.95,1.3,.07,doorPivot);
BOXES.push([-.75,-.45,2.75,3.95]);

// window frames + warm glow panes (only visible from outside; from inside you look out)
const frameMat=std(0x3a2616);
export const glowMat=new THREE.MeshBasicMaterial({color:0xffb15c,transparent:true,opacity:0,depthWrite:false,side:THREE.FrontSide});
function windowAt(x,z,rotY,w,h,yc){
  const g=new THREE.Group();g.position.set(x,yc,z);g.rotation.y=rotY;cabin.add(g);
  add(new THREE.BoxGeometry(w+.16,.1,.32),frameMat,0,-h/2,0,g);add(new THREE.BoxGeometry(w+.16,.1,.32),frameMat,0,h/2,0,g);
  add(new THREE.BoxGeometry(.08,h,.3),frameMat,-w/2,0,0,g);add(new THREE.BoxGeometry(.08,h,.3),frameMat,w/2,0,0,g);
  add(new THREE.BoxGeometry(.05,h,.05),frameMat,0,0,0,g);add(new THREE.BoxGeometry(w,.05,.05),frameMat,0,0,0,g);
  const pane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),glowMat);pane.position.z=.16;g.add(pane);
  add(new THREE.BoxGeometry(w+.3,.06,.28),frameMat,0,-h/2-.06,.12,g);}
windowAt(-2,HZ-.125,0,1.1,1.0,1.75);windowAt(2,HZ-.125,0,1.1,1.0,1.75);windowAt(HX-.125,0,Math.PI/2,1.0,.9,1.75);windowAt(-1.6,-HZ+.125,Math.PI,1.1,.9,1.75);

// porch
add(new THREE.BoxGeometry(7.2,.22,1.8),std(0x6a4a2e),0,.3,3.7);
[-3.4,3.4].forEach(x=>{add(new THREE.CylinderGeometry(.1,.1,2.6,6),std(0x5a3d24),x,1.5,4.45);CIRCLES.push([x,4.45,.15]);});
const porchRoof=add(new THREE.BoxGeometry(7.6,.16,1.9),roofMat,0,2.85,3.75);porchRoof.rotation.x=.22;
add(new THREE.BoxGeometry(1.6,.12,.45),std(0x7b5634),-2.1,.85,3.4);
[-2.75,-1.45].forEach(x=>add(new THREE.BoxGeometry(.1,.5,.4),std(0x5a3d24),x,.6,3.4));
BOXES.push([-2.95,-1.25,3.15,3.65]);
export const logMat=std(0x8a6a48),logGeo=new THREE.CylinderGeometry(.16,.16,1.3,7);logGeo.rotateX(Math.PI/2);
for(let row=0;row<4;row++)for(let i=0;i<5-row;i++)add(logGeo,logMat,4.1+0,.2+row*.29,-1.6+i*.34+row*.17);
BOXES.push([3.85,4.4,-2.35,.35]);

// window glow light outside
export const winLight=new THREE.PointLight(0xffa94d,0,14,2);winLight.position.set(0,1.8,4.2);scene.add(winLight);
