(function(){
'use strict';
const $ = id => document.getElementById(id);
const isMobile = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

// ---------- helpers ----------
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const lerp=(a,b,t)=>a+(b-a)*t;
const smooth=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};
function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
function fbm(x,y){let f=0,a=.5,fr=1;for(let i=0;i<5;i++){f+=a*vnoise(x*fr,y*fr);fr*=2.03;a*=.5;}return f;}
let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};

const LAKE={x:30,z:-24,r:13};
const FIRE=new THREE.Vector3(5.5,0,7);
// ---- coast: to the west the plateau breaks off as a cliff down to a beach and the sea
const SEA=-24;
function coastEdge(z){return -62+6*Math.sin(z*.03)+4*Math.sin(z*.083+2);}
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
const GULLY=(()=>{const pts=[[coastEdge(4)+27,4],[coastEdge(15)+13,15],[coastEdge(24)+4,24],[coastEdge(31)-5,31],[coastEdge(37)-13,37]];
  let L=[0];for(let i=1;i<pts.length;i++)L.push(L[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
  const h0=baseHeight(pts[0][0],pts[0][1]),h1=SEA+1.3,tot=L[L.length-1];
  return pts.map((p,i)=>[p[0],p[1],h0+(h1-h0)*Math.pow(L[i]/tot,.9)]);})();
TRAIL.push([GULLY[0][0],GULLY[0][1]]);
function onPoly(px,pz,P){let best=1e9,bh=0;
  for(let i=0;i<P.length-1;i++){const a=P[i],b=P[i+1],vx=b[0]-a[0],vz=b[1]-a[1];
    const t=clamp(((px-a[0])*vx+(pz-a[1])*vz)/(vx*vx+vz*vz),0,1);const d=Math.hypot(px-a[0]-vx*t,pz-a[1]-vz*t);
    if(d<best){best=d;bh=a.length>2?a[2]+(b[2]-a[2])*t:0;}}
  return [best,bh];}
function heightAt(x,z){
  const h=baseHeight(x,z);
  if(x>-20||x<-95||z<-10||z>52)return h;
  const [d,hp]=onPoly(x,z,GULLY);
  if(d>10)return h;
  return hp+(h-hp)*smooth(2.1,9,d);
}
const pathDist=(x,z)=>Math.min(onPoly(x,z,TRAIL)[0],onPoly(x,z,GULLY)[0]);

// ---------- renderer / scene ----------
const canvas=$('scene');
let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:!isMobile||devicePixelRatio<2,powerPreference:'high-performance'});}
catch(e){ $('loader').innerHTML='<p>Dein Browser kann hier kein WebGL starten. Versuche Chrome, Safari oder Firefox in aktueller Version.</p>'; return; }
renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;
const POST=renderer.capabilities.isWebGL2;
renderer.toneMapping=POST?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

const scene=new THREE.Scene();
scene.fog=POST?null:new THREE.FogExp2(0xaabbcc,.003);
const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,2500);

// shared weather uniforms used by several materials
const WU={uTime:{value:0},uWind:{value:.25},uSnow:{value:0},uWet:{value:0},uSunDir:{value:new THREE.Vector3(0,1,0)},uSunCol:{value:new THREE.Color(0,0,0)}};

function weatherize(mat,key,extraVertex){
  mat.onBeforeCompile=(s)=>{
    Object.assign(s.uniforms,WU);
    s.vertexShader='uniform float uTime;\nuniform float uWind;\nvarying float vUp;\nvarying float vH;\n'+s.vertexShader
      .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        vec3 wn=objectNormal;
        #ifdef USE_INSTANCING
          wn=mat3(instanceMatrix)*wn;
        #endif
        vUp=normalize(mat3(modelMatrix)*wn).y;
        vH=clamp(position.y,0.0,1.0);`)
      .replace('#include <begin_vertex>','#include <begin_vertex>\n'+(extraVertex||''));
    s.fragmentShader='uniform float uSnow;\nuniform float uWet;\nvarying float vUp;\nvarying float vH;\n'+s.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        ${key==='grass'?'diffuseColor.rgb*=mix(0.45,1.08,vH); float up=0.9;':'float up=vUp;'}
        ${key==='terrain'?`float rk=smoothstep(0.8,0.45,vUp);
          float band=0.5+0.5*sin(vWPos.y*2.1+sin(vWPos.x*0.23+vWPos.z*0.19)*2.2+sin(vWPos.z*0.9)*0.4);
          float big=0.5+0.5*sin(vWPos.x*0.37+vWPos.z*0.29+vWPos.y*0.53)*sin(vWPos.z*0.21-vWPos.y*0.31);
          float fine=0.5+0.5*sin(vWPos.y*7.0+sin(vWPos.x*1.7+vWPos.z*1.3)*1.5);
          diffuseColor.rgb*=mix(1.0,(0.5+0.3*band+0.08*fine)*(0.82+0.3*big),rk);`:''}
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.93,0.95,1.0),uSnow*smoothstep(0.45,0.8,up));
        diffuseColor.rgb*=1.0-uWet*0.28*(1.0-uSnow);`)
      .replace('#include <tonemapping_fragment>',(key==='grass'?`
        float tl=pow(max(dot(normalize(vWPos-cameraPosition),uSunDir),0.0),5.0);
        gl_FragColor.rgb+=diffuseColor.rgb*uSunCol*vec3(1.2,1.05,0.55)*tl*vH*vH*2.2*(1.0-uSnow*0.7);
        `:'')+'#include <tonemapping_fragment>');
    if(key==='terrain'){s.vertexShader='varying vec3 vWPos;\n'+s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWPos=(modelMatrix*vec4(transformed,1.0)).xyz;');s.fragmentShader='varying vec3 vWPos;\n'+s.fragmentShader;}
    if(key==='grass'){s.vertexShader='varying vec3 vWPos;\n'+s.vertexShader;s.fragmentShader='uniform vec3 uSunDir;\nuniform vec3 uSunCol;\nvarying vec3 vWPos;\n'+s.fragmentShader;}
  };
  mat.customProgramCacheKey=()=>'w-'+key;
  return mat;
}

// ---------- sky ----------
const skyU={uTop:{value:new THREE.Color()},uHor:{value:new THREE.Color()},uSunCol:{value:new THREE.Color()},
  uSun:{value:new THREE.Vector3(0,1,0)},uStars:{value:0},uCloud:{value:0},uFlash:{value:0},uTime:WU.uTime,
  uCloudLit:{value:new THREE.Color()},uCloudDark:{value:new THREE.Color()},uWindOff:{value:0}};
const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,48,24),new THREE.ShaderMaterial({
  uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
  uniform vec3 uTop,uHor,uSunCol,uSun,uCloudLit,uCloudDark;uniform float uStars,uCloud,uFlash,uTime,uWindOff;varying vec3 vDir;
  float h31(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float v=0.0,a=0.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*n2(p);p=m*p;a*=0.5;}return v;}
  void main(){
    vec3 d=normalize(vDir);
    float y=d.y;
    vec3 col=mix(uHor,uTop,pow(clamp(y,0.0,1.0),0.5));
    col=mix(col,uHor*0.8,smoothstep(0.0,-0.25,y));
    vec3 sn=normalize(uSun);
    float sd=dot(d,sn);
    float clear=1.0-uCloud*0.85;
    col+=uSunCol*pow(max(sd,0.0),5.0)*0.4*clear;
    col+=uSunCol*pow(max(sd,0.0),48.0)*0.7*clear;
    col+=uSunCol*smoothstep(0.9992,0.9996,sd)*4.0*step(-0.02,sn.y+0.05);
    float md=dot(d,-sn);
    col+=vec3(0.85,0.9,1.0)*smoothstep(0.9994,0.9997,md)*1.4*uStars;
    col+=vec3(0.5,0.6,0.9)*pow(max(md,0.0),40.0)*0.15*uStars;
    vec3 sp=floor(d*420.0);
    float s=h31(sp);
    float tw=0.6+0.4*sin(uTime*2.0+s*60.0);
    col+=vec3(1.0)*step(0.9975,s)*tw*uStars*smoothstep(0.0,0.25,y);
    // painted cloud layer
    if(y>-0.02){
      vec2 cp=d.xz/(max(y,0.0)+0.13)*0.9+vec2(uWindOff,uWindOff*0.35);
      float cov=mix(0.7,0.2,uCloud);
      float n=fbm(cp);
      float dens=smoothstep(cov,cov+0.22,n)*smoothstep(-0.02,0.16,y);
      vec2 toSun=normalize(sn.xz+vec2(1e-4))*0.18;
      float nS=fbm(cp+toSun);
      float lit=clamp(0.55+(n-nS)*5.0,0.0,1.0);
      vec3 cc=mix(uCloudDark,uCloudLit,lit);
      cc+=uSunCol*pow(max(sd,0.0),10.0)*(1.0-smoothstep(cov,cov+0.4,n))*1.6*clear;
      col=mix(col,cc,dens*0.97);
    }
    col+=vec3(0.85,0.9,1.0)*uFlash;
    gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`
}));
sky.renderOrder=-1;
scene.add(sky);

// ---------- lights ----------
const hemi=new THREE.HemisphereLight(0xbcd4ff,0x3a3020,.5);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,2);
sun.castShadow=true;
const SM=isMobile?1024:2048;
sun.shadow.mapSize.set(SM,SM);
Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:320});
sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.03;
scene.add(sun);scene.add(sun.target);

// ---------- terrain ----------
const TS=640,TSEG=isMobile?200:290;
const tg=new THREE.PlaneGeometry(TS,TS,TSEG,TSEG);tg.rotateX(-Math.PI/2);
const tp=tg.attributes.position;
for(let i=0;i<tp.count;i++){tp.setY(i,heightAt(tp.getX(i),tp.getZ(i)));}
tg.computeVertexNormals();
const tcol=new Float32Array(tp.count*3);const c=new THREE.Color(),c2=new THREE.Color();
const G1=new THREE.Color(0x4f7233),G2=new THREE.Color(0x7c9a45),MEAD=new THREE.Color(0x8fae52),
  DIRT=new THREE.Color(0x7a6446),ROCK=new THREE.Color(0x77706a),SNOWC=new THREE.Color(0xe7edf2),SAND=new THREE.Color(0x9a8664),CLIFF2=new THREE.Color(0x8a6e58),WETSAND=new THREE.Color(0x6f5f45);
function distSeg(px,pz,ax,az,bx,bz){const vx=bx-ax,vz=bz-az,t=clamp(((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz),0,1);return Math.hypot(px-ax-vx*t,pz-az-vz*t);}
for(let i=0;i<tp.count;i++){
  const x=tp.getX(i),z=tp.getZ(i),y=tp.getY(i),ny=tg.attributes.normal.getY(i);
  const r=Math.hypot(x,z),n=fbm(x*.05,z*.05);
  c.copy(G1).lerp(G2,n);
  c.lerp(MEAD,(1-smooth(10,30,r))*.7);
  const path=Math.min(distSeg(x,z,0,3.6,FIRE.x,FIRE.z),Math.hypot(x-FIRE.x,z-FIRE.z)-1.2);
  c.lerp(DIRT,(1-smooth(.6,1.6,path))*.85);
  c.lerp(DIRT,(1-smooth(3.5,5.5,Math.hypot(x/1.2,z-0.5)))*.6);
  c.lerp(ROCK,smooth(.82,.62,ny)*smooth(5,12,y));
  const steep=smooth(.72,.5,ny);
  c.lerp(c2.copy(ROCK).multiplyScalar(.75+.5*fbm(x*.15+y*.4,z*.15)).lerp(CLIFF2,smooth(.4,.7,fbm(y*.35,x*.05+z*.05))*.5),steep*.92);
  const sd=pathDist(x,z);c.lerp(DIRT,(1-smooth(.8,2.0,sd))*.8*(y>SEA+2?1:.3));
  const dxc=x-coastEdge(z);
  if(dxc<-4){const sandW=smooth(SEA+3.5,SEA+1.5,y);c.lerp(SAND,sandW*smooth(.6,.8,ny));c.lerp(WETSAND,smooth(SEA+.8,SEA-.2,y));}
  c.lerp(ROCK,smooth(18,32,y)*.7);
  c.lerp(SNOWC,smooth(34,50,y+n*10));
  const lr=Math.hypot(x-LAKE.x,z-LAKE.z);
  c.lerp(SAND,(1-smooth(LAKE.r*.95,LAKE.r*1.35,lr))*.75);
  tcol[i*3]=c.r;tcol[i*3+1]=c.g;tcol[i*3+2]=c.b;
}
tg.setAttribute('color',new THREE.BufferAttribute(tcol,3));
const terrain=new THREE.Mesh(tg,weatherize(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0}),'terrain'));
terrain.receiveShadow=true;scene.add(terrain);

// lake
const water=new THREE.Mesh(new THREE.CircleGeometry(LAKE.r*1.45,48),
  new THREE.MeshPhongMaterial({color:0x2b4d5c,shininess:140,specular:0x9fb4c0,transparent:true,opacity:.88}));
water.rotation.x=-Math.PI/2;water.position.set(LAKE.x,-1.0,LAKE.z);scene.add(water);

// ---------- textures ----------
function canvasTex(w,h,draw){const cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;return t;}
const softDot=canvasTex(64,64,(g,w)=>{const gr=g.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.4,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,w);});
const cloudTex=canvasTex(256,128,(g,w,h)=>{for(let i=0;i<22;i++){const x=40+Math.random()*(w-80),y=h*.45+Math.random()*h*.25,r=18+Math.random()*34;
  const gr=g.createRadialGradient(x,y,0,x,y,r);gr.addColorStop(0,'rgba(255,255,255,.75)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.beginPath();g.arc(x,y,r,0,7);g.fill();}});
const logTex=canvasTex(128,256,(g,w,h)=>{const n=10,lh=h/n;for(let i=0;i<n;i++){const gr=g.createLinearGradient(0,i*lh,0,(i+1)*lh);
  gr.addColorStop(0,'#5a3c22');gr.addColorStop(.15,'#8a6038');gr.addColorStop(.6,'#7a5230');gr.addColorStop(.92,'#4a3019');gr.addColorStop(1,'#2a1a0e');g.fillStyle=gr;g.fillRect(0,i*lh,w,lh);}
  g.globalAlpha=.12;for(let i=0;i<60;i++){g.fillStyle=Math.random()<.5?'#000':'#c89a62';g.fillRect(Math.random()*w,Math.random()*h,8+Math.random()*30,1);} });
logTex.wrapS=logTex.wrapT=THREE.RepeatWrapping;

// ---------- cabin ----------
let charMatShared=null;
const cabin=new THREE.Group();scene.add(cabin);
const std=(col,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:col,roughness:.9,metalness:0},o));
function add(geo,mat,x,y,z,parent=cabin){const m=new THREE.Mesh(geo,mat);m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
const wallMat=std(0xffffff,{map:logTex});
// colliders for walking: boxes [minX,maxX,minZ,maxZ] and circles [x,z,r]
const BOXES=[],CIRCLES=[];
// walls with consistent log UVs, built around openings so the cabin is hollow
function wallBox(x0,x1,y0,y1,z0,z1,collide){
  const g=new THREE.BoxGeometry(x1-x0,y1-y0,z1-z0);g.translate((x0+x1)/2,(y0+y1)/2,(z0+z1)/2);
  const pa=g.attributes.position,na=g.attributes.normal,ua=g.attributes.uv;
  for(let i=0;i<pa.count;i++){const x=pa.getX(i),y=pa.getY(i),z=pa.getZ(i);
    if(Math.abs(na.getY(i))>.5)ua.setXY(i,x*.35,z*.35);else ua.setXY(i,(Math.abs(na.getX(i))>.5?z:x)*.35,y/3);}
  const m=new THREE.Mesh(g,wallMat);m.castShadow=m.receiveShadow=true;cabin.add(m);
  if(collide!==false&&y0<1.4)BOXES.push([x0,x1,z0,z1]);return m;}
const T_=.25,HX=3.5,HZ=2.75,WH=3;
wallBox(-HX,-2.15,0,WH,-HZ,-HZ+T_);wallBox(-1.05,HX,0,WH,-HZ,-HZ+T_);   // back, around window
wallBox(-2.15,-1.05,0,1.3,-HZ,-HZ+T_);wallBox(-2.15,-1.05,2.2,WH,-HZ,-HZ+T_);
wallBox(-HX,-HX+T_,0,WH,-HZ+T_,HZ-T_);                   // left
wallBox(HX-T_,HX,0,WH,-HZ+T_,-.5);wallBox(HX-T_,HX,0,WH,.5,HZ-T_);   // right, around window
wallBox(HX-T_,HX,0,1.3,-.5,.5);wallBox(HX-T_,HX,2.2,WH,-.5,.5);
// front: door at |x|<.55, windows at 1.45<|x|<2.55
[[-HX,-2.55],[-1.45,-.55],[.55,1.45],[2.55,HX]].forEach(a=>wallBox(a[0],a[1],0,WH,HZ-T_,HZ));
[[-2.55,-1.45],[1.45,2.55]].forEach(a=>{wallBox(a[0],a[1],0,1.25,HZ-T_,HZ);wallBox(a[0],a[1],2.25,WH,HZ-T_,HZ);});
wallBox(-.55,.55,2.2,WH,HZ-T_,HZ);
add(new THREE.BoxGeometry(7.4,.35,5.9),std(0x6b6660),0,.12,0);
// gable (its underside is the ceiling)
const gs=new THREE.Shape();gs.moveTo(-2.75,0);gs.lineTo(2.75,0);gs.lineTo(0,2.1);gs.lineTo(-2.75,0);
const gg=new THREE.ExtrudeGeometry(gs,{depth:6.9,bevelEnabled:false});gg.rotateY(Math.PI/2);gg.translate(-3.45,3,0);
add(gg,std(0x6e4a2b),0,0,0);
// roof
const roofMat=weatherize(std(0x4a3b33,{flatShading:true}),'roof');
const ang=Math.atan2(2.1,2.75),rl=Math.hypot(2.75,2.1)+.75;
const rf=add(new THREE.BoxGeometry(8.2,.24,rl),roofMat,0,4.05+.05,1.55);rf.rotation.x=ang;
const rb=add(new THREE.BoxGeometry(8.2,.24,rl),roofMat,0,4.05+.05,-1.55);rb.rotation.x=-ang;

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

// door, open onto the porch
const doorPivot=new THREE.Group();doorPivot.position.set(-.55,0,2.78);doorPivot.rotation.y=-1.75;cabin.add(doorPivot);
add(new THREE.BoxGeometry(1.1,2.1,.08),std(0x4a2f1a),.55,1.36,0,doorPivot);
add(new THREE.SphereGeometry(.06,8,6),std(0xc9a24a,{metalness:.6,roughness:.4}),.95,1.3,.07,doorPivot);
BOXES.push([-.75,-.45,2.75,3.95]);

// window frames + warm glow panes (only visible from outside; from inside you look out)
const frameMat=std(0x3a2616);
const glowMat=new THREE.MeshBasicMaterial({color:0xffb15c,transparent:true,opacity:0,depthWrite:false,side:THREE.FrontSide});
function windowAt(x,z,rotY,w,h,yc){
  const g=new THREE.Group();g.position.set(x,yc,z);g.rotation.y=rotY;cabin.add(g);
  add(new THREE.BoxGeometry(w+.16,.1,.32),frameMat,0,-h/2,0,g);add(new THREE.BoxGeometry(w+.16,.1,.32),frameMat,0,h/2,0,g);
  add(new THREE.BoxGeometry(.08,h,.3),frameMat,-w/2,0,0,g);add(new THREE.BoxGeometry(.08,h,.3),frameMat,w/2,0,0,g);
  add(new THREE.BoxGeometry(.05,h,.05),frameMat,0,0,0,g);add(new THREE.BoxGeometry(w,.05,.05),frameMat,0,0,0,g);
  const pane=new THREE.Mesh(new THREE.PlaneGeometry(w,h),glowMat);pane.position.z=.16;g.add(pane);
  add(new THREE.BoxGeometry(w+.3,.06,.28),frameMat,0,-h/2-.06,.12,g);}
windowAt(-2,HZ-.125,0,1.1,1.0,1.75);windowAt(2,HZ-.125,0,1.1,1.0,1.75);windowAt(HX-.125,0,Math.PI/2,1.0,.9,1.75);windowAt(-1.6,-HZ+.125,Math.PI,1.1,.9,1.75);

// porch
add(new THREE.BoxGeometry(7.2,.22,1.8),std(0x6a4a2e),0,.3,3.7);
[-3.4,3.4].forEach(x=>{add(new THREE.CylinderGeometry(.1,.1,2.6,6),std(0x5a3d24),x,1.5,4.45);CIRCLES.push([x,4.45,.15]);});
const porchRoof=add(new THREE.BoxGeometry(7.6,.16,1.9),roofMat,0,2.85,3.75);porchRoof.rotation.x=.22;
add(new THREE.BoxGeometry(1.6,.12,.45),std(0x7b5634),-2.1,.85,3.4);
[-2.75,-1.45].forEach(x=>add(new THREE.BoxGeometry(.1,.5,.4),std(0x5a3d24),x,.6,3.4));
BOXES.push([-2.95,-1.25,3.15,3.65]);
const logMat=std(0x8a6a48),logGeo=new THREE.CylinderGeometry(.16,.16,1.3,7);logGeo.rotateX(Math.PI/2);
for(let row=0;row<4;row++)for(let i=0;i<5-row;i++)add(logGeo,logMat,4.1+0,.2+row*.29,-1.6+i*.34+row*.17);
BOXES.push([3.85,4.4,-2.35,.35]);

// ---------- fireplace (back wall) and exterior stone chimney ----------
const stoneM=std(0xffffff,{map:stoneTex,roughness:1});
const FPX=1.6,FPZ=-2.2;
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
const hearthLight=new THREE.PointLight(0xff8a3a,1.5,11,2);hearthLight.position.set(FPX,1.0,-1.4);scene.add(hearthLight);
hearthLight.castShadow=!isMobile;hearthLight.shadow.mapSize.set(512,512);hearthLight.shadow.bias=-0.004;hearthLight.shadow.camera.near=.2;
const bounceLight=new THREE.PointLight(0xffd2a8,0,8,2);bounceLight.position.set(-.5,2.4,.2);scene.add(bounceLight);
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
function updateBeams(sd,strength,col){
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
const lanternLight=new THREE.PointLight(0xffb060,.6,6,2);lanternLight.position.set(-2.85,1.35,1.45);scene.add(lanternLight);
BOXES.push([-3.15,-2.55,1.15,1.75]);
// a small shelf with jars on the right wall
add(new THREE.BoxGeometry(.3,.05,1.4),std(0x5c3a22),3.1,1.9,-1.6);
[[-.45,0x8a6a3a],[-.15,0x6a7a52],[.15,0xb08850],[.45,0x7a4a3a]].forEach(j=>add(new THREE.CylinderGeometry(.07,.07,.2,8),std(j[1],{roughness:.5}),3.1,2.03,-1.6+j[0]));

// window glow light outside
const winLight=new THREE.PointLight(0xffa94d,0,14,2);winLight.position.set(0,1.8,4.2);scene.add(winLight);

// ---------- campfire ----------
const fireG=new THREE.Group();fireG.position.copy(FIRE);scene.add(fireG);
const stoneMat=std(0x7d7a74,{flatShading:true});
for(let i=0;i<9;i++){const a=i/9*Math.PI*2;const s=add(new THREE.DodecahedronGeometry(.28+rnd()*.1,0),stoneMat,Math.cos(a)*.95,.12,Math.sin(a)*.95,fireG);s.rotation.set(rnd()*3,rnd()*3,0);}
const charMat=std(0x3b2a1e);
for(let i=0;i<3;i++){const l=add(new THREE.CylinderGeometry(.09,.11,1.1,6),charMat,0,.28,0,fireG);l.rotation.set(1.1,i*2.1,0);}
const benchLog=new THREE.CylinderGeometry(.28,.3,2.4,8);benchLog.rotateZ(Math.PI/2);
add(benchLog,logMat,FIRE.x,.28,FIRE.z+2.6,scene);
const b2=add(benchLog,logMat,FIRE.x+2.5,.28,FIRE.z+.3,scene);b2.rotation.y=Math.PI/2.4;
CIRCLES.push([FIRE.x,FIRE.z,1.15],[FIRE.x+2.5,FIRE.z+.3,.9]);BOXES.push([FIRE.x-1.25,FIRE.x+1.25,FIRE.z+2.3,FIRE.z+2.9]);
const fireLight=new THREE.PointLight(0xff8a3a,2,22,2);fireLight.position.set(FIRE.x,1.1,FIRE.z);fireLight.castShadow=!isMobile;
fireLight.shadow.mapSize.set(512,512);fireLight.shadow.bias=-0.002;scene.add(fireLight);

function particles(n,size,opts){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
  g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
  const m=new THREE.PointsMaterial(Object.assign({size,map:softDot,transparent:true,depthWrite:false,vertexColors:true,sizeAttenuation:true},opts));
  const p=new THREE.Points(g,m);p.frustumCulled=false;scene.add(p);return p;
}
const FLAMES=70,flames=particles(FLAMES,.75,{blending:THREE.AdditiveBlending,fog:false});
const flameData=[...Array(FLAMES)].map(()=>({life:rnd(),vx:0,vz:0,ox:0,oz:0}));
const HF=40,hearth=particles(HF,.5,{blending:THREE.AdditiveBlending,fog:false});
const hearthData=[...Array(HF)].map(()=>({life:rnd(),ox:0,oz:0}));
const DUST=isMobile?90:180,dust=particles(DUST,.022,{blending:THREE.AdditiveBlending,fog:false,opacity:.5});
const dustData=[...Array(DUST)].map(()=>[(rnd()-.5)*6.3,.4+rnd()*2.5,(rnd()-.5)*4.8,rnd()*10]);
const SMOKE=46,smoke=particles(SMOKE,2.4,{opacity:.32});
const smokeData=[...Array(SMOKE)].map(()=>({life:rnd(),x:0,y:0,z:0}));
const FF=70,flies=particles(FF,.32,{blending:THREE.AdditiveBlending,opacity:0});
const flyData=[...Array(FF)].map(()=>{const a=rnd()*6.28,r=8+rnd()*24;return{x:Math.cos(a)*r,z:Math.sin(a)*r,y:.5+rnd()*2,p:rnd()*10};});
(function(){const col=flies.geometry.attributes.color;for(let i=0;i<FF;i++)col.setXYZ(i,.85,1,.45);})();

// ---------- trees ----------
function mergeGeo(list){let tot=0;const parts=list.map(g=>{const n=g.index?g.toNonIndexed():g;tot+=n.attributes.position.count;return n;});
  const pos=new Float32Array(tot*3),nor=new Float32Array(tot*3);let o=0;
  parts.forEach(p=>{pos.set(p.attributes.position.array,o*3);nor.set(p.attributes.normal.array,o*3);o+=p.attributes.position.count;});
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(pos,3));g.setAttribute('normal',new THREE.BufferAttribute(nor,3));return g;}
const crown=mergeGeo([new THREE.ConeGeometry(2.3,3.4,7).translate(0,2.9,0),new THREE.ConeGeometry(1.8,2.8,7).translate(0,4.3,0),new THREE.ConeGeometry(1.15,2.2,7).translate(0,5.6,0)]);
const trunk=new THREE.CylinderGeometry(.2,.32,2.4,6).translate(0,1.2,0);
const spots=[];
let tries=0;const TREES=isMobile?650:1000;
while(spots.length<TREES&&tries<20000){tries++;
  const a=rnd()*Math.PI*2,r=24+Math.pow(rnd(),.8)*190;const x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.55)continue;
  const y=heightAt(x,z);if(y>40)continue;
  if(fbm(x*.03+50,z*.03)<.38&&r>40)continue; // natural gaps
  if(x-coastEdge(z)<5||y<SEA+3)continue;
  if(pathDist(x,z)<4.5)continue;
  if(r<95&&(x*-.88+z*-.47)/r>.93)continue;   // vista toward the sea
  spots.push([x,y,z,.7+rnd()*.9,rnd()*6.28]);}
const crownMat=weatherize(std(0xffffff,{flatShading:true,roughness:.95}),'tree');
const crowns=new THREE.InstancedMesh(crown,crownMat,spots.length);
const trunks=new THREE.InstancedMesh(trunk,std(0x4d3624),spots.length);
const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),P=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0);
spots.forEach((s,i)=>{P.set(s[0],s[1]-.2,s[2]);Q.setFromAxisAngle(UP,s[4]);S.set(s[3],s[3]*(.9+rnd()*.3),s[3]);M.compose(P,Q,S);
  crowns.setMatrixAt(i,M);trunks.setMatrixAt(i,M);
  c.setHSL(.27+rnd()*.07,.35+rnd()*.2,.17+rnd()*.1);crowns.setColorAt(i,c);});
spots.forEach(t=>{if(Math.hypot(t[0],t[2])<110)CIRCLES.push([t[0],t[2],.35*t[3]]);});
crowns.frustumCulled=trunks.frustumCulled=false;
// keep trees out of the point-light (fire) shadow maps: cheap and avoids 6x tree passes
const noPointShadow=new THREE.MeshDistanceMaterial();noPointShadow.onBeforeCompile=s=>{s.vertexShader=s.vertexShader.replace('#include <project_vertex>','gl_Position=vec4(2.0,2.0,2.0,1.0);');};
crowns.customDistanceMaterial=trunks.customDistanceMaterial=noPointShadow;
crowns.castShadow=trunks.castShadow=true;crowns.receiveShadow=true;
scene.add(crowns,trunks);

// rocks
for(let i=0;i<40;i++){const a=rnd()*6.28,r=12+rnd()*60,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r||x-coastEdge(z)<3||pathDist(x,z)<2.5)continue;
  const s=.3+rnd()*1.3;const m=add(new THREE.DodecahedronGeometry(s,0),weatherize(std(0x86817a,{flatShading:true}),'rock'),x,heightAt(x,z)+s*.3,z,scene);m.rotation.set(rnd()*3,rnd()*3,rnd()*3);CIRCLES.push([x,z,s*.85]);}

const cliffRockMat=weatherize(std(0x7c776f,{flatShading:true}),'rock');
for(let i=0;i<70;i++){const z=-150+rnd()*300,dx=-2-rnd()*11,x=coastEdge(z)+dx;if(pathDist(x,z)<4)continue;
  const s=.8+rnd()*2.6*(dx<-8?.6:1);const y=heightAt(x,z);
  const m=add(new THREE.DodecahedronGeometry(s,0),cliffRockMat,x,y+s*.2,z,scene);m.scale.set(1,.7+rnd()*.8,1);m.rotation.set(rnd()*3,rnd()*3,rnd()*3);
  if(Math.hypot(x,z)<120)CIRCLES.push([x,z,s*.8]);}
const driftMat=std(0x9a8a76);
for(let i=0;i<9;i++){const z=GULLY[4][1]-30+rnd()*60,x=coastEdge(z)-11-rnd()*3.5;const y=heightAt(x,z);if(y<SEA+.3)continue;
  const l=add(new THREE.CylinderGeometry(.12+rnd()*.1,.15+rnd()*.1,1.8+rnd()*2.2,6),driftMat,x,y+.12,z,scene);l.rotation.set(Math.PI/2,0,rnd()*3.14);}
// path posts with a rope down the ravine, and a little sign at the top
const postMat=std(0x5a3d24),ropeMat=new THREE.LineBasicMaterial({color:0x8a7656});
{const ropePts=[];
 for(let i=0;i<GULLY.length-1;i++){const a=GULLY[i],b=GULLY[i+1],L=Math.hypot(b[0]-a[0],b[1]-a[1]),n=Math.max(1,Math.round(L/5));
   const nx=-(b[1]-a[1])/L,nz=(b[0]-a[0])/L;
   for(let k=0;k<n;k++){const t=k/n,x=a[0]+(b[0]-a[0])*t+nx*1.7,z=a[1]+(b[1]-a[1])*t+nz*1.7,y=heightAt(x,z);
     add(new THREE.CylinderGeometry(.07,.08,1.1,6),postMat,x,y+.55,z,scene);ropePts.push(new THREE.Vector3(x,y+.95,z));CIRCLES.push([x,z,.12]);}}
 scene.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(ropePts),ropeMat));
 const g0=GULLY[0],sx=g0[0]+2.2,sz=g0[1]-1.8,sy=heightAt(sx,sz);
 add(new THREE.CylinderGeometry(.08,.09,1.6,6),postMat,sx,sy+.8,sz,scene);
 const board=add(new THREE.BoxGeometry(.9,.32,.06),std(0x7b5634),sx-.25,sy+1.35,sz,scene);board.rotation.y=.9;CIRCLES.push([sx,sz,.15]);}

// ---------- sea ----------
const seaU={uTime:WU.uTime,uWind:WU.uWind,uSunDir:{value:new THREE.Vector3()},uSunCol:{value:new THREE.Color()},uSkyTop:{value:new THREE.Color()},
  uSkyHor:{value:new THREE.Color()},uDeep:{value:new THREE.Color()},uFoam:{value:new THREE.Color()},uRain:{value:0}};
const sea=new THREE.Mesh(new THREE.PlaneGeometry(2600,4200,1,1).rotateX(-Math.PI/2),new THREE.ShaderMaterial({uniforms:seaU,fog:false,
  vertexShader:`varying vec3 vW;void main(){vec4 w=modelMatrix*vec4(position,1.0);vW=w.xyz;gl_Position=projectionMatrix*viewMatrix*w;}`,
  fragmentShader:`
  uniform float uTime,uWind,uRain;uniform vec3 uSunDir,uSunCol,uSkyTop,uSkyHor,uDeep,uFoam;varying vec3 vW;
  float coast(float z){return -62.0+6.0*sin(z*0.03)+4.0*sin(z*0.083+2.0);}
  float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
  void main(){
    vec3 V=normalize(cameraPosition-vW);float dist=length(cameraPosition-vW);
    vec2 p=vW.xz;float t=uTime;vec2 g=vec2(0.0);
    for(int i=0;i<6;i++){float fi=float(i);float a=fi*1.7+0.4;vec2 d=vec2(cos(a),sin(a));float f=0.12*pow(1.75,fi);float amp=0.5/pow(1.9,fi);
      g+=d*f*amp*cos(dot(d,p)*f+t*sqrt(9.8*f)*0.9+fi*2.1);}
    g*=(0.35+uWind*0.9)*smoothstep(900.0,60.0,dist);
    g+=vec2(n2(p*1.7+t*0.6)-0.5,n2(p*1.7-t*0.5+9.0)-0.5)*0.12*uRain;
    vec3 N=normalize(vec3(-g.x,1.0,-g.y));
    float fr=0.03+0.97*pow(1.0-max(dot(N,V),0.0),5.0);
    vec3 R=reflect(-V,N);
    vec3 sky=mix(uSkyHor,uSkyTop,pow(clamp(R.y,0.0,1.0),0.5));
    vec3 col=mix(uDeep,sky,fr);
    float sr=max(dot(R,uSunDir),0.0);
    col+=uSunCol*(pow(sr,420.0)*9.0+pow(sr,60.0)*0.5+pow(sr,8.0)*0.06);
    float sh=vW.x-coast(vW.z)+16.5;
    float band=smoothstep(-9.0,0.5,sh);
    float wl=0.5+0.5*sin(sh*1.1-t*1.3+sin(vW.z*0.15)*2.5);
    float foam=band*smoothstep(0.55,0.95,wl*(0.7+0.6*n2(p*1.3+t*0.3)));
    foam=max(foam,smoothstep(-0.6,0.4,sh)*0.9);
    col=mix(col,uFoam,clamp(foam,0.0,1.0)*0.85);
    col=mix(col,uDeep*1.6,smoothstep(-3.0,0.0,sh)*0.25);
    gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`}));
sea.position.set(-1340,SEA,0);sea.frustumCulled=false;scene.add(sea);

// ---------- grass ----------
const blade=new THREE.PlaneGeometry(.13,1,1,3);blade.translate(0,.5,0);
const grassMat=weatherize(new THREE.MeshStandardMaterial({side:THREE.DoubleSide,roughness:.9,metalness:0}),'grass',`
  #ifdef USE_INSTANCING
    vec2 ip=vec2(instanceMatrix[3][0],instanceMatrix[3][2]);
  #else
    vec2 ip=vec2(0.0);
  #endif
  float bend=pow(clamp(position.y,0.0,1.0),2.0);
  float gust=sin(uTime*0.9+ip.x*0.08)*0.5+0.5;
  float w=sin(uTime*1.8+ip.x*0.35+ip.y*0.22)*0.6+sin(uTime*3.3+ip.y*0.8)*0.25;
  transformed.x+=(w*(0.12+uWind*0.5)+uWind*(0.25+gust*0.35))*bend;
  transformed.z+=sin(uTime*2.4+ip.y*0.5)*0.08*bend*(0.3+uWind);
  #ifdef USE_INSTANCING
    vWPos=(modelMatrix*instanceMatrix*vec4(transformed,1.0)).xyz;
  #else
    vWPos=(modelMatrix*vec4(transformed,1.0)).xyz;
  #endif`);
const GRASS=isMobile?14000:26000;
const grass=new THREE.InstancedMesh(blade,grassMat,GRASS);
let gi=0;
while(gi<GRASS){const a=rnd()*6.28,r=Math.sqrt(rnd())*38,x=Math.cos(a)*r,z=Math.sin(a)*r;
  if(Math.abs(x)<4.6&&z>-3.9&&z<4.8)continue;
  if(Math.hypot(x-FIRE.x,z-FIRE.z)<1.6)continue;
  if(distSeg(x,z,0,3.6,FIRE.x,FIRE.z)<.9||pathDist(x,z)<.9)continue;
  if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.1)continue;
  const h=.3+rnd()*.45*(1+smooth(8,30,r)*.6);
  P.set(x,heightAt(x,z)-.05,z);Q.setFromAxisAngle(UP,rnd()*6.28);S.set(1,h,1);M.compose(P,Q,S);grass.setMatrixAt(gi,M);
  c.setHSL(.2+rnd()*.08,.45+rnd()*.15,.3+rnd()*.12);
  if(rnd()<.015)c.setHSL(rnd()<.5?.13:.75,.7,.65); // little flowers
  grass.setColorAt(gi,c);gi++;}
grass.receiveShadow=true;grass.frustumCulled=false;scene.add(grass);

// ---------- rain & snow ----------
const BOX=34,RAIN=isMobile?2500:5000,SNOW=isMobile?1800:3200;
const rainGeo=new THREE.BufferGeometry();const rainPos=new Float32Array(RAIN*6);
rainGeo.setAttribute('position',new THREE.BufferAttribute(rainPos,3));
const rain=new THREE.LineSegments(rainGeo,new THREE.LineBasicMaterial({color:0xb8c6d6,transparent:true,opacity:0,depthWrite:false}));
rain.frustumCulled=false;scene.add(rain);
const drops=[...Array(RAIN)].map(()=>[(rnd()-.5)*2*BOX,rnd()*30,(rnd()-.5)*2*BOX,16+rnd()*8]);
const snow=particles(SNOW,.28,{opacity:0});
(function(){const col=snow.geometry.attributes.color;for(let i=0;i<SNOW;i++)col.setXYZ(i,1,1,1);})();
const flakes=[...Array(SNOW)].map(()=>[(rnd()-.5)*2*BOX,rnd()*26,(rnd()-.5)*2*BOX,rnd()*10,.8+rnd()*.8]);

// ---------- weather presets ----------
const W={
  klar:{cloud:.12,rain:0,snow:0,fog:0,wind:.22,storm:0,label:'klar'},
  wolken:{cloud:.68,rain:0,snow:0,fog:.1,wind:.45,storm:0,label:'bewölkt'},
  regen:{cloud:.9,rain:1,snow:0,fog:.3,wind:.55,storm:0,label:'Regen'},
  gewitter:{cloud:1,rain:1,snow:0,fog:.2,wind:1,storm:1,label:'Gewitter'},
  schnee:{cloud:.82,rain:0,snow:1,fog:.35,wind:.28,storm:0,label:'Schneefall'},
  nebel:{cloud:.5,rain:0,snow:0,fog:1,wind:.08,storm:0,label:'Nebel'}
};
let wKey='klar';const cur=Object.assign({},W.klar);

// ---------- sky colors over the day ----------
const KEYS=[
  [-.4,0x040912,0x0b1824],[-.14,0x121d46,0x3a2c58],[-.02,0x37397a,0xee6948],[.06,0x5468ad,0xf6a25c],
  [.16,0x5885c4,0xf5cd98],[.35,0x4e88cf,0xc8dbea],[1,0x3b7ac8,0xd3e5ef]];
const kc=KEYS.map(k=>[k[0],new THREE.Color(k[1]),new THREE.Color(k[2])]);
function skyAt(sy,top,hor){
  if(sy<=kc[0][0]){top.copy(kc[0][1]);hor.copy(kc[0][2]);return;}
  for(let i=1;i<kc.length;i++){if(sy<=kc[i][0]){const t=(sy-kc[i-1][0])/(kc[i][0]-kc[i-1][0]);
    top.copy(kc[i-1][1]).lerp(kc[i][1],t);hor.copy(kc[i-1][2]).lerp(kc[i][2],t);return;}}
  top.copy(kc[kc.length-1][1]);hor.copy(kc[kc.length-1][2]);
}
function greyify(col,amt,dark){const l=col.r*.3+col.g*.55+col.b*.15;c2.setRGB(l*.95,l*.98,l*1.05);col.lerp(c2,amt).multiplyScalar(1-dark);}

// ---------- state ----------
const c2v=new THREE.Vector3(),fwd=new THREE.Vector3();
let hour=17,playing=true,flash=0,nextBolt=6,snowCover=0,wet=0,T=0;
const SPEEDS=[[20,'1 h / 20 s'],[8,'1 h / 8 s'],[2,'1 h / 2 s']];let speedI=1;
const top=new THREE.Color(),hor=new THREE.Color(),sunCol=new THREE.Color(),tmp=new THREE.Color();
const sunDir=new THREE.Vector3();

// ---------- camera control ----------
const target=new THREE.Vector3(2,3.6,2.5);
let az=.95,pol=1.5,dist=25,tAz=az,tPol=pol,tDist=dist,idle=0;
const pointers=new Map();let pinch0=0,dist0=0;
let mode='orbit';
const player={x:0,z:8.5,y:0,yaw:0,pitch:-.05,bob:0};
const keys={};let joyX=0,joyY=0,indoor=0;
canvas.addEventListener('pointerdown',e=>{canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,{x:e.clientX,y:e.clientY});idle=0;hideHint();
  if(pointers.size===2){const [a,b]=[...pointers.values()];pinch0=Math.hypot(a.x-b.x,a.y-b.y);dist0=tDist;}});
canvas.addEventListener('pointermove',e=>{const p=pointers.get(e.pointerId);if(!p)return;idle=0;
  const dx=e.clientX-p.x,dy=e.clientY-p.y;
  if(mode==='fp'){const k=e.pointerType==='touch'?.0065:.0042;player.yaw-=dx*k;player.pitch=clamp(player.pitch-dy*k,-1.35,1.35);}
  else if(pointers.size===1){tAz-=dx*.006;tPol=clamp(tPol-dy*.005,.35,1.5);}
  p.x=e.clientX;p.y=e.clientY;
  if(mode==='orbit'&&pointers.size===2){const [a,b]=[...pointers.values()];const d=Math.hypot(a.x-b.x,a.y-b.y);if(pinch0>0)tDist=clamp(dist0*pinch0/d,7,80);}});
canvas.addEventListener('wheel',e=>{e.preventDefault();if(mode==='fp')return;idle=0;hideHint();tDist=clamp(tDist*(1+Math.sign(e.deltaY)*.1),7,80);},{passive:false});

addEventListener('keydown',e=>{if(e.target&&e.target.type==='range')return;keys[e.code]=true;
  if(mode==='fp'&&/^(Arrow|Space)/.test(e.code))e.preventDefault();});
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

const PR=.28;
function blocked(x,z){
  for(const b of BOXES)if(x>b[0]-PR&&x<b[1]+PR&&z>b[2]-PR&&z<b[3]+PR)return true;
  for(const c of CIRCLES){const dx=x-c[0],dz=z-c[1],r=c[2]+PR;if(dx*dx+dz*dz<r*r)return true;}
  if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.02)return true;
  if(Math.hypot(x,z)>120)return true;
  if(x<-40&&heightAt(x,z)<SEA+.25)return true;   // the sea
  return false;}
// cliffs and ravine walls are too steep to walk
function tooSteep(x0,z0,x1,z1){
  if(Math.abs(x1)<5&&z1>-4&&z1<6)return false;
  const a=floorAt(x0,z0),b=floorAt(x1,z1),d=Math.hypot(x1-x0,z1-z0)+1e-6;
  return b-a>d*1.25||a-b>d*1.6;}
function floorAt(x,z){
  if(Math.abs(x)<3.5&&Math.abs(z)<2.75)return .31;
  if(Math.abs(x)<3.6&&z>=2.75&&z<4.6)return .41;
  return Math.max(heightAt(x,z),Math.abs(x)<3.7&&Math.abs(z)<2.95?.3:-99);}
const isInside=(x,z)=>Math.abs(x)<3.3&&z>-2.55&&z<2.6;
const touchUI=matchMedia('(pointer:coarse)').matches;
function setMode(m){
  mode=m;document.body.classList.toggle('fp',m==='fp');
  $('modeBtn').textContent=m==='fp'?'Rundblick':'Hineingehen';
  $('modeBtn').setAttribute('aria-pressed',m==='fp');
  if(m==='fp'){player.x=0;player.z=8.5;player.yaw=0;player.pitch=-.05;player.y=floorAt(0,8.5);camera.near=.05;
    const h=$('hint');h.textContent=touchUI?'Links mit dem Joystick gehen, rechts ziehen zum Umsehen':'W A S D zum Gehen, Shift zum Laufen, Ziehen zum Umsehen';h.classList.remove('gone');setTimeout(hideHint,7000);}
  else{camera.near=.1;target.set(2,3.6,2.5);}
  camera.updateProjectionMatrix();}
$('modeBtn').addEventListener('click',()=>setMode(mode==='fp'?'orbit':'fp'));


// ---------- UI ----------
const timeIn=$('time'),knob=$('knob'),clock=$('clock');
let dragging=false;
timeIn.addEventListener('input',()=>{hour=parseFloat(timeIn.value);dragging=true;});
timeIn.addEventListener('change',()=>{dragging=false;});
$('playBtn').addEventListener('click',()=>{playing=!playing;$('playBtn').setAttribute('aria-label',playing?'Zeit anhalten':'Zeit laufen lassen');
  $('playIcon').innerHTML=playing?'<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>':'<path d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5z"/>';});
$('speedBtn').addEventListener('click',()=>{speedI=(speedI+1)%SPEEDS.length;$('speedBtn').textContent=SPEEDS[speedI][1];});
document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{wKey=b.dataset.w;
  document.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
  if(wKey==='gewitter')nextBolt=T+2.5;}));
let hintT=null;function hideHint(){$('hint').classList.add('gone');}
setTimeout(hideHint,7000);

function phaseName(h,sy){
  if(sy<-.2)return 'Nacht';
  if(h<12&&sy<.02)return 'Morgendämmerung';
  if(h<12&&sy<.3)return 'Früher Morgen';
  if(h<10.5)return 'Morgen';
  if(h<13.5)return 'Mittag';
  if(sy>.3)return 'Nachmittag';
  if(sy>.02)return 'Goldene Stunde';
  return 'Abenddämmerung';
}

// ---------- audio ----------
let AC=null,A=null,soundOn=false;
function initAudio(){
  AC=new (window.AudioContext||window.webkitAudioContext)();
  const master=AC.createGain();master.gain.value=.9;master.connect(AC.destination);
  const len=AC.sampleRate*4;const white=AC.createBuffer(1,len,AC.sampleRate),brown=AC.createBuffer(1,len,AC.sampleRate);
  const wd=white.getChannelData(0),bd=brown.getChannelData(0);let last=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;wd[i]=w;last=(last+.02*w)/1.02;bd[i]=last*3.5;}
  const loop=(buf)=>{const s=AC.createBufferSource();s.buffer=buf;s.loop=true;s.start();return s;};
  const gain=(v,dest)=>{const g=AC.createGain();g.gain.value=v;g.connect(dest);return g;};
  const filt=(type,f,q,dest)=>{const b=AC.createBiquadFilter();b.type=type;b.frequency.value=f;if(q)b.Q.value=q;b.connect(dest);return b;};
  const windG=gain(0,master);const wf=filt('lowpass',420,.7,windG);loop(brown).connect(wf);
  const lfo=AC.createOscillator();lfo.frequency.value=.11;const lfoG=AC.createGain();lfoG.gain.value=220;lfo.connect(lfoG);lfoG.connect(wf.frequency);lfo.start();
  const rainG=gain(0,master);const rl=filt('lowpass',6500,0,rainG);const rh=filt('highpass',700,0,rl);loop(white).connect(rh);
  const cricketG=gain(0,master);const am=gain(.0,cricketG);const osc=AC.createOscillator();osc.frequency.value=4400;osc.connect(am);osc.start();
  const tr=AC.createOscillator();tr.type='square';tr.frequency.value=28;const trG=AC.createGain();trG.gain.value=.5;tr.connect(trG);trG.connect(am.gain);tr.start();
  const surfG=gain(0,master);const sf=filt('lowpass',700,.5,surfG);const sAm=gain(.55,sf);loop(brown).connect(sAm);
  const swell=AC.createOscillator();swell.frequency.value=.09;const swG=AC.createGain();swG.gain.value=.45;swell.connect(swG);swG.connect(sAm.gain);swell.start();
  A={master,windG,rainG,cricketG,white,brown,rl,wf,surfG,acc:0};
}
function crackle(vol){if(!A||vol<.02)return;const s=AC.createBufferSource();s.buffer=A.white;
  const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1200+Math.random()*2500;bp.Q.value=1.4;
  const g=AC.createGain();const t=AC.currentTime,d=.015+Math.random()*.05;g.gain.setValueAtTime(vol*(.3+Math.random()*.7),t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  s.connect(bp);bp.connect(g);g.connect(A.master);s.start(t,Math.random()*3,d+.02);}
function chirp(vol){if(!A)return;const t0=AC.currentTime;const n=2+Math.floor(Math.random()*4);const base=2600+Math.random()*1800;
  for(let i=0;i<n;i++){const o=AC.createOscillator(),g=AC.createGain();const t=t0+i*(.12+Math.random()*.08);
    o.frequency.setValueAtTime(base,t);o.frequency.exponentialRampToValueAtTime(base*(1.3+Math.random()*.4),t+.05);o.frequency.exponentialRampToValueAtTime(base*.9,t+.1);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.11);
    o.connect(g);g.connect(A.master);o.start(t);o.stop(t+.13);}}
function thunder(delay,vol){if(!A)return;const s=AC.createBufferSource();s.buffer=A.brown;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=160;
  const g=AC.createGain();const t=AC.currentTime+delay;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.08);g.gain.exponentialRampToValueAtTime(.001,t+4.5);
  s.connect(lp);lp.connect(g);g.connect(A.master);s.start(t,Math.random()*2,5);}
$('soundBtn').addEventListener('click',async()=>{
  soundOn=!soundOn;if(soundOn&&!AC)initAudio();
  if(AC){soundOn?await AC.resume():await AC.suspend();}
  $('soundBtn').setAttribute('aria-pressed',soundOn);$('waves').setAttribute('opacity',soundOn?'1':'.35');
  $('soundLbl').textContent=soundOn?'An':'Klang';});

// ---------- post-processing: height fog, sun shafts, bloom, colour grade ----------
const PP={};
let lookOn=true;
if(POST){
  const mkRT=(w,h,type,depth)=>{const rt=new THREE.WebGLRenderTarget(w,h,{type:type||THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:!!depth});
    if(depth){rt.depthTexture=new THREE.DepthTexture(w,h);rt.depthTexture.type=THREE.UnsignedIntType;}return rt;};
  PP.cam=new THREE.OrthographicCamera(-1,1,1,-1,0,1);PP.scene=new THREE.Scene();
  PP.quad=new THREE.Mesh(new THREE.PlaneGeometry(2,2));PP.quad.frustumCulled=false;PP.scene.add(PP.quad);
  const V=`varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.0,1.0);}`;
  const mk=(u,f)=>new THREE.ShaderMaterial({uniforms:u,vertexShader:V,fragmentShader:'varying vec2 vUv;\n'+f,depthTest:false,depthWrite:false});
  PP.bright=mk({tIn:{value:null},uTexel:{value:new THREE.Vector2()},uThresh:{value:1.0}},`
    uniform sampler2D tIn;uniform vec2 uTexel;uniform float uThresh;
    void main(){vec3 c=(texture2D(tIn,vUv+uTexel*vec2(-.5,-.5)).rgb+texture2D(tIn,vUv+uTexel*vec2(.5,-.5)).rgb+texture2D(tIn,vUv+uTexel*vec2(-.5,.5)).rgb+texture2D(tIn,vUv+uTexel*vec2(.5,.5)).rgb)*.25;
      c=min(c,vec3(12.0));float l=max(c.r,max(c.g,c.b));gl_FragColor=vec4(c*smoothstep(uThresh,uThresh*2.2,l),1.0);}`);
  PP.blur=mk({tIn:{value:null},uDir:{value:new THREE.Vector2()}},`
    uniform sampler2D tIn;uniform vec2 uDir;
    void main(){vec3 s=texture2D(tIn,vUv).rgb*.2270270;
      s+=(texture2D(tIn,vUv+uDir*1.3846153).rgb+texture2D(tIn,vUv-uDir*1.3846153).rgb)*.3162162;
      s+=(texture2D(tIn,vUv+uDir*3.2307692).rgb+texture2D(tIn,vUv-uDir*3.2307692).rgb)*.0702703;gl_FragColor=vec4(s,1.0);}`);
  PP.occ=mk({tColor:{value:null},tDepth:{value:null},uSunUV:{value:new THREE.Vector2()},uAspect:{value:1}},`
    uniform sampler2D tColor,tDepth;uniform vec2 uSunUV;uniform float uAspect;
    void main(){float sky=step(0.99999,texture2D(tDepth,vUv).x);vec3 c=texture2D(tColor,vUv).rgb;
      float l=min(max(dot(c,vec3(.3,.59,.11))-0.8,0.0),3.0);float pr=1.0-smoothstep(0.0,0.3,length((vUv-uSunUV)*vec2(uAspect,1.0)));
      gl_FragColor=vec4(vec3(sky*pr*pr*l),1.0);}`);
  PP.radial=mk({tIn:{value:null},uSunUV:{value:new THREE.Vector2()}},`
    uniform sampler2D tIn;uniform vec2 uSunUV;
    void main(){vec2 dl=(vUv-uSunUV)*(0.92/48.0);vec2 uv=vUv;float il=1.0,acc=0.0;
      for(int i=0;i<48;i++){uv-=dl;acc+=texture2D(tIn,clamp(uv,0.0,1.0)).r*il;il*=0.962;}
      gl_FragColor=vec4(vec3(acc/48.0*1.6),1.0);}`);
  PP.comp=mk({tColor:{value:null},tDepth:{value:null},tB1:{value:null},tB2:{value:null},tRays:{value:null},
    uInvProj:{value:new THREE.Matrix4()},uCamWorld:{value:new THREE.Matrix4()},uCamPos:{value:new THREE.Vector3()},
    uFogCol:{value:new THREE.Color()},uFogSun:{value:new THREE.Color()},uSunDir:{value:new THREE.Vector3()},
    uFogDens:{value:.002},uFogStart:{value:30},uFogFall:{value:.045},uHaze:{value:.0012},uRayCol:{value:new THREE.Color()},uRayInt:{value:0},
    uBloom:{value:.22},uExposure:{value:1},uLook:{value:1},uTime:{value:0},uShadowTint:{value:new THREE.Color()},
    uHighTint:{value:new THREE.Color()},uSat:{value:1.1},uVig:{value:.5}},`
    uniform sampler2D tColor,tDepth,tB1,tB2,tRays;uniform mat4 uInvProj,uCamWorld;uniform vec3 uCamPos,uFogCol,uFogSun,uSunDir,uRayCol,uShadowTint,uHighTint;
    uniform float uFogStart,uFogDens,uFogFall,uHaze,uRayInt,uBloom,uExposure,uLook,uTime,uSat,uVig;
    vec3 rrt(vec3 v){vec3 a=v*(v+0.0245786)-0.000090537;vec3 b=v*(0.983729*v+0.4329510)+0.238081;return a/b;}
    vec3 aces(vec3 c){const mat3 I=mat3(vec3(0.59719,0.07600,0.02840),vec3(0.35458,0.90834,0.13383),vec3(0.04823,0.01566,0.83777));
      const mat3 O=mat3(vec3(1.60475,-0.10208,-0.00327),vec3(-0.53108,1.10813,-0.07276),vec3(-0.07367,-0.00605,1.07602));
      c*=1.0/0.6;c=I*c;c=rrt(c);c=O*c;return clamp(c,0.0,1.0);}
    vec3 srgb(vec3 c){return mix(pow(c,vec3(0.41666))*1.055-0.055,c*12.92,step(c,vec3(0.0031308)));}
    void main(){
      vec3 col=texture2D(tColor,vUv).rgb;
      float d=texture2D(tDepth,vUv).x;bool sky=d>0.99999;
      vec4 vp=uInvProj*vec4(vUv*2.0-1.0,sky?1.0:d*2.0-1.0,1.0);vec3 vpos=vp.xyz/vp.w;
      float dist=sky?1800.0:max(length(vpos)-uFogStart,0.0);vec3 rd=normalize(mat3(uCamWorld)*normalize(vpos));
      float ry=abs(rd.y)<1e-3?1e-3:rd.y;float b=uFogFall;
      float fh=uFogDens*exp(-max(uCamPos.y,-5.0)*b)*(1.0-exp(-dist*ry*b))/(ry*b);
      float fog=1.0-exp(-fh);
      if(!sky){fog=1.0-(1.0-fog)*exp(-dist*uHaze);}else{fog*=0.92;}
      vec3 fc=mix(uFogCol,uFogSun,pow(max(dot(rd,uSunDir),0.0),6.0));
      col=mix(col,fc,clamp(fog,0.0,1.0));
      if(uLook>0.5){col+=texture2D(tB1,vUv).rgb*uBloom+texture2D(tB2,vUv).rgb*uBloom*1.4;col+=uRayCol*texture2D(tRays,vUv).r*uRayInt;}
      col=aces(col*uExposure);
      col=srgb(col);
      if(uLook>0.5){
        float l=dot(col,vec3(.299,.587,.114));
        col=mix(vec3(l),col,uSat);
        col=mix(col,col*uShadowTint*1.3,(1.0-smoothstep(0.0,0.55,l))*0.5);
        col=mix(col,1.0-(1.0-col)*(1.0-uHighTint*0.35),smoothstep(0.5,1.0,l)*0.35);
        col=mix(col,col*col*(3.0-2.0*col),0.35);
        col*=mix(1.0,smoothstep(1.3,0.35,length(vUv-0.5)*1.414),uVig);
        float g=fract(sin(dot(vUv*vec2(1234.5,987.6)+fract(uTime),vec2(12.9898,78.233)))*43758.5453);col+=(g-0.5)*0.022;
      }
      gl_FragColor=vec4(clamp(col,0.0,1.0),1.0);}`);
  PP.fxaa=mk({tIn:{value:null},uTexel:{value:new THREE.Vector2()}},`
    uniform sampler2D tIn;uniform vec2 uTexel;
    float lu(vec3 c){return dot(c,vec3(.299,.587,.114));}
    void main(){vec3 nw=texture2D(tIn,vUv+vec2(-1.,-1.)*uTexel).rgb,ne=texture2D(tIn,vUv+vec2(1.,-1.)*uTexel).rgb,
      sw=texture2D(tIn,vUv+vec2(-1.,1.)*uTexel).rgb,se=texture2D(tIn,vUv+vec2(1.,1.)*uTexel).rgb,m=texture2D(tIn,vUv).rgb;
      float a=lu(nw),b=lu(ne),c=lu(sw),e=lu(se),lm=lu(m);
      float mn=min(lm,min(min(a,b),min(c,e))),mx=max(lm,max(max(a,b),max(c,e)));
      vec2 dir=vec2(-((a+b)-(c+e)),(a+c)-(b+e));
      float red=max((a+b+c+e)*(0.25/8.0),1.0/128.0);float rcp=1.0/(min(abs(dir.x),abs(dir.y))+red);
      dir=clamp(dir*rcp,-8.0,8.0)*uTexel;
      vec3 A=0.5*(texture2D(tIn,vUv+dir*(1.0/3.0-0.5)).rgb+texture2D(tIn,vUv+dir*(2.0/3.0-0.5)).rgb);
      vec3 B=A*0.5+0.25*(texture2D(tIn,vUv-dir*0.5).rgb+texture2D(tIn,vUv+dir*0.5).rgb);
      float lb=lu(B);gl_FragColor=vec4((lb<mn||lb>mx)?A:B,1.0);}`);
  PP.resize=()=>{const w=renderer.domElement.width,h=renderer.domElement.height;
    for(const k of ['main','ldr','half','q1','q2','e1','e2','r1','r2'])if(PP[k])PP[k].dispose();
    PP.main=mkRT(w,h,THREE.HalfFloatType,true);PP.ldr=mkRT(w,h,THREE.UnsignedByteType);
    PP.half=mkRT(w>>1,h>>1);PP.q1=mkRT(w>>2,h>>2);PP.q2=mkRT(w>>2,h>>2);PP.e1=mkRT(w>>3,h>>3);PP.e2=mkRT(w>>3,h>>3);
    PP.r1=mkRT(w>>2,h>>2);PP.r2=mkRT(w>>2,h>>2);PP.w=w;PP.h=h;};
  PP.resize();
  PP.pass=(mat,target)=>{PP.quad.material=mat;renderer.setRenderTarget(target);renderer.render(PP.scene,PP.cam);};
}
function renderFrame(){
  if(!POST){renderer.render(scene,camera);return;}
  renderer.setRenderTarget(PP.main);renderer.render(scene,camera);
  const C=PP.comp.uniforms;
  if(lookOn){
    PP.bright.uniforms.tIn.value=PP.main.texture;PP.bright.uniforms.uTexel.value.set(1/PP.w,1/PP.h);PP.pass(PP.bright,PP.half);
    const bl=PP.blur.uniforms;
    bl.tIn.value=PP.half.texture;bl.uDir.value.set(2/PP.w,0);PP.pass(PP.blur,PP.q1);
    bl.tIn.value=PP.q1.texture;bl.uDir.value.set(0,4/PP.h);PP.pass(PP.blur,PP.q2);
    bl.tIn.value=PP.q2.texture;bl.uDir.value.set(4/PP.w,0);PP.pass(PP.blur,PP.e1);
    bl.tIn.value=PP.e1.texture;bl.uDir.value.set(0,8/PP.h);PP.pass(PP.blur,PP.e2);
    if(C.uRayInt.value>.002){
      PP.occ.uniforms.tColor.value=PP.main.texture;PP.occ.uniforms.tDepth.value=PP.main.depthTexture;PP.occ.uniforms.uAspect.value=PP.w/PP.h;PP.pass(PP.occ,PP.r1);
      PP.radial.uniforms.tIn.value=PP.r1.texture;PP.pass(PP.radial,PP.r2);}
  }
  C.tColor.value=PP.main.texture;C.tDepth.value=PP.main.depthTexture;C.tB1.value=PP.q2.texture;C.tB2.value=PP.e2.texture;C.tRays.value=PP.r2.texture;
  C.uLook.value=lookOn?1:0;
  C.uInvProj.value.copy(camera.projectionMatrixInverse);C.uCamWorld.value.copy(camera.matrixWorld);C.uCamPos.value.copy(camera.position);
  PP.pass(PP.comp,PP.ldr);
  PP.fxaa.uniforms.tIn.value=PP.ldr.texture;PP.fxaa.uniforms.uTexel.value.set(1/PP.w,1/PP.h);PP.pass(PP.fxaa,null);
}
const lookBtn=$('lookBtn');
if(!POST)lookBtn.style.display='none';
lookBtn.addEventListener('click',()=>{lookOn=!lookOn;lookBtn.setAttribute('aria-pressed',lookOn);lookBtn.textContent=lookOn?'Filmlook':'Ohne Filmlook';});

// ---------- resize ----------
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);if(POST)PP.resize();});

// ---------- main loop ----------
let lastT=performance.now(),uiAcc=1,firstFrame=true;
function frame(now){
  const dt=clamp((now-lastT)/1000,0,.05);lastT=now;T+=dt;WU.uTime.value=T;

  if(playing&&!dragging)hour=(hour+dt/SPEEDS[speedI][0])%24;

  // weather blend
  const tw=W[wKey],k=Math.min(1,dt*.35);
  for(const key of ['cloud','rain','snow','fog','wind','storm'])cur[key]+=(tw[key]-cur[key])*k;
  snowCover=clamp(snowCover+dt*(cur.snow>.5?.035:-.02),0,1);
  wet=clamp(wet+dt*(cur.rain>.5?.08:-.015),0,1);
  WU.uSnow.value=snowCover;WU.uWet.value=wet;WU.uWind.value=cur.wind;

  // sun
  const th=(hour-6)/24*Math.PI*2;
  sunDir.set(Math.cos(th)*.85,Math.sin(th),-.45).normalize();
  const sy=sunDir.y;
  const day=smooth(-.1,.22,sy),night=1-smooth(-.16,.06,sy);
  skyAt(sy,top,hor);
  const cl=cur.cloud,dark=cur.storm*.5+cl*.15*day;
  greyify(top,cl*.8,dark);greyify(hor,cl*.7,dark*.7);
  if(cur.fog>.01){tmp.copy(hor).lerp(c2.setRGB(.62,.66,.7).multiplyScalar(.2+.8*smooth(-.2,.3,sy)),cur.fog*.6);hor.copy(tmp);}
  sunCol.setHex(0xff7a3a).lerp(c.setHex(0xfff0cc),smooth(0,.4,sy));
  // palette is authored in sRGB; the renderer works in linear space
  top.convertSRGBToLinear();hor.convertSRGBToLinear();sunCol.convertSRGBToLinear();

  // flash
  if(cur.storm>.5&&T>nextBolt){flash=1;nextBolt=T+5+Math.random()*9;const d=.4+Math.random()*2.2;thunder(d,.9/(1+d*.3));setTimeout(()=>{flash=Math.max(flash,.8);},120);}
  flash=Math.max(0,flash-dt*5);

  skyU.uTop.value.copy(top);skyU.uHor.value.copy(hor);skyU.uSunCol.value.copy(sunCol);skyU.uSun.value.copy(sunDir);
  skyU.uStars.value=night;skyU.uCloud.value=cl;skyU.uFlash.value=flash*.6;
  const golden=smooth(-.12,0,sy)*(1-smooth(.1,.38,sy));
  skyU.uCloudLit.value.setRGB(1,.97,.92).lerp(c.copy(sunCol).multiplyScalar(1.5),golden*.75).multiplyScalar((.12+.88*day)*(1-cur.storm*.55)).add(c.setRGB(.03,.04,.07).multiplyScalar(night));
  skyU.uCloudDark.value.copy(hor).lerp(top,.5).multiplyScalar(.62*(1-cur.storm*.5)).lerp(c.setRGB(.25,.12,.2),golden*.25);
  skyU.uWindOff.value+=dt*(.006+cur.wind*.03);
  WU.uSunDir.value.copy(sunDir);WU.uSunCol.value.copy(sunCol).multiplyScalar(day*(1-cl*.85)*(1-indoor*.5)*(.3+.7*golden));
  sky.position.copy(camera.position);

  // lights
  const useSun=sy>-.04;
  const ld=useSun?sunDir:P.copy(sunDir).negate();
  sun.position.copy(target).addScaledVector(ld,140);sun.target.position.copy(target);
  if(useSun){sun.color.copy(sunCol);sun.intensity=day*(1.25+golden*.9)*(1-cl*.78);}
  else{sun.color.setHex(0x9fb2ff);sun.intensity=.45*smooth(-.04,-.3,sy)*(1-cl*.8);}
  hemi.color.copy(top).lerp(c.setRGB(1,1,1),.1*day).add(c.setRGB(.06,.07,.11));
  hemi.groundColor.setHex(0x3b3322).convertSRGBToLinear().multiplyScalar(.5+.9*day);
  hemi.intensity=(.34+day*.36)*(1-cur.storm*.25)+flash*2.5+snowCover*.15*day;

  const fogDens=(.0026+cur.fog*.032+cur.rain*.006+cur.snow*.009)*(1-indoor*.85);
  const expo=1.0+night*.25*(1-indoor)+indoor*.3*day;
  if(!POST){scene.fog.color.copy(hor);scene.fog.density=fogDens;renderer.toneMappingExposure=expo;}
  else{const C=PP.comp.uniforms;
    C.uFogCol.value.copy(hor);C.uFogSun.value.copy(hor).lerp(sunCol,.55*(1-cl*.7)*smooth(-.1,.05,sy));C.uSunDir.value.copy(sunDir);
    C.uFogDens.value=fogDens*.55;C.uFogStart.value=lerp(40,3,Math.max(cur.fog,cur.snow*.6,cur.rain*.4))*(1-indoor*.7);C.uFogFall.value=lerp(.026,.015,cur.fog);C.uHaze.value=.0006*(1-indoor*.9)+cur.fog*.004;
    C.uExposure.value=expo;C.uTime.value=T;
    // shafts: from the sun by day, faintly from the moon at night
    const lightDir=sy>-.04?sunDir:P.copy(sunDir).negate();
    const sp3=c2v.copy(lightDir).multiplyScalar(1000).add(camera.position).project(camera);
    camera.getWorldDirection(fwd);
    const facing=smooth(.0,.35,fwd.dot(lightDir));
    PP.occ.uniforms.uSunUV.value.set(sp3.x*.5+.5,sp3.y*.5+.5);PP.radial.uniforms.uSunUV.value.copy(PP.occ.uniforms.uSunUV.value);
    C.uRayCol.value.copy(sy>-.04?sunCol:c.setRGB(.5,.6,.9));
    C.uRayInt.value=facing*(sy>-.04?smooth(-.04,.06,sy):.25*smooth(-.04,-.25,sy))*(1-cl*.8)*(.45+cur.fog*.7+wet*.3)*.55;
    // colour grade: two-tone palettes per time of day
    const sT=C.uShadowTint.value,hT=C.uHighTint.value;
    sT.setRGB(.55,.72,.85).lerp(c.setRGB(.62,.45,.85),golden).lerp(c.setRGB(.38,.5,.92),night*.85).lerp(c.setRGB(.62,.46,.4),indoor*.7);
    hT.setRGB(1,.93,.78).lerp(c.setRGB(1,.68,.42),golden).lerp(c.setRGB(.7,.85,1),night*.7).lerp(c.setRGB(1,.74,.48),indoor*.6);
    C.uSat.value=1.1-cur.storm*.15-cur.fog*.08;}

  seaU.uSunDir.value.copy(sy>-.04?sunDir:P.copy(sunDir).negate());
  seaU.uSunCol.value.copy(sy>-.04?sunCol:c.setRGB(.5,.6,.9)).multiplyScalar((sy>-.04?smooth(-.04,.05,sy):.25*smooth(-.04,-.25,sy))*(1-cl*.85));
  seaU.uSkyTop.value.copy(top);seaU.uSkyHor.value.copy(hor);
  seaU.uDeep.value.setRGB(.012,.05,.07).lerp(c.copy(hor).multiplyScalar(.25),.35).multiplyScalar(.35+.65*day+flash);
  seaU.uFoam.value.setRGB(.85,.9,.92).multiplyScalar(.12+.75*day+flash).lerp(sunCol,golden*.25);
  seaU.uRain.value=cur.rain;
  water.material.color.copy(hor).lerp(c.setHex(0x1b3440).convertSRGBToLinear(),.55).multiplyScalar(.6+.4*day);
  water.material.specular.copy(useSun?sunCol:c.setHex(0x9fb2ff)).multiplyScalar(.6*(1-cl));

  // windows & fire
  const glow=Math.max(night,cl*.35,(1-day)*.6);
  glowMat.opacity=glow*.55;winLight.intensity=glow*1.4;
  const fireScale=1-cur.rain*.55;
  fireLight.intensity=(1.3+night*1.6)*fireScale*(.82+.18*Math.sin(T*13)*Math.sin(T*7.3+1)+.06*Math.random());

  hearthLight.intensity=(.9+night*.4)*(.8+.2*Math.sin(T*11+2)*Math.sin(T*6.1)+.06*Math.random());
  lanternLight.intensity=.25+glow*.6;
  const sunIn=day*(1-cl*.9);
  bounceLight.intensity=hearthLight.intensity*.22+sunIn*.45;
  updateBeams(sunDir,.32*sunIn*(1+cur.fog*.5),c.copy(sunCol));
  {const dp=dust.geometry.attributes.position,dc=dust.geometry.attributes.color,br=.12+sunIn*.5+night*.05;
   for(let i=0;i<DUST;i++){const q=dustData[i];q[3]+=dt*.15;
     dp.setXYZ(i,q[0]+Math.sin(q[3]*1.3)*.25,q[1]+Math.sin(q[3]*.7+i)*.18,q[2]+Math.cos(q[3])*.25);dc.setXYZ(i,br,br*.85,br*.6);}
   dp.needsUpdate=dc.needsUpdate=true;}
  {const hp=hearth.geometry.attributes.position,hc=hearth.geometry.attributes.color;
   for(let i=0;i<HF;i++){const f=hearthData[i];f.life+=dt*(1.5+Math.random()*.6);
     if(f.life>1){f.life=0;f.ox=(Math.random()-.5)*.6;f.oz=(Math.random()-.5)*.25;}
     const l=f.life;hp.setXYZ(i,FPX+f.ox*(1-l*.7),.58+l*.75,FPZ+f.oz);const b=(1-l)*.5;hc.setXYZ(i,b,b*(.5-l*.3),b*.1);}
   hp.needsUpdate=hc.needsUpdate=true;}
  // flames
  const fp=flames.geometry.attributes.position,fc=flames.geometry.attributes.color;
  for(let i=0;i<FLAMES;i++){const f=flameData[i];f.life+=dt*(1.4+Math.random()*.6);
    if(f.life>1){f.life=0;const a=Math.random()*6.28,r=Math.random()*.35;f.ox=Math.cos(a)*r;f.oz=Math.sin(a)*r;}
    const l=f.life;fp.setXYZ(i,FIRE.x+f.ox*(1-l)+cur.wind*l*.4,.25+l*1.5*fireScale,FIRE.z+f.oz*(1-l));
    const b=(1-l)*fireScale*.55;fc.setXYZ(i,b,b*(.5-l*.32),b*.1*(1-l));}
  fp.needsUpdate=fc.needsUpdate=true;

  // smoke from chimney
  const sp=smoke.geometry.attributes.position,sc=smoke.geometry.attributes.color;
  const sLight=.25+.6*day+glow*.08;
  for(let i=0;i<SMOKE;i++){const s=smokeData[i];s.life+=dt*.16;
    if(s.life>1){s.life=0;s.x=FPX+(Math.random()-.5)*.3;s.y=6.45;s.z=-3.17+(Math.random()-.5)*.3;}
    s.y+=dt*(1.1-cur.wind*.4);s.x+=dt*(.2+cur.wind*2.4);s.z+=dt*Math.sin(T*.5+i)*.15;
    sp.setXYZ(i,s.x,s.y,s.z);const fade=Math.sin(s.life*Math.PI)*sLight;sc.setXYZ(i,fade,fade,fade*1.04);}
  sp.needsUpdate=sc.needsUpdate=true;
  smoke.material.size=1.6+cur.wind;

  // fireflies
  flies.material.opacity=night*(1-cl)*(1-cur.rain)*(1-cur.snow);
  if(flies.material.opacity>.01){const p=flies.geometry.attributes.position,col=flies.geometry.attributes.color;
    for(let i=0;i<FF;i++){const f=flyData[i];const tt=T*.4+f.p;
      p.setXYZ(i,f.x+Math.sin(tt*1.3)*1.5,heightAt(f.x,f.z)+f.y+Math.sin(tt*2.1)*.5,f.z+Math.cos(tt)*1.5);
      const blink=Math.max(0,Math.sin(T*1.7+f.p*3));col.setXYZ(i,.8*blink,blink,.4*blink);}
    p.needsUpdate=col.needsUpdate=true;}

  // rain
  const pBase=Math.min(0,target.y-8);
  rain.material.opacity=cur.rain*.42;
  if(cur.rain>.01){const slant=cur.wind*4;
    for(let i=0;i<RAIN;i++){const d=drops[i];d[1]-=d[3]*dt;d[0]+=slant*dt;
      if(d[1]<0){d[1]=26+Math.random()*4;d[0]=(Math.random()-.5)*2*BOX;d[2]=(Math.random()-.5)*2*BOX;}
      const x=target.x+d[0],z=target.z+d[2],o=i*6;
      const yy=d[1]+pBase;
      if(yy<5.4&&Math.abs(x)<4.3&&z>-3.6&&z<4.8){rainPos[o+1]=rainPos[o+4]=-60;continue;}
      rainPos[o]=x;rainPos[o+1]=yy;rainPos[o+2]=z;rainPos[o+3]=x-slant*.05;rainPos[o+4]=yy+.65;rainPos[o+5]=z;}
    rainGeo.attributes.position.needsUpdate=true;}
  rain.material.color.setRGB(.45+.4*day,.5+.4*day,.58+.4*day);

  // snow
  snow.material.opacity=cur.snow*.95;
  if(cur.snow>.01){const p=snow.geometry.attributes.position;
    for(let i=0;i<SNOW;i++){const f=flakes[i];f[1]-=dt*f[4];f[0]+=dt*(cur.wind*2.2+Math.sin(T+f[3])*.4);f[2]+=dt*Math.cos(T*.7+f[3])*.3;
      if(f[1]<0){f[1]=24+Math.random()*3;f[0]=(Math.random()-.5)*2*BOX;f[2]=(Math.random()-.5)*2*BOX;}
      if(f[0]>BOX)f[0]-=2*BOX;
      const sx=target.x+f[0],sz=target.z+f[2];const yy=f[1]+pBase;p.setXYZ(i,sx,(yy<5.4&&Math.abs(sx)<4.3&&sz>-3.6&&sz<4.8)?-60:yy,sz);}
    p.needsUpdate=true;
    const v=.45+.55*day;snow.material.color.setRGB(v,v,v*1.05);}

  // camera
  if(mode==='fp'){
    let f=(keys.KeyW||keys.ArrowUp?1:0)-(keys.KeyS||keys.ArrowDown?1:0)-joyY;
    let r=(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0)+joyX;
    const m=Math.hypot(f,r);if(m>1){f/=m;r/=m;}
    const sp=(keys.ShiftLeft||keys.ShiftRight||Math.hypot(joyX,joyY)>.95?4.6:2.4)*dt;
    const sy_=Math.sin(player.yaw),cy=Math.cos(player.yaw);
    const mx=(-sy_*f+cy*r)*sp,mz=(-cy*f-sy_*r)*sp;
    if(!blocked(player.x+mx,player.z)&&!tooSteep(player.x,player.z,player.x+mx,player.z))player.x+=mx;
    if(!blocked(player.x,player.z+mz)&&!tooSteep(player.x,player.z,player.x,player.z+mz))player.z+=mz;
    const moving=Math.hypot(mx,mz)>1e-4;if(moving)player.bob+=Math.hypot(mx,mz)*3.2;
    const fy=floorAt(player.x,player.z);player.y+=(fy-player.y)*Math.min(1,dt*12);
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
  indoor+=((mode==='fp'&&isInside(player.x,player.z)?1:0)-indoor)*Math.min(1,dt*2.5);

  // audio levels
  if(A&&soundOn){A.acc+=dt;
    if(A.acc>.2){A.acc=0;const t=AC.currentTime;
      A.windG.gain.setTargetAtTime((.08+cur.wind*.35)*(1-indoor*.6),t,.6);
      A.rainG.gain.setTargetAtTime(cur.rain*.32*(1-indoor*.35),t,.6);{const cd=camera.position.x-coastEdge(camera.position.z);A.surfG.gain.setTargetAtTime(clamp(1-(cd+14)/110,0,1)*(.18+cur.wind*.3)*(1-indoor*.7),t,.8);}A.rl.frequency.setTargetAtTime(6500-indoor*5000,t,.5);
      A.cricketG.gain.setTargetAtTime(night*(1-cl*.7)*(1-cur.rain)*(1-cur.snow)*.012,t,1);}
    const fd=camera.position.distanceTo(FIRE),fv=Math.max(clamp(1-fd/45,0,1)*.22*fireScale*(1-indoor*.8),clamp(1-camera.position.distanceTo(hearthLight.position)/12,0,1)*.2);
    if(Math.random()<dt*9)crackle(fv);
    if(day>.6&&cur.rain<.2&&cur.snow<.3&&Math.random()<dt*.18)chirp(.035*(1-cl*.6));}

  // UI
  uiAcc+=dt;
  if(uiAcc>.15){uiAcc=0;
    if(!dragging)timeIn.value=hour.toFixed(2);
    knob.style.left=(hour/24*100)+'%';knob.classList.toggle('moon',sy<-.04);
    const hh=Math.floor(hour),mm=Math.floor((hour-hh)*60/5)*5;clock.textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
    $('mood').textContent=phaseName(hour,sy)+', '+W[wKey].label;}

  camera.updateMatrixWorld();renderFrame();
  if(firstFrame){firstFrame=false;setTimeout(()=>$('loader').classList.add('gone'),150);}
  requestAnimationFrame(frame);
}
window.__lichtung={player,setMode};
requestAnimationFrame(frame);
})();
