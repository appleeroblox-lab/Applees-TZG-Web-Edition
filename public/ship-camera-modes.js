import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3(),UP=new T.Vector3(0,1,0);
export const SHIP_CAMERA_MODES=['chase','cockpit','orbit','planet-orbit','space-orbit','flyby'];
export const SHIP_CAMERA_NAMES=['Chase','Cockpit','Orbit','Orbit – Planet Aligned','Orbit – Space Aligned','Flyby – Cinematic'];
// Anchors are absolute CPU coordinates, independent of the renderer's floating origin.
export class ShipCameraModes{
 constructor(){this.mode='chase';this.up=UP.clone();this.anchor=V();this.destination=V();this.previous=V();this.previousQ=new T.Quaternion();this.valid=false;this.blend=0;this.context=null;this.repositioning=false}
 select(mode){if(!SHIP_CAMERA_MODES.includes(mode))return;this.mode=mode;this.blend=this.valid?1:0;this.context=null;this.repositioning=false}
 align(q,targetUp,dt){const target=targetUp||this.up,turn=new T.Quaternion().setFromUnitVectors(this.up,target),step=new T.Quaternion().slerp(turn,1-Math.exp(-dt*3));q.premultiply(step).normalize();this.up.applyQuaternion(step).normalize();return this.up}
 apply(camera,{dt,subject,origin,velocity,forward,context,clear}){
  if(this.context!==context){if(this.context!==null)this.blend=0;this.context=context;this.repositioning=false;if(this.mode==='flyby')this.anchor.copy(camera.position).add(origin)}
  if(this.mode==='flyby'){
   const center=subject.clone().add(origin),speed=velocity.length(),distance=T.MathUtils.clamp(24+speed*.65,24,180),direction=speed>.01?velocity.clone().normalize():forward.clone().normalize();
   if(!this.repositioning&&(this.anchor.distanceTo(center)>distance*1.7||this.anchor.distanceTo(center)<6)){
    const side=V().crossVectors(direction,this.up);if(side.lengthSq()<.01)side.set(1,0,0);side.normalize();
    this.destination.copy(center).addScaledVector(direction,distance*.85).addScaledVector(side,distance*.65).addScaledVector(this.up,distance*.25);this.repositioning=true;
   }
   if(this.repositioning){this.anchor.lerp(this.destination,1-Math.exp(-dt*4));if(this.anchor.distanceTo(this.destination)<.2)this.repositioning=false}
   camera.position.copy(this.anchor).sub(origin);clear?.(camera.position,subject);this.anchor.copy(camera.position).add(origin);camera.up.copy(this.up);camera.lookAt(subject);
  }
  if(this.blend>0&&this.valid){const goal=camera.position.clone().add(origin);camera.position.copy(this.previous).lerp(goal,1-this.blend).sub(origin);const goalQ=camera.quaternion.clone();camera.quaternion.copy(this.previousQ).slerp(goalQ,1-this.blend);}
  this.blend=Math.max(0,this.blend-dt*2.5);
  clear?.(camera.position,subject);this.previous.copy(camera.position).add(origin);this.previousQ.copy(camera.quaternion);this.valid=true;
 }
}
