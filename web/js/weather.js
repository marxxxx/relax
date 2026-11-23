// Blends the current weather toward the selected preset and drives lightning.
import {clamp} from './util.js';
import {WU} from './materials.js';
import {state,W,cur} from './state.js';
import {thunder} from './audio.js';

// ---------- live weather: browser location + Open-Meteo (no key) -> nearest preset ----------
const WMO={0:'klar',1:'überwiegend klar',2:'teils bewölkt',3:'bedeckt',45:'Nebel',48:'Raureifnebel',
  51:'leichter Niesel',53:'Nieselregen',55:'starker Niesel',56:'gefrierender Niesel',57:'starker gefrierender Niesel',
  61:'leichter Regen',63:'Regen',65:'starker Regen',66:'gefrierender Regen',67:'starker gefrierender Regen',
  71:'leichter Schneefall',73:'Schneefall',75:'starker Schneefall',77:'Schneegriesel',
  80:'leichte Schauer',81:'Regenschauer',82:'heftige Schauer',85:'Schneeschauer',86:'starke Schneeschauer',
  95:'Gewitter',96:'Gewitter mit Hagel',99:'Gewitter mit starkem Hagel'};
const HOME_LOC={lat:52.52,lon:13.41,name:'Berlin'};
export function presetFor(c,wind){   // WMO code + wind (km/h) -> key of W
  const k=c>=95?'gewitter':(c>=71&&c<=77)||c===85||c===86?'schnee':(c>=51&&c<=67)||(c>=80&&c<=82)?'regen':c===45||c===48?'nebel':c>=2?'wolken':'klar';
  return wind>=50&&k!=='gewitter'&&k!=='schnee'?'sturm':k;}
function locate(){return new Promise(res=>{   // denied/failed -> last known place, else Berlin
  const fb=why=>{const l=state.live;res(l&&isFinite(l.lat)?{lat:l.lat,lon:l.lon,name:l.name,why}:{...HOME_LOC,why});};
  if(!navigator.geolocation)return fb('kein Standort verfügbar');
  navigator.geolocation.getCurrentPosition(p=>res({lat:+p.coords.latitude.toFixed(2),lon:+p.coords.longitude.toFixed(2),name:'dein Standort'}),
    e=>fb(e.code===1?'Standort verweigert':'Standort nicht ermittelbar'),{timeout:8000,maximumAge:6e5});});}
let busy=false;
async function fetchLive(){
  busy=true;const loc=await locate();
  try{const r=await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${loc.lat}&longitude=${loc.lon}&current=temperature_2m,weather_code,wind_speed_10m`);
    if(!r.ok)throw new Error('HTTP '+r.status);
    const c=(await r.json()).current;if(!c)throw new Error('keine Daten');
    state.live={temp:c.temperature_2m,wind:c.wind_speed_10m,code:c.weather_code,desc:WMO[c.weather_code]||'Code '+c.weather_code,
      lat:loc.lat,lon:loc.lon,name:loc.name,at:new Date().toISOString()};
    state.wErr=loc.why?loc.why+', Wetter für '+loc.name:'';
  }catch(e){state.wErr='Wetter nicht abrufbar ('+e.message+')'+(state.live?', zeige letzten Stand':'');}   // offline: keep the saved reading
  busy=false;
  if(state.wLive&&state.live){const k=presetFor(state.live.code,state.live.wind);if(k==='gewitter'&&state.wKey!==k)state.nextBolt=state.T+2.5;state.wKey=k;}}

export function updateWeather(dt){
  if(state.wLive&&!busy&&state.T>=state.nextLive){state.nextLive=state.T+600;fetchLive();}   // on start / when chosen, then every 10 min
  const tw=W[state.wKey],k=Math.min(1,dt*.35);
  for(const key of ['cloud','rain','snow','fog','wind','storm','bolt'])cur[key]+=(tw[key]-cur[key])*k;
  state.snowCover=clamp(state.snowCover+dt*(cur.snow>.5?.035:-.02),0,1);
  state.wet=clamp(state.wet+dt*(cur.rain>.5?.08:-.015),0,1);
  WU.uSnow.value=state.snowCover;WU.uWet.value=state.wet;WU.uWind.value=cur.wind;

  if(cur.bolt>.5&&state.T>state.nextBolt){state.flash=1;state.nextBolt=state.T+5+Math.random()*9;const d=.4+Math.random()*2.2;thunder(d,.9/(1+d*.3));setTimeout(()=>{state.flash=Math.max(state.flash,.8);},120);}
  state.flash=Math.max(0,state.flash-dt*5);
}
