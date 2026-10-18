import {LAKE,SEA,heightAt} from './world.js';

// colliders for walking: boxes [minX,maxX,minZ,maxZ] and circles [x,z,r]
export const BOXES=[],CIRCLES=[];
const PR=.28;
export function blocked(x,z){
  for(const b of BOXES)if(x>b[0]-PR&&x<b[1]+PR&&z>b[2]-PR&&z<b[3]+PR)return true;
  for(const c of CIRCLES){const dx=x-c[0],dz=z-c[1],r=c[2]+PR;if(dx*dx+dz*dz<r*r)return true;}
  if(Math.hypot(x-LAKE.x,z-LAKE.z)<LAKE.r*1.02)return true;
  if(Math.hypot(x,z)>120)return true;
  if(x<-40&&heightAt(x,z)<SEA+.25)return true;   // the sea
  return false;}
// cliffs and ravine walls are too steep to walk
export function tooSteep(x0,z0,x1,z1){
  if(Math.abs(x1)<5&&z1>-4&&z1<6)return false;
  const a=floorAt(x0,z0),b=floorAt(x1,z1),d=Math.hypot(x1-x0,z1-z0)+1e-6;
  return b-a>d*1.25||a-b>d*1.6;}
export function floorAt(x,z){
  if(Math.abs(x)<3.5&&Math.abs(z)<2.75)return .31;
  if(Math.abs(x)<3.6&&z>=2.75&&z<4.6)return .41;
  return Math.max(heightAt(x,z),Math.abs(x)<3.7&&Math.abs(z)<2.95?.3:-99);}
export const isInside=(x,z)=>Math.abs(x)<3.3&&z>-2.55&&z<2.6;
