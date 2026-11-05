import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3(),UP=new T.Vector3(0,1,0);
export const SHIP_CAMERA_MODES=['chase','cockpit','orbit','flyby'];
export const SHIP_CAMERA_NAMES=['Chase','Cockpit','Orbit','Flyby – Cinematic'];
// Flyby anchors are absolute CPU coordinates. Switch offsets follow the subject,
// so floating-origin motion cannot drag a camera back to the previous ship position.
export class ShipCameraModes{
 constructor(){this.mode='chase';this.up=UP.clone();this.anchor=V();this.destination=V();this.previous=V();this.previousCenter=V();this.transitionOffset=V();this.previousQ=new T.Quaternion();this.transitionQ=new T.Quaternion();this.valid=false;this.blend=0;this.context=null;this.repositioning=false;this.shotValid=false;this.interval=5;this.zoomFov=60;this.shotCenter=V();this.shotOffset=V();this.previousOffset=V()}
 zoom(delta){this.zoomFov=T.MathUtils.clamp(this.zoomFov+delta*.025,25,85)}
 select(mode){if(!SHIP_CAMERA_MODES.includes(mode))return;this.mode=mode;this.blend=this.valid?1:0;this.transitionOffset.copy(this.previous);this.transitionQ.copy(this.previousQ);this.repositioning=false;this.shotValid=false}
 align(q,targetUp,dt){const target=targetUp||this.up,turn=new T.Quaternion().setFromUnitVectors(this.up,target),step=new T.Quaternion().slerp(turn,1-Math.exp(-dt*3));q.premultiply(step).normalize();this.up.applyQuaternion(step).normalize();return this.up}
 apply(camera,{dt,subject,origin,velocity,forward,context,clear,shipRadius=5}){
  if(this.context!==context||!this.valid){this.blend=0;this.context=context;this.repositioning=false;this.shotValid=false}
  if(this.mode==='flyby'){
   const center=subject.clone().add(origin),speed=velocity.length(),radius=Math.max(1,shipRadius),interval=T.MathUtils.clamp(Number(this.interval)||5,1,30),direction=speed>.01?velocity.clone().normalize():forward.clone().normalize(),side=V().crossVectors(direction,this.up);
   if(side.lengthSq()<.01)side.set(1,0,0);side.normalize();
   if(this.shotValid)this.shotTime=(this.shotTime||0)+Math.max(0,dt);
   if(!this.shotValid||this.shotTime+1e-8>=interval){
    // Saturate speed-based framing. A light-speed shot must still show the ship.
    const pace=1-Math.exp(-speed/350),framing=55+radius*5+pace*45;
    this.shotCenter.copy(center);this.shotOffset.copy(direction).multiplyScalar(framing*1.5).addScaledVector(side,framing*.65).addScaledVector(this.up,framing*.25);
    this.maxTravel=framing*1.8;this.travelScale=Math.min(1,this.maxTravel/Math.max(1,speed*interval));
    this.repositioning=this.shotValid;this.shotStart=this.previousOffset.clone();this.shotBlend=0;this.shotDuration=.35;
    this.shotValid=true;this.shotTime=0;this.shotId=(this.shotId||0)+1;
   }
   // Preserve stationary flybys at low speed; compress travel at relativistic
   // speed so the floating origin cannot leave the camera millions of units away.
   const travel=center.clone().sub(this.shotCenter).multiplyScalar(this.travelScale).clampLength(0,this.maxTravel),offset=this.shotOffset.clone().sub(travel);
   this.destination.copy(center).add(this.shotOffset);
   if(this.repositioning){this.shotBlend=Math.min(1,this.shotBlend+dt/this.shotDuration);const t=this.shotBlend*this.shotBlend*(3-2*this.shotBlend);offset.lerpVectors(this.shotStart,offset,t);if(this.shotBlend===1)this.repositioning=false}
   if(offset.length()<radius*3+8)offset.copy(side).multiplyScalar(radius*3+8).addScaledVector(this.up,4);
   camera.position.copy(subject).add(offset);clear?.(camera.position,subject);this.anchor.copy(camera.position).add(origin);this.previousOffset.copy(camera.position).sub(subject);camera.up.copy(this.up);camera.lookAt(subject);this.previousCenter.copy(center);
   if(camera.fov!==this.zoomFov){camera.fov=this.zoomFov;camera.updateProjectionMatrix()}

  }
  if(this.mode!=='flyby'&&this.blend>0&&this.valid){const goal=camera.position.clone().sub(subject);camera.position.copy(this.transitionOffset).lerp(goal,1-this.blend).add(subject);const goalQ=camera.quaternion.clone();camera.quaternion.copy(this.transitionQ).slerp(goalQ,1-this.blend);}
  this.blend=Math.max(0,this.blend-dt*2.5);
  clear?.(camera.position,subject);this.previous.copy(camera.position).sub(subject);this.previousQ.copy(camera.quaternion);this.valid=true;
 }
}
