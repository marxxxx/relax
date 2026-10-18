import {isMobile,fbm,rnd} from './util.js';
import {LAKE,SEA,coastEdge,heightAt,pathDist} from './world.js';
import {scene} from './renderer.js';
import {std,weatherize} from './materials.js';
import {CIRCLES} from './collision.js';

const c=new THREE.Color();
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
