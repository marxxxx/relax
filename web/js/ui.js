import {$} from './util.js';
import {state,SPEEDS,W} from './state.js';

// ---------- UI ----------
const timeIn=$('time'),knob=$('knob'),clock=$('clock');
timeIn.addEventListener('input',()=>{state.hour=parseFloat(timeIn.value);state.dragging=true;});
timeIn.addEventListener('change',()=>{state.dragging=false;});
$('playBtn').addEventListener('click',()=>{state.playing=!state.playing;$('playBtn').setAttribute('aria-label',state.playing?'Zeit anhalten':'Zeit laufen lassen');
  $('playIcon').innerHTML=state.playing?'<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>':'<path d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5z"/>';});
$('speedBtn').addEventListener('click',()=>{state.speedI=(state.speedI+1)%SPEEDS.length;$('speedBtn').textContent=SPEEDS[state.speedI][1];});
document.querySelectorAll('.chip').forEach(b=>b.addEventListener('click',()=>{state.wKey=b.dataset.w;
  document.querySelectorAll('.chip').forEach(x=>x.setAttribute('aria-pressed',x===b?'true':'false'));
  if(state.wKey==='gewitter')state.nextBolt=state.T+2.5;}));

function phaseName(h,sy){
  if(sy<-.2)return 'Nacht';
  if(h<12&&sy<.02)return 'Morgendämmerung';
  if(h<12&&sy<.3)return 'Früher Morgen';
  if(h<10.5)return 'Morgen';
  if(h<13.5)return 'Mittag';
  if(sy>.3)return 'Nachmittag';
  if(sy>.02)return 'Goldene Stunde';
  return 'Abenddämmerung';
}

let uiAcc=1;
export function updateUI(dt,sy){
  uiAcc+=dt;
  if(uiAcc>.15){uiAcc=0;
    if(!state.dragging)timeIn.value=state.hour.toFixed(2);
    knob.style.left=(state.hour/24*100)+'%';knob.classList.toggle('moon',sy<-.04);
    const hh=Math.floor(state.hour),mm=Math.floor((state.hour-hh)*60/5)*5;clock.textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
    $('mood').textContent=phaseName(state.hour,sy)+', '+W[state.wKey].label;}
}
