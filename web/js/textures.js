// ---------- textures ----------
export function canvasTex(w,h,draw){const cv=document.createElement('canvas');cv.width=w;cv.height=h;draw(cv.getContext('2d'),w,h);const t=new THREE.CanvasTexture(cv);t.encoding=THREE.sRGBEncoding;return t;}
export const softDot=canvasTex(64,64,(g,w)=>{const gr=g.createRadialGradient(w/2,w/2,0,w/2,w/2,w/2);gr.addColorStop(0,'rgba(255,255,255,1)');gr.addColorStop(.4,'rgba(255,255,255,.55)');gr.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=gr;g.fillRect(0,0,w,w);});
export const logTex=canvasTex(128,256,(g,w,h)=>{const n=10,lh=h/n;for(let i=0;i<n;i++){const gr=g.createLinearGradient(0,i*lh,0,(i+1)*lh);
  gr.addColorStop(0,'#5a3c22');gr.addColorStop(.15,'#8a6038');gr.addColorStop(.6,'#7a5230');gr.addColorStop(.92,'#4a3019');gr.addColorStop(1,'#2a1a0e');g.fillStyle=gr;g.fillRect(0,i*lh,w,lh);}
  g.globalAlpha=.12;for(let i=0;i<60;i++){g.fillStyle=Math.random()<.5?'#000':'#c89a62';g.fillRect(Math.random()*w,Math.random()*h,8+Math.random()*30,1);} });
logTex.wrapS=logTex.wrapT=THREE.RepeatWrapping;
