import {isMobile} from './util.js';
import {scene} from './renderer.js';

// ---------- lights ----------
export const hemi=new THREE.HemisphereLight(0xbcd4ff,0x3a3020,.5);scene.add(hemi);
export const sun=new THREE.DirectionalLight(0xffffff,2);
sun.castShadow=true;
const SM=isMobile?1024:2048;
sun.shadow.mapSize.set(SM,SM);
Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:320});
sun.shadow.bias=-0.0006;sun.shadow.normalBias=0.03;
scene.add(sun);scene.add(sun.target);
