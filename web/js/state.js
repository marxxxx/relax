// Mutable state shared between modules. Imported bindings are read-only,
// so everything that several modules write lives on these objects.
export const state={hour:5.75,playing:true,dragging:false,speedI:0,wKey:'klar',T:0,flash:0,nextBolt:6,snowCover:0,wet:0,mode:'orbit',indoor:0,animalFrac:.5,rider:null,watch:null,xr:false};
export const SPEEDS=[[20,'1 h / 20 s'],[8,'1 h / 8 s'],[2,'1 h / 2 s']];

// ---------- weather presets ----------
export const W={
  klar:{cloud:.12,rain:0,snow:0,fog:0,wind:.22,storm:0,bolt:0,label:'klar'},
  wolken:{cloud:.68,rain:0,snow:0,fog:.1,wind:.45,storm:0,bolt:0,label:'bewölkt'},
  regen:{cloud:.9,rain:1,snow:0,fog:.3,wind:.55,storm:0,bolt:0,label:'Regen'},
  gewitter:{cloud:1,rain:1,snow:0,fog:.2,wind:1,storm:1,bolt:1,label:'Gewitter'},
  sturm:{cloud:.97,rain:.8,snow:0,fog:.42,wind:1.3,storm:.85,bolt:0,label:'Sturm'},
  schnee:{cloud:.82,rain:0,snow:1,fog:.35,wind:.28,storm:0,bolt:0,label:'Schneefall'},
  nebel:{cloud:.5,rain:0,snow:0,fog:1,wind:.08,storm:0,bolt:0,label:'Nebel'}
};
// current weather, blended toward the selected preset every frame
export const cur=Object.assign({},W.klar);
