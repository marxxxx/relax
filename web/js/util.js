export const $ = id => document.getElementById(id);
export const isMobile = matchMedia('(pointer:coarse)').matches || Math.min(innerWidth, innerHeight) < 600;

// ---------- helpers ----------
export const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
export const lerp=(a,b,t)=>a+(b-a)*t;
export const smooth=(e0,e1,x)=>{const t=clamp((x-e0)/(e1-e0),0,1);return t*t*(3-2*t);};
export function hash(x,y){const s=Math.sin(x*127.1+y*311.7)*43758.5453;return s-Math.floor(s);}
export function vnoise(x,y){const xi=Math.floor(x),yi=Math.floor(y),xf=x-xi,yf=y-yi;
  const u=xf*xf*(3-2*xf),v=yf*yf*(3-2*yf);
  const a=hash(xi,yi),b=hash(xi+1,yi),c=hash(xi,yi+1),d=hash(xi+1,yi+1);
  return a+(b-a)*u+(c-a)*v+(a-b-c+d)*u*v;}
export function fbm(x,y){let f=0,a=.5,fr=1;for(let i=0;i<5;i++){f+=a*vnoise(x*fr,y*fr);fr*=2.03;a*=.5;}return f;}
// seeded so the world (trees, rocks, grass …) is laid out identically on every load
let seed=7;export const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};
export function distSeg(px,pz,ax,az,bx,bz){const vx=bx-ax,vz=bz-az,t=clamp(((px-ax)*vx+(pz-az)*vz)/(vx*vx+vz*vz),0,1);return Math.hypot(px-ax-vx*t,pz-az-vz*t);}
