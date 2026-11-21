// Terrain height field and landmarks: lake, campfire, coast, trail, ravine and the paths up to the summits.
import {clamp,smooth,fbm,vnoise,hash} from './util.js';

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
  const mf=smooth(-30,40,dx)*(1-smooth(305,395+90*east,r));
  if(mf>0)h+=Math.pow(Math.max(0,r-120),1.45)*.017*(.5+fbm(x*.018+4,z*.018))*mf;   // skipped where the factor is 0 (same value, less work)
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
  const k=smooth(-9.5,-1,dx);
  const beach=k>=1?0:SEA+1.4+(fbm(x*.08,z*.08)-.5)*.8-Math.max(0,-dx-12)*.32;      // inland k=1: the beach term is 0
  const crag=(k>0&&k<1)?(fbm(z*.22+7,x*.22)-.5)*5*k*(1-k)*4:0;
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
// Catmull-Rom control points (a meander bend is inserted between each pair), mean half-width w, channel depth D.
// The main river comes first: tributaries end exactly on one of its control points and join at its water level.
const RIVER_CTRL=[
  {w:6.5,D:1.7,ford:[524,7],pts:[[520,470],[492,380],[476,290],[466,210],[470,130],[490,64],[512,28],[536,-14],[572,-40],[630,-48],[700,-36],[782,-18]]},  // main river, exits east
  {w:4.2,D:1.2,pts:[[560,-430],[512,-300],[486,-190],[492,-110],[530,-70],[572,-40]]},                                                                     // from the SE ring
  {w:3.6,D:1.1,pts:[[420,560],[400,470],[404,380],[424,290],[466,210]]},                                                                                    // through the NE valley
];
const CAMPXZ=[468,16];   // the yurt camp (CAMP in valley.js)
function riverPath(c,ci){
  const C=[c.pts[0]];
  for(let i=1;i<c.pts.length;i++){const a=c.pts[i-1],b=c.pts[i],dx=b[0]-a[0],dz=b[1]-a[1],L=Math.hypot(dx,dz),mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;
    const amp=L*(.13+.1*hash(ci*7+i,5))*(i%2?1:-1)*smooth(60,110,Math.hypot(mx-CAMPXZ[0],mz-CAMPXZ[1]));   // no bends right at the camp
    C.push([mx-dz/L*amp,mz+dx/L*amp],b);}
  const P=[];
  for(let i=0;i<C.length-1;i++){const p0=C[Math.max(i-1,0)],p1=C[i],p2=C[i+1],p3=C[Math.min(i+2,C.length-1)];
    const n=Math.max(2,Math.ceil(Math.hypot(p2[0]-p1[0],p2[1]-p1[1])/4));
    for(let k=i?1:0;k<=n;k++){const t=k/n,t2=t*t,t3=t2*t;
      const f=q=>.5*(2*p1[q]+(p2[q]-p0[q])*t+(2*p0[q]-5*p1[q]+4*p2[q]-p3[q])*t2+(3*p1[q]-p0[q]-3*p2[q]+p3[q])*t3);
      P.push([f(0),f(1)]);}}
  return P;}
// non-increasing least-squares fit (pool adjacent violators)
function monoFit(v){const val=[],cnt=[];
  for(const x of v){val.push(x);cnt.push(1);
    while(val.length>1&&val[val.length-2]<val[val.length-1]){const c2=cnt.pop(),v2=val.pop(),c1=cnt.pop(),v1=val.pop();val.push((v1*c1+v2*c2)/(c1+c2));cnt.push(c1+c2);}}
  const o=[];val.forEach((x,i)=>{for(let k=0;k<cnt[i];k++)o.push(x);});return o;}
const SLOPE=.0006;
function riverProfile(c,ci){
  const P=riverPath(c,ci),n=P.length,S=[0],W=[],G=[],GL=[],Dp=[],BH=[];
  for(let i=1;i<n;i++)S.push(S[i-1]+Math.hypot(P[i][0]-P[i-1][0],P[i][1]-P[i-1][1]));
  for(let i=0;i<n;i++){const s=S[i];
    const fk=c.ford?1-smooth(10,28,Math.hypot(P[i][0]-c.ford[0],P[i][1]-c.ford[1])):0;      // the ford: wider and shallow
    const w=c.w*(.8+.4*vnoise(s*.011+ci*9,ci*3.1))*(.3+.7*smooth(0,160,s))*(1+.3*fk);     // narrow at the source
    const a=P[Math.max(i-1,0)],b=P[Math.min(i+1,n-1)];let nx=-(b[1]-a[1]),nz=b[0]-a[0];const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
    let g=baseHeight(P[i][0],P[i][1]),m=g;for(const o of [w+6,w+16])for(const sg of [-1,1]){const v=baseHeight(P[i][0]+nx*o*sg,P[i][1]+nz*o*sg);g+=v;m=Math.min(m,v);}
    const bh=.55+.75*vnoise(s*.02+ci*5,7.3);
    W.push(w);BH.push(bh);G.push(.3*g/5+.7*m-bh);GL.push(m-.4);Dp.push(c.D*(.35+.65*smooth(0,220,s))*(1-fk)+.36*fk);}
  // water level: the closest always-falling fit to the ground (slope >= SLOPE), then smoothed (keeps it monotone)
  // and never above the lowest nearby ground, so it cuts into the land instead of sitting on a levee
  let L=monoFit(G.map((g,i)=>g+SLOPE*S[i])).map((y,i)=>y-SLOPE*S[i]);
  for(let i=0;i<n;i++){L[i]=Math.min(L[i],GL[i]);if(i)L[i]=Math.min(L[i],L[i-1]-SLOPE*(S[i]-S[i-1]));}
  for(let pass=0;pass<4;pass++){const L2=L.slice();for(let i=2;i<n-2;i++)L2[i]=(L[i-2]+L[i-1]+L[i]+L[i+1]+L[i+2])/5;L=L2;}
  return {P,S,L,W,Dp,BH};}
const RP=RIVER_CTRL.map(riverProfile);
// confluences: a tributary ends exactly at the main river's level
const near0=(P,x,z)=>{let j=0,m=1e9;for(let i=0;i<P.length;i++){const d=Math.hypot(P[i][0]-x,P[i][1]-z);if(d<m){m=d;j=i;}}return j;};
for(let k=1;k<RP.length;k++){const T=RP[k],e=T.P[T.P.length-1],ml=RP[0].L[near0(RP[0].P,e[0],e[1])],tot=T.S[T.S.length-1];
  for(let i=0;i<T.L.length;i++)T.L[i]=Math.min(Math.max(T.L[i],ml),ml+.012*(tot-T.S[i]));}
const RV=90;   // reach of a river's influence on the terrain
// [x,z,water level,depth,half-width,arc length,bank height]; spatial blocks of 16 segments speed up the nearest-point queries
export const RIVERS=RP.map((r,k)=>{const pts=r.P.map((p,i)=>[p[0],p[1],r.L[i],r.Dp[i],r.W[i],r.S[i],r.BH[i]]),blocks=[];
  for(let i=0;i<pts.length-1;i+=16){const i1=Math.min(i+16,pts.length-1);let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;
    for(let q=i;q<=i1;q++){x0=Math.min(x0,pts[q][0]);x1=Math.max(x1,pts[q][0]);z0=Math.min(z0,pts[q][1]);z1=Math.max(z1,pts[q][1]);}
    blocks.push([i,i1,x0,x1,z0,z1]);}
  let x0=1e9,x1=-1e9,z0=1e9,z1=-1e9;for(const b of blocks){x0=Math.min(x0,b[2]);x1=Math.max(x1,b[3]);z0=Math.min(z0,b[4]);z1=Math.max(z1,b[5]);}
  return {pts,blocks,w:RIVER_CTRL[k].w,main:k===0,x0:x0-RV,x1:x1+RV,z0:z0-RV,z1:z1+RV};});
// nearest point on a river: [distance, water level, depth, half-width, arc length, segment index, signed side]
export function riverNear(x,z,R,maxD){let best=maxD,bi=-1,bt=0;
  for(const b of R.blocks){const ox=Math.max(b[2]-x,0,x-b[3]),oz=Math.max(b[4]-z,0,z-b[5]);if(ox*ox+oz*oz>=best*best)continue;
    for(let i=b[0];i<b[1];i++){const a=R.pts[i],c=R.pts[i+1],vx=c[0]-a[0],vz=c[1]-a[1];
      const t=clamp(((x-a[0])*vx+(z-a[1])*vz)/(vx*vx+vz*vz),0,1),d=Math.hypot(x-a[0]-vx*t,z-a[1]-vz*t);
      if(d<best){best=d;bi=i;bt=t;}}}
  if(bi<0)return null;
  const a=R.pts[bi],c=R.pts[bi+1],l=q=>a[q]+(c[q]-a[q])*bt,side=Math.sign((c[0]-a[0])*(z-a[1])-(c[1]-a[1])*(x-a[0]))||1;
  return [best,l(2),l(3),l(4),l(5),bi,side,l(6)];}
export const riverDist=(x,z)=>{let m=1e9;
  for(const R of RIVERS){if(x<R.x0||x>R.x1||z<R.z0||z>R.z1)continue;
    const q=riverNear(x,z,R,m);if(q)m=q[0];}
  return m;};
// [distance to the nearest river, its water level, channel depth, half-width]
export const riverAt=(x,z)=>{let best=1e9,r=[1e9,-99,0,0];
  for(const R of RIVERS){if(x<R.x0||x>R.x1||z<R.z0||z>R.z1)continue;
    const q=riverNear(x,z,R,best);if(q){best=q[0];r=q;}}
  return [r[0],r[1],r[2],r[3]];};

// the pass: from the ring's east edge down to the yurt camp (blended only for r>298, the old world stays untouched)
export const FAR_TRAIL=makeTrail([[302,4],[330,8],[368,12],[408,16],[446,18],[468,16]]);

export function heightAt(x,z){
  let h=baseHeight(x,z);
  if(x<=-20&&x>=-95&&z>=-10&&z<=52){const [d,hp]=onPoly(x,z,GULLY);if(d<=10)h=hp+(h-hp)*smooth(2.1,9,d);}
  for(const t of MTRAILS){if(x<t.x0||x>t.x1||z<t.z0||z>t.z1)continue;
    const [d,hp]=onPoly(x,z,t.pts);if(d<9)h=hp+(h-hp)*smooth(2,8,d);}
  const r=Math.hypot(x,z);
  if(r>298){const [d,hp]=onPoly(x,z,FAR_TRAIL.pts);const k=(1-smooth(2,8,d))*smooth(298,312,r);if(k>0)h=h*(1-k)+hp*k;}   // blend ramps in with r, no cliff at the mask edge
  return riverShape(x,z,h);}
// rivers shape the ground around them: rounded bed, banks, a gently rising floodplain, then valley sides back to the land.
// Each river lowers or raises; raising is suppressed near another river's channel, and lowering always wins (confluences).
function riverShape(x,z,h){
  let lo=h,hi=h,Q=null;
  for(const R of RIVERS){if(x<R.x0||x>R.x1||z<R.z0||z>R.z1)continue;const q=riverNear(x,z,R,RV);if(q)(Q||(Q=[])).push(q);}
  if(!Q)return h;
  for(const q of Q){const [d,wl,D,w]=q,bh=q[7],bw=2.5;
    let t;
    if(d<w)t=wl-D*(1-.8*(d/w)*(d/w));
    else if(d<w+bw)t=wl-.2*D+(.2*D+bh)*smooth(w,w+bw,d);
    else t=wl+bh+(d-w-bw)*.015;
    const v=t+(h-t)*smooth(w+bw+2,w+bw+2+clamp(Math.abs(h-t)*6,6,RV-w-bw-4),d);
    if(v<lo)lo=v;
    if(v>h){let al=1;for(const o of Q)if(o!==q)al*=smooth(o[3]+3,o[3]+12,o[0]);const r=h+(v-h)*al;if(r>hi)hi=r;}}
  return lo<h?lo:hi;}

export const pathDist=(x,z)=>{
  let m=Math.min(onPoly(x,z,TRAIL)[0],onPoly(x,z,GULLY)[0]);
  for(const t of MTRAILS){if(x<t.x0||x>t.x1||z<t.z0||z>t.z1)continue;
    const d=onPoly(x,z,t.pts)[0];if(d<m)m=d;}
  {const d=onPoly(x,z,FAR_TRAIL.pts)[0];if(d<m)m=d;}
  return m;};
