import * as T from './vendor/three.module.js';
// Cabin-local look. Never writes the ship orientation or flight input.
export class CockpitLook{
 constructor(){this.yaw=0;this.pitch=0;this.q=new T.Quaternion();this.euler=new T.Euler(0,0,0,'YXZ')}
 reset(){this.yaw=this.pitch=0}
 look(dx,dy,sensitivity=1){this.yaw=T.MathUtils.clamp(this.yaw-dx*.002*sensitivity,-Math.PI/2,Math.PI/2);this.pitch=T.MathUtils.clamp(this.pitch-dy*.002*sensitivity,-Math.PI*.42,Math.PI*.42)}
 apply(camera){this.euler.set(this.pitch,this.yaw,0,'YXZ');camera.quaternion.multiply(this.q.setFromEuler(this.euler))}
}
