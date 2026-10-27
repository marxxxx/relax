// Camera control: orbit view (drag / pinch / wheel) and first-person walking (keys / joystick).
import {$,clamp} from './util.js';
import {canvas,camera} from './renderer.js';
import {heightAt} from './world.js';
import {blocked,tooSteep,floorAt,isInside} from './collision.js';
import {state} from './state.js';

// ---------- camera control ----------
export const target=new THREE.Vector3(2,3.6,2.5);
let az=.95,pol=1.5,dist=25,tAz=az,tPol=pol,tDist=dist,idle=0;
const pointers=new Map();let pinch0=0,dist0=0;
export const player={x:0,z:8.5,y:0,yaw:0,pitch:-.05,bob:0};
const keys={};let joyX=0,joyY=0;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});idle=0;hideHint();
  if(pointers.size===2){const [a,b]=[...pointers.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y);dist0=tDist;}});
canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;idle=0;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(state.mode==='fp'){const k=e.pointerType==='touch'?.0065:.0042;player.yaw-=dx*k;player.pitch=clamp(player.pitch-dy*k,-1.35,1.35);}
  else if(pointers.size===1){tAz-=dx*.006;tPol=clamp(tPol-dy*.005,.35,1.5);}
  p.x=e.clientX;p.y=e.clientY;
  if(state.mode==='orbit'&&pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0>0)tDist=clamp(dist0*pinch0/d,7,80);}});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(state.mode==='fp')return;idle=0;hideHint();tDist=clamp(tDist*(1+Math.sign(e.deltaY)*.1),7,80);},{passive:false});

addEventListener('keydown',e=>{if(e.target&&e.target.type==='range')return;keys[e.code]=true;
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
export function setMode(m){
  state.mode=m;document.body.classList.toggle('fp',m==='fp');
  $('modeBtn').textContent=m==='fp'?'Rundblick':'Hineingehen';
  $('modeBtn').setAttribute('aria-pressed',m==='fp');
  if(m==='fp'){player.x=0;player.z=8.5;player.yaw=0;player.pitch=-.05;player.y=floorAt(0,8.5);camera.near=.05;
    const h=$('hint');h.textContent=touchUI?'Links mit dem Joystick gehen, rechts ziehen zum Umsehen':'W A S D zum Gehen, Shift zum Laufen, Ziehen zum Umsehen';h.classList.remove('gone');setTimeout(hideHint,7000);}
  else{camera.near=.1;target.set(2,3.6,2.5);}
  camera.updateProjectionMatrix();}
$('modeBtn').addEventListener('click',()=>setMode(state.mode==='fp'?'orbit':'fp'));

function hideHint(){$('hint').classList.add('gone');}
setTimeout(hideHint,7000);

export function updateCamera(dt){
  if(state.mode==='fp'){
    let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joyY;
    let r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joyX;
    const m=Math.hypot(f,r);if(m>1){f/=m;r/=m;}
    const sp=(keys.ShiftLeft||keys.ShiftRight||Math.hypot(joyX,joyY)>.95?4.6:2.4)*dt;
    const sy_=Math.sin(player.yaw),cy=Math.cos(player.yaw);
    const mx=(-sy_*f+cy*r)*sp,mz=(-cy*f-sy_*r)*sp;
    const py=player.y;
    if(!blocked(player.x+mx,player.z,py)&&!tooSteep(player.x,player.z,player.x+mx,player.z,py))player.x+=mx;
    if(!blocked(player.x,player.z+mz,py)&&!tooSteep(player.x,player.z,player.x,player.z+mz,py))player.z+=mz;
    const moving=Math.hypot(mx,mz)>1e-4;if(moving)player.bob+=Math.hypot(mx,mz)*3.2;
    const fy=floorAt(player.x,player.z,player.y);player.y+=(fy-player.y)*Math.min(1,dt*12);
    camera.rotation.order='YXZ';camera.rotation.set(player.pitch,player.yaw,0);
    camera.position.set(player.x,player.y+1.62+Math.sin(player.bob)*.03*(moving?1:0),player.z);
    target.set(player.x,player.y+1.6,player.z);
  }else{
  idle+=dt;if(idle>12)tAz+=dt*.025;
  az+=(tAz-az)*Math.min(1,dt*6);pol+=(tPol-pol)*Math.min(1,dt*6);dist+=(tDist-dist)*Math.min(1,dt*5);
  camera.position.set(target.x+dist*Math.sin(pol)*Math.sin(az),target.y+dist*Math.cos(pol),target.z+dist*Math.sin(pol)*Math.cos(az));
  const gh=heightAt(camera.position.x,camera.position.z)+1.2;if(camera.position.y<gh)camera.position.y=gh;
  camera.lookAt(target);
  }
  state.indoor+=((state.mode==='fp'&&isInside(player.x,player.z)?1:0)-state.indoor)*Math.min(1,dt*2.5);
}
