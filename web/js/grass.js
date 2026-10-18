import {isMobile,smooth,rnd,distSeg} from './util.js';
import {LAKE,FIRE,heightAt,pathDist} from './world.js';
import {scene} from './renderer.js';
import {weatherize} from './materials.js';

const M=new THREE.Matrix4(),Q=new THREE.Quaternion(),S=new THREE.Vector3(),P=new THREE.Vector3(),UP=new THREE.Vector3(0,1,0),c=new THREE.Color();
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
