import {$,isMobile} from './util.js';

// ---------- renderer / scene ----------
export const canvas=$('scene');
export let renderer;
try{renderer=new THREE.WebGLRenderer({canvas,antialias:!isMobile||devicePixelRatio<2,powerPreference:'high-performance'});}
catch(e){ $('loader').innerHTML='<p>Dein Browser kann hier kein WebGL starten. Versuche Chrome, Safari oder Firefox in aktueller Version.</p>'; throw e; }
renderer.setPixelRatio(Math.min(devicePixelRatio,isMobile?1.5:2));
renderer.setSize(innerWidth,innerHeight);
renderer.outputEncoding=THREE.sRGBEncoding;
export const POST=renderer.capabilities.isWebGL2;
renderer.toneMapping=POST?THREE.NoToneMapping:THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure=1.0;
renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFSoftShadowMap;

export const scene=new THREE.Scene();
scene.fog=POST?null:new THREE.FogExp2(0xaabbcc,.003);
export const camera=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.1,2500);
