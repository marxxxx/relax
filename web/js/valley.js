// The far world beyond the mountains: yurt camp on the plain, river water, pass cairns, plain trees and grass.
// Imported LAST in main.js, so the seeded rnd() layout of the rest of the world is unchanged.
import {isMobile,rnd,hash,smooth,clamp} from './util.js';
import {SEA,coastEdge,RIVERS,FAR_TRAIL,riverDist,riverAt,riverNear,heightAt,pathDist} from './world.js';
import {scene} from './renderer.js';
import {std,weatherize,WU,WATER_NOISE,WATER_TAIL} from './materials.js';
import {CIRCLES} from './collision.js';
import {add} from './cabin.js';
import {canvasTex} from './textures.js';
import {treeCrown,treeTrunk,treeCrownMat} from './trees.js';
import {grassBlade,grassMat} from './grass.js';
import {addEmitter} from './effects.js';
import {state,cur} from './state.js';

export const CAMP={x:468,z:16};
const nearWater=(x,z,m)=>{const r=riverAt(x,z);return r[0]<r[3]+m;};   // inside a river or on its bank
const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),P=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0),c=new THREE.Color();

// ---------- yurts ----------
const latticeTex=canvasTex(128,128,(g,w,h)=>{   // wooden lattice wall
  g.fillStyle='#a8895f';g.fillRect(0,0,w,h);
  g.strokeStyle='#6b4f30';g.lineWidth=3;
  for(let i=-h;i<w+h;i+=16){g.beginPath();g.moveTo(i,0);g.lineTo(i+h,h);g.stroke();g.beginPath();g.moveTo(i+h,0);g.lineTo(i,h);g.stroke();}
  g.globalAlpha=.22;g.fillStyle='#3a2a18';for(let i=0;i<50;i++)g.fillRect(Math.random()*w,Math.random()*h,6+Math.random()*22,1);});
latticeTex.wrapS=latticeTex.wrapT=THREE.RepeatWrapping;
const yurtWallMat=weatherize(std(0xffffff,{map:latticeTex,side:THREE.DoubleSide}),'yurt');
const yurtRoofMat=weatherize(std(0xcfc8b6,{roughness:1}),'yurt');
function yurt(x,z){
  const y=heightAt(x,z),g=new THREE.Group();g.position.set(x,y,z);
  g.rotation.y=Math.atan2(CAMP.x-x,CAMP.z-z);   // door faces the camp center
  scene.add(g);
  add(new THREE.CylinderGeometry(3,3,2.2,24,1,true),yurtWallMat,0,1.1,0,g);       // lattice wall
  add(new THREE.ConeGeometry(3.7,2.4,24,1,true),yurtRoofMat,0,3.4,0,g);            // felt roof
  add(new THREE.CylinderGeometry(.34,.34,.55,12),std(0x8a6f4d),0,4.75,0,g);         // crown ring (toono)
  add(new THREE.BoxGeometry(.95,1.75,.09),std(0x5a3d24),0,.88,3.03,g);             // door
  CIRCLES.push([x,z,3.3]);
  return {g,x,y,z};}
const yurts=[];
for(let k=0;k<6;k++){
  for(let t=0;t<24;t++){
    const a=rnd()*6.283,rr=11+rnd()*9,x=CAMP.x+Math.cos(a)*rr,z=CAMP.z+Math.sin(a)*rr;
    if(riverDist(x,z)<24||pathDist(x,z)<5.5||Math.hypot(x,z)>700)continue;
    yurts.push(yurt(x,z));break;}}
if(yurts.length>=2){addEmitter('smoke',yurts[0].x,yurts[0].y+5.1,yurts[0].z);addEmitter('smoke',yurts[1].x,yurts[1].y+5.1,yurts[1].z);}

// ---------- fence around the camp ----------
const postMat=std(0x5a3d24),ropeMat=new THREE.LineBasicMaterial({color:0x8a7656});
{const FR=30,NP=Math.floor(6.283*FR/2.2),postGeo=new THREE.CylinderGeometry(.06,.08,1.35,6);
  const posts=new THREE.InstancedMesh(postGeo,postMat,NP);
  const rope=[];
  for(let i=0;i<NP;i++){const a=i/NP*6.283,x=CAMP.x+Math.cos(a)*FR,z=CAMP.z+Math.sin(a)*FR,y=heightAt(x,z);
    P.set(x,y+.67,z);M.compose(P,Q.identity(),S.set(1,1,1));posts.setMatrixAt(i,M);
    rope.push(new THREE.Vector3(x,y+.72,z),new THREE.Vector3(x,y+1.12,z));}
  posts.castShadow=true;scene.add(posts);
  scene.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(rope),ropeMat));
  for(let i=0;i<NP;i+=3){const a=i/NP*6.283;CIRCLES.push([CAMP.x+Math.cos(a)*FR,CAMP.z+Math.sin(a)*FR,.14]);}}

// ---------- fire pits; the central one burns (flame + smoke + light) ----------
const stoneMat=std(0x7d7a74,{flatShading:true}),charMat=std(0x3b2a1e);
function firePit(x,z,burn){
  const y=heightAt(x,z),g=new THREE.Group();g.position.set(x,y,z);scene.add(g);
  for(let i=0;i<9;i++){const a=i/9*6.283,s=add(new THREE.DodecahedronGeometry(.26+rnd()*.1,0),stoneMat,Math.cos(a)*.95,.12,Math.sin(a)*.95,g);s.rotation.set(rnd()*3,rnd()*3,0);}
  for(let i=0;i<3;i++){const l=add(new THREE.CylinderGeometry(.09,.11,1.1,6),charMat,0,.28,0,g);l.rotation.set(1.1,i*2.1,0);}
  CIRCLES.push([x,z,1.1]);
  if(burn){addEmitter('flame',x,.3,z);addEmitter('smoke',x,1.5,z);
    campLight.position.set(x,1.2,z);}
  return [x,z];}
const campLight=new THREE.PointLight(0xff8a3a,2,22,2);campLight.castShadow=false;scene.add(campLight);
firePit(CAMP.x+4.5,CAMP.z+3,true);
firePit(CAMP.x-6,CAMP.z-4,false);

// ---------- river water ----------
// One ribbon mesh per river, laid out in river space (s = metres downstream, l = metres across), so the ripple pattern can be
// advected with the current. Water is transparent by depth (the bed shows through in the shallows), reflects the sky and,
// near the horizon, the dark banks; riffles and white water appear where the river runs steep or shallow.
const riverU={...THREE.UniformsUtils.clone(THREE.UniformsLib.fog),uTime:WU.uTime,   // fog uniforms: built-in fog (WebGL1, VR)
  uWind:WU.uWind,uRain:{value:0},
  uSunDir:{value:new THREE.Vector3()},uSunCol:{value:new THREE.Color()},
  uSkyTop:{value:new THREE.Color()},uSkyHor:{value:new THREE.Color()},
  uScat:{value:new THREE.Color()},uBank:{value:new THREE.Color()},uLand:{value:new THREE.Color()},uFoam:{value:new THREE.Color()}};
const riverMat=new THREE.ShaderMaterial({uniforms:riverU,fog:true,transparent:true,depthWrite:false,
  blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,   // premultiplied alpha
  vertexShader:`
    attribute vec2 aFlow,aUV,aBank; attribute float aDepth,aSpeed,aRough,aFade;
    varying vec3 vW; varying vec2 vFlow,vUV,vBank; varying float vDepth,vSpeed,vRough,vFade;
    #include <fog_pars_vertex>
    void main(){
      vW=position; vFlow=aFlow; vUV=aUV; vBank=aBank; vDepth=aDepth; vSpeed=aSpeed; vRough=aRough; vFade=aFade;
      vec4 mvPosition=viewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader:`
    uniform vec3 uSkyTop,uSkyHor,uSunDir,uSunCol,uScat,uBank,uLand,uFoam; uniform float uTime,uRain,uWind;
    varying vec3 vW; varying vec2 vFlow,vUV,vBank; varying float vDepth,vSpeed,vRough,vFade;
    #include <fog_pars_fragment>
    ${WATER_NOISE}
    // ripple height: stretched along the current (s), so the surface shows the flow lines
    float rip(vec2 q){return n2(q*vec2(.42,1.4))*.5+n2(q*vec2(1.,3.1)+3.1)*.3+n2(q*vec2(2.4,6.)+7.7)*.2;}
    vec2 gradRip(vec2 q){const float e=.07;float h=rip(q);return vec2(rip(q+vec2(e,0.))-h,rip(q+vec2(0.,e))-h)/e;}
    void main(){
      vec3 V=cameraPosition-vW;float dist=length(V);V/=dist;
      vec2 F=normalize(vFlow),Nl=vec2(-F.y,F.x);
      // two-phase flow advection: each phase slides the pattern downstream, they cross-fade so it never stretches
      float per=1.6,p0=fract(uTime/per),p1=fract(uTime/per+.5),w0=1.-abs(2.*p0-1.);
      vec2 qa=vec2(vUV.x-vSpeed*per*(p0-.5),vUV.y),qb=vec2(vUV.x-vSpeed*per*(p1-.5),vUV.y)+vec2(4.37,1.91);
      vec2 g=gradRip(qa)*w0+gradRip(qb)*(1.-w0);
      float amp=(.05+.3*vRough+.04*vSpeed+.05*uWind)*(.25+.75*smoothstep(320.,25.,dist));
      vec2 gw=(g.x*F+g.y*Nl)*amp;                                   // river space -> world space
      // rain: short-lived rings
      vec2 rc=floor(vW.xz*1.6),rf=fract(vW.xz*1.6)-.5;float rt=fract(uTime*.9+h21(rc)*7.);
      float rr=length(rf-(vec2(h21(rc+.3),h21(rc+.7))-.5)*.4);
      gw+=uRain*sin((rr-rt*.45)*55.)*(1.-rt)*smoothstep(.45*rt+.06,.45*rt,rr)*.25*normalize(rf+1e-4)*smoothstep(150.,10.,dist);
      vec3 N=normalize(vec3(-gw.x,1.,-gw.y));
      float ndv=max(dot(N,V),0.),fr=.02+.98*pow(1.-ndv,5.);
      vec3 R=reflect(-V,N);R.y=abs(R.y);
      vec3 refl=mix(uSkyHor,uSkyTop,pow(R.y,.5));
      // mirrored banks: follow the reflected ray across the river to the bank it faces; the land rises behind it
      float rh=max(length(R.xz),1e-3),rl=dot(R.xz,Nl)/rh;
      float dl=rl>0.?vBank.y-vUV.y:vUV.y+vBank.x,th=max(dl,0.)/max(abs(rl),.06);
      float hit=smoothstep(1.2,.8,(R.y/rh*th)/(1.5+.11*th));
      refl=mix(refl,mix(uBank,uLand,smoothstep(12.,90.,th)),hit*.9);
      float sr=max(dot(R,uSunDir),0.);
      vec3 spec=uSunCol*(pow(sr,700.)*10.+pow(sr,70.)*.25)*(1.-.6*vRough);
      // body: turbid river water, light is lost within about a metre (more after rain)
      float d=max(vDepth,0.),tm=exp(-d*(1.4+uRain*1.6));
      float a=1.-(1.-fr)*tm;
      vec3 col=fr*refl+(1.-fr)*(1.-tm)*uScat+spec;
      // foam: white water where steep/shallow and fast, drifting foam lines elsewhere, a thin scum line at the banks
      float fn=n2(qa*vec2(.7,1.6)+11.)*w0+n2(qb*vec2(.7,1.6)+5.)*(1.-w0);
      fn=fn*.65+.35*(n2(qa*vec2(2.1,3.7)+1.)*w0+n2(qb*vec2(2.1,3.7)+9.)*(1.-w0));
      float foam=smoothstep(.15,.8,vRough)*smoothstep(.66-.2*vRough,.82-.14*vRough,fn);
      foam=max(foam,smoothstep(.9,.98,n2(qa*vec2(.12,1.6)+2.)*w0+n2(qb*vec2(.12,1.6)+8.)*(1.-w0))*.13*(1.-vRough));
      foam=max(foam,smoothstep(.16,.02,d)*smoothstep(.45,.8,fn)*.4);
      foam*=smoothstep(600.,120.,dist);
      col=col*(1.-foam)+uFoam*foam;a=a*(1.-foam)+foam;
      float shore=smoothstep(0.,.05,vDepth);                           // soft waterline
      gl_FragColor=vec4(col,a)*shore*vFade;
      ${WATER_TAIL}
    }`});
{const NA=11;
  for(const R of RIVERS){
    const pos=[],flow=[],uv=[],bnk=[],depA=[],spd=[],rgh=[],fad=[],idx=[];
    const pts=R.pts,np=pts.length;
    const lv=i=>pts[clamp(i,0,np-1)][2],sl=i=>pts[clamp(i,0,np-1)][5];
    let rows=0;
    for(let i=0;i<np-1;i++)for(let h=0;h<2;h++){
      if(i===np-2&&h===1)continue;
      const a=pts[i],b=pts[i+1],t=h/2,L=k=>a[k]+(b[k]-a[k])*t,x=L(0),z=L(1),wl=L(2),D=L(3),w=L(4),s=L(5);
      if(!R.main){const q=riverNear(x,z,RIVERS[0],RIVERS[0].w*2+6);if(q&&q[0]<q[3]*.5)break;}   // the tributary ends inside the main river
      const pa=pts[Math.max(i-1,0)],pb=pts[Math.min(i+2,np-1)];
      let tx=pb[0]-pa[0],tz=pb[1]-pa[1];const tl=Math.hypot(tx,tz)||1;tx/=tl;tz/=tl;
      const nx=-tz,nz=tx;
      const slope=Math.max(0,(lv(i-3)-lv(i+4))/Math.max(1,sl(i+4)-sl(i-3)));
      const base=clamp(.45+slope*45,.45,3.4)*(1+.9*smooth(.9,.4,D));         // faster where steep or shallow
      const rough=clamp(smooth(.004,.05,slope)+smooth(.75,.4,D)*.22,0,1);
      const ext=[],open=[];for(const sg of [-1,1]){let e=w+4,o=1;for(let d=.5;d<=w+4;d+=.2)if(heightAt(x+nx*sg*d,z+nz*sg*d)>=wl+.02){e=d+1.1;o=0;break;}ext.push(e);open.push(o);}
      for(let j=0;j<NA;j++){
        const u=j/(NA-1)*2-1,lat=u*(u<0?ext[0]:ext[1]),px=x+nx*lat,pz=z+nz*lat;
        pos.push(px,wl,pz);flow.push(tx,tz);uv.push(s,lat);bnk.push(ext[0]-1.1,ext[1]-1.1);depA.push(wl-heightAt(px,pz));
        // confluence: the main river fades out across the open mouth, the tributary fades in where the main river's water ends
        let f=open[u<0?0:1]?smooth(w+4,w+1,Math.abs(lat)):1;
        if(!R.main){const q=riverNear(px,pz,RIVERS[0],RIVERS[0].w*2+12);if(q)f*=smooth(q[3]+1,q[3]+4,q[0]);}
        fad.push(f);
        const lw=clamp(Math.abs(lat)/w,0,1);
        spd.push(base*(1-.7*lw*lw));rgh.push(rough*(1-.4*lw));
        if(rows>0&&j<NA-1){const q=(rows-1)*NA+j,v=rows*NA+j;idx.push(q,q+1,v, q+1,v+1,v);}}
      rows++;}
    const g=new THREE.BufferGeometry();
    g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));
    g.setAttribute('aFlow',new THREE.Float32BufferAttribute(flow,2));
    g.setAttribute('aUV',new THREE.Float32BufferAttribute(uv,2));
    g.setAttribute('aBank',new THREE.Float32BufferAttribute(bnk,2));
    g.setAttribute('aFade',new THREE.Float32BufferAttribute(fad,1));
    g.setAttribute('aDepth',new THREE.Float32BufferAttribute(depA,1));
    g.setAttribute('aSpeed',new THREE.Float32BufferAttribute(spd,1));
    g.setAttribute('aRough',new THREE.Float32BufferAttribute(rgh,1));
    g.setIndex(idx);g.computeBoundingSphere();
    scene.add(new THREE.Mesh(g,riverMat));}}

// ---------- plain trees ----------
{const NT=isMobile?150:320;
  const pc=new THREE.InstancedMesh(treeCrown,treeCrownMat,NT),pt=new THREE.InstancedMesh(treeTrunk,std(0x4d3624),NT);
  let n=0,tries=0;
  while(n<NT&&tries<8000){tries++;
    const a=rnd()*6.283,r=355+Math.pow(rnd(),.9)*285,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(x-coastEdge(z)<60)continue;                                  // inland only, the sea stays west
    if(nearWater(x,z,6)||pathDist(x,z)<4.5)continue;
    if(Math.hypot(x-CAMP.x,z-CAMP.z)<34)continue;
    const y=heightAt(x,z);
    if(y<SEA+2||y>30)continue;
    if(Math.abs(heightAt(x+2,z)-heightAt(x-2,z))>.9||Math.abs(heightAt(x,z+2)-heightAt(x,z-2))>.9)continue;
    const s=.7+rnd()*.9;
    P.set(x,y-.2,z);Q.setFromAxisAngle(UP,rnd()*6.28);S.set(s,s*(.9+rnd()*.3),s);M.compose(P,Q,S);
    pc.setMatrixAt(n,M);pt.setMatrixAt(n,M);
    c.setHSL(.27+rnd()*.07,.35+rnd()*.2,.17+rnd()*.1);pc.setColorAt(n,c);
    CIRCLES.push([x,z,.35*s]);n++;}
  pc.count=pt.count=n;pc.castShadow=pt.castShadow=true;pc.receiveShadow=true;
  pc.frustumCulled=pt.frustumCulled=false;scene.add(pc,pt);}

// ---------- plain grass ----------
{const NG=isMobile?6000:14000;
  const pg=new THREE.InstancedMesh(grassBlade,grassMat,NG);
  let gi=0,tries=0;
  while(gi<NG&&tries<40000){tries++;
    const a=rnd()*6.283,r=352+Math.sqrt(rnd())*298,x=Math.cos(a)*r,z=Math.sin(a)*r;
    if(x-coastEdge(z)<60)continue;
    if(nearWater(x,z,2.6)||pathDist(x,z)<1)continue;
    if(Math.hypot(x-CAMP.x,z-CAMP.z)<30)continue;
    const y=heightAt(x,z);if(y<SEA+2||y>26)continue;
    const h=.3+rnd()*.45;
    P.set(x,y-.05,z);Q.setFromAxisAngle(UP,rnd()*6.28);S.set(1,h,1);M.compose(P,Q,S);pg.setMatrixAt(gi,M);
    c.setHSL(.2+rnd()*.08,.45+rnd()*.15,.3+rnd()*.12);
    if(rnd()<.02)c.setHSL(rnd()<.5?.13:.75,.7,.65);   // little flowers
    pg.setColorAt(gi,c);gi++;}
  pg.count=gi;pg.receiveShadow=true;pg.frustumCulled=false;scene.add(pg);}
// lusher grass around the camp and along the pass trail (the wide plain stays sparse steppe)
{const NG2=isMobile?3500:12000;
  const pg2=new THREE.InstancedMesh(grassBlade,grassMat,NG2);
  let gi=0,tries=0;
  while(gi<NG2&&tries<40000){tries++;
    let x,z;
    if(rnd()<.6){const a=rnd()*6.283,rr=Math.sqrt(rnd())*95;x=CAMP.x+Math.cos(a)*rr;z=CAMP.z+Math.sin(a)*rr;}
    else{const p=FAR_TRAIL.pts[(rnd()*FAR_TRAIL.pts.length)|0],a=rnd()*6.283,rr=rnd()*12;x=p[0]+Math.cos(a)*rr;z=p[1]+Math.sin(a)*rr;}
    if(x-coastEdge(z)<60)continue;
    if(nearWater(x,z,2.6)||pathDist(x,z)<1)continue;
    let nearYurt=false;for(const yu of yurts)if(Math.hypot(x-yu.x,z-yu.z)<4.2){nearYurt=true;break;}
    if(nearYurt)continue;
    const y=heightAt(x,z);if(y<SEA+2||y>26)continue;
    const h=.3+rnd()*.45;
    P.set(x,y-.05,z);Q.setFromAxisAngle(UP,rnd()*6.28);S.set(1,h,1);M.compose(P,Q,S);pg2.setMatrixAt(gi,M);
    c.setHSL(.2+rnd()*.08,.45+rnd()*.15,.3+rnd()*.12);
    if(rnd()<.02)c.setHSL(rnd()<.5?.13:.75,.7,.65);
    pg2.setColorAt(gi,c);gi++;}
  pg2.count=gi;pg2.receiveShadow=true;pg2.frustumCulled=false;scene.add(pg2);}

// ---------- river banks: boulders, pebbles along the waterline and on the gravel bars of inner bends, reed beds ----------
// own random sequence, so the shared rnd() layout is untouched
let hs=4242;const hr=()=>{hs=(hs*16807)%2147483647;return (hs-1)/2147483646;};
const bankRockMat=weatherize(std(0xffffff,{flatShading:true}),'rock');
const rockGeo=new THREE.DodecahedronGeometry(1,0),E=new THREE.Euler();
const FORD=[524,7];
// a random spot on one bank: [x,z,nx,nz (pointing away from the water),water level,waterline distance,local slope,inner-bend side?]
function bankSpot(){
  const R=RIVERS[(hr()*RIVERS.length*1.6|0)%RIVERS.length],np=R.pts.length,i=2+(hr()*(np-6)|0),p=R.pts[i];
  const a=R.pts[i-2],b=R.pts[i+2],side=hr()<.5?-1:1;
  let nx=-(b[1]-a[1]),nz=b[0]-a[0];const nl=Math.hypot(nx,nz)||1;nx=nx/nl*side;nz=nz/nl*side;
  if(!R.main&&i>np-14&&riverNear(p[0],p[1],RIVERS[0],RIVERS[0].w*2+16))return null;     // keep the confluence mouths clear
  const key=i*2+(side>0),cache=R.wl||(R.wl=new Map());   // waterline distance per point and side, searched once
  let wd=cache.get(key);
  if(wd===undefined){wd=-1;for(let d=.5;d<=p[4]+4;d+=.25)if(heightAt(p[0]+nx*d,p[1]+nz*d)>=p[2]){wd=d;break;}cache.set(key,wd);}
  if(wd<0)return null;
  const slope=(a[2]-b[2])/Math.max(1,b[5]-a[5]);
  const turn=((b[0]-p[0])*(p[1]-a[1])-(b[1]-p[1])*(p[0]-a[0]))*side;             // >0: this bank is on the inside of the bend
  return [p[0],p[1],nx,nz,p[2],wd,slope,turn>0?1:0,p[4]];}
function place(mesh,n,x,y,z,sx,sy,sz,ry,col){P.set(x,y,z);Q.setFromEuler(E.set(hr()*.5,ry,hr()*.5));S.set(sx,sy,sz);M.compose(P,Q,S);mesh.setMatrixAt(n,M);mesh.setColorAt(n,col);}
{ // boulders: some on the banks, some in the stream where it runs fast
  const NB=isMobile?160:420,rk=new THREE.InstancedMesh(rockGeo,bankRockMat,NB);let n=0,tries=0;
  while(n<NB&&tries<NB*12){tries++;const b=bankSpot();if(!b)continue;
    const [x,z,nx,nz,wl,wd,slope]=b,fast=slope>.015;
    const lat=fast&&hr()<.6?-hr()*b[8]*1.6:wd-1.4+hr()*4,px=x+nx*lat,pz=z+nz*lat;
    if(Math.hypot(px-FORD[0],pz-FORD[1])<12||pathDist(px,pz)<4)continue;
    const s=.25+Math.pow(hr(),2.2)*1.1,y=heightAt(px,pz);
    c.setHSL(.08+hr()*.05,.05+hr()*.08,.42+hr()*.14);
    place(rk,n++,px,y+s*.12,pz,s*(.8+hr()*.5),s*(.5+hr()*.35),s*(.8+hr()*.4),hr()*6.3,c);
    if(s>.45&&y>wl-.3)CIRCLES.push([px,pz,s*.8]);}
  rk.count=n;rk.castShadow=rk.receiveShadow=true;rk.frustumCulled=false;scene.add(rk);}
{ // pebbles: along the waterline (also under the shallow water), gravel bars on the inner bends
  const NP=isMobile?1800:6000,pb=new THREE.InstancedMesh(rockGeo,bankRockMat,NP);let n=0,tries=0;
  while(n<NP&&tries<NP*4){tries++;const b=bankSpot();if(!b)continue;
    const [x,z,nx,nz,wl,wd,,inner]=b;
    if(!inner&&hr()<.55)continue;
    for(let k=0,m=6+(hr()*14|0);k<m&&n<NP;k++){
      const lat=wd-1.8+hr()*(inner?4.5:2.6),al=(hr()-.5)*3.5,px=x+nx*lat-nz*al,pz=z+nz*lat+nx*al;
      const y=heightAt(px,pz);if(y>wl+.6)continue;
      const s=.05+Math.pow(hr(),2)*.17;
      c.setHSL(.07+hr()*.06,.06+hr()*.14,.34+hr()*.26);
      place(pb,n++,px,y+s*.1,pz,s*(1+hr()*.6),s*.45,s,hr()*6.3,c);}}
  pb.count=n;pb.receiveShadow=true;pb.frustumCulled=false;scene.add(pb);}
{ // reed beds in the slow water at the banks
  const NR=isMobile?3000:9000,rd=new THREE.InstancedMesh(grassBlade,grassMat,NR);let n=0,tries=0;
  while(n<NR&&tries<NR){tries++;const b=bankSpot();if(!b)continue;
    const [x,z,nx,nz,wl,wd,slope]=b;if(slope>.01)continue;
    const cl=wd-.6+hr()*1.4,cx=x+nx*cl,cz=z+nz*cl;
    if(Math.hypot(cx-FORD[0],cz-FORD[1])<14)continue;
    for(let k=0,m=10+(hr()*26|0);k<m&&n<NR;k++){
      const px=cx+(hr()-.5)*2.4+(hr()-.5)*1.2*nz,pz=cz+(hr()-.5)*2.4-(hr()-.5)*1.2*nx,y=heightAt(px,pz);
      if(y<wl-.4||y>wl+.8)continue;
      const h=1.1+hr()*.9;
      if(hr()<.15)c.setHSL(.1+hr()*.03,.32,.36+hr()*.1);else c.setHSL(.16+hr()*.07,.28+hr()*.18,.27+hr()*.12);
      P.set(px,y-.05,pz);Q.setFromAxisAngle(UP,hr()*6.28);S.set(.4,h,.4);M.compose(P,Q,S);rd.setMatrixAt(n,M);rd.setColorAt(n,c);n++;}}
  rd.count=n;rd.receiveShadow=true;rd.frustumCulled=false;scene.add(rd);}

// ---------- cairns mark the pass trail ----------
const cairnMat=weatherize(std(0x8d877d,{flatShading:true}),'rock');
{const pts=FAR_TRAIL.pts;
  for(let i=6;i<pts.length-3;i+=7){
    const p=pts[i],q=pts[Math.min(i+1,pts.length-1)];
    let nx=-(q[1]-p[1]),nz=q[0]-p[0];const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
    const side=((i/7)|0)%2?1:-1,x=p[0]+nx*2.6*side,z=p[1]+nz*2.6*side;
    const y=heightAt(x,z),n=2+(i%3===0?1:0),s=.32+hash(i,7)*.12;
    for(let k=0;k<n;k++){const ss=s*(1-k*.26);
      add(new THREE.DodecahedronGeometry(ss,0),cairnMat,x,y+.3*k+ss*.45,z,scene).rotation.set(k,k*1.7,k*.6);}
    CIRCLES.push([x,z,.3]);}}

// ---------- per-frame: camp fire light flicker + river water colors (same palette logic as the sea) ----------
const _v=new THREE.Vector3(),_c=new THREE.Color();
export function updateValley(dt,env){
  const fireScale=1-cur.rain*.55;
  campLight.intensity=(1.3+env.night*1.6)*fireScale*(.82+.18*Math.sin(state.T*13)*Math.sin(state.T*7.3+1)+.06*Math.random());
  const {sy,day,cl,golden,sunDir,sunCol,top,hor}=env;
  riverU.uSkyTop.value.copy(top);riverU.uSkyHor.value.copy(hor);
  riverU.uSunDir.value.copy(sy>-.04?sunDir:_v.copy(sunDir).negate());
  riverU.uSunCol.value.copy(sy>-.04?sunCol:_c.setRGB(.5,.6,.9)).multiplyScalar((sy>-.04?smooth(-.04,.05,sy):.25*smooth(-.04,-.25,sy))*(1-cl*.85));
  riverU.uScat.value.setRGB(.028,.062,.05).lerp(_c.copy(hor).multiplyScalar(.12),.25).multiplyScalar(.3+.7*day+state.flash);   // greenish, silty
  riverU.uBank.value.setRGB(.045,.07,.03).multiplyScalar(.2+.8*day+state.flash);                                        // mirrored banks: reeds, grass
  riverU.uLand.value.setRGB(.11,.15,.08).lerp(_c.copy(hor).multiplyScalar(.6),.35).multiplyScalar(.2+.8*day+state.flash);   // the valley sides further away
  riverU.uFoam.value.setRGB(.78,.82,.8).multiplyScalar(.1+.7*day+state.flash).lerp(sunCol,golden*.25);
  riverU.uRain.value=cur.rain;
}
