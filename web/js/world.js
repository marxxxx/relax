// Terrain height field and landmarks: lake, campfire, coast, trail, ravine and the paths up to the summits.
import {clamp,smooth,fbm} from './util.js';

export const LAKE={x:30,z:-24,r:13};
export const FIRE=new THREE.Vector3(5.5,0,7);
// ---- coast: to the west the plateau breaks off as a cliff down to a beach and the sea
export const SEA=-24;
export function coastEdge(z){return -62+6*Math.sin(z*.03)+4*Math.sin(z*.083+2);}
function baseHeight(x,z){
  const r=Math.hypot(x,z),dx=x-coastEdge(z);
  let h=(fbm(x*.012+10,z*.012+3)-.5)*16*(.35+.65*smooth(0,45,dx));
  h+=Math.pow(Math.max(0,r-120),1.45)*.017*(.5+fbm(x*.018+4,z*.018))*smooth(-30,40,dx);
  h*=smooth(13,44,r);
  h-=8*(1-smooth(0,48,dx));          // the land slopes gently toward the edge, so the sea is visible
  const lr=Math.hypot(x-LAKE.x,z-LAKE.z);
  const lk=1-smooth(LAKE.r*.45,LAKE.r*1.35,lr);
  h=h*(1-lk)+(-2.4)*lk;
  // cliff: land above, beach and seabed below
  const beach=SEA+1.4+(fbm(x*.08,z*.08)-.5)*.8-Math.max(0,-dx-12)*.32;
  const k=smooth(-9.5,-1,dx);
  const crag=(fbm(z*.22+7,x*.22)-.5)*5*k*(1-k)*4;
  return Math.max(SEA-14,beach*(1-k)+h*k+crag);
}
// a trail from the clearing to the edge, then a path down a ravine to the beach
const TRAIL=[[-4.6,4.5],[-14,7.5],[-25,6.5]];
export const GULLY=(()=>{const pts=[[coastEdge(4)+27,4],[coastEdge(15)+13,15],[coastEdge(24)+4,24],[coastEdge(31)-5,31],[coastEdge(37)-13,37]];
  let L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const h0=baseHeight(pts[0][0],pts[0][1]),h1=SEA+1.3,tot=L[L.length-1];
  return pts.map((p,i)=>[p[0],p[1],h0+(h1-h0)*Math.pow(L[i]/tot,.9)]);})();
TRAIL.push([GULLY[0][0],GULLY[0][1]]);
function onPoly(px,pz,P){let best=1e9,bh=0;
  for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],vx=b[0]-a[0],vz=b[1]-a[1];
    const t=clamp(((px-a[0])*vx+(pz-a[1])*vz)/(vx*vx+vz*vz),0,1);const d=Math.hypot(px-a[0]-vx*t,pz-a[1]-vz*t);
    if(d<best){best=d;bh=a.length>2?a[2]+(b[2]-a[2])*t:0;}}
  return [best,bh];}

// ---------- paths from the clearing up into the mountains behind the house ----------
// control points of three trails (north, north-east, east); each is extended to the highest summit in its direction
function summitNear(a0){
  let best=null,bh=-1e9;
  for(let r=215;r<=298;r+=1.5){
    const x=Math.cos(a0)*r,z=Math.sin(a0)*r;
    if(x-coastEdge(z)<50)continue;                       // stay clear of the coast
    const h=(baseHeight(x,z)+baseHeight(x+4,z+4)+baseHeight(x-4,z-4))/3;
    if(h>bh){bh=h;best=[x,z];}}
  return best;}
const TRAIL_CTRL=[
  [[12,10],[6,-6],[-2,-24],[-8,-46],[-13,-70],[-15,-96],[-12,-122],[-8,-148],[-5,-174],[-3,-200]],
  [[16,4],[26,-2],[38,-6],[50,-12],[62,-22],[78,-36],[96,-50],[116,-66],[138,-84],[160,-104],[182,-126]],
  [[10,14],[22,24],[38,34],[58,46],[80,58],[104,72],[130,88],[156,106],[182,126]],
];
export const SUMMITS=[];
export const MTRAILS=TRAIL_CTRL.map(ctrl=>{
  const s=summitNear(Math.atan2(ctrl[ctrl.length-1][1],ctrl[ctrl.length-1][0]));
  const pts=s?ctrl.concat([s]):ctrl.slice();
  // densify to ~5 m steps
  const P=[];
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/5));
    for(let k=i===1?0:1;k<=n;k++)P.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  // the trail follows the terrain but never gets steeper than 1:2, so it stays walkable
  const H=P.map(p=>baseHeight(p[0],p[1]));
  for(let pass=0;pass<2;pass++)for(let i=1;i<H.length-1;i++)H[i]=(H[i-1]+2*H[i]+H[i+1])/4;
  for(let pass=0;pass<3;pass++){
    for(let i=1;i<H.length;i++){const m=.5*Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);H[i]=clamp(H[i],H[i-1]-m,H[i-1]+m);}
    for(let i=H.length-2;i>=0;i--){const m=.5*Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1]);H[i]=clamp(H[i],H[i+1]-m,H[i+1]+m);}}
  const T=P.map((p,i)=>[p[0],p[1],H[i]]);
  SUMMITS.push([P[P.length-1][0],P[P.length-1][1],H[H.length-1]]);
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const p of P){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<z0)z0=p[1];if(p[1]>z1)z1=p[1];}
  return {pts:T,x0:x0-12,x1:x1+12,z0:z0-12,z1:z1+12};});

export function heightAt(x,z){
  let h=baseHeight(x,z);
  if(x<=-20&&x>=-95&&z>=-10&&z<=52){const [d,hp]=onPoly(x,z,GULLY);if(d<=10)h=hp+(h-hp)*smooth(2.1,9,d);}
  for(const t of MTRAILS){if(x<t.x0||x>t.x1||z<t.z0||z>t.z1)continue;
    const [d,hp]=onPoly(x,z,t.pts);if(d<9)h=hp+(h-hp)*smooth(2,8,d);}
  return h;}
export const pathDist=(x,z)=>{
  let m=Math.min(onPoly(x,z,TRAIL)[0],onPoly(x,z,GULLY)[0]);
  for(const t of MTRAILS){if(x<t.x0||x>t.x1||z<t.z0||z>t.z1)continue;
    const d=onPoly(x,z,t.pts)[0];if(d<m)m=d;}
  return m;};
