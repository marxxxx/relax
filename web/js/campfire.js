import {isMobile,rnd} from './util.js';
import {FIRE} from './world.js';
import {scene} from './renderer.js';
import {std} from './materials.js';
import {BOXES,CIRCLES} from './collision.js';
import {add,logMat} from './cabin.js';

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
export const fireLight=new THREE.PointLight(0xff8a3a,2,22,2);fireLight.position.set(FIRE.x,1.1,FIRE.z);fireLight.castShadow=!isMobile;
fireLight.shadow.mapSize.set(512,512);fireLight.shadow.bias=-0.002;scene.add(fireLight);
