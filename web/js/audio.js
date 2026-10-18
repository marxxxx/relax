import {$,clamp} from './util.js';
import {FIRE,coastEdge} from './world.js';
import {camera} from './renderer.js';
import {hearthLight} from './interior.js';
import {state,cur} from './state.js';

// ---------- audio ----------
let AC=null,A=null,soundOn=false;
function initAudio(){
  AC=new (window.AudioContext||window.webkitAudioContext)();
  const master=AC.createGain();master.gain.value=.9;master.connect(AC.destination);
  const len=AC.sampleRate*4;const white=AC.createBuffer(1,len,AC.sampleRate),brown=AC.createBuffer(1,len,AC.sampleRate);
  const wd=white.getChannelData(0),bd=brown.getChannelData(0);let last=0;
  for(let i=0;i<len;i++){const w=Math.random()*2-1;wd[i]=w;last=(last+.02*w)/1.02;bd[i]=last*3.5;}
  const loop=(buf)=>{const s=AC.createBufferSource();s.buffer=buf;s.loop=true;s.start();return s;};
  const gain=(v,dest)=>{const g=AC.createGain();g.gain.value=v;g.connect(dest);return g;};
  const filt=(type,f,q,dest)=>{const b=AC.createBiquadFilter();b.type=type;b.frequency.value=f;if(q)b.Q.value=q;b.connect(dest);return b;};
  const windG=gain(0,master);const wf=filt('lowpass',420,.7,windG);loop(brown).connect(wf);
  const lfo=AC.createOscillator();lfo.frequency.value=.11;const lfoG=AC.createGain();lfoG.gain.value=220;lfo.connect(lfoG);lfoG.connect(wf.frequency);lfo.start();
  const rainG=gain(0,master);const rl=filt('lowpass',6500,0,rainG);const rh=filt('highpass',700,0,rl);loop(white).connect(rh);
  const cricketG=gain(0,master);const am=gain(.0,cricketG);const osc=AC.createOscillator();osc.frequency.value=4400;osc.connect(am);osc.start();
  const tr=AC.createOscillator();tr.type='square';tr.frequency.value=28;const trG=AC.createGain();trG.gain.value=.5;tr.connect(trG);trG.connect(am.gain);tr.start();
  const surfG=gain(0,master);const sf=filt('lowpass',700,.5,surfG);const sAm=gain(.55,sf);loop(brown).connect(sAm);
  const swell=AC.createOscillator();swell.frequency.value=.09;const swG=AC.createGain();swG.gain.value=.45;swell.connect(swG);swG.connect(sAm.gain);swell.start();
  A={master,windG,rainG,cricketG,white,brown,rl,wf,surfG,acc:0};
}
function crackle(vol){if(!A||vol<.02)return;const s=AC.createBufferSource();s.buffer=A.white;
  const bp=AC.createBiquadFilter();bp.type='bandpass';bp.frequency.value=1200+Math.random()*2500;bp.Q.value=1.4;
  const g=AC.createGain();const t=AC.currentTime,d=.015+Math.random()*.05;g.gain.setValueAtTime(vol*(.3+Math.random()*.7),t);g.gain.exponentialRampToValueAtTime(.0001,t+d);
  s.connect(bp);bp.connect(g);g.connect(A.master);s.start(t,Math.random()*3,d+.02);}
function chirp(vol){if(!A)return;const t0=AC.currentTime;const n=2+Math.floor(Math.random()*4);const base=2600+Math.random()*1800;
  for(let i=0;i<n;i++){const o=AC.createOscillator(),g=AC.createGain();const t=t0+i*(.12+Math.random()*.08);
    o.frequency.setValueAtTime(base,t);o.frequency.exponentialRampToValueAtTime(base*(1.3+Math.random()*.4),t+.05);o.frequency.exponentialRampToValueAtTime(base*.9,t+.1);
    g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.015);g.gain.exponentialRampToValueAtTime(.0001,t+.11);
    o.connect(g);g.connect(A.master);o.start(t);o.stop(t+.13);}}
export function thunder(delay,vol){if(!A)return;const s=AC.createBufferSource();s.buffer=A.brown;const lp=AC.createBiquadFilter();lp.type='lowpass';lp.frequency.value=160;
  const g=AC.createGain();const t=AC.currentTime+delay;g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(vol,t+.08);g.gain.exponentialRampToValueAtTime(.001,t+4.5);
  s.connect(lp);lp.connect(g);g.connect(A.master);s.start(t,Math.random()*2,5);}
$('soundBtn').addEventListener('click',async()=>{
  soundOn=!soundOn;if(soundOn&&!AC)initAudio();
  if(AC){soundOn?await AC.resume():await AC.suspend();}
  $('soundBtn').setAttribute('aria-pressed',soundOn);$('waves').setAttribute('opacity',soundOn?'1':'.35');
  $('soundLbl').textContent=soundOn?'An':'Klang';});

export function updateAudio(dt,env){
  const {day,night,cl,fireScale}=env;
  if(A&&soundOn){A.acc+=dt;
    if(A.acc>.2){A.acc=0;const t=AC.currentTime;
      A.windG.gain.setTargetAtTime((.08+cur.wind*.35)*(1-state.indoor*.6),t,.6);
      A.rainG.gain.setTargetAtTime(cur.rain*.32*(1-state.indoor*.35),t,.6);{const cd=camera.position.x-coastEdge(camera.position.z);A.surfG.gain.setTargetAtTime(clamp(1-(cd+14)/110,0,1)*(.18+cur.wind*.3)*(1-state.indoor*.7),t,.8);}A.rl.frequency.setTargetAtTime(6500-state.indoor*5000,t,.5);
      A.cricketG.gain.setTargetAtTime(night*(1-cl*.7)*(1-cur.rain)*(1-cur.snow)*.012,t,1);}
    const fd=camera.position.distanceTo(FIRE),fv=Math.max(clamp(1-fd/45,0,1)*.22*fireScale*(1-state.indoor*.8),clamp(1-camera.position.distanceTo(hearthLight.position)/12,0,1)*.2);
    if(Math.random()<dt*9)crackle(fv);
    if(day>.6&&cur.rain<.2&&cur.snow<.3&&Math.random()<dt*.18)chirp(.035*(1-cl*.6));}
}
