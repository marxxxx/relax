// Terrain height field and landmarks: lake, campfire, coast, trail and ravine path.
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
export function heightAt(x,z){
  const h=baseHeight(x,z);
  if(x>-20||x<-95||z<-10||z>52)return h;
  const [d,hp]=onPoly(x,z,GULLY);
  if(d>10)return h;
  return hp+(h-hp)*smooth(2.1,9,d);
}
export const pathDist=(x,z)=>Math.min(onPoly(x,z,TRAIL)[0],onPoly(x,z,GULLY)[0]);
