// Per-frame lighting: sun and moon, sky colours, fog and colour grade, lake, window glow and fire light.
import {lerp,smooth} from './util.js';
import {renderer,scene,camera,POST} from './renderer.js';
import {WU} from './materials.js';
import {skyU,sky,skyAt,greyify} from './sky.js';
import {hemi,sun} from './lights.js';
import {water} from './terrain.js';
import {glowMat,winLight} from './cabin.js';
import {hearthLight,bounceLight,lanternLight,updateBeams} from './interior.js';
import {fireLight} from './campfire.js';
import {target} from './controls.js';
import {PP} from './post.js';
import {state,cur} from './state.js';

const top=new THREE.Color(),hor=new THREE.Color(),sunCol=new THREE.Color(),tmp=new THREE.Color();
const sunDir=new THREE.Vector3();
const c=new THREE.Color(),c2=new THREE.Color(),P=new THREE.Vector3(),c2v=new THREE.Vector3(),fwd=new THREE.Vector3();
// values derived each frame that other modules' updates read
const env={top,hor,sunCol,sunDir};

export function updateEnvironment(dt){
  // sun
  const th=(state.hour-6)/24*Math.PI*2;
  sunDir.set(Math.cos(th)*.85,Math.sin(th),-.45).normalize();
  const sy=sunDir.y;
  const day=smooth(-.1,.22,sy),night=1-smooth(-.16,.06,sy);
  skyAt(sy,top,hor);
  const cl=cur.cloud,dark=cur.storm*.5+cl*.15*day;
  greyify(top,cl*.8,dark);greyify(hor,cl*.7,dark*.7);
  if(cur.fog>.01){tmp.copy(hor).lerp(c2.setRGB(.62,.66,.7).multiplyScalar(.2+.8*smooth(-.2,.3,sy)),cur.fog*.6);hor.copy(tmp);}
  sunCol.setHex(0xff7a3a).lerp(c.setHex(0xfff0cc),smooth(0,.4,sy));
  // palette is authored in sRGB; the renderer works in linear space
  top.convertSRGBToLinear();hor.convertSRGBToLinear();sunCol.convertSRGBToLinear();


  skyU.uTop.value.copy(top);skyU.uHor.value.copy(hor);skyU.uSunCol.value.copy(sunCol);skyU.uSun.value.copy(sunDir);
  skyU.uStars.value=night;skyU.uCloud.value=cl;skyU.uFlash.value=state.flash*.6;
  const golden=smooth(-.12,0,sy)*(1-smooth(.1,.38,sy));
  skyU.uCloudLit.value.setRGB(1,.97,.92).lerp(c.copy(sunCol).multiplyScalar(1.5),golden*.75).multiplyScalar((.12+.88*day)*(1-cur.storm*.55)).add(c.setRGB(.03,.04,.07).multiplyScalar(night));
  skyU.uCloudDark.value.copy(hor).lerp(top,.5).multiplyScalar(.62*(1-cur.storm*.5)).lerp(c.setRGB(.25,.12,.2),golden*.25);
  skyU.uWindOff.value+=dt*(.006+cur.wind*.03);
  WU.uSunDir.value.copy(sunDir);WU.uSunCol.value.copy(sunCol).multiplyScalar(day*(1-cl*.85)*(1-state.indoor*.5)*(.3+.7*golden));
  sky.position.copy(camera.position);

  // lights
  const useSun=sy>-.04;
  const ld=useSun?sunDir:P.copy(sunDir).negate();
  sun.position.copy(target).addScaledVector(ld,140);sun.target.position.copy(target);
  if(useSun){sun.color.copy(sunCol);sun.intensity=day*(1.25+golden*.9)*(1-cl*.78);}
  else{sun.color.setHex(0x9fb2ff);sun.intensity=.45*smooth(-.04,-.3,sy)*(1-cl*.8);}
  hemi.color.copy(top).lerp(c.setRGB(1,1,1),.1*day).add(c.setRGB(.06,.07,.11));
  hemi.groundColor.setHex(0x3b3322).convertSRGBToLinear().multiplyScalar(.5+.9*day);
  hemi.intensity=(.34+day*.36)*(1-cur.storm*.25)+state.flash*2.5+state.snowCover*.15*day;

  const fogDens=(.0026+cur.fog*.032+cur.rain*.006+cur.snow*.009)*(1-state.indoor*.85);
  const expo=1.0+night*.25*(1-state.indoor)+state.indoor*.3*day;
  if(!POST){scene.fog.color.copy(hor);scene.fog.density=fogDens;renderer.toneMappingExposure=expo;}
  else{const C=PP.comp.uniforms;
    C.uFogCol.value.copy(hor);C.uFogSun.value.copy(hor).lerp(sunCol,.55*(1-cl*.7)*smooth(-.1,.05,sy));C.uSunDir.value.copy(sunDir);
    C.uFogDens.value=fogDens*.55;C.uFogStart.value=lerp(40,3,Math.max(cur.fog,cur.snow*.6,cur.rain*.4))*(1-state.indoor*.7);C.uFogFall.value=lerp(.026,.015,cur.fog);C.uHaze.value=.0006*(1-state.indoor*.9)+cur.fog*.004;
    C.uExposure.value=expo;C.uTime.value=state.T;
    // shafts: from the sun by day, faintly from the moon at night
    const lightDir=sy>-.04?sunDir:P.copy(sunDir).negate();
    const sp3=c2v.copy(lightDir).multiplyScalar(1000).add(camera.position).project(camera);
    camera.getWorldDirection(fwd);
    const facing=smooth(.0,.35,fwd.dot(lightDir));
    PP.occ.uniforms.uSunUV.value.set(sp3.x*.5+.5,sp3.y*.5+.5);PP.radial.uniforms.uSunUV.value.copy(PP.occ.uniforms.uSunUV.value);
    C.uRayCol.value.copy(sy>-.04?sunCol:c.setRGB(.5,.6,.9));
    C.uRayInt.value=facing*(sy>-.04?smooth(-.04,.06,sy):.25*smooth(-.04,-.25,sy))*(1-cl*.8)*(.45+cur.fog*.7+state.wet*.3)*.55;
    // colour grade: two-tone palettes per time of day
    const sT=C.uShadowTint.value,hT=C.uHighTint.value;
    sT.setRGB(.55,.72,.85).lerp(c.setRGB(.62,.45,.85),golden).lerp(c.setRGB(.38,.5,.92),night*.85).lerp(c.setRGB(.62,.46,.4),state.indoor*.7);
    hT.setRGB(1,.93,.78).lerp(c.setRGB(1,.68,.42),golden).lerp(c.setRGB(.7,.85,1),night*.7).lerp(c.setRGB(1,.74,.48),state.indoor*.6);
    C.uSat.value=1.1-cur.storm*.15-cur.fog*.08;}


  water.material.color.copy(hor).lerp(c.setHex(0x1b3440).convertSRGBToLinear(),.55).multiplyScalar(.6+.4*day);
  water.material.specular.copy(useSun?sunCol:c.setHex(0x9fb2ff)).multiplyScalar(.6*(1-cl));

  // windows & fire
  const glow=Math.max(night,cl*.35,(1-day)*.6);
  glowMat.opacity=glow*.55;winLight.intensity=glow*1.4;
  const fireScale=1-cur.rain*.55;
  fireLight.intensity=(1.3+night*1.6)*fireScale*(.82+.18*Math.sin(state.T*13)*Math.sin(state.T*7.3+1)+.06*Math.random());

  hearthLight.intensity=(.9+night*.4)*(.8+.2*Math.sin(state.T*11+2)*Math.sin(state.T*6.1)+.06*Math.random());
  lanternLight.intensity=.25+glow*.6;
  const sunIn=day*(1-cl*.9);
  bounceLight.intensity=hearthLight.intensity*.22+sunIn*.45;
  updateBeams(sunDir,.32*sunIn*(1+cur.fog*.5),c.copy(sunCol));
  return Object.assign(env,{sy,day,night,golden,cl,glow,fireScale,sunIn});
}
