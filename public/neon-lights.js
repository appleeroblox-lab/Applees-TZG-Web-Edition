import * as T from './vendor/three.module.js';
// Reuse a fixed light budget; emitting parts retain their own glow at any distance.
export class NeonLights{
 constructor(scene){this.scene=scene;this.lights=Array.from({length:4},()=>{const light=new T.PointLight(0xffffff,0,9,2);light.name='Small neon part light';light.castShadow=false;scene.add(light);return light});this.nextScan=0;this.candidates=[];this.center=new T.Vector3()}
 update(time,camera,enabled=true){
  if(!enabled){for(const light of this.lights)light.intensity=0;return}
  if(time>=this.nextScan){this.nextScan=time+.5;this.candidates=[];this.scene.updateMatrixWorld();this.scene.traverseVisible(mesh=>{if(!mesh.isMesh||!mesh.userData.neonPart)return;const material=Array.isArray(mesh.material)?mesh.material.find(m=>m.emissive?.getHex()):mesh.material;if(!material?.emissive?.getHex()||material.emissiveIntensity<=0)return;if(!mesh.geometry.boundingSphere)mesh.geometry.computeBoundingSphere();for(const point of mesh.userData.neonPoints?.length?mesh.userData.neonPoints:[mesh.geometry.boundingSphere.center]){mesh.localToWorld(this.center.copy(point));const distance=this.center.distanceToSquared(camera.position);if(distance<625)this.candidates.push({mesh,material,point,distance})}});this.candidates.sort((a,b)=>a.distance-b.distance);this.candidates.length=Math.min(4,this.candidates.length)}
  this.lights.forEach((light,index)=>{const part=this.candidates[index];if(!part||!part.mesh.parent){light.intensity=0;return}part.mesh.localToWorld(this.center.copy(part.point));let visible=true,root=part.mesh;for(let node=part.mesh;node;node=node.parent){root=node;if(!node.visible)visible=false}visible=visible&&root===this.scene;light.intensity=visible&&this.center.distanceToSquared(camera.position)<625?4:0;light.color.copy(part.material.color);if(part.material.map&&part.material.userData.fallbackColor)light.color.set(part.material.userData.fallbackColor);part.mesh.localToWorld(light.position.copy(part.point));});
 }
}
