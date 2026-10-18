import {smooth} from './util.js';
import {SEA} from './world.js';
import {scene} from './renderer.js';
import {WU} from './materials.js';
import {state,cur} from './state.js';

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

const _v=new THREE.Vector3(),c=new THREE.Color();
export function updateSea(env){
  const {sy,day,cl,golden,sunDir,sunCol,top,hor}=env;
  seaU.uSunDir.value.copy(sy>-.04?sunDir:_v.copy(sunDir).negate());
  seaU.uSunCol.value.copy(sy>-.04?sunCol:c.setRGB(.5,.6,.9)).multiplyScalar((sy>-.04?smooth(-.04,.05,sy):.25*smooth(-.04,-.25,sy))*(1-cl*.85));
  seaU.uSkyTop.value.copy(top);seaU.uSkyHor.value.copy(hor);
  seaU.uDeep.value.setRGB(.012,.05,.07).lerp(c.copy(hor).multiplyScalar(.25),.35).multiplyScalar(.35+.65*day+state.flash);
  seaU.uFoam.value.setRGB(.85,.9,.92).multiplyScalar(.12+.75*day+state.flash).lerp(sunCol,golden*.25);
  seaU.uRain.value=cur.rain;
}
