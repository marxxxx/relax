import {LAKE,SEA,heightAt} from './world.js';
import {HX,HZ,GF,UF,STAIR,BALC,stairH} from './house.js';

// colliders for walking: boxes [minX,maxX,minZ,maxZ,minY?,maxY?] and circles [x,z,r]; a box with a
// y-range only blocks when the player's body [y+.1,y+1.75] overlaps it (so each storey has its own)
export const BOXES=[],CIRCLES=[];
const PR=.28;
BOXES.push([STAIR.x0,STAIR.x1,STAIR.z1-.05,STAIR.z1+.05,0,3]);   // stair railing, ground floor: enter from the west end only
export function blocked(x,z,y=0){
  for(const b of BOXES)if(x>b[0]-PR&&x<b[1]+PR&&z>b[2]-PR&&z<b[3]+PR&&(b[4]===undefined||(y+1.75>b[4]&&y+.1<b[5])))return true;
  for(const c of CIRCLES){const dx=x-c[0],dz=z-c[1],r=c[2]+PR;if(dx*dx+dz*dz<r*r)return true;}
  if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.02)return true;
  if(Math.hypot(x,z)>120)return true;
  if(x<-40&&heightAt(x,z)<SEA+.25)return true;   // the sea
  return false;}
// cliffs and ravine walls are too steep to walk
export function tooSteep(x0,z0,x1,z1,y=0){
  const a=floorAt(x0,z0,y),b=floorAt(x1,z1,y),d=Math.hypot(x1-x0,z1-z0)+1e-6;
  if(Math.abs(b-a)>.45)return true;                 // no climbing onto / dropping off a storey
  if(Math.abs(x1)<6.5&&z1>-4.5&&z1<6.5)return false;
  return b-a>d*1.25||a-b>d*1.6;}
export function floorAt(x,z,y=0){
  if(x>STAIR.x0&&x<STAIR.x1&&z>STAIR.z0&&z<STAIR.z1&&(x>STAIR.hx||y<2.3))return stairH(x);
  if(Math.abs(x)<HX&&Math.abs(z)<HZ)return y>1.8?UF:GF;
  if(x>BALC.x0&&x<=BALC.x1&&Math.abs(z)<BALC.hz&&y>2)return UF;
  if(Math.abs(x)<4.6&&z>=HZ&&z<5.2)return .41;
  return Math.max(heightAt(x,z),Math.abs(x)<HX+.2&&Math.abs(z)<HZ+.2?.3:-99);}
export const isInside=(x,z)=>Math.abs(x)<4.2&&Math.abs(z)<2.95;
