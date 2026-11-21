// Terrain height field and landmarks: lake, campfire, coast, trail, ravine and the paths up to the summits.
import {clamp,smooth,fbm} from './util.js';

export const LAKE={x:30,z:-24,r:13};
export const FIRE=new THREE.Vector3(5.5,0,7);
// ---- coast: to the west the plateau breaks off as a cliff down to a beach and the sea
export const SEA=-24;
export function coastEdge(z){return -62+6*Math.sin(z*.03)+4*Math.sin(z*.083+2);}
function baseHeight(x,z){
  const r=Math.hypot(x,z),dx=x-coastEdge(z),ang=Math.atan2(z,x);
  let h=(fbm(x*.012+10,z*.012+3)-.5)*16*(.35+.65*smooth(0,45,dx));
  // the ring falls away beyond ~305; due east the fall is stretched into a wide pass
  const east=smooth(.35,1,Math.cos(ang));
  h+=Math.pow(Math.max(0,r-120),1.45)*.017*(.5+fbm(x*.018+4,z*.018))*smooth(-30,40,dx)*(1-smooth(305,395+90*east,r));
  h*=smooth(13,44,r);
  h-=8*(1-smooth(0,48,dx));          // the land slopes gently toward the edge, so the sea is visible
  const lr=Math.hypot(x-LAKE.x,z-LAKE.z);
  const lk=1-smooth(LAKE.r*.45,LAKE.r*1.35,lr);
  h=h*(1-lk)+(-2.4)*lk;
  // ---- far world beyond the mountains: wide plain, NE valley, outer ring (only r>310 and inland)
  const far=smooth(310,355,r)*smooth(20,60,dx);
  if(far>0){
    let fh=5.5+(fbm(x*.018+31,z*.018+13)-.5)*4;                              // the plain
    const vA=Math.cos(ang-.62);                                               // NE valley axis
    const vM=smooth(380,460,r)*smooth(660,520,r)*smooth(.3,.75,vA);
    fh-=4.5*vM*(.6+.8*fbm(x*.03+17,z*.03+5));                                 // valley floor
    const rg=smooth(400,480,r)*smooth(700,560,r);
    fh+=6*rg*(smooth(.6,.95,Math.cos(ang-1.45))+smooth(.6,.95,Math.cos(ang+.25)));  // flanking ridges
    const gap=1-smooth(.78,.96,Math.cos(ang));                                // outer ring, gap due east
    fh+=Math.pow(Math.max(0,r-615),1.4)*.05*(.55+.9*fbm(x*.013+9,z*.013+5))*gap;
    h=h*(1-far)+fh*far;}
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
function onPoly(px,pz,P){let best=1e9,bh=0,bd=0;
  for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],vx=b[0]-a[0],vz=b[1]-a[1];
    const t=clamp(((px-a[0])*vx+(pz-a[1])*vz)/(vx*vx+vz*vz),0,1);const d=Math.hypot(px-a[0]-vx*t,pz-a[1]-vz*t);
    if(d<best){best=d;bh=a.length>2?a[2]+(b[2]-a[2])*t:0;bd=a.length>3?a[3]+(b[3]-a[3])*t:0;}}
  return [best,bh,bd];}

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
// densify control points to ~5 m steps, then clamp the profile to <=1:2 so the trail stays walkable
function makeTrail(pts){
  const P=[];
  for(let i=1;i<pts.length;i++){const a=pts[i-1],b=pts[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/5));
    for(let k=i===1?0:1;k<=n;k++)P.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  const H=P.map(p=>baseHeight(p[0],p[1]));
  for(let pass=0;pass<2;pass++)for(let i=1;i<H.length-1;i++)H[i]=(H[i-1]+2*H[i]+H[i+1])/4;
  for(let pass=0;pass<3;pass++){
    for(let i=1;i<H.length;i++){const m=.5*Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]);H[i]=clamp(H[i],H[i-1]-m,H[i-1]+m);}
    for(let i=H.length-2;i>=0;i--){const m=.5*Math.hypot(P[i+1][0]-P[i][0],P[i+1][1]-P[i][1]);H[i]=clamp(H[i],H[i+1]-m,H[i+1]+m);}}
  const T=P.map((p,i)=>[p[0],p[1],H[i]]);
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
  for(const p of P){if(p[0]<x0)x0=p[0];if(p[0]>x1)x1=p[0];if(p[1]<z0)z0=p[1];if(p[1]>z1)z1=p[1];}
  return {pts:T,x0:x0-12,x1:x1+12,z0:z0-12,z1:z1+12};}
export const MTRAILS=TRAIL_CTRL.map(ctrl=>{
  const s=summitNear(Math.atan2(ctrl[ctrl.length-1][1],ctrl[ctrl.length-1][0]));
  const t=makeTrail(s?ctrl.concat([s]):ctrl.slice());
  const last=t.pts[t.pts.length-1];
  SUMMITS.push([last[0],last[1],last[2]]);
  return t;});

// ---------- the far world beyond the ring: rivers and the pass trail down to the yurt plain ----------
// control points; the bed follows the terrain downhill (never deeper than 1.4 m); the ford is a shallow crossing
const RIVER_CTRL=[
  {w:4.0,ford:5,pts:[[500,470],[468,382],[448,282],[432,172],[446,82],[482,22],[540,-28],[618,-42],[700,-34],[782,-18]]},  // main river, exits east
  {w:3.2,pts:[[560,-430],[505,-300],[472,-185],[474,-70],[480,-6]]},                                                     // from the SE ring, joins the main
  {w:2.8,pts:[[420,560],[402,470],[412,380],[442,262],[446,150]]},                                                        // through the NE valley, joins the main
];
function riverPts(c){
  const P=[];
  for(let i=1;i<c.pts.length;i++){const a=c.pts[i-1],b=c.pts[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.ceil(L/6));
    for(let k=i===1?0:1;k<=n;k++)P.push([a[0]+(b[0]-a[0])*k/n,a[1]+(b[1]-a[1])*k/n]);}
  let prev=1e9;const out=[];
  for(let i=0;i<P.length;i++){const bh0=baseHeight(P[i][0],P[i][1]);
    let s=Math.min(bh0-.2,prev-.12);s=Math.max(s,bh0-1.4);prev=s;    // water surface, downhill, max depth 1.4
    const nearFord=c.ford!==undefined&&Math.abs(i/(P.length-1)-c.ford/(c.pts.length-1))<.06;
    const dep=nearFord?.35:1.1;
    out.push([P[i][0],P[i][1],s-dep,dep]);}                           // [x,z,bed,depth]; water level = bed+depth-.35
  return out;}
export const RIVERS=RIVER_CTRL.map(c=>{const pts=riverPts(c);
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const p of pts){x0=Math.min(x0,p[0]);x1=Math.max(x1,p[0]);z0=Math.min(z0,p[1]);z1=Math.max(z1,p[1]);}
  return {pts,w:c.w,x0:x0-10,x1:x1+10,z0:z0-10,z1:z1+10};});
export const riverDist=(x,z)=>{let m=1e9;
  for(const R of RIVERS){if(x<R.x0||x>R.x1||z<R.z0||z>R.z1)continue;
    const d=onPoly(x,z,R.pts)[0];if(d<m)m=d;}
  return m;};
// [distance to the river, water level, water depth]
export const riverAt=(x,z)=>{let best=1e9,bw=0,bd=1.1;
  for(const R of RIVERS){if(x<R.x0||x>R.x1||z<R.z0||z>R.z1)continue;
    const [d,bh,dep]=onPoly(x,z,R.pts);if(d<best){best=d;bw=bh+dep-.35;bd=dep;}}
  return [best,bw,bd];};
// the pass: from the ring's east edge down to the yurt camp (blended only for r>298, the old world stays untouched)
export const FAR_TRAIL=makeTrail([[302,4],[330,8],[368,12],[408,16],[446,18],[468,16]]);

export function heightAt(x,z){
  let h=baseHeight(x,z);
  if(x<=-20&&x>=-95&&z>=-10&&z<=52){const [d,hp]=onPoly(x,z,GULLY);if(d<=10)h=hp+(h-hp)*smooth(2.1,9,d);}
  for(const t of MTRAILS){if(x<t.x0||x>t.x1||z<t.z0||z>t.z1)continue;
    const [d,hp]=onPoly(x,z,t.pts);if(d<9)h=hp+(h-hp)*smooth(2,8,d);}
  const r=Math.hypot(x,z);
  if(r>298){const [d,hp]=onPoly(x,z,FAR_TRAIL.pts);if(d<9)h=hp+(h-hp)*smooth(2,8,d)*smooth(300,312,r);}
  for(const R of RIVERS){if(x<R.x0||x>R.x1||z<R.z0||z>R.z1)continue;   // carve the river channels
    const [d,bh]=onPoly(x,z,R.pts);const k=1-smooth(R.w,R.w+5,d);
    if(k>0)h=h*(1-k)+Math.min(h,bh)*k;}
  return h;}
export const pathDist=(x,z)=>{
  let m=Math.min(onPoly(x,z,TRAIL)[0],onPoly(x,z,GULLY)[0]);
  for(const t of MTRAILS){if(x<t.x0||x>t.x1||z<t.z0||z>t.z1)continue;
    const d=onPoly(x,z,t.pts)[0];if(d<m)m=d;}
  {const d=onPoly(x,z,FAR_TRAIL.pts)[0];if(d<m)m=d;}
  return m;};
