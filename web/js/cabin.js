import {scene} from './renderer.js';
import {std,weatherize} from './materials.js';
import {logTex} from './textures.js';
import {BOXES,CIRCLES} from './collision.js';
import {HX,HZ,T_,GF,WH,UF,UH,RIDGE,STAIR,BALC,stairH} from './house.js';

// ---------- cabin ----------
export const cabin=new THREE.Group();scene.add(cabin);
export function add(geo,mat,x,y,z,parent=cabin){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const wallMat=std(0xffffff,{map:logTex});
const logUV=g=>{const ua=g.attributes.uv;for(let i=0;i<ua.count;i++)ua.setXY(i,ua.getX(i)*.35,ua.getY(i)/3);return g;};
// walls with consistent log UVs, built around openings so the cabin is hollow; each storey collides on its own
function wallBox(x0,x1,y0,y1,z0,z1,collide){
  const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  const pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv;
  for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
    if(Math.abs(na.getY(i))>.5)ua.setXY(i,x*.35,z*.35);else ua.setXY(i,(Math.abs(na.getX(i))>.5?z:x)*.35,y/3);}
  const m=new THREE.Mesh(g,wallMat);m.castShadow=m.receiveShadow=true;cabin.add(m);
  if(collide!==false)BOXES.push([x0,x1,z0,z1,y0,y1]);return m;}
// a wall along x (front/back) at z0..z1 from y0 to y1, with openings [xa,xb,ya,yb]
function wallX(z0,z1,y0,y1,holes,xa=-HX,xb=HX){let x=xa;
  for(const h of holes){if(h[0]>x)wallBox(x,h[0],y0,y1,z0,z1);if(h[2]>y0)wallBox(h[0],h[1],y0,h[2],z0,z1);if(h[3]<y1)wallBox(h[0],h[1],h[3],y1,z0,z1);x=h[1];}
  if(x<xb)wallBox(x,xb,y0,y1,z0,z1);}
function wallZ(x0,x1,y0,y1,holes,za=-HZ+T_,zb=HZ-T_){let z=za;
  for(const h of holes){if(h[0]>z)wallBox(x0,x1,y0,y1,z,h[0]);if(h[2]>y0)wallBox(x0,x1,y0,h[2],h[0],h[1]);if(h[3]<y1)wallBox(x0,x1,h[3],y1,h[0],h[1]);z=h[1];}
  if(z<zb)wallBox(x0,x1,y0,y1,z,zb);}
const IX=HX-T_,IZ=HZ-T_;   // inner faces
// ground floor: door + two windows at the front, one window at the back (east of the stair), solid side walls
wallX(IZ,HZ,0,WH,[[-2.55,-1.45,1.25,2.25],[-.55,.55,0,2.2],[1.45,2.55,1.25,2.25]]);
wallX(-HZ,-IZ,0,WH,[[2.5,3.5,1.3,2.2]]);
wallZ(-HX,-IX,0,WH,[]);wallZ(IX,HX,0,WH,[]);
// upper floor: bedroom + hall windows at the front, balcony door in the west gable wall; front/back walls run up under the roof
wallX(IZ,HZ,WH,UH+.2,[[-3.2,-2,4.3,5.3],[0,1.1,4.3,5.3]]);
wallX(-HZ,-IZ,WH,UH+.2,[]);
wallZ(-HX,-IX,WH,UH,[[-.5,.5,UF,5.4]]);wallZ(IX,HX,WH,UH,[]);
// partitions: bedroom | hall | bathroom, doorways toward the front / the stair top
wallZ(-1.46,-1.34,WH,UH,[[1.3,2.3,UF,5.4]],-IZ,IZ);wallZ(2.24,2.36,WH,UH,[[-1.3,-.3,UF,5.4]],-IZ,IZ);
add(new THREE.BoxGeometry(9.4,.35,6.9),std(0x6b6660),0,.12,0);
// slab between the storeys, open above the stair
const slabMat=std(0x7a5636),SB=UF-WH;
[[-IX,IX,STAIR.z1,IZ],[-IX,STAIR.hx,-IZ,STAIR.z1],[STAIR.x1,IX,-IZ,STAIR.z1]].forEach(s=>add(new THREE.BoxGeometry(s[1]-s[0],SB,s[3]-s[2]),slabMat,(s[0]+s[1])/2,WH+SB/2,(s[2]+s[3])/2));
// gable ends and partition gables up to the roof line
function gable(x0,d){const s=new THREE.Shape();s.moveTo(-HZ,UH);s.lineTo(HZ,UH);s.lineTo(0,RIDGE);s.lineTo(-HZ,UH);
  const g=logUV(new THREE.ExtrudeGeometry(s,{depth:d,bevelEnabled:false}));g.rotateY(Math.PI/2);g.translate(x0,0,0);return add(g,wallMat,0,0,0);}
gable(-HX,T_);gable(IX,T_);gable(-1.46,.12);gable(2.24,.12);

// warm night glow for windows and the skylight (only visible from outside; from inside you look out)
export const glowMat=new THREE.MeshBasicMaterial({color:0xffb15c,transparent:true,opacity:0,depthWrite:false,side:THREE.FrontSide});
// ---------- roof: two slopes, vaulted plank ceiling underneath, skylight over the bathroom tub ----------
const roofMat=weatherize(std(0x4a3b33,{flatShading:true}),'roof'),ceilMat=std(0x8a6440);
const ang=Math.atan2(RIDGE-UH,HZ),SL=Math.hypot(HZ,RIDGE-UH)+.75,RW=HX*2+.9;
// skylight in slope coordinates: u along x, s down the slope from the ridge
const SKU=[2.7,3.9],SKS=[.8,2.2];
export const SKY={x0:SKU[0],x1:SKU[1],z0:SKS[0]*Math.cos(ang),z1:SKS[1]*Math.cos(ang)};
function slope(side){const g=new THREE.Group();g.position.set(0,RIDGE,0);g.rotation.x=side*ang;if(side<0)g.rotation.y=Math.PI;cabin.add(g);
  const parts=side>0?[[-RW/2,SKU[0],0,SL],[SKU[1],RW/2,0,SL],[SKU[0],SKU[1],0,SKS[0]],[SKU[0],SKU[1],SKS[1],SL]]:[[-RW/2,RW/2,0,SL]];
  for(const p of parts){add(new THREE.BoxGeometry(p[1]-p[0],.24,p[3]-p[2]),roofMat,(p[0]+p[1])/2,.12,(p[2]+p[3])/2,g);
    if(p[2]<HZ/Math.cos(ang))add(new THREE.BoxGeometry(p[1]-p[0],.05,Math.min(p[3],HZ/Math.cos(ang))-p[2]),ceilMat,(p[0]+p[1])/2,-.03,(p[2]+Math.min(p[3],HZ/Math.cos(ang)))/2,g);}
  return g;}
const front=slope(1);slope(-1);
add(new THREE.BoxGeometry(RW,.14,.5),roofMat,0,RIDGE+.25,0);
{const w=SKU[1]-SKU[0],l=SKS[1]-SKS[0],u=(SKU[0]+SKU[1])/2,s=(SKS[0]+SKS[1])/2,fm=std(0x3a2616);
  const pane=add(new THREE.BoxGeometry(w,.03,l),std(0x9fc4d8,{transparent:true,opacity:.35,roughness:.1,metalness:.1}),u,.14,s,front);pane.castShadow=false;
  const glow=new THREE.Mesh(new THREE.PlaneGeometry(w,l).rotateX(-Math.PI/2),glowMat);glow.position.set(u,.17,s);front.add(glow);
  [[w+.12,.08,u,SKS[0]],[w+.12,.08,u,SKS[1]]].forEach(f=>add(new THREE.BoxGeometry(f[0],.3,f[1]),fm,f[2],.12,f[3],front));
  [SKU[0],SKU[1]].forEach(x=>add(new THREE.BoxGeometry(.08,.3,l),fm,x,.12,s,front));}
// tie beams under the vault
[-3.2,.4,3.2].forEach(x=>add(new THREE.BoxGeometry(.18,.2,HZ*2-.3),std(0x4e3420),x,UH+.1,0));

// ---------- stair along the back wall, railings ----------
const stairMat=std(0x6a4a2e),railMat=std(0x5a3d24),N=13,run=(STAIR.x1-STAIR.x0)/N,sw=STAIR.z1-STAIR.z0;
for(let i=0;i<N;i++){const top=stairH(STAIR.x0+(i+1)*run);add(new THREE.BoxGeometry(run,top,sw),stairMat,STAIR.x0+(i+.5)*run,top/2,(STAIR.z0+STAIR.z1)/2);}
function rail(x0,z0,x1,z1,y0,y1,posts=3){const L=Math.hypot(x1-x0,z1-z0),r=add(new THREE.BoxGeometry(Math.hypot(L,y1-y0)+.06,.07,.07),railMat,0,0,0);
  r.position.set((x0+x1)/2,(y0+y1)/2+1,(z0+z1)/2);r.rotation.order='YZX';r.rotation.y=-Math.atan2(z1-z0,x1-x0);r.rotation.z=Math.atan2(y1-y0,L);
  for(let i=0;i<=posts;i++){const t=i/posts;add(new THREE.BoxGeometry(.06,1,.06),railMat,x0+(x1-x0)*t,y0+(y1-y0)*t+.5,z0+(z1-z0)*t);}}
rail(STAIR.x0+.15,STAIR.z1,STAIR.x1,STAIR.z1,stairH(STAIR.x0+.15),UF,6);
rail(STAIR.hx,STAIR.z1,1.2,STAIR.z1,UF,UF,3);
BOXES.push([STAIR.hx,1.2,STAIR.z1-.05,STAIR.z1+.05,UF+.2,4.5],[STAIR.hx-.05,STAIR.hx+.05,STAIR.z0,STAIR.z1,UF+.2,4.5]); // upper floor only: the stair passes under them

// ---------- balcony on the west gable, facing the sea ----------
add(new THREE.BoxGeometry(BALC.x1-BALC.x0,.15,BALC.hz*2),std(0x6a4a2e),(BALC.x0+BALC.x1)/2,UF-.075,0);
[-1,1].forEach(s=>{add(new THREE.CylinderGeometry(.09,.09,UF,6),railMat,BALC.x0+.1,UF/2,s*(BALC.hz-.1));CIRCLES.push([BALC.x0+.1,s*(BALC.hz-.1),.12]);
  rail(BALC.x1,s*BALC.hz,BALC.x0,s*BALC.hz,UF,UF,2);BOXES.push([BALC.x0,BALC.x1,s*BALC.hz-.05,s*BALC.hz+.05,WH,4.5]);});
rail(BALC.x0,-BALC.hz,BALC.x0,BALC.hz,UF,UF,4);BOXES.push([BALC.x0-.05,BALC.x0+.05,-BALC.hz,BALC.hz,WH,4.5]);

// door, open onto the porch
const doorPivot=new THREE.Group();doorPivot.position.set(-.55,0,HZ+.03);doorPivot.rotation.y=-1.75;cabin.add(doorPivot);
add(new THREE.BoxGeometry(1.1,2.1,.08),std(0x4a2f1a),.55,1.36,0,doorPivot);
add(new THREE.SphereGeometry(.06,8,6),std(0xc9a24a,{metalness:.6,roughness:.4}),.95,1.3,.07,doorPivot);
BOXES.push([-.75,-.45,HZ,HZ+1.2]);

// window frames + warm glow panes (only visible from outside; from inside you look out)
const frameMat=std(0x3a2616);
export function windowAt(x,z,rotY,w,h,yc){
  const g=new THREE.Group();g.position.set(x,yc,z);g.rotation.y=rotY;cabin.add(g);
  add(new THREE.BoxGeometry(w+.16,.1,.32),frameMat,0,-h/2,0,g);add(new THREE.BoxGeometry(w+.16,.1,.32),frameMat,0,h/2,0,g);
  add(new THREE.BoxGeometry(.08,h,.3),frameMat,-w/2,0,0,g);add(new THREE.BoxGeometry(.08,h,.3),frameMat,w/2,0,0,g);
  add(new THREE.BoxGeometry(.05,h,.05),frameMat,0,0,0,g);add(new THREE.BoxGeometry(w,.05,.05),frameMat,0,0,0,g);
  const pane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),glowMat);pane.position.z=.16;g.add(pane);
  add(new THREE.BoxGeometry(w+.3,.06,.28),frameMat,0,-h/2-.06,.12,g);}
windowAt(-2,HZ-.125,0,1.1,1.0,1.75);windowAt(2,HZ-.125,0,1.1,1.0,1.75);windowAt(3,-HZ+.125,Math.PI,1.0,.9,1.75);

// porch
add(new THREE.BoxGeometry(9.2,.22,1.85),std(0x6a4a2e),0,.3,HZ+.925);
[-4.4,4.4].forEach(x=>{add(new THREE.CylinderGeometry(.1,.1,2.6,6),std(0x5a3d24),x,1.5,HZ+1.7);CIRCLES.push([x,HZ+1.7,.15]);});
const porchRoof=add(new THREE.BoxGeometry(9.6,.16,2.1),roofMat,0,2.85,HZ+1.0);porchRoof.rotation.x=.22;
add(new THREE.BoxGeometry(1.6,.12,.45),std(0x7b5634),-2.1,.85,HZ+.65);
[-2.75,-1.45].forEach(x=>add(new THREE.BoxGeometry(.1,.5,.4),std(0x5a3d24),x,.6,HZ+.65));
BOXES.push([-2.95,-1.25,HZ+.4,HZ+.9]);
export const logMat=std(0x8a6a48),logGeo=new THREE.CylinderGeometry(.16,.16,1.3,7);logGeo.rotateX(Math.PI/2);

// window glow light outside
export const winLight=new THREE.PointLight(0xffa94d,0,14,2);winLight.position.set(0,1.8,HZ+1.45);scene.add(winLight);
