// Entry point. The scene is built as these modules are evaluated; they share one
// seeded random sequence, so keep the import order to get the same world layout.
// They are imported one by one (same order as static imports would evaluate them)
// so the loader can paint its progress bar in between.
import {clamp,$} from './util.js';

// ---------- loader ----------
const bar=$('loadBar'),pct=$('loadPct');
const setLoad=f=>{const p=Math.round(clamp(f,0,1)*100);bar.style.width=p+'%';pct.textContent=p+' %';$('loadTrack').setAttribute('aria-valuenow',p);};
const paint=()=>new Promise(r=>requestAnimationFrame(()=>setTimeout(r,0)));   // let the browser draw the bar before the next chunk of work
let done=0;
// on Pages, build-site.sh appends ?v=<sha> to static imports; dynamic ones must carry the same query, or each module loads twice
const V=new URL(import.meta.url).search,load=p=>import(p+V);
async function step(w,fn){const r=await fn();done+=w;setLoad(done/100);await paint();return r;}
setLoad(0);await paint();

// [weight, import] — weights ≈ measured share of the load time; all steps sum to 100
const R=await step(6,()=>load('./renderer.js'));
const MA=await step(.5,()=>load('./materials.js'));
await step(.5,()=>load('./sky.js'));
await step(.5,()=>load('./lights.js'));
const TE=await step(39.5,()=>load('./terrain.js'));
await step(.5,()=>load('./cabin.js'));
await step(.5,()=>load('./interior.js'));
await step(.5,()=>load('./upstairs.js'));
await step(.5,()=>load('./campfire.js'));
const EF=await step(.5,()=>load('./effects.js'));
await step(.5,()=>load('./trees.js'));
await step(1,()=>load('./props.js'));
const SE=await step(.5,()=>load('./sea.js'));
await step(5,()=>load('./grass.js'));
const PR=await step(.5,()=>load('./precipitation.js'));
const WE=await step(.5,()=>load('./weather.js'));
const EN=await step(.5,()=>load('./environment.js'));
const CO=await step(.5,()=>load('./controls.js'));
const AU=await step(.5,()=>load('./audio.js'));
const UI=await step(.5,()=>load('./ui.js'));
const PO=await step(.5,()=>load('./post.js'));
const ST=await step(.5,()=>load('./state.js'));
const AN=await step(1,()=>load('./animals.js'));
const VA=await step(14.5,()=>load('./valley.js'));   // LAST world module on purpose: keeps the seeded rnd() layout of the world above unchanged
const XR=await step(.5,()=>load('./xr.js'));       // VR mode; uses no rnd()
const SA=await step(.5,()=>load('./save.js'));     // restores the saved view, weather and time; uses no rnd()
const {camera,renderer,scene}=R,{WU}=MA,{state,SPEEDS}=ST,{player,setMode}=CO,{animals}=AN;

// ---------- main loop ----------
function tick(dt){
  state.T+=dt;WU.uTime.value=state.T;
  if(state.playing&&!state.dragging)state.hour=(state.hour+dt/SPEEDS[state.speedI][0])%24;

  WE.updateWeather(dt);
  const env=EN.updateEnvironment(dt);
  SE.updateSea(env);
  TE.updateLake(dt,env);
  EF.updateEffects(dt,env);
  PR.updatePrecipitation(dt,env);
  AN.updateAnimals(dt,env);
  VA.updateValley(dt,env);
  CO.updateCamera(dt);
  XR.updateXR(dt);
  AU.updateAudio(dt,env);
  UI.updateUI(dt,env.sy);
  SA.updateSave();

  camera.updateMatrixWorld();PO.renderFrame();
}
await step(8,()=>{renderer.compile(scene,camera);});   // shader programs of the whole scene
await step(15,()=>tick(0));                             // warm-up frame behind the loader: shadow maps, post passes
setTimeout(()=>$('loader').classList.add('gone'),250);

let lastT=performance.now();
function frame(now){tick(clamp((now-lastT)/1000,0,.05));lastT=now;}
window.__lichtung={player,setMode,animals,state,camera,vrTap:XR.onSelect,save:SA};
renderer.setAnimationLoop(frame);   // not window rAF: that stops while a VR session is presenting
