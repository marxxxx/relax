// Regression + structural checks for web/js/world.js — this repo has no test runner, so this script is the suite.
// Usage: node tools/world-check.mjs [--write-baseline] [--require-far]
//   --write-baseline  capture the current heightAt samples (r<300) into tools/world-baseline.json
//   --require-far     fail if the far-world exports (RIVERS, FAR_TRAIL, riverAt, riverDist) are missing
import fs from 'node:fs';
import path from 'node:path';
import url from 'node:url';
import {fileURLToPath} from 'node:url';

// browser globals that web/js/util.js + world.js touch at import time
globalThis.matchMedia=()=>({matches:false});
globalThis.innerWidth=1200;globalThis.innerHeight=800;
globalThis.THREE={Vector3:class{constructor(x=0,y=0,z=0){this.x=x;this.y=y;this.z=z;}}};

const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const W=await import(url.pathToFileURL(path.join(root,'web/js/world.js')).href);
const baselinePath=path.join(root,'tools/world-baseline.json');
const writeBaseline=process.argv.includes('--write-baseline');
const requireFar=process.argv.includes('--require-far');

// polar sample grid of the existing world (skip the existing trail blends: pathDist<12)
const samples=[];
for(let a=0;a<360;a+=7)for(let r=5;r<300;r+=9){
  const x=+((Math.cos(a*Math.PI/180)*r).toFixed(3)),z=+((Math.sin(a*Math.PI/180)*r).toFixed(3));
  if(W.pathDist(x,z)<12)continue;
  samples.push([x,z,W.heightAt(x,z)]);}

let fails=0;
const ok=(cond,msg)=>{console.log((cond?'OK   ':'FAIL ')+msg);if(!cond)fails++;};

if(writeBaseline){
  fs.writeFileSync(baselinePath,JSON.stringify({samples}));
  console.log(`wrote ${samples.length} samples to tools/world-baseline.json`);
  process.exit(0);}

// 1) regression: heightAt for r<300 must be bit-identical to the baseline
const base=JSON.parse(fs.readFileSync(baselinePath,'utf8'));
const cur=new Map(samples.map(s=>[s[0]+','+s[1],s[2]]));
let maxd=0,n=0;
for(const [x,z,h] of base.samples){const v=cur.get(x+','+z);if(v===undefined)continue;
  const d=Math.abs(W.heightAt(x,z)-h);if(d>maxd)maxd=d;n++;}
ok(n>1000&&maxd<1e-9,`baseline r<300 identical (${n} samples, max diff ${maxd})`);

// 2) structural checks for the far world
const hasFar=W.RIVERS&&W.FAR_TRAIL&&W.riverAt&&W.riverDist;
if(!hasFar){
  if(requireFar)ok(false,'far-world exports present (RIVERS, FAR_TRAIL, riverAt, riverDist)');
  else console.log('SKIP structural checks (RIVERS/FAR_TRAIL/riverAt not exported yet)');
}else{
  ok(true,'far-world exports present (RIVERS, FAR_TRAIL, riverAt, riverDist)');
  for(const R of W.RIVERS){
    let carveOK=true,containOK=true,maxRise=-1e9;
    for(let i=0;i<R.pts.length;i++){
      const [x,z,bed,dep]=R.pts[i],wy=bed+dep-.35;
      if(W.heightAt(x,z)>bed+1e-6)carveOK=false;                 // the channel is carved down to the bed
      if(i>0){const p=R.pts[i-1];maxRise=Math.max(maxRise,wy-(p[2]+p[3]-.35));}  // may follow terrain bumps up, bounded
      const a=R.pts[Math.max(i-1,0)],b=R.pts[Math.min(i+1,R.pts.length-1)];
      let nx=-(b[1]-a[1]),nz=b[0]-a[0];const nl=Math.hypot(nx,nz)||1;
      const hL=W.heightAt(x-nx/nl*(R.w+6),z-nz/nl*(R.w+6)),hR=W.heightAt(x+nx/nl*(R.w+6),z+nz/nl*(R.w+6));
      if(Math.max(hL,hR)<wy-.05)containOK=false;}                // water held by at least one bank
    ok(carveOK,`river w=${R.w}: channel carved to bed at center`);
    ok(maxRise<=.8,`river w=${R.w}: water rise per 6 m step <= 0.8 (max ${maxRise.toFixed(2)})`);
    ok(containOK,`river w=${R.w}: at least one bank above water level`);}
  let slopeOK=true,maxs=0;
  for(let i=1;i<W.FAR_TRAIL.pts.length;i++){
    const a=W.FAR_TRAIL.pts[i-1],b=W.FAR_TRAIL.pts[i];
    const s=Math.abs(b[2]-a[2])/Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(s>maxs)maxs=s;if(s>.5+1e-6)slopeOK=false;}
  ok(slopeOK,`FAR_TRAIL slope <= 1:2 (max ${maxs.toFixed(3)})`);
  const camp=W.heightAt(468,16),pass=W.heightAt(340,8),exit=W.heightAt(700,-30),ring=W.heightAt(0,700),plain=W.heightAt(540,140);
  ok(camp>3&&camp<9,`camp (468,16) h=${camp.toFixed(1)} in [3,9]`);
  ok(pass>8&&pass<20,`pass (340,8) h=${pass.toFixed(1)} in [8,20]`);
  ok(exit>W.SEA+1,`river exit (700,-30) h=${exit.toFixed(1)} > SEA+1`);
  ok(ring>20,`outer ring (0,700) h=${ring.toFixed(1)} > 20`);
  ok(plain>3&&plain<10,`plain (540,140) h=${plain.toFixed(1)} in [3,10]`);
  const [fd,fw,fdep]=W.riverAt(482,22);
  ok(fdep<=.4,`ford at (482,22) depth=${fdep.toFixed(2)} <= .4 (dist ${fd.toFixed(1)})`);
  ok(W.riverDist(470,16)<20,`river near camp: riverDist(470,16)=${W.riverDist(470,16).toFixed(1)}`);
}
console.log(fails?`${fails} FAILURES`:'ALL OK');
process.exit(fails?1:0);
