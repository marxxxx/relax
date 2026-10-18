import {$} from './util.js';
import {renderer,scene,camera,POST} from './renderer.js';

// ---------- post-processing: height fog, sun shafts, bloom, colour grade ----------
export const PP={};
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
export function renderFrame(){
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
