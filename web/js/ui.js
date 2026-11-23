import {$} from './util.js';
import {state,SPEEDS,W} from './state.js';

// ---------- UI ----------
// collapsible bottom panel; its live height (--panelH) keeps joystick and hint above it
const panel=$('panel'),panelTog=$('panelTog');
export function setPanel(min){document.body.classList.toggle('panelMin',min);panelTog.setAttribute('aria-expanded',!min);
  panelTog.setAttribute('aria-label',min?'Bedienfeld ausklappen':'Bedienfeld einklappen');}
panelTog.addEventListener('click',()=>setPanel(!document.body.classList.contains('panelMin')));
const panelH=()=>document.documentElement.style.setProperty('--panelH',panel.offsetHeight+'px');
new ResizeObserver(panelH).observe(panel);panelH();
const timeIn=$('time'),knob=$('knob'),clock=$('clock');
timeIn.addEventListener('input',()=>{state.hour=parseFloat(timeIn.value);state.dragging=true;});
timeIn.addEventListener('change',()=>{state.dragging=false;});
$('playBtn').addEventListener('click',()=>{state.playing=!state.playing;$('playBtn').setAttribute('aria-label',state.playing?'Zeit anhalten':'Zeit laufen lassen');
  $('playIcon').innerHTML=state.playing?'<rect x="3" y="2" width="3.5" height="12" rx="1"/><rect x="9.5" y="2" width="3.5" height="12" rx="1"/>':'<path d="M4 2.5v11a1 1 0 0 0 1.5.86l9-5.5a1 1 0 0 0 0-1.72l-9-5.5A1 1 0 0 0 4 2.5z"/>';});
const speedLbl=()=>$('speedBtn').textContent=SPEEDS[state.speedI][1];speedLbl();
$('speedBtn').addEventListener('click',()=>{state.speedI=(state.speedI+1)%SPEEDS.length;speedLbl();});
const chips=document.querySelectorAll('.chip');let shownW='';
chips.forEach(b=>b.addEventListener('click',()=>{const w=b.dataset.w;state.wLive=w==='live';
  if(state.wLive){state.nextLive=0;return;}   // weather.js fetches the real weather and picks the matching preset
  state.wKey=w;if(w==='gewitter')state.nextBolt=state.T+2.5;}));
const hm=d=>new Date(d).toLocaleTimeString('de-DE',{hour:'2-digit',minute:'2-digit'});

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
  const pk=state.wLive?'live':state.wKey;if(pk!==shownW){shownW=pk;chips.forEach(x=>x.setAttribute('aria-pressed',x.dataset.w===pk));}
  if(uiAcc>.15){uiAcc=0;
    const L=state.live;
    $('liveInfo').textContent=(L?`Echt: ${Math.round(L.temp)} °C, ${L.desc}, Wind ${Math.round(L.wind)} km/h (${L.name}, ${hm(L.at)})`:'Echtes Wetter: noch keine Daten')+(state.savedAt?` · gespeichert ${state.savedAt.toLocaleTimeString('de-DE')}`:'');
    $('liveErr').textContent=state.wErr;
    if(!state.dragging)timeIn.value=state.hour.toFixed(2);
    knob.style.left=(state.hour/24*100)+'%';knob.classList.toggle('moon',sy<-.04);
    const hh=Math.floor(state.hour),mm=Math.floor((state.hour-hh)*60/5)*5;clock.textContent=String(hh).padStart(2,'0')+':'+String(mm).padStart(2,'0');
    $('mood').textContent=phaseName(state.hour,sy)+', '+(state.wLive&&L?L.desc+', '+Math.round(L.temp)+' °C':W[state.wKey].label);}
}
