import {scene} from './renderer.js';
import {WU} from './materials.js';

// ---------- sky ----------
export const skyU={uTop:{value:new THREE.Color()},uHor:{value:new THREE.Color()},uSunCol:{value:new THREE.Color()},
  uSun:{value:new THREE.Vector3(0,1,0)},uStars:{value:0},uCloud:{value:0},uFlash:{value:0},uTime:WU.uTime,
  uCloudLit:{value:new THREE.Color()},uCloudDark:{value:new THREE.Color()},uWindOff:{value:0}};
export const sky=new THREE.Mesh(new THREE.SphereGeometry(1200,48,24),new THREE.ShaderMaterial({
  uniforms:skyU,side:THREE.BackSide,depthWrite:false,fog:false,
  vertexShader:`varying vec3 vDir;void main(){vDir=normalize(position);gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
  fragmentShader:`
  uniform vec3 uTop,uHor,uSunCol,uSun,uCloudLit,uCloudDark;uniform float uStars,uCloud,uFlash,uTime,uWindOff;varying vec3 vDir;
  float h31(vec3 p){p=fract(p*0.3183099+.1);p*=17.0;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
  float h21(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n2(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.0-2.0*f);
    return mix(mix(h21(i),h21(i+vec2(1,0)),f.x),mix(h21(i+vec2(0,1)),h21(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float v=0.0,a=0.5;mat2 m=mat2(1.6,1.2,-1.2,1.6);for(int i=0;i<5;i++){v+=a*n2(p);p=m*p;a*=0.5;}return v;}
  void main(){
    vec3 d=normalize(vDir);
    float y=d.y;
    vec3 col=mix(uHor,uTop,pow(clamp(y,0.0,1.0),0.5));
    col=mix(col,uHor*0.8,smoothstep(0.0,-0.25,y));
    vec3 sn=normalize(uSun);
    float sd=dot(d,sn);
    float clear=1.0-uCloud*0.85;
    col+=uSunCol*pow(max(sd,0.0),5.0)*0.4*clear;
    col+=uSunCol*pow(max(sd,0.0),48.0)*0.7*clear;
    col+=uSunCol*smoothstep(0.9992,0.9996,sd)*4.0*step(-0.02,sn.y+0.05);
    float md=dot(d,-sn);
    col+=vec3(0.85,0.9,1.0)*smoothstep(0.9994,0.9997,md)*1.4*uStars;
    col+=vec3(0.5,0.6,0.9)*pow(max(md,0.0),40.0)*0.15*uStars;
    vec3 sp=floor(d*420.0);
    float s=h31(sp);
    float tw=0.6+0.4*sin(uTime*2.0+s*60.0);
    col+=vec3(1.0)*step(0.9975,s)*tw*uStars*smoothstep(0.0,0.25,y);
    // painted cloud layer
    if(y>-0.02){
      vec2 cp=d.xz/(max(y,0.0)+0.13)*0.9+vec2(uWindOff,uWindOff*0.35);
      float cov=mix(0.7,0.2,uCloud);
      float n=fbm(cp);
      float dens=smoothstep(cov,cov+0.22,n)*smoothstep(-0.02,0.16,y);
      vec2 toSun=normalize(sn.xz+vec2(1e-4))*0.18;
      float nS=fbm(cp+toSun);
      float lit=clamp(0.55+(n-nS)*5.0,0.0,1.0);
      vec3 cc=mix(uCloudDark,uCloudLit,lit);
      cc+=uSunCol*pow(max(sd,0.0),10.0)*(1.0-smoothstep(cov,cov+0.4,n))*1.6*clear;
      col=mix(col,cc,dens*0.97);
    }
    col+=vec3(0.85,0.9,1.0)*uFlash;
    gl_FragColor=vec4(col,1.0);
    #include <tonemapping_fragment>
    #include <encodings_fragment>
  }`
}));
sky.renderOrder=-1;
scene.add(sky);

// ---------- sky colors over the day ----------
const KEYS=[
  [-.4,0x040912,0x0b1824],[-.14,0x121d46,0x3a2c58],[-.02,0x37397a,0xee6948],[.06,0x5468ad,0xf6a25c],
  [.16,0x5885c4,0xf5cd98],[.35,0x4e88cf,0xc8dbea],[1,0x3b7ac8,0xd3e5ef]];
const kc=KEYS.map(k=>[k[0],new THREE.Color(k[1]),new THREE.Color(k[2])]);
export function skyAt(sy,top,hor){
  if(sy<=kc[0][0]){top.copy(kc[0][1]);hor.copy(kc[0][2]);return;}
  for(let i=1;i<kc.length;i++){if(sy<=kc[i][0]){const t=(sy-kc[i-1][0])/(kc[i][0]-kc[i-1][0]);
    top.copy(kc[i-1][1]).lerp(kc[i][1],t);hor.copy(kc[i-1][2]).lerp(kc[i][2],t);return;}}
  top.copy(kc[kc.length-1][1]);hor.copy(kc[kc.length-1][2]);
}
const c2=new THREE.Color();
export function greyify(col,amt,dark){const l=col.r*.3+col.g*.55+col.b*.15;c2.setRGB(l*.95,l*.98,l*1.05);col.lerp(c2,amt).multiplyScalar(1-dark);}
