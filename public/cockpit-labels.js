import * as T from './vendor/three.module.js';
// Raycast the label's screen footprint, including back faces seen from the cabin.
// Proxies share geometry but never change the rendered materials or their sides.
export class CockpitLabelMask{
 constructor(){this.proxies=new WeakMap();this.meshes=[];this.material=new T.MeshBasicMaterial({side:T.DoubleSide});this.ray=new T.Raycaster();this.ray.near=.025;this.ray.far=30;this.screen=new T.Vector2()}
 update(root){this.meshes=[];if(!root||root.visible===false||root.parent?.visible===false)return;root.updateWorldMatrix(true,true);root.traverseVisible(mesh=>{
  if(!mesh.isMesh||!mesh.geometry)return;
  const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material];
  if(materials.every(m=>!m||m.visible===false||(m.transparent&&m.opacity<.65)||(m.transmission||0)>.1))return;
  let proxy=this.proxies.get(mesh);if(!proxy){proxy=new T.Mesh(mesh.geometry,this.material);proxy.matrixAutoUpdate=false;this.proxies.set(mesh,proxy)}
  proxy.matrixWorld.copy(mesh.matrixWorld);this.meshes.push(proxy);
 })}
 blocked(point,camera,width,height,labelWidth=100,labelHeight=32){
  if(!this.meshes.length)return false;
  for(const [dx,dy]of [[0,0],[-.45,-.4],[.45,-.4],[-.45,.4],[.45,.4]]){
   this.screen.set((point.x+dx*labelWidth)/width*2-1,1-(point.y+dy*labelHeight)/height*2);
   this.ray.setFromCamera(this.screen,camera);
   if(this.ray.intersectObjects(this.meshes,false).length)return true;
  }
  return false;
 }
}
