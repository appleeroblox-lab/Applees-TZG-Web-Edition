import * as T from './vendor/three.module.js';
const V=()=>new T.Vector3(),UP=new T.Vector3(0,1,0);
export class OnFootCamera{
 constructor(){this.scratch={target:V(),forward:V(),right:V(),end:V(),look:V()};this.distance=6;this.currentDistance=6;this.enabled=false;this.locked=false;this.valid=false;this.shoulder=0;this.anchor=V();this.firstPerson=false;this.facing=new T.Quaternion();this.lastUp=UP.clone()}
 setEnabled(value){this.enabled=!!value;if(!this.enabled)this.locked=false}
 toggle(){if(this.enabled)this.locked=!this.locked;return this.locked}
 reset(){this.valid=false;this.locked=false;this.firstPerson=false}
 zoom(delta){if(!Number.isFinite(delta))return;this.distance=T.MathUtils.clamp(this.distance+delta*.012,0,16)}
 face(dt,view,motion,up=UP){this.facing.premultiply(new T.Quaternion().setFromUnitVectors(this.lastUp,up));this.lastUp.copy(up);const forward=new T.Vector3(0,0,-1).applyQuaternion(view).projectOnPlane(up);if(forward.lengthSq()<1e-8)return this.facing;const direction=this.locked?forward:motion.clone().projectOnPlane(up);if(direction.lengthSq()>1e-8){const matrix=new T.Matrix4().lookAt(V(),direction.normalize(),up),goal=new T.Quaternion().setFromRotationMatrix(matrix);this.facing.slerp(goal,1-Math.exp(-Math.max(0,dt)*14)).normalize()}return this.facing}
 apply(camera,{dt,feet,view,up=UP,clear=()=>1}){
  const s=this.scratch,rate=1-Math.exp(-Math.max(0,dt)*12),target=s.target.copy(feet).addScaledVector(up,1.5),forward=s.forward.set(0,0,-1).applyQuaternion(view),right=s.right.set(1,0,0).applyQuaternion(view);
  if(!this.valid){this.anchor.copy(target);this.currentDistance=this.distance;this.valid=true;this.facing.setFromRotationMatrix(new T.Matrix4().lookAt(V(),forward.clone().projectOnPlane(up).normalize(),up));this.lastUp.copy(up)}else{this.anchor.copy(target);this.currentDistance=T.MathUtils.lerp(this.currentDistance,this.distance,rate)}
  this.shoulder=T.MathUtils.lerp(this.shoulder,this.locked&&this.distance>.35?.6:0,rate);
  this.firstPerson=this.distance<=.35;
  if(this.firstPerson){this.anchor.copy(target);camera.position.copy(target);camera.quaternion.copy(view);return}
  const end=s.end.copy(this.anchor).addScaledVector(forward,-this.currentDistance).addScaledVector(right,this.shoulder);
  // Correct the whole sight corridor immediately; only outward recovery is smoothed.
  const fraction=T.MathUtils.clamp(clear(target,end),0,1);camera.position.copy(target).lerp(end,fraction);
  const look=s.look.copy(this.anchor).addScaledVector(right,this.shoulder);camera.up.copy(up);camera.lookAt(look);
  // A wall can temporarily force the camera into the character without changing zoom intent.
  this.firstPerson=camera.position.distanceTo(target)<.5;if(this.firstPerson)camera.quaternion.copy(view);
 }
}
export function corridorFraction(start,end,solid){const length=start.distanceTo(end);if(length<1e-6)return 1;const steps=Math.max(1,Math.ceil(length/.16)),p=V();for(let i=1;i<=steps;i++){p.copy(start).lerp(end,i/steps);if(solid(p))return Math.max(0,(i-1)/steps)}return 1}
