import {isMobile,smooth,fbm,distSeg} from './util.js';
import {LAKE,FIRE,SEA,coastEdge,heightAt,pathDist,riverAt} from './world.js';
import {scene} from './renderer.js';
import {weatherize,WU,WATER_NOISE,WATER_TAIL} from './materials.js';
import {state,cur} from './state.js';

// ---------- terrain ----------
const TS=1600,TSEG=isMobile?240:580;   // big enough to hold the far plain and the outer ring
const tg=new THREE.PlaneGeometry(TS,TS,TSEG,TSEG);tg.rotateX(-Math.PI/2);
const tp=tg.attributes.position;
for(let i=0;i<tp.count;i++){tp.setY(i,heightAt(tp.getX(i),tp.getZ(i)));}
tg.computeVertexNormals();
const tcol=new Float32Array(tp.count*3);const c=new THREE.Color(),c2=new THREE.Color();
const G1=new THREE.Color(0x4f7233),G2=new THREE.Color(0x7c9a45),MEAD=new THREE.Color(0x8fae52),
  DIRT=new THREE.Color(0x7a6446),ROCK=new THREE.Color(0x77706a),SNOWC=new THREE.Color(0xe7edf2),SAND=new THREE.Color(0x9a8664),CLIFF2=new THREE.Color(0x8a6e58),WETSAND=new THREE.Color(0x6f5f45),
  GRAVEL=new THREE.Color(0x6e6452),PEBBLE=new THREE.Color(0x8d8576),DEEPBED=new THREE.Color(0x3a3d2c),WETB=new THREE.Color(0x4e4433),LUSH=new THREE.Color(0x3f6a2a);
for(let i=0;i<tp.count;i++){
  const x=tp.getX(i),z=tp.getZ(i),y=tp.getY(i),ny=tg.attributes.normal.getY(i);
  const r=Math.hypot(x,z),n=fbm(x*.05,z*.05);
  c.copy(G1).lerp(G2,n);
  c.lerp(MEAD,(1-smooth(10,30,r))*.7);
  const path=Math.min(distSeg(x,z,0,3.6,FIRE.x,FIRE.z),Math.hypot(x-FIRE.x,z-FIRE.z)-1.2);
  c.lerp(DIRT,(1-smooth(.6,1.6,path))*.85);
  c.lerp(DIRT,(1-smooth(4.5,7,Math.hypot(x/1.2,z-0.5)))*.6);
  c.lerp(ROCK,smooth(.82,.62,ny)*smooth(5,12,y));
  const steep=smooth(.72,.5,ny);
  c.lerp(c2.copy(ROCK).multiplyScalar(.75+.5*fbm(x*.15+y*.4,z*.15)).lerp(CLIFF2,smooth(.4,.7,fbm(y*.35,x*.05+z*.05))*.5),steep*.92);
  const sd=pathDist(x,z);c.lerp(DIRT,(1-smooth(1.1,3.0,sd))*.85*(y>SEA+2?1:.3));
  const dxc=x-coastEdge(z);
  if(dxc<-4){const sandW=smooth(SEA+3.5,SEA+1.5,y);c.lerp(SAND,sandW*smooth(.6,.8,ny));c.lerp(WETSAND,smooth(SEA+.8,SEA-.2,y));}
  c.lerp(ROCK,smooth(18,32,y)*.7);
  c.lerp(SNOWC,smooth(34,50,y+n*10));
  c.lerp(DIRT,(1-smooth(1.2,3.2,sd))*.4*smooth(22,40,y));   // the paths stay visible as gravel strips in rock and snow
  const [rd,rw,,rwd]=riverAt(x,z);
  if(rd<rwd+40){const up=y-rw,gv=fbm(x*.45+3,z*.45);
    if(up<0)c.copy(GRAVEL).lerp(PEBBLE,smooth(.45,.75,gv)*(1-smooth(.2,.9,-up))).lerp(DEEPBED,smooth(.25,1.5,-up));   // river bed: gravel, darker and greener with depth
    else{c.lerp(LUSH,(1-smooth(rwd+5,rwd+32,rd))*.5);                       // lusher floodplain
      c.lerp(DIRT,smooth(.93,.75,ny)*(1-smooth(rwd+3,rwd+7,rd))*.85);      // cut banks show bare earth
      c.lerp(PEBBLE,smooth(.5,.7,gv)*(1-smooth(.2,.6,up))*.8);             // gravel at the waterline
      c.lerp(WETB,(1-smooth(.04,.4,up))*.8);}}                             // wet band
  const lr=Math.hypot(x-LAKE.x,z-LAKE.z);
  c.lerp(SAND,(1-smooth(LAKE.r*.95,LAKE.r*1.35,lr))*.75);
  if(lr<LAKE.r*1.2)c.lerp(WETB,smooth(-.9,-1.15,y)*.8).lerp(DEEPBED,smooth(-1.2,-2.1,y)*.9);   // lake bed: wet sand at the waterline, dark silt deeper
  tcol[i*3]=c.r;tcol[i*3+1]=c.g;tcol[i*3+2]=c.b;
}
tg.setAttribute('color',new THREE.BufferAttribute(tcol,3));
const terrain=new THREE.Mesh(tg,weatherize(new THREE.MeshStandardMaterial({vertexColors:true,roughness:.97,metalness:0}),'terrain'));
terrain.receiveShadow=true;scene.add(terrain);

// ---------- lake ----------
// Same water model as the river (valley.js): transparent by depth (the sandy shallows show through), Fresnel sky reflection,
// the forest rim mirrored in calm water, sun/moon glint. Still water, so the ripples drift with the wind instead of a current:
// gusts roughen passing patches (cat's paws), a storm raises whitecaps, wind lanes and surf on the lee shore, rain adds rings.
const WL=-1.0;   // water level; the wind blows toward +x, as trees, grass and smoke lean
const lakeU={uTime:WU.uTime,uWind:WU.uWind,uRain:{value:0},uStorm:{value:0},
  uOff:{value:new THREE.Vector2()},uGust:{value:new THREE.Vector2()},uC:{value:new THREE.Vector2(LAKE.x,LAKE.z)},
  uSunDir:{value:new THREE.Vector3()},uSunCol:{value:new THREE.Color()},uSkyTop:{value:new THREE.Color()},uSkyHor:{value:new THREE.Color()},
  uScat:{value:new THREE.Color()},uBank:{value:new THREE.Color()},uWood:{value:new THREE.Color()},uFoam:{value:new THREE.Color()}};
const lakeMat=new THREE.ShaderMaterial({uniforms:lakeU,fog:true,transparent:true,depthWrite:false,
  blending:THREE.CustomBlending,blendSrc:THREE.OneFactor,blendDst:THREE.OneMinusSrcAlphaFactor,   // premultiplied alpha
  vertexShader:`
    attribute float aDepth; varying vec3 vW; varying float vDepth;
    #include <fog_pars_vertex>
    void main(){
      vW=position; vDepth=aDepth;
      vec4 mvPosition=viewMatrix*vec4(position,1.);
      gl_Position=projectionMatrix*mvPosition;
      #include <fog_vertex>
    }`,
  fragmentShader:`
    uniform vec3 uSkyTop,uSkyHor,uSunDir,uSunCol,uScat,uBank,uWood,uFoam; uniform vec2 uOff,uGust,uC; uniform float uTime,uRain,uWind,uStorm;
    varying vec3 vW; varying float vDepth;
    #include <fog_pars_fragment>
    ${WATER_NOISE}
    float wav(vec2 q){return n2(q)*.5+n2(q*2.03+3.1)*.3+n2(q*4.1+7.7)*.2;}
    vec2 gradW(vec2 q){const float e=.07;float h=wav(q);return vec2(wav(q+vec2(e,0.))-h,wav(q+vec2(0.,e))-h)/e;}
    // rain: short-lived rings, one per cell
    vec2 ring(vec2 x,float s,float o){vec2 rc=floor(x*s),rf=fract(x*s)-.5;float rt=fract(uTime*.9+h21(rc+o)*7.);
      vec2 rd=rf-(vec2(h21(rc+.3+o),h21(rc+.7+o))-.5)*.4;float rr=length(rd);
      return sin((rr-rt*.45)*55.)*(1.-rt)*smoothstep(.45*rt+.06,.45*rt,rr)*normalize(rd+1e-4);}
    void main(){
      if(vDepth<=0.)discard;
      vec3 V=cameraPosition-vW;float dist=length(V);V/=dist;
      vec2 Dw=normalize(vec2(.98,.2)),Cw=vec2(-Dw.y,Dw.x);
      vec2 p=vW.xz-uC,pw=vec2(dot(p,Dw),dot(p,Cw));                  // wind space: x downwind, y across
      float k=smoothstep(.55,1.25,uWind+uStorm*.2);                   // storm sea state
      // cat's paws: gust patches run downwind faster than the waves and roughen the surface where they pass
      vec2 pg=pw-uGust;
      float gs=smoothstep(.35,.8,n2(pg*vec2(.06,.11))*.65+n2(pg*vec2(.17,.3)+4.)*.35);
      gs=mix(gs,.5+.5*gs,k);
      // wind waves: crests across the wind, longer and steeper as it freshens; fine capillary ripples ride on top
      float f=mix(2.4,.85,smoothstep(.2,1.3,uWind));
      vec2 S1=vec2(1.,.45)*f,S2=vec2(3.4,2.1);
      vec2 g=gradW((pw-uOff)*S1)*S1+gradW((pw-uOff*1.8)*S2+9.3)*S2*(.08+.14*gs);
      float amp=(.006+.06*uWind*(.25+1.2*gs)+.05*uStorm)*(.3+.7*smoothstep(160.,15.,dist));
      vec2 gw=(g.x*Dw+g.y*Cw)*amp;                                   // wind space -> world space
      // rain: rings and a fine stippled roughness from the drops
      float rn=uRain*smoothstep(120.,8.,dist);
      gw+=rn*((ring(vW.xz,1.6,0.)+ring(vW.xz,2.3,17.))*.25+.06*(vec2(n2(vW.xz*9.+uTime*13.),n2(vW.xz*9.+31.-uTime*11.))-.5));
      vec3 N=normalize(vec3(-gw.x,1.,-gw.y));
      float ndv=max(dot(N,V),0.),fr=.02+.98*pow(1.-ndv,5.);
      vec3 R=reflect(-V,N);R.y=abs(R.y);
      vec3 refl=mix(uSkyHor,uSkyTop,pow(R.y,.5));
      // mirrored forest rim: follow the reflected ray to the tree line around the lake (further off toward the cabin's clearing)
      float rh=max(length(R.xz),1e-3);vec2 d=R.xz/rh;float an=atan(d.y,d.x);
      float clr=smoothstep(.55,.9,dot(d,normalize(-uC)));
      float Rt=mix(21.,38.,clr),b=dot(p,d),t=-b+sqrt(max(b*b-dot(p,p)+Rt*Rt,0.));
      float H=(7.+3.5*n2(vec2(an*7.,1.))+2.*n2(vec2(an*23.,5.)))*mix(1.,.6,clr);
      float e=R.y/rh*t,bw=.06+amp*5.;                                // height of the ray at the tree line; blurrier when rough
      float hit=smoothstep(H*(1.+bw),H*(1.-bw),e);
      refl=mix(refl,mix(uWood,uBank,smoothstep(1.6,.4,e)),hit*.92);
      float sr=max(dot(R,uSunDir),0.);
      vec3 spec=uSunCol*(pow(sr,900.)*12.+pow(sr,80.)*.3)*(1.-.5*k);
      // body: dark, peaty lake water, clearer than the river; rain and storm stir it up
      float dep=max(vDepth,0.),tm=exp(-dep*(1.1+uRain*1.4+k*.9)*(1.+1./max(ndv,.15)));   // down to the bed and back up
      float a=1.-(1.-fr)*tm;
      vec3 col=fr*refl+(1.-fr)*(1.-tm)*uScat+spec;
      // foam: whitecaps on gusty crests, streaks along the wind lanes, surf on the lee (east) shore
      vec2 qf=(pw-uOff*1.15)*vec2(1.7,.8);
      float fn=n2(qf+2.)*.6+n2(qf*2.3+5.)*.4,lace=n2((pw-uOff*1.3)*vec2(6.,3.5)+uTime*vec2(0.,.4));
      float foam=k*smoothstep(.8-.1*gs,.9-.06*gs,fn)*smoothstep(.25,.7,lace)*(.3+.6*gs);
      foam=max(foam,k*.22*smoothstep(.82,.95,n2(vec2((pw.x-uOff.x*1.3)*.1,pw.y*1.6)))*smoothstep(.35,.75,n2(pw*.25-uOff*.2))*smoothstep(.2,.6,lace));
      float lee=smoothstep(-.2,.6,dot(normalize(p),Dw));
      foam=max(foam,smoothstep(.25,.02,dep)*smoothstep(.4,.75,n2(pw*vec2(1.5,.8)-uOff*2.))*(.1+.6*k*lee));
      col=col*(1.-foam)+uFoam*foam;a=a*(1.-foam)+foam;
      gl_FragColor=vec4(col,a)*smoothstep(0.,.06,vDepth);             // soft waterline
      ${WATER_TAIL}
    }`});
// polar grid out past the shore (rings denser outward, toward the waterline); triangles wholly under the bank are dropped
export const water=(()=>{const NR=isMobile?22:36,NS=isMobile?72:120,RM=LAKE.r*1.45,pos=[LAKE.x,WL,LAKE.z],dep=[WL-heightAt(LAKE.x,LAKE.z)],idx=[];
  for(let i=1;i<=NR;i++){const r=RM*Math.pow(i/NR,.85);
    for(let j=0;j<NS;j++){const a=j/NS*6.2832,x=LAKE.x+Math.cos(a)*r,z=LAKE.z+Math.sin(a)*r;pos.push(x,WL,z);dep.push(WL-heightAt(x,z));}}
  const V=(i,j)=>i?1+(i-1)*NS+(j%NS):0,tri=(a,b,c)=>{if(Math.max(dep[a],dep[b],dep[c])>0)idx.push(a,b,c);};
  for(let i=1;i<=NR;i++)for(let j=0;j<NS;j++){tri(V(i-1,j),V(i,j+1),V(i,j));if(i>1)tri(V(i-1,j),V(i-1,j+1),V(i,j+1));}
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(pos,3));g.setAttribute('aDepth',new THREE.Float32BufferAttribute(dep,1));
  g.setIndex(idx);g.computeBoundingSphere();
  const m=new THREE.Mesh(g,lakeMat);scene.add(m);return m;})();

// per-frame: wind drift and water colours (same palette logic as the river)
const _v=new THREE.Vector3(),_c=new THREE.Color();
export function updateLake(dt,env){
  const {sy,day,cl,golden,sunDir,sunCol,top,hor}=env,fl=state.flash,w=cur.wind,U=lakeU;
  U.uOff.value.x+=dt*(.12+w*1.1);U.uOff.value.y+=dt*.03;U.uGust.value.x+=dt*(.5+w*3.2);   // wind space: x downwind
  U.uSkyTop.value.copy(top);U.uSkyHor.value.copy(hor);
  U.uSunDir.value.copy(sy>-.04?sunDir:_v.copy(sunDir).negate());
  U.uSunCol.value.copy(sy>-.04?sunCol:_c.setRGB(.5,.6,.9)).multiplyScalar((sy>-.04?smooth(-.04,.05,sy):.25*smooth(-.04,-.25,sy))*(1-cl*.85));
  U.uScat.value.setRGB(.012,.035,.04).lerp(_c.copy(hor).multiplyScalar(.12),.3).multiplyScalar(.3+.7*day+fl);       // dark, peaty
  U.uWood.value.setRGB(.016,.03,.014).lerp(_c.setRGB(.5,.53,.56),state.snowCover*.35).multiplyScalar(.15+.85*day+fl)
    .lerp(_c.copy(hor).multiplyScalar(.7),.12+cur.fog*.5);                                                          // the forest rim, hazy in fog
  U.uBank.value.setRGB(.07,.09,.04).lerp(_c.setRGB(.6,.63,.66),state.snowCover*.6).multiplyScalar(.2+.8*day+fl);
  U.uFoam.value.setRGB(.78,.82,.8).multiplyScalar(.1+.7*day+fl).lerp(sunCol,golden*.25);
  U.uRain.value=cur.rain;U.uStorm.value=cur.storm;
}
