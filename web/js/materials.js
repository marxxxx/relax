// shared weather uniforms used by several materials
export const WU={uTime:{value:0},uWind:{value:.25},uSnow:{value:0},uWet:{value:0},uSunDir:{value:new THREE.Vector3(0,1,0)},uSunCol:{value:new THREE.Color(0,0,0)}};

export function weatherize(mat,key,extraVertex){
  mat.onBeforeCompile=(s)=>{
    Object.assign(s.uniforms,WU);
    s.vertexShader='uniform float uTime;\nuniform float uWind;\nvarying float vUp;\nvarying float vH;\n'+s.vertexShader
      .replace('#include <beginnormal_vertex>',`#include <beginnormal_vertex>
        vec3 wn=objectNormal;
        #ifdef USE_INSTANCING
          wn=mat3(instanceMatrix)*wn;
        #endif
        vUp=normalize(mat3(modelMatrix)*wn).y;
        vH=clamp(position.y,0.0,1.0);`)
      .replace('#include <begin_vertex>','#include <begin_vertex>\n'+(extraVertex||''));
    s.fragmentShader='uniform float uSnow;\nuniform float uWet;\nvarying float vUp;\nvarying float vH;\n'+s.fragmentShader
      .replace('#include <color_fragment>',`#include <color_fragment>
        ${key==='grass'?'diffuseColor.rgb*=mix(0.45,1.08,vH); float up=0.9;':'float up=vUp;'}
        ${key==='terrain'?`float rk=smoothstep(0.8,0.45,vUp);
          float band=0.5+0.5*sin(vWPos.y*2.1+sin(vWPos.x*0.23+vWPos.z*0.19)*2.2+sin(vWPos.z*0.9)*0.4);
          float big=0.5+0.5*sin(vWPos.x*0.37+vWPos.z*0.29+vWPos.y*0.53)*sin(vWPos.z*0.21-vWPos.y*0.31);
          float fine=0.5+0.5*sin(vWPos.y*7.0+sin(vWPos.x*1.7+vWPos.z*1.3)*1.5);
          diffuseColor.rgb*=mix(1.0,(0.5+0.3*band+0.08*fine)*(0.82+0.3*big),rk);`:''}
        diffuseColor.rgb=mix(diffuseColor.rgb,vec3(0.93,0.95,1.0),uSnow*smoothstep(0.45,0.8,up));
        diffuseColor.rgb*=1.0-uWet*0.28*(1.0-uSnow);`)
      .replace('#include <tonemapping_fragment>',(key==='grass'?`
        float tl=pow(max(dot(normalize(vWPos-cameraPosition),uSunDir),0.0),5.0);
        gl_FragColor.rgb+=diffuseColor.rgb*uSunCol*vec3(1.2,1.05,0.55)*tl*vH*vH*2.2*(1.0-uSnow*0.7);
        `:'')+'#include <tonemapping_fragment>');
    if(key==='terrain'){s.vertexShader='varying vec3 vWPos;\n'+s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWPos=(modelMatrix*vec4(transformed,1.0)).xyz;');s.fragmentShader='varying vec3 vWPos;\n'+s.fragmentShader;}
    if(key==='grass'){s.vertexShader='varying vec3 vWPos;\n'+s.vertexShader;s.fragmentShader='uniform vec3 uSunDir;\nuniform vec3 uSunCol;\nvarying vec3 vWPos;\n'+s.fragmentShader;}
  };
  mat.customProgramCacheKey=()=>'w-'+key;
  return mat;
}

export const std=(col,o={})=>new THREE.MeshStandardMaterial(Object.assign({color:col,roughness:.9,metalness:0},o));
