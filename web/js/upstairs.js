import {scene} from './renderer.js';
import {std} from './materials.js';
import {BOXES} from './collision.js';
import {cabin,add,windowAt} from './cabin.js';
import {plankTex,pelt,FUR_CREAM,FUR_GREY} from './interior.js';
import {HX,HZ,T_,UF,STAIR} from './house.js';

// ---------- upper floor: plank floor around the stair opening ----------
const IX=HX-T_,IZ=HZ-T_,floorMat=std(0xffffff,{map:plankTex});
[[-IX,IX,STAIR.z1,IZ],[-IX,STAIR.hx,-IZ,STAIR.z1],[STAIR.x1,IX,-IZ,STAIR.z1]].forEach(s=>{const w=s[1]-s[0],d=s[3]-s[2],g=new THREE.PlaneGeometry(w,d),ua=g.attributes.uv;
  for(let i=0;i<ua.count;i++)ua.setXY(i,ua.getX(i)*w/(IX*2),ua.getY(i)*d/(IZ*2));
  const m=new THREE.Mesh(g,floorMat);m.rotation.x=-Math.PI/2;m.position.set((s[0]+s[1])/2,UF+.004,(s[2]+s[3])/2);m.receiveShadow=true;cabin.add(m);});
const box=(w,h,d,mat,x,y,z)=>add(new THREE.BoxGeometry(w,h,d),mat,x,UF+y,z);
const wood=std(0x6b4a2c),dark=std(0x4e3420);
// windows: bedroom and hall at the front (frames + night glow), frame around the balcony door
windowAt(-2.6,HZ-.125,0,1.2,1.0,4.8);windowAt(.55,HZ-.125,0,1.1,1.0,4.8);
box(.32,2.1,.1,dark,-HX+.125,1.05,-.55);box(.32,2.1,.1,dark,-HX+.125,1.05,.55);box(.32,.1,1.2,dark,-HX+.125,2.12,0);

// ---------- bedroom (west): bed against the back wall, desk under the window ----------
export const BED={x:-2.9,z:-1.95};
box(1.7,.3,2.15,wood,BED.x,.2,BED.z);box(1.6,.2,2.0,std(0xe8e0d0,{roughness:1}),BED.x,.45,BED.z+.02);
box(1.62,.07,1.35,std(0x7a3b2e,{roughness:1}),BED.x,.58,BED.z+.35);
[-.4,.4].forEach(dx=>box(.62,.14,.4,std(0xf1ece2,{roughness:1}),BED.x+dx,.62,BED.z-.72));
box(1.75,.95,.08,dark,BED.x,.5,-IZ+.04);
{const f=pelt(FUR_CREAM,.9,1.2,cabin);f.position.set(BED.x,UF+.625,BED.z+.7);f.rotation.set(-Math.PI/2,0,1.57);}
BOXES.push([BED.x-.85,BED.x+.85,-IZ,BED.z+1.08,UF-.3,UF+1.2]);
// desk + chair, a book and a small lamp
box(1.2,.05,.6,wood,-2.6,.75,IZ-.32);[[-.55,-.25],[.55,-.25],[-.55,.25],[.55,.25]].forEach(o=>box(.05,.73,.05,dark,-2.6+o[0],.37,IZ-.32+o[1]));
box(.45,.05,.45,wood,-2.6,.45,IZ-.95);[[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]].forEach(o=>box(.04,.44,.04,dark,-2.6+o[0],.22,IZ-.95+o[1]));box(.45,.5,.04,wood,-2.6,.72,IZ-1.18);
box(.28,.04,.2,std(0x3c4a32),-2.95,.8,IZ-.3);box(.08,.25,.08,std(0x2e2a26,{metalness:.5,roughness:.5}),-2.15,.9,IZ-.2);
BOXES.push([-3.2,-2.0,IZ-.62,IZ,UF-.3,UF+1.2],[-2.85,-2.35,IZ-1.2,IZ-.72,UF-.3,UF+1.2]);
{const r=pelt(FUR_GREY,1.6,2.0,cabin);r.position.set(-2.9,UF+.01,.9);r.rotation.set(-Math.PI/2,0,.2);}

// ---------- hall: a chest under the window ----------
box(1.0,.45,.45,std(0x5c3a22),.55,.23,IZ-.25);BOXES.push([.05,1.05,IZ-.5,IZ,UF-.3,UF+1.2]);

// ---------- bathroom (east): freestanding tub under the skylight, candles ----------
export const TUB={x:3.3,z:1.2};
const enamel=std(0xf4f1ea,{roughness:.25,side:THREE.DoubleSide}),tub=new THREE.Group();tub.position.set(TUB.x,UF,TUB.z);tub.scale.set(.42,1,.88);cabin.add(tub);
add(new THREE.CylinderGeometry(1,.9,.55,32,1,true),enamel,0,.4,0,tub);
add(new THREE.CircleGeometry(.9,32).rotateX(-Math.PI/2),enamel,0,.13,0,tub);
add(new THREE.TorusGeometry(1,.06,6,32).rotateX(Math.PI/2),enamel,0,.67,0,tub);
{const w=new THREE.Mesh(new THREE.CircleGeometry(.96,32).rotateX(-Math.PI/2),std(0x7fa8b8,{transparent:true,opacity:.7,roughness:.05,metalness:.1}));w.position.y=.5;tub.add(w);}
[[-.7,-.7],[.7,-.7],[-.7,.7],[.7,.7]].forEach(o=>add(new THREE.SphereGeometry(.07,8,6),std(0xc9a24a,{metalness:.6,roughness:.4}),o[0],.08,o[1],tub));
BOXES.push([TUB.x-.45,TUB.x+.45,TUB.z-.9,TUB.z+.9,UF-.3,UF+1.2]);
// stool with candles beside the tub, more on the floor at its foot
box(.4,.04,.4,wood,4.0,.45,1.0);[[-.15,-.15],[.15,-.15],[-.15,.15],[.15,.15]].forEach(o=>box(.04,.44,.04,dark,4.0+o[0],.22,1.0+o[1]));
BOXES.push([3.8,4.2,.8,1.2,UF-.3,UF+1.2]);
const wax=std(0xf0e6cc,{roughness:.8}),flameMat=new THREE.MeshBasicMaterial({color:0xffd27a});
[[4.0,.47,.92,.14],[4.1,.47,1.08,.1],[3.9,.47,1.1,.08],[3.3,0,2.3,.16],[3.05,0,2.25,.1],[3.55,0,2.28,.12]].forEach(c=>{
  const m=add(new THREE.CylinderGeometry(.03,.03,c[3],10),wax,c[0],UF+c[1]+c[3]/2,c[2]);m.castShadow=false;
  const f=new THREE.Mesh(new THREE.SphereGeometry(.018,6,6),flameMat);f.scale.y=1.8;f.position.set(c[0],UF+c[1]+c[3]+.03,c[2]);cabin.add(f);});
export const candleLight=new THREE.PointLight(0xffb35a,0,5,2);candleLight.position.set(3.7,UF+.8,1.6);candleLight.castShadow=false;scene.add(candleLight);
// towel rack on the partition wall
box(.06,.06,.7,dark,2.45,1.1,2.2);box(.04,.7,.62,std(0xb9c7c4,{roughness:1}),2.43,.78,2.2);
