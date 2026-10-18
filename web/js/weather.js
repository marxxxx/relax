// Blends the current weather toward the selected preset and drives lightning.
import {clamp} from './util.js';
import {WU} from './materials.js';
import {state,W,cur} from './state.js';
import {thunder} from './audio.js';

export function updateWeather(dt){
  const tw=W[state.wKey],k=Math.min(1,dt*.35);
  for(const key of ['cloud','rain','snow','fog','wind','storm'])cur[key]+=(tw[key]-cur[key])*k;
  state.snowCover=clamp(state.snowCover+dt*(cur.snow>.5?.035:-.02),0,1);
  state.wet=clamp(state.wet+dt*(cur.rain>.5?.08:-.015),0,1);
  WU.uSnow.value=state.snowCover;WU.uWet.value=state.wet;WU.uWind.value=cur.wind;

  if(cur.storm>.5&&state.T>state.nextBolt){state.flash=1;state.nextBolt=state.T+5+Math.random()*9;const d=.4+Math.random()*2.2;thunder(d,.9/(1+d*.3));setTimeout(()=>{state.flash=Math.max(state.flash,.8);},120);}
  state.flash=Math.max(0,state.flash-dt*5);
}
