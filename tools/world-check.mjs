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
  // pts: [x,z,water level,depth,half-width,arc length,bank height]
  for(const R of W.RIVERS){
    let carveOK=true,maxRise=-1e9,noBank=0;
    for(let i=0;i<R.pts.length;i++){
      const [x,z,wl,D,w]=R.pts[i];
      if(W.heightAt(x,z)>wl-D*.5)carveOK=false;                    // the channel is carved below the water
      if(i>0)maxRise=Math.max(maxRise,wl-R.pts[i-1][2]);           // water only ever runs downhill
      if(i%2)continue;
      let near=false;for(const O of W.RIVERS)if(O!==R&&W.riverNear(x,z,O,O.w*2+25))near=true;   // confluence mouths stay open
      if(near)continue;
      const a=R.pts[Math.max(i-1,0)],b=R.pts[Math.min(i+1,R.pts.length-1)];
      let nx=-(b[1]-a[1]),nz=b[0]-a[0];const nl=Math.hypot(nx,nz)||1;nx/=nl;nz/=nl;
      for(const s of [-1,1]){let found=false;
        for(let d=0;d<=w+4;d+=0.25)if(W.heightAt(x+nx*s*d,z+nz*s*d)>=wl+.05){found=true;break;}
        if(!found)noBank++;}}
    ok(carveOK,`river w=${R.w}: channel carved below the water at the centerline`);
    ok(maxRise<=0,`river w=${R.w}: water level never rises downstream (max step ${maxRise.toFixed(4)})`);
    ok(noBank===0,`river w=${R.w}: both banks rise above the water within w+4 (missing: ${noBank})`);}
  let slopeOK=true,maxs=0;
  for(let i=1;i<W.FAR_TRAIL.pts.length;i++){
    const a=W.FAR_TRAIL.pts[i-1],b=W.FAR_TRAIL.pts[i];
    const s=Math.abs(b[2]-a[2])/Math.hypot(b[0]-a[0],b[1]-a[1]);
    if(s>maxs)maxs=s;if(s>.5+1e-6)slopeOK=false;}
  ok(slopeOK,`FAR_TRAIL slope <= 1:2 (max ${maxs.toFixed(3)})`);
  // the blend mask must not create a cliff where it switches on (r≈298) inside the trail corridor
  let maxJump=0,maxSlope=0;
  for(let a=-0.3;a<=0.3;a+=0.02){
    const cA=Math.cos(a),sA=Math.sin(a);
    if(W.pathDist(cA*298,sA*298)<8){
      const h0=W.heightAt(cA*297.99,sA*297.99),h1=W.heightAt(cA*298.01,sA*298.01);
      maxJump=Math.max(maxJump,Math.abs(h1-h0));}
    let px=cA*296,pz=sA*296;
    for(let r=296.1;r<=314;r+=0.1){const nx=cA*r,nz=sA*r;
      if(W.pathDist(nx,nz)<8)maxSlope=Math.max(maxSlope,Math.abs(W.heightAt(nx,nz)-W.heightAt(px,pz))/0.1);
      px=nx;pz=nz;}}
  ok(maxJump<0.05,`pass entrance continuous at r=298 (max jump ${maxJump.toFixed(3)} m)`);
  ok(maxSlope<1.26,`pass corridor walkable (max slope ${maxSlope.toFixed(2)}/m, tooSteep limit 1.25)`);
  const camp=W.heightAt(468,16),pass=W.heightAt(340,8),exit=W.heightAt(700,-30),ring=W.heightAt(0,700),plain=W.heightAt(540,140);
  ok(camp>3&&camp<9,`camp (468,16) h=${camp.toFixed(1)} in [3,9]`);
  ok(pass>8&&pass<20,`pass (340,8) h=${pass.toFixed(1)} in [8,20]`);
  ok(exit>W.SEA+1,`river exit (700,-30) h=${exit.toFixed(1)} > SEA+1`);
  ok(ring>20,`outer ring (0,700) h=${ring.toFixed(1)} > 20`);
  ok(plain>3&&plain<10,`plain (540,140) h=${plain.toFixed(1)} in [3,10]`);
  const [fd,fw,fdep]=W.riverAt(524,7);
  ok(fdep<=.4&&fd<3,`ford at (524,7) depth=${fdep.toFixed(2)} <= .4 (dist ${fd.toFixed(1)})`);
  const cd=W.riverDist(468,16);
  ok(cd>36&&cd<60,`river passes the camp outside its fence: riverDist(468,16)=${cd.toFixed(1)}`);
  // tributaries end at the main river's water level
  for(const R of W.RIVERS.slice(1)){const e=R.pts[R.pts.length-1],q=W.riverNear(e[0],e[1],W.RIVERS[0],5);
    ok(q&&Math.abs(q[1]-e[2])<.02,`tributary w=${R.w} joins at the main river's level (${e[2].toFixed(2)} vs ${q?q[1].toFixed(2):'-'})`);}
}
console.log(fails?`${fails} FAILURES`:'ALL OK');
process.exit(fails?1:0);
