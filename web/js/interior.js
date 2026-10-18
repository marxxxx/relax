import {isMobile} from './util.js';
import {scene} from './renderer.js';
import {std} from './materials.js';
import {canvasTex} from './textures.js';
import {BOXES} from './collision.js';
import {cabin,add,logMat} from './cabin.js';

let charMatShared=null;
// ---------- interior textures ----------
const plankTex=canvasTex(256,256,(g,w,h)=>{const n=8,pw=w/n;for(let i=0;i<n;i++){const l=40+Math.random()*14;g.fillStyle=`hsl(28,38%,${l}%)`;g.fillRect(i*pw,0,pw,h);
  g.fillStyle='rgba(30,18,8,.55)';g.fillRect(i*pw,0,2,h);const cut=Math.random()*h;g.fillRect(i*pw,cut,pw,2);
  g.globalAlpha=.08;for(let k=0;k<14;k++){g.fillStyle=Math.random()<.5?'#000':'#e0b080';g.fillRect(i*pw+Math.random()*pw,0,1,h);}g.globalAlpha=1;}});
plankTex.wrapS=plankTex.wrapT=THREE.RepeatWrapping;
const stoneTex=canvasTex(256,256,(g,w,h)=>{g.fillStyle='#3a3632';g.fillRect(0,0,w,h);
  for(let y=0;y<h;y+=30){for(let x=-(y/30%2)*20;x<w;x+=44){const l=40+Math.random()*22;g.fillStyle=`hsl(${25+Math.random()*15},${6+Math.random()*8}%,${l}%)`;
    g.beginPath();g.ellipse(x+21,y+15,19+Math.random()*3,12+Math.random()*2,Math.random()*.3,0,7);g.fill();}}});
stoneTex.wrapS=stoneTex.wrapT=THREE.RepeatWrapping;
function furTex(base,tip,len){return canvasTex(256,256,(g,w,h)=>{g.fillStyle=base;g.fillRect(0,0,w,h);g.lineCap='round';
  for(let i=0;i<4200;i++){const x=Math.random()*w,y=Math.random()*h,a=Math.PI/2+(Math.random()-.5)*.9,l=len*(.5+Math.random());
    g.strokeStyle=Math.random()<.5?tip:base;g.globalAlpha=.25+Math.random()*.5;g.lineWidth=1+Math.random()*1.5;
    g.beginPath();g.moveTo(x,y);g.lineTo(x+Math.cos(a)*l,y+Math.sin(a)*l);g.stroke();}});}
const FUR_BROWN=furTex('#5a3e28','#8a6544',10),FUR_CREAM=furTex('#cfc2a8','#f1e8d4',12),FUR_GREY=furTex('#55524e','#9a958c',11);
[FUR_BROWN,FUR_CREAM,FUR_GREY].forEach(t=>{t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(1.6,1.6);});

// floor & ceiling
const floor=new THREE.Mesh(new THREE.PlaneGeometry(6.5,5),std(0xffffff,{map:plankTex}));
plankTex.repeat.set(2.4,1.6);floor.rotation.x=-Math.PI/2;floor.position.set(0,.31,0);floor.receiveShadow=true;cabin.add(floor);
const beamMat=std(0x4e3420);
[-1.6,0,1.6].forEach(x=>add(new THREE.BoxGeometry(.22,.24,5),beamMat,x,2.88,0));

// ---------- fireplace (back wall) and exterior stone chimney ----------
const stoneM=std(0xffffff,{map:stoneTex,roughness:1});
export const FPX=1.6,FPZ=-2.2;
add(new THREE.BoxGeometry(2.3,.18,1.2),stoneM,FPX,.39,-1.95);
add(new THREE.BoxGeometry(.5,1.35,.7),stoneM,FPX-.85,.98,FPZ);add(new THREE.BoxGeometry(.5,1.35,.7),stoneM,FPX+.85,.98,FPZ);
add(new THREE.BoxGeometry(2.2,.4,.75),stoneM,FPX,1.85,FPZ);
add(new THREE.BoxGeometry(1.25,1.4,.12),std(0x1a1512),FPX,1.0,-2.52);
add(new THREE.BoxGeometry(2.6,.12,.42),std(0x5c3a22),FPX,2.11,-1.98);
add(new THREE.BoxGeometry(1.6,.95,.6),stoneM,FPX,2.55,-2.25);
for(let i=0;i<3;i++){const l=add(new THREE.CylinderGeometry(.08,.09,.8,6),charMat0(),FPX-.15+i*.15,.58,FPZ,cabin);l.rotation.set(0,0,Math.PI/2+(i-1)*.25);l.rotation.y=(i-1)*.4;}
function charMat0(){return charMatShared||(charMatShared=std(0x2e2018));}
// mantel decorations
[[-.9,.18,0xc9b48a],[-.6,.12,0xd8cfb8],[.7,.22,0x6d7f5a],[.95,.14,0x8a4a32]].forEach(d=>add(new THREE.CylinderGeometry(.07,.08,d[1],10),std(d[2]),FPX+d[0],2.17+d[1]/2,-1.98));
const candleFlame=new THREE.Mesh(new THREE.SphereGeometry(.025,6,6),new THREE.MeshBasicMaterial({color:0xffd27a}));candleFlame.position.set(FPX-.6,2.32,-1.98);cabin.add(candleFlame);
BOXES.push([FPX-1.15,FPX+1.15,-2.75,-1.4]);
add(new THREE.BoxGeometry(1.25,6.4,.85),stoneM,FPX,3.2,-3.17);
BOXES.push([FPX-.65,FPX+.65,-3.65,-2.75]);
export const hearthLight=new THREE.PointLight(0xff8a3a,1.5,11,2);hearthLight.position.set(FPX,1.0,-1.4);scene.add(hearthLight);
hearthLight.castShadow=!isMobile;hearthLight.shadow.mapSize.set(512,512);hearthLight.shadow.bias=-0.004;hearthLight.shadow.camera.near=.2;
export const bounceLight=new THREE.PointLight(0xffd2a8,0,8,2);bounceLight.position.set(-.5,2.4,.2);scene.add(bounceLight);
// sun shafts through the windows: soft additive volumes recomputed from the sun direction
const beamMatBase=new THREE.ShaderMaterial({uniforms:{uCol:{value:new THREE.Color()},uInt:{value:0}},transparent:true,depthWrite:false,
  blending:THREE.AdditiveBlending,side:THREE.DoubleSide,
  vertexShader:`varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`uniform vec3 uCol;uniform float uInt;varying vec2 vUv;void main(){float e=sin(vUv.x*3.14159);float a=pow(1.0-vUv.y,1.4)*e*e;gl_FragColor=vec4(uCol*uInt*a,1.0);}`});
const beams=[];
function makeBeam(corners,normal){
  const g=new THREE.BufferGeometry(),uvs=[],idx=[];
  for(let q=0;q<4;q++){const b=q*4;uvs.push(0,0,1,0,1,1,0,1);idx.push(b,b+1,b+2,b,b+2,b+3);}
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(48),3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setIndex(idx);
  const mat=beamMatBase.clone();const m=new THREE.Mesh(g,mat);m.frustumCulled=false;m.visible=false;scene.add(m);
  beams.push({m,mat,corners:corners.map(c=>new THREE.Vector3(...c)),normal:new THREE.Vector3(...normal)});}
makeBeam([[-2.15,1.3,-2.5],[-1.05,1.3,-2.5],[-1.05,2.2,-2.5],[-2.15,2.2,-2.5]],[0,0,-1]);
makeBeam([[3.25,1.3,.5],[3.25,1.3,-.5],[3.25,2.2,-.5],[3.25,2.2,.5]],[1,0,0]);
const _B=[new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3(),new THREE.Vector3()];
export function updateBeams(sd,strength,col){
  for(const b of beams){const f=Math.max(0,b.normal.dot(sd))*strength;b.m.visible=f>.004&&sd.y>.02;if(!b.m.visible)continue;
    b.mat.uniforms.uInt.value=f;b.mat.uniforms.uCol.value.copy(col);
    for(let i=0;i<4;i++){const A=b.corners[i];const t=Math.min((A.y-.31)/sd.y,6);_B[i].copy(A).addScaledVector(sd,-t);}
    const pa=b.m.geometry.attributes.position;
    for(let q=0;q<4;q++){const i=q,j=(q+1)%4,o=q*4;
      pa.setXYZ(o,b.corners[i].x,b.corners[i].y,b.corners[i].z);pa.setXYZ(o+1,b.corners[j].x,b.corners[j].y,b.corners[j].z);
      pa.setXYZ(o+2,_B[j].x,_B[j].y,_B[j].z);pa.setXYZ(o+3,_B[i].x,_B[i].y,_B[i].z);}
    pa.needsUpdate=true;}}
// firewood basket next to it
for(let i=0;i<6;i++)add(new THREE.CylinderGeometry(.07,.07,.6,6).rotateZ(Math.PI/2),logMat,.15+(i%3)*.02,.42+Math.floor(i/3)*.14,-2.25+(i%3)*.15);
BOXES.push([-.25,.5,-2.5,-1.85]);

// ---------- couch with furs (left wall) ----------
const sofa=std(0x3c4a32,{roughness:1}),sofaDark=std(0x2c3624,{roughness:1});
const CX=-2.8,CZ=-.3;
add(new THREE.BoxGeometry(.95,.42,2.4),sofaDark,CX,.52,CZ);
add(new THREE.BoxGeometry(.28,.75,2.4),sofa,-3.1,1.05,CZ);
[-1.25,1.25].forEach(dz=>add(new THREE.BoxGeometry(.95,.62,.22),sofa,CX,.85,CZ+dz));
[-.56,.56].forEach(dz=>{add(new THREE.BoxGeometry(.78,.16,1.08),sofa,CX+.04,.81,CZ+dz);
  const bc=add(new THREE.BoxGeometry(.2,.5,1.02),sofa,-2.9,1.13,CZ+dz);bc.rotation.z=-.18;});
BOXES.push([-3.3,-2.28,-1.75,1.15]);
// pelts
function peltShape(sx,sy){const sh=new THREE.Shape();const N=48;
  for(let i=0;i<=N;i++){const a=i/N*Math.PI*2;let r=1+.05*Math.sin(a*7);
    [Math.PI/4,3*Math.PI/4,5*Math.PI/4,7*Math.PI/4].forEach(c=>{const d=Math.atan2(Math.sin(a-c),Math.cos(a-c));r+=.42*Math.exp(-d*d*28);});
    r+=.3*Math.exp(-Math.pow(Math.atan2(Math.sin(a+Math.PI/2),Math.cos(a+Math.PI/2)),2)*40);
    const x=Math.cos(a)*r*sx*.5,y=Math.sin(a)*r*sy*.5;i?sh.lineTo(x,y):sh.moveTo(x,y);}
  return new THREE.ShapeGeometry(sh,2);}
function pelt(tex,sx,sy,parent){const m=new THREE.Mesh(peltShape(sx,sy),std(0xffffff,{map:tex,roughness:1,side:THREE.DoubleSide}));m.receiveShadow=true;parent.add(m);return m;}
const wallPelts=[[FUR_BROWN,1.0,1.25,-1.35,2.05,.08],[FUR_CREAM,1.25,1.6,-.25,2.1,0],[FUR_GREY,.95,1.2,.85,2.0,-.1]];
wallPelts.forEach(w=>{const m=pelt(w[0],w[1],w[2],cabin);m.position.set(-3.23,w[4],w[3]);m.rotation.set(0,Math.PI/2,w[5]);});
const throwFur=pelt(FUR_CREAM,.9,1.1,cabin);throwFur.position.set(-2.6,.9,CZ+.65);throwFur.rotation.set(-Math.PI/2,0,.4);
const rug=pelt(FUR_BROWN,2.0,2.6,cabin);rug.position.set(.4,.32,-.4);rug.rotation.set(-Math.PI/2,0,1.45);
// side table with lantern
add(new THREE.BoxGeometry(.5,.05,.5),std(0x6b4a2c),-2.85,.88,1.45);
[[-.2,-.2],[.2,-.2],[-.2,.2],[.2,.2]].forEach(o=>add(new THREE.BoxGeometry(.05,.55,.05),std(0x5a3d24),-2.85+o[0],.6,1.45+o[1]));
add(new THREE.CylinderGeometry(.09,.11,.22,8),std(0x2e2a26,{metalness:.5,roughness:.5}),-2.85,1.02,1.45);
const lanternGlow=new THREE.Mesh(new THREE.SphereGeometry(.06,8,6),new THREE.MeshBasicMaterial({color:0xffc070}));lanternGlow.position.set(-2.85,1.19,1.45);add(new THREE.ConeGeometry(.1,.1,8),std(0x2e2a26,{metalness:.5,roughness:.5}),-2.85,1.3,1.45);cabin.add(lanternGlow);
export const lanternLight=new THREE.PointLight(0xffb060,.6,6,2);lanternLight.position.set(-2.85,1.35,1.45);scene.add(lanternLight);
BOXES.push([-3.15,-2.55,1.15,1.75]);
// a small shelf with jars on the right wall
add(new THREE.BoxGeometry(.3,.05,1.4),std(0x5c3a22),3.1,1.9,-1.6);
[[-.45,0x8a6a3a],[-.15,0x6a7a52],[.15,0xb08850],[.45,0x7a4a3a]].forEach(j=>add(new THREE.CylinderGeometry(.07,.07,.2,8),std(j[1],{roughness:.5}),3.1,2.03,-1.6+j[0]));
