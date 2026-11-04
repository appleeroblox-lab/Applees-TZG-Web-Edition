import * as T from './vendor/three.module.js';
// Stable local lights. Emissive parts always use the normal scene depth buffer.
export function neonBrightness(scene){let value=0;for(const light of scene.children){if(!light.visible)continue;if(light.isAmbientLight)value+=light.intensity*.5;else if(light.isHemisphereLight)value+=light.intensity*.35;else if(light.isDirectionalLight)value+=light.intensity*.25}return T.MathUtils.clamp(.18+.82*T.MathUtils.clamp(value,0,1),.18,1)}
const visibleIn=(object,scene)=>{let root=object;for(let node=object;node;node=node.parent){if(!node.visible)return false;root=node}return root===scene};
export class NeonLights{
 constructor(scene){this.scene=scene;this.slots=Array.from({length:4},()=>({part:null}));this.lights=this.slots.map(slot=>{const light=slot.light=new T.PointLight(0xffffff,0,7,2);light.name='Small neon part light';light.castShadow=false;scene.add(light);return light});this.nextScan=0;this.candidates=[];this.materials=new Set();this.occluders=[];this.center=new T.Vector3();this.direction=new T.Vector3();this.ray=new T.Raycaster();this.hits=[];this.sphere=new T.Sphere();this.brightness=1;}
 scan(camera){
  this.candidates=[];this.materials.clear();this.occluders=[];this.scene.updateMatrixWorld();const held=new Set(this.slots.map(s=>s.part?.key));
  this.scene.traverseVisible(mesh=>{
   if(!mesh.isMesh||!mesh.geometry)return;
   const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
   if(materials.some(m=>m&&m.visible!==false&&m.depthWrite!==false&&m.colorWrite!==false&&(!m.transparent||m.opacity>=.9)&&!m.isShaderMaterial)){
    if(mesh.isInstancedMesh){if(!mesh.boundingSphere)mesh.computeBoundingSphere();this.sphere.copy(mesh.boundingSphere)}else{if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();this.sphere.copy(mesh.geometry.boundingSphere)}this.sphere.applyMatrix4(mesh.matrixWorld);
    if(this.sphere.center.distanceTo(camera.position)<this.sphere.radius+32)this.occluders.push(mesh);
   }
   if(!mesh.userData.neonPart)return;
   const material=materials.find(m=>m.emissive?.getHex());if(!material)return;
   material.userData.neonBaseIntensity??=material.emissiveIntensity;
   material.depthTest=true;if(!material.transparent)material.depthWrite=true;
   this.materials.add(material);
   if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();
   const points=mesh.userData.neonPoints?.length?mesh.userData.neonPoints:[mesh.geometry.boundingSphere.center];
   points.forEach((point,index)=>{mesh.localToWorld(this.center.copy(point));const distance=this.center.distanceToSquared(camera.position),key=mesh.uuid+':'+index;if(distance<900)this.candidates.push({mesh,material,point,key,distance,rank:distance*(held.has(key)?.65:1),blocked:false,nextRay:0})});
  });
  this.candidates.sort((a,b)=>a.rank-b.rank);this.candidates.length=Math.min(4,this.candidates.length);
 }
 blocked(part,camera){
  part.mesh.localToWorld(this.center.copy(part.point));this.direction.copy(this.center).sub(camera.position);const distance=this.direction.length();if(distance<.1)return false;
  this.ray.set(camera.position,this.direction.divideScalar(distance));this.ray.near=.04;this.ray.far=Math.max(.04,distance-.06);this.hits.length=0;this.ray.intersectObjects(this.occluders,false,this.hits);
  return this.hits.some(hit=>hit.object!==part.mesh&&visibleIn(hit.object,this.scene));
 }
 update(time,camera,enabled=true){
  const dt=this.lastTime===undefined?1/60:Math.min(.1,Math.max(0,time-this.lastTime));this.lastTime=time;
  if(!enabled){for(const slot of this.slots){slot.light.intensity=0;slot.part=null}return}
  if(time>=this.nextScan){this.nextScan=time+.5;this.scan(camera)}
  const blend=1-Math.exp(-dt*8);this.brightness=T.MathUtils.lerp(this.brightness,neonBrightness(this.scene),blend);
  for(const material of this.materials){const target=Math.min(2,material.userData.neonBaseIntensity)*this.brightness;material.emissiveIntensity=T.MathUtils.lerp(material.emissiveIntensity,target,blend)}
  const desired=new Map(this.candidates.map(part=>[part.key,part]));
  for(const slot of this.slots)if(slot.part){const next=desired.get(slot.part.key);if(next){slot.part.distance=next.distance;desired.delete(slot.part.key)}else if(slot.light.intensity<.015){slot.part=null;slot.light.intensity=0}}
  for(const slot of this.slots)if(!slot.part&&desired.size){const part=desired.values().next().value;slot.part=part;desired.delete(part.key)}
  let matricesUpdated=false;
  for(const slot of this.slots){const {part,light}=slot;if(!part){light.intensity=0;continue}const visible=visibleIn(part.mesh,this.scene);if(!visible){light.intensity=0;continue}part.mesh.localToWorld(light.position.copy(part.point));
   if(time>=part.nextRay){if(!matricesUpdated){for(const object of this.occluders)object.updateWorldMatrix(true,false);matricesUpdated=true}part.nextRay=time+.1;part.blocked=this.blocked(part,camera)}
   const selected=this.candidates.some(p=>p.key===part.key),distance=light.position.distanceTo(camera.position),fade=1-T.MathUtils.smoothstep(distance,20,30),target=selected&&!part.blocked?1.8*this.brightness*fade:0;
   light.intensity=part.blocked?0:T.MathUtils.lerp(light.intensity,target,blend);
   light.color.copy(part.material.color);if(part.material.map&&part.material.userData.fallbackColor)light.color.set(part.material.userData.fallbackColor);
  }
 }
}
