// Entry point. The scene is built as these modules are evaluated; they share one
// seeded random sequence, so keep the import order to get the same world layout.
import {clamp,$} from './util.js';
import {camera} from './renderer.js';
import {WU} from './materials.js';
import './sky.js';
import './lights.js';
import './terrain.js';
import './cabin.js';
import './interior.js';
import './campfire.js';
import {updateEffects} from './effects.js';
import './trees.js';
import './props.js';
import {updateSea} from './sea.js';
import './grass.js';
import {updatePrecipitation} from './precipitation.js';
import {updateWeather} from './weather.js';
import {updateEnvironment} from './environment.js';
import {player,setMode,updateCamera} from './controls.js';
import {updateAudio} from './audio.js';
import {updateUI} from './ui.js';
import {renderFrame} from './post.js';
import {state,SPEEDS} from './state.js';

// ---------- main loop ----------
let lastT=performance.now(),firstFrame=true;
function frame(now){
  const dt=clamp((now-lastT)/1000,0,.05);lastT=now;state.T+=dt;WU.uTime.value=state.T;

  if(state.playing&&!state.dragging)state.hour=(state.hour+dt/SPEEDS[state.speedI][0])%24;

  updateWeather(dt);
  const env=updateEnvironment(dt);
  updateSea(env);
  updateEffects(dt,env);
  updatePrecipitation(dt,env);
  updateCamera(dt);
  updateAudio(dt,env);
  updateUI(dt,env.sy);

  camera.updateMatrixWorld();renderFrame();
  if(firstFrame){firstFrame=false;setTimeout(()=>$('loader').classList.add('gone'),150);}
  requestAnimationFrame(frame);
}
window.__lichtung={player,setMode};
requestAnimationFrame(frame);
