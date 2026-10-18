import {scene} from './renderer.js';
import {softDot} from './textures.js';

export function particles(n,size,opts){
  const g=new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(n*3),3));
  g.setAttribute('color',new THREE.BufferAttribute(new Float32Array(n*3),3));
  const m=new THREE.PointsMaterial(Object.assign({size,map:softDot,transparent:true,depthWrite:false,vertexColors:true,sizeAttenuation:true},opts));
  const p=new THREE.Points(g,m);p.frustumCulled=false;scene.add(p);return p;
}
