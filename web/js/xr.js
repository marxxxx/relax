// VR mode (WebXR) for phone-in-headset viewers (Cardboard): head rotation only, one button (tap).
// Look at the ground + tap = jump there; look ahead / up + tap = next viewpoint. No post pass in VR (post.js useBuiltIn).
import {$,clamp} from './util.js';
import {renderer,scene,camera,rig} from './renderer.js';
import {useBuiltIn} from './post.js';
import {player,setMode} from './controls.js';
import {blocked,floorAt} from './collision.js';
import {SEA,FIRE,LAKE,GULLY,SUMMITS,coastEdge} from './world.js';
import {BALC,UF} from './house.js';
import {FPX,FPZ} from './interior.js';
import {soundIsOn} from './audio.js';
import {state} from './state.js';

const EYE=1.62,MAXT=30,FADE=.2;   // 'local' reference space: its origin is the head at session start
const btn=$('vrBtn');
let session=null,ryaw=0;           // rig yaw: turns the headset's "forward" onto the world

// ---------- viewpoints: [name, x, z, look-at x, look-at z, storey hint y] ----------
const VIEWS=[
  ['Veranda',.5,4.6,5.5,14],
  ['Lagerfeuer',3,9.8,FIRE.x,FIRE.z],
  ['Seeufer',LAKE.x-12,LAKE.z+12,LAKE.x+6,LAKE.z-6],
  ['Gipfel',SUMMITS[0][0],SUMMITS[0][1],0,0],
  ['Klippe',coastEdge(-6)+4,-6,coastEdge(-6)-100,-6],
  ['Strand',GULLY[4][0]-4,GULLY[4][1],-300,GULLY[4][1]],
  ['Balkon',(BALC.x0+BALC.x1)/2,0,-100,0,UF],
  ['Stube',-1.5,.6,FPX,FPZ],
];
let vi=-1;
const flatAt=(x,z,y)=>Math.abs(floorAt(x+.4,z,y)-floorAt(x-.4,z,y))+Math.abs(floorAt(x,z+.4,y)-floorAt(x,z-.4,y))<.9;
const okAt=(x,z,y)=>y>SEA+.25&&!blocked(x,z,y)&&flatAt(x,z,y);
// nearest free spot around (x,z), rings of .5 m
function spot(x,z,y0){
  for(let ring=0;ring<=8;ring++){const n=ring?8*ring:1;
    for(let k=0;k<n;k++){const a=k/n*6.283,xx=x+Math.cos(a)*ring*.5,zz=z+Math.sin(a)*ring*.5,y=floorAt(xx,zz,y0);
      if(okAt(xx,zz,y))return [xx,zz,y];}}
  return null;}

// ---------- gaze helpers: centre dot, target ring, fade sphere, text label ----------
const mk=(geo,col,o,parent)=>{const m=new THREE.Mesh(geo,new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:o,depthTest:false,depthWrite:false,fog:false,toneMapped:false}));
  m.renderOrder=990;m.frustumCulled=false;m.visible=false;parent.add(m);return m;};
const dot=mk(new THREE.CircleGeometry(.007,12),0xffffff,.75,camera);dot.position.z=-1;
const ring=mk(new THREE.RingGeometry(.17,.25,32).rotateX(-Math.PI/2),0xffffff,.85,scene);
const veil=mk(new THREE.SphereGeometry(.25,16,8),0x000000,0,camera);veil.material.side=THREE.BackSide;veil.renderOrder=1000;
const lc=document.createElement('canvas');lc.width=1024;lc.height=256;const lx=lc.getContext('2d');
const ltex=new THREE.CanvasTexture(lc);ltex.encoding=THREE.sRGBEncoding;
const label=mk(new THREE.PlaneGeometry(1.6,.4),0xffffff,1,camera);label.material.map=ltex;label.position.set(0,-.45,-2.2);
let lText=null,msgT=0;
function say(t,dur){msgT=dur;if(t===lText)return;lText=t;
  const L=t.split('\n');lx.clearRect(0,0,1024,256);lx.font='600 46px Karla, system-ui, sans-serif';
  const w=Math.min(1016,Math.max(...L.map(s=>lx.measureText(s).width))+72),h=L.length*62+40,y0=(256-h)/2;
  lx.fillStyle='rgba(16,20,19,.7)';lx.beginPath();lx.roundRect?lx.roundRect(512-w/2,y0,w,h,32):lx.rect(512-w/2,y0,w,h);lx.fill();
  lx.fillStyle='#f3efe4';lx.textAlign='center';lx.textBaseline='middle';L.forEach((s,i)=>lx.fillText(s,512,y0+20+31+i*62));
  ltex.needsUpdate=true;}

// ---------- teleport with a short fade to black ----------
let fade=0,fd=0,pend=null;
const eul=new THREE.Euler();
const headYaw=()=>eul.setFromQuaternion(camera.quaternion,'YXZ').y;   // head yaw inside the rig
function go(p,yaw,name){if(fd>0)return;pend={p,yaw,name};fd=1;}
function arrive(){const {p,yaw,name}=pend;pend=null;player.x=p[0];player.z=p[1];player.y=p[2];
  if(yaw!==undefined)ryaw=yaw-headYaw();   // face the view's subject from wherever the head points now
  if(name)say(name,3);}
function nextView(){for(let i=0;i<VIEWS.length;i++){vi=(vi+1)%VIEWS.length;const v=VIEWS[vi],p=spot(v[1],v[2],v[5]||0);
  if(p)return go(p,Math.atan2(p[0]-v[3],p[1]-v[4]),v[0]);}}

// ---------- gaze ray against the floor (terrain, storeys) ----------
const eye=new THREE.Vector3(),dir=new THREE.Vector3(),hit=new THREE.Vector3();
let aim=0;   // 0 nothing (sky / far), 1 free ground, 2 ground but not walkable
function gaze(){camera.getWorldPosition(eye);camera.getWorldDirection(dir);
  if(dir.y>-.06)return 0;
  const fl=t=>eye.y+dir.y*t-floorAt(eye.x+dir.x*t,eye.z+dir.z*t,player.y);
  let a=0,t=.3;
  while(fl(t)>0){a=t;t+=.25+t*.05;if(t>MAXT)return 0;}
  for(let i=0;i<6;i++){const m=(a+t)/2;if(fl(m)>0)a=m;else t=m;}
  hit.set(eye.x+dir.x*t,0,eye.z+dir.z*t);hit.y=floorAt(hit.x,hit.z,player.y);
  return okAt(hit.x,hit.z,hit.y)?1:2;}
export function onSelect(){if(fd)return;   // also the debug handle's vrTap()
  if(aim===1)go([hit.x,hit.z,hit.y]);
  else if(aim===0)nextView();}

// ---------- per frame (after updateCamera: the rig follows the player) ----------
export function updateXR(dt){
  if(!state.xr)return;
  if(fd){fade=clamp(fade+fd*dt/FADE,0,1);if(fd>0&&fade>=1){if(pend)arrive();fd=-1;}else if(fd<0&&fade<=0)fd=0;}
  rig.position.set(player.x,player.y+EYE,player.z);rig.rotation.y=ryaw;
  player.yaw=ryaw+headYaw();   // keyboard walking (Bluetooth) follows the gaze
  aim=fd?0:gaze();
  ring.visible=aim>0;
  if(aim){ring.position.set(hit.x,hit.y+.04,hit.z);ring.scale.setScalar(1+eye.distanceTo(hit)*.04);
    ring.material.color.setHex(aim===1?0xffffff:0xff6a55);ring.material.opacity=aim===1?.85:.5;}
  veil.visible=fade>0;veil.material.opacity=fade;
  msgT-=dt;label.visible=msgT>0;dot.visible=true;
}

// ---------- session ----------
function enter(){
  if(state.mode!=='fp')setMode('fp');state.rider=null;state.watch=null;
  ryaw=player.yaw;rig.add(camera);camera.position.set(0,0,0);camera.rotation.set(0,0,0);
  state.xr=true;useBuiltIn(true);renderer.compile(scene,camera);   // all programs now, not as hitches in the headset
  fade=1;fd=-1;say('Boden anschauen + tippen: dorthin springen\nGeradeaus schauen + tippen: nächster Ort',8);
  btn.textContent='VR beenden';}
function leave(){
  player.yaw=ryaw+headYaw();player.pitch=0;rig.remove(camera);
  state.xr=false;session=null;useBuiltIn(false);renderer.xr.enabled=false;
  for(const m of [dot,ring,veil,label])m.visible=false;fade=fd=0;pend=null;
  btn.textContent='VR';dispatchEvent(new Event('resize'));}
renderer.xr.addEventListener('sessionstart',enter);
renderer.xr.addEventListener('sessionend',leave);

if(navigator.xr)navigator.xr.isSessionSupported('immersive-vr').then(ok=>{btn.hidden=!ok;},()=>{});
btn.addEventListener('click',()=>{
  if(session){session.end();return;}
  if(!soundIsOn())$('soundBtn').click();   // no way to switch sound on inside the headset
  navigator.xr.requestSession('immersive-vr').then(s=>{session=s;s.addEventListener('select',onSelect);
    renderer.xr.enabled=true;renderer.xr.setReferenceSpaceType('local');return renderer.xr.setSession(s);})
  .catch(e=>{console.warn('VR:',e);session=null;renderer.xr.enabled=false;
    const h=$('hint');h.textContent='VR konnte nicht gestartet werden.';h.classList.remove('gone');setTimeout(()=>h.classList.add('gone'),4000);});
});
