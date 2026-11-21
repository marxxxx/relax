// Camera control: orbit view (drag / pinch / wheel) and first-person walking (keys / joystick).
import {$,clamp,lerp,smooth} from './util.js';
import {canvas,camera} from './renderer.js';
import {heightAt,SEA} from './world.js';
import {blocked,tooSteep,floorAt,isInside,WALK_R} from './collision.js';
import {state,cur} from './state.js';
import {setPanel} from './ui.js';

// ---------- camera control ----------
export const target=new THREE.Vector3(2,4.6,2.5);
const HOME=target.clone(),HOFF=HOME.y-heightAt(HOME.x,HOME.z),tTgt=HOME.clone(),PANR=700;
let az=.95,pol=1.5,dist=25,tAz=az,tPol=pol,tDist=dist,idle=0,lastTap=0;
const pointers=new Map();let pinch0=0,dist0=0;
export const player={x:0,z:8.5,y:0,yaw:0,pitch:-.05,bob:0};
// transition when entering fp from the orbit view: the camera drops from its current position to eye level
const drop={on:false,t:0,dur:1,from:new THREE.Vector3(),to:new THREE.Vector3(),yaw0:0,pitch0:0};
// nearest walkable spot to a panned-to position (out of the lake, off trees/rocks, not in the sea, inside the walk radius)
function findGround(x,z){
  const r=Math.hypot(x,z);if(r>WALK_R){x*=WALK_R/r;z*=WALK_R/r;}
  const ok=(x,z)=>{const y=floorAt(x,z);return heightAt(x,z)>SEA+.25&&!blocked(x,z,y);};
  if(ok(x,z))return[x,z];
  for(let ring=1;ring<=14;ring++){const rr=ring*1.5;
    for(let k=0;k<8*ring;k++){const a=k/(8*ring)*6.283,xx=x+Math.cos(a)*rr,zz=z+Math.sin(a)*rr;
      if(ok(xx,zz))return[xx,zz];}}
  return[0,8.5];}
const camP=new THREE.Vector3();
const keys={};let joyX=0,joyY=0;
// ride input: drag turns the animal (turn, consumed by animals.js) and tilts the view / flight pitch; tap = jump
export const rideCtl={turn:0,pitch:0,jump:false};
export function moveAxes(){
  let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joyY,r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joyX;
  const m=Math.hypot(f,r);if(m>1){f/=m;r/=m;}
  return {f,r,run:!!(keys.ShiftLeft||keys.ShiftRight)||Math.hypot(joyX,joyY)>.95,up:(keys.Space||keys.KeyE?1:0)-(keys.KeyQ||keys.KeyC?1:0)};}
const minD=()=>state.watch?1.2:9;   // orbit zoom: much closer when watching an animal
// screen drag (px) -> move the orbit target across the ground, map style
function pan(dx,dy){state.watch=null;const k=tDist*1.04/innerHeight,s=Math.sin(az),c=Math.cos(az);
  tTgt.x-=(c*dx+s*dy)*k;tTgt.z-=(-s*dx+c*dy)*k;
  const r=Math.hypot(tTgt.x,tTgt.z);if(r>PANR){tTgt.x*=PANR/r;tTgt.z*=PANR/r;}}
function goHome(){state.watch=null;tTgt.copy(HOME);}
const mid=()=>{let x=0,y=0;for(const p of pointers.values()){x+=p.x;y+=p.y;}return {x:x/pointers.size,y:y/pointers.size};};
const pinchStart=()=>{const [a,b]=[...pointers.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y);dist0=tDist;};
canvas.addEventListener('contextmenu',e=>e.preventDefault());
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);idle=0;hideHint();
  pointers.set(e.pointerId,{x:e.clientX,y:e.clientY,mv:0,t:performance.now()});
  if(pointers.size===2)pinchStart();
  if(pointers.size===1&&state.mode==='orbit'&&e.pointerType==='touch'){const t=performance.now();if(t-lastTap<300)goHome();lastTap=t;}});
canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;idle=0;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;if(dx||dy)lastTap=0;p.mv+=Math.abs(dx)+Math.abs(dy);
  if(state.mode==='fp'){const k=e.pointerType==='touch'?.0065:.0042;
    if(state.rider){rideCtl.turn-=dx*k;rideCtl.pitch=clamp(rideCtl.pitch-dy*k,-1.1,1.1);}
    else{player.yaw-=dx*k;player.pitch=clamp(player.pitch-dy*k,-1.35,1.35);}p.x=e.clientX;p.y=e.clientY;return;}
  if(pointers.size===1){if(e.buttons&2||e.shiftKey)pan(dx,dy);else{tAz-=dx*.006;tPol=clamp(tPol-dy*.005,.08,1.5);}p.x=e.clientX;p.y=e.clientY;return;}
  if(pointers.size===2){const m0=mid();p.x=e.clientX;p.y=e.clientY;const m1=mid();pan(m1.x-m0.x,m1.y-m0.y);
    const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0>0)tDist=clamp(dist0*pinch0/d,minD(),220);}});
const ptrEnd=e=>{const p=pointers.get(e.pointerId);if(!p)return;pointers.delete(e.pointerId);
  if(e.type==='pointerup'&&state.rider&&p.mv<8&&performance.now()-p.t<300)rideCtl.jump=true;   // short tap while riding = jump
  pinch0=0;if(pointers.size===2)pinchStart();};
for(const t of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(t,ptrEnd);
canvas.addEventListener('dblclick',()=>{if(state.mode==='orbit')goHome();});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(state.mode==='fp')return;idle=0;hideHint();tDist=clamp(tDist*(1+Math.sign(e.deltaY)*.1),minD(),220);},{passive:false});

addEventListener('keydown',e=>{if(e.code==='Escape'&&(state.rider||state.mode==='fp'))setMode('orbit');   // detach from the animal (or leave fp) -> orbit, camera stays on the animal via state.watch — also works while a slider has focus
  if(e.target&&e.target.type==='range')return;keys[e.code]=true;
  if(state.mode==='fp'&&/^(Arrow|Space)/.test(e.code))e.preventDefault();});
addEventListener('keyup',e=>{keys[e.code]=false;});
addEventListener('blur',()=>{for(const k in keys)keys[k]=false;});
const joy=$('joy'),joyKnob=$('joyKnob');let joyId=null;
function joyMove(e){const r=joy.getBoundingClientRect();let dx=e.clientX-(r.left+r.width/2),dy=e.clientY-(r.top+r.height/2);
  const m=Math.hypot(dx,dy),max=r.width*.38;if(m>max){dx*=max/m;dy*=max/m;}
  joyX=dx/max;joyY=dy/max;joyKnob.style.transform=`translate(${dx}px,${dy}px)`;}
joy.addEventListener('pointerdown',e=>{joyId=e.pointerId;joy.setPointerCapture(e.pointerId);joyMove(e);hideHint();});
joy.addEventListener('pointermove',e=>{if(e.pointerId===joyId)joyMove(e);});
const joyEnd=e=>{if(e.pointerId!==joyId)return;joyId=null;joyX=joyY=0;joyKnob.style.transform='';};
joy.addEventListener('pointerup',joyEnd);joy.addEventListener('pointercancel',joyEnd);


const touchUI=matchMedia('(pointer:coarse)').matches;
let panelWasMin=false;
export function setMode(m){
  const prev=state.mode,bc=document.body.classList;
  if(m==='fp'&&prev!=='fp'){panelWasMin=bc.contains('panelMin');setPanel(true);}   // walking/riding: fold the panel away, restore it on return
  else if(m!=='fp'&&prev==='fp')setPanel(panelWasMin);
  state.mode=m;document.body.classList.toggle('fp',m==='fp');
  $('modeBtn').textContent=m==='fp'?'Rundblick':'First-Person';
  $('modeBtn').setAttribute('aria-pressed',m==='fp');
  if(m==='fp'){state.rider=null;state.watch=null;
    // start where the orbit view is currently looking (panned/zoomed position), else at the porch
    const g=prev==='orbit'?findGround(tTgt.x,tTgt.z):[0,8.5];
    player.x=g[0];player.z=g[1];player.y=floorAt(player.x,player.z);
    const e=new THREE.Euler().setFromQuaternion(camera.quaternion,'YXZ');   // keep looking the same way while dropping down
    player.yaw=e.y;player.pitch=clamp(e.x,-.85,.35);
    drop.from.copy(camera.position);drop.to.set(player.x,player.y+1.62,player.z);
    drop.yaw0=e.y;drop.pitch0=e.x;drop.t=0;drop.dur=clamp(drop.from.distanceTo(drop.to)/70,.7,1.6);drop.on=true;
    camera.near=.05;
    const h=$('hint');h.textContent=touchUI?'Links mit dem Joystick gehen, rechts ziehen zum Umsehen – die Steinmänner weisen zu den Gipfeln':'W A S D zum Gehen, Shift zum Laufen, Ziehen zum Umsehen – die Steinmänner weisen zu den Gipfeln';h.classList.remove('gone');setTimeout(hideHint,7000);}
  else{camera.near=.1;
    if(state.rider){state.watch=state.rider;state.rider=null;const p=state.watch.g.position;   // leave ride view: orbit keeps watching the animal
      tTgt.set(p.x,state.watch.x!==undefined?p.y+.8:p.y,p.z);tDist=clamp(tDist,3,10);}
    else if(!state.watch){tTgt.set(player.x,Math.max(heightAt(player.x,player.z),SEA)+HOFF,player.z);target.copy(tTgt);}}   // leave fp where you stand
  camera.updateProjectionMatrix();}
$('modeBtn').addEventListener('click',()=>setMode(state.mode==='fp'?'orbit':'fp'));

function hideHint(){$('hint').classList.add('gone');}
setTimeout(hideHint,7000);

export function updateCamera(dt){
  const g=Math.max(0,cur.wind-1)*1.6; // sturm gusts shake the camera
  if(state.mode==='fp'){
    if(joy.style.display!=='')joy.style.display='';
    if(state.rider){   // ride view: camera glued to the animal's head, the animal is steered in animals.js
      const r=state.rider,an=r.anchor||r.g,fly=r.kind==='bird'||r.kind==='gull';
      an.updateWorldMatrix(true,false);
      camP.set(r.eyeOff.x,r.eyeOff.y,r.eyeOff.z).applyMatrix4(an.matrixWorld);
      camera.rotation.order='YXZ';
      const bp=-(an.rotation.x||0)*(r.kind==='dolphin'&&!r.jump?.3:1);   // swim bob only lightly tilts the view
      camera.rotation.set(fly?rideCtl.pitch:clamp(bp-.03+rideCtl.pitch,-1.3,1.3),r.g.rotation.y+Math.PI,0);
      camera.position.copy(camP);target.copy(camP);
    }else{
    const {f,r,run}=moveAxes(),sp=(run?4.6:2.4)*dt;
    const sy_=Math.sin(player.yaw),cy=Math.cos(player.yaw);
    const mx=(-sy_*f+cy*r)*sp,mz=(-cy*f-sy_*r)*sp;
    const py=player.y;
    if(!drop.on&&!blocked(player.x+mx,player.z,py)&&!tooSteep(player.x,player.z,player.x+mx,player.z,py))player.x+=mx;
    if(!drop.on&&!blocked(player.x,player.z+mz,py)&&!tooSteep(player.x,player.z,player.x,player.z+mz,py))player.z+=mz;
    const moving=!drop.on&&Math.hypot(mx,mz)>1e-4;if(moving)player.bob+=Math.hypot(mx,mz)*3.2;
    const fy=floorAt(player.x,player.z,player.y);player.y+=(fy-player.y)*Math.min(1,dt*12);
    if(drop.on){   // camera falls from the orbit position down to eye level, then walking starts
      drop.t=Math.min(1,drop.t+dt/drop.dur);
      const e=smooth(0,1,drop.t);
      drop.to.set(player.x,player.y+1.62,player.z);
      camera.position.lerpVectors(drop.from,drop.to,e);
      camera.rotation.order='YXZ';
      camera.rotation.set(lerp(drop.pitch0,player.pitch,e),lerp(drop.yaw0,player.yaw,e),0);
      if(drop.t>=1)drop.on=false;
    }else{
      camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);
      camera.position.set(player.x,player.y+1.62+Math.sin(player.bob)*.03*(moving?1:0),player.z);}
    camera.position.x+=Math.sin(state.T*7.1)*g*.035;camera.position.y+=Math.sin(state.T*11.3+1.7)*g*.022;
    camera.rotation.z=Math.sin(state.T*5.9)*g*.014;
    target.set(player.x,player.y+1.6,player.z);
    }
  }else{
  idle+=dt;if(idle>12)tAz+=dt*.025;
  if(state.watch){if(!state.watch.g.visible)state.watch=null;   // orbit may keep watching the last ridden animal
    else{const p=state.watch.g.position;tTgt.set(p.x,state.watch.x!==undefined?p.y+.8:p.y,p.z);}}
  if(tDist<minD())tDist=minD();   // stopped watching -> ease back out to the normal minimum
  if(!state.watch)tTgt.y=Math.max(heightAt(tTgt.x,tTgt.z),SEA)+HOFF;target.lerp(tTgt,Math.min(1,dt*6));
  az+=(tAz-az)*Math.min(1,dt*6);pol+=(tPol-pol)*Math.min(1,dt*6);dist+=(tDist-dist)*Math.min(1,dt*5);
  camera.position.set(target.x+dist*Math.sin(pol)*Math.sin(az),target.y+dist*Math.cos(pol),target.z+dist*Math.sin(pol)*Math.cos(az));
  camera.position.x+=Math.sin(state.T*7.1)*g*.02;camera.position.y+=Math.sin(state.T*11.3+1.7)*g*.013;
  const gh=Math.max(heightAt(camera.position.x,camera.position.z),SEA)+(state.watch?.35:1.2);if(camera.position.y<gh)camera.position.y=gh;
  camera.lookAt(target);
  }
  state.indoor+=((state.mode==='fp'&&isInside(player.x,player.z)?1:0)-state.indoor)*Math.min(1,dt*2.5);
}
