// Save/resume: where you are (walking spot or orbit view), the weather and the time of day go to
// localStorage every second and when the page is left; on the next visit they are restored. Uses no rnd().
import {$} from './util.js';
import {state,W,cur} from './state.js';
import {viewState,setView} from './controls.js';

const KEY='savegame';
let last=0,off=false;   // off: "Neu beginnen" cleared the save, don't write it back while reloading

// ---------- write ----------
export function writeSave(){
  if(off)return;const now=new Date();
  const s={player:viewState(),                                    // x/z = ground plane (world units), y = height
    weather:{preset:state.wKey},                                  // key of W
    time:{hour:+state.hour.toFixed(3),real:now.toISOString()},    // hour = in-game time of day
    savedAt:now.toISOString()};
  try{localStorage.setItem(KEY,JSON.stringify(s));state.savedAt=now;}catch(e){}}
export function updateSave(){const t=performance.now();if(t-last>=1000){last=t;writeSave();}}   // wall clock: tick's dt is clamped
addEventListener('pagehide',writeSave);addEventListener('beforeunload',writeSave);
document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='hidden')writeSave();});

// ---------- read + restore ----------
function readSave(){
  try{const s=JSON.parse(localStorage.getItem(KEY));return s&&s.player&&isFinite(s.player.x)&&isFinite(s.player.z)?s:null;}catch(e){return null;}}
export const restored=readSave();
if(restored){const S=restored,t=S.time||{},w=S.weather||{};
  if(isFinite(t.hour))state.hour=((t.hour%24)+24)%24;
  if(W[w.preset])state.wKey=w.preset;
  Object.assign(cur,W[state.wKey]);state.snowCover=cur.snow;state.wet=cur.rain;   // start in the saved weather instead of blending in from 'klar'
  setView(S.player);
  state.savedAt=new Date(S.savedAt);
  const hh=Math.floor(state.hour),mm=Math.floor((state.hour-hh)*60);
  const toast=$('toast');
  toast.textContent=`Fortgesetzt, Stand vom ${state.savedAt.toLocaleString('de-DE',{dateStyle:'short',timeStyle:'short'})}: `+
    `${S.player.mode==='fp'?'unterwegs':'Rundblick'} bei (${Math.round(S.player.x)}, ${Math.round(S.player.z)}), `+
    `${String(hh).padStart(2,'0')}:${String(mm).padStart(2,'0')} Uhr, ${W[state.wKey].label}`;
  toast.classList.remove('gone');setTimeout(()=>toast.classList.add('gone'),8000);}

// ---------- start over ----------
$('resetBtn').addEventListener('click',()=>{off=true;try{localStorage.removeItem(KEY);}catch(e){}location.reload();});
