import {isMobile,smooth,fbm,distSeg} from './util.js';
import {LAKE,FIRE,SEA,coastEdge,heightAt,pathDist} from './world.js';
import {scene} from './renderer.js';
import {weatherize} from './materials.js';

// ---------- terrain ----------
const TS=640,TSEG=isMobile?200:290;
const tg=new THREE.PlaneGeometry(TS,TS,TSEG,TSEG);tg.rotateX(-Math.PI/2);
const tp=tg.attributes.position;
for(let i=0;i<tp.count;i++){tp.setY(i,heightAt(tp.getX(i),tp.getZ(i)));}
tg.computeVertexNormals();
const tcol=new Float32Array(tp.count*3);const c=new THREE.Color(),c2=new THREE.Color();
const G1=new THREE.Color(0x4f7233),G2=new THREE.Color(0x7c9a45),MEAD=new THREE.Color(0x8fae52),
  DIRT=new THREE.Color(0x7a6446),ROCK=new THREE.Color(0x77706a),SNOWC=new THREE.Color(0xe7edf2),SAND=new THREE.Color(0x9a8664),CLIFF2=new THREE.Color(0x8a6e58),WETSAND=new THREE.Color(0x6f5f45);
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
export const water=new THREE.Mesh(new THREE.CircleGeometry(LAKE.r*1.45,48),
  new THREE.MeshPhongMaterial({color:0x2b4d5c,shininess:140,specular:0x9fb4c0,transparent:true,opacity:.88}));
water.rotation.x=-Math.PI/2;water.position.set(LAKE.x,-1.0,LAKE.z);scene.add(water);
