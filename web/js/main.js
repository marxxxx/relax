// Entry point. The scene is built as these modules are evaluated; they share one
// seeded random sequence, so keep the load order to get the same world layout.
// Modules are loaded one by one (dynamic import) so the splash screen can show
// real progress; awaiting each step yields to the browser, letting the bar paint.
const STEPS=[
  ['./util.js',()=>import('./util.js')],
  ['./renderer.js',()=>import('./renderer.js')],
  ['./materials.js',()=>import('./materials.js')],
  ['./sky.js',()=>import('./sky.js')],
  ['./lights.js',()=>import('./lights.js')],
  ['./terrain.js',()=>import('./terrain.js')],
  ['./cabin.js',()=>import('./cabin.js')],
  ['./interior.js',()=>import('./interior.js')],
  ['./upstairs.js',()=>import('./upstairs.js')],
  ['./campfire.js',()=>import('./campfire.js')],
  ['./effects.js',()=>import('./effects.js')],
  ['./trees.js',()=>import('./trees.js')],
  ['./props.js',()=>import('./props.js')],
  ['./sea.js',()=>import('./sea.js')],
  ['./grass.js',()=>import('./grass.js')],
  ['./precipitation.js',()=>import('./precipitation.js')],
  ['./weather.js',()=>import('./weather.js')],
  ['./environment.js',()=>import('./environment.js')],
  ['./controls.js',()=>import('./controls.js')],
  ['./audio.js',()=>import('./audio.js')],
  ['./ui.js',()=>import('./ui.js')],
  ['./post.js',()=>import('./post.js')],
  ['./state.js',()=>import('./state.js')],
  ['./animals.js',()=>import('./animals.js')],
];

let clamp,$,camera,WU,updateEffects,updateSea,updatePrecipitation,updateWeather,updateEnvironment,
    player,setMode,updateCamera,updateAudio,updateUI,renderFrame,state,SPEEDS,updateAnimals,animals;

function setLoad(p){
  const v=Math.round(p*100);
  document.getElementById('loadFill').style.width=v+'%';
  document.getElementById('loadPct').textContent=v+'%';
  document.getElementById('loadBar').setAttribute('aria-valuenow',v);
}

async function boot(){
  setLoad(0);
  const M={};
  for(let i=0;i<STEPS.length;i++){
    const [path,load]=STEPS[i];
    M[path]=await load();
    setLoad((i+1)/STEPS.length);
    await new Promise(r=>setTimeout(r)); // yield so the updated bar paints before the next module builds
  }
  ({clamp,$}=M['./util.js']);
  ({camera}=M['./renderer.js']);
  ({WU}=M['./materials.js']);
  ({updateEffects}=M['./effects.js']);
  ({updateSea}=M['./sea.js']);
  ({updatePrecipitation}=M['./precipitation.js']);
  ({updateWeather}=M['./weather.js']);
  ({updateEnvironment}=M['./environment.js']);
  ({player,setMode,updateCamera}=M['./controls.js']);
  ({updateAudio}=M['./audio.js']);
  ({updateUI}=M['./ui.js']);
  ({renderFrame}=M['./post.js']);
  ({state,SPEEDS}=M['./state.js']);
  ({updateAnimals,animals}=M['./animals.js']);

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
    updateAnimals(dt,env);
    updateCamera(dt);
    updateAudio(dt,env);
    updateUI(dt,env.sy);

    camera.updateMatrixWorld();renderFrame();
    if(firstFrame){firstFrame=false;setTimeout(()=>$('loader').classList.add('gone'),150);}
    requestAnimationFrame(frame);
  }
  window.__lichtung={player,setMode,animals,state,camera};
  requestAnimationFrame(frame);
}
boot();
