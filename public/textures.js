import * as T from './vendor/three.module.js';
// Only a small working set of maps is uploaded. Hidden worlds keep cheap solid materials.
export class TextureCache {
 constructor(bodies,max=4){this.bodies=bodies;this.max=max;this.cache=new Map();this.pending=false;this.wanted=new Set();this.failed=new Set();this.enabled=true;this.anisotropy=2;this.loader=new T.TextureLoader()}
 update(position,system){
  const nearby=this.bodies.filter(b=>b.system===system&&b.texture&&b.type!=='STAR').sort((a,b)=>(position.distanceTo(a.pos)-a.r)-(position.distanceTo(b.pos)-b.r));
  this.wanted=new Set([...new Set(nearby.map(b=>b.texture))].slice(0,this.max));
  for(const [key,map] of this.cache)if(!this.wanted.has(key)){for(const b of this.bodies)if(b.mesh?.material.map===map){b.mesh.material.map=null;b.mesh.material.color.set(b.color);b.mesh.material.needsUpdate=true}map.dispose();this.cache.delete(key)}
  for(const b of nearby){const map=this.cache.get(b.texture);if(map&&b.mesh.material.map!==map){b.mesh.material.map=map;b.mesh.material.color.set(0xffffff);b.mesh.material.needsUpdate=true}}
  this.pump();
 }
 pump(){if(!this.enabled||this.pending)return;const key=[...this.wanted].find(k=>!this.cache.has(k)&&!this.failed.has(k));if(!key)return;this.pending=true;this.loader.load('./textures/'+key,map=>{this.pending=false;if(!this.wanted.has(key)){map.dispose();return this.pump()}map.colorSpace=T.SRGBColorSpace;map.anisotropy=this.anisotropy;this.cache.set(key,map);for(const b of this.bodies)if(b.type!=='STAR'&&b.texture===key&&b.mesh?.visible){b.mesh.material.map=map;b.mesh.material.color.set(0xffffff);b.mesh.material.needsUpdate=true}this.pump()},undefined,()=>{this.pending=false;this.failed.add(key);this.pump()})}
}
