import * as T from '../vendor/three.module.js';
import {rotateShip} from '../ship-rotation.js';
import {ShipBoost} from '../boost.js';
import {PLANET_RADIUS,cubeDirection,tangentFrame,cellAt,sampleCell} from './coordinates.js?v=157';
export {cubeDirection,tangentFrame};
export const SYSTEM='Experimental System',RADIUS=PLANET_RADIUS,ATMOSPHERE=1000;
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),UP=V(0,1,0),clamp=T.MathUtils.clamp;
export class SphereTerrain{
 constructor(seed=1){this.seed=seed;this.cache=new Map()}
 clearCache(){this.cache.clear()}
 height(direction){
  const n=direction.clone().normalize(),s=this.seed*.317;let h=0,amp=1,total=0;
  for(let i=0;i<5;i++){const f=2**i*2.6;h+=amp*(Math.sin(n.x*f+s)*Math.cos(n.y*f*.83-s)+Math.sin(n.z*f*.91+s*.7)*.6);total+=amp;amp*=.48}
  h=(h/total)*100-8;h+=Math.pow(Math.max(0,Math.sin(n.x*6.7+n.z*4.1+s)*Math.cos(n.y*5.3-s)),3)*100;
  return T.MathUtils.lerp(24,h,1-T.MathUtils.smoothstep(n.y,.94,.995));
 }
 radius(direction){return RADIUS+this.height(direction)}
 point(direction,offset=0){return direction.clone().normalize().multiplyScalar(this.radius(direction)+offset)}
 normal(direction){
  const n=direction.clone().normalize(),a=Math.abs(n.y)>.95?V(1,0,0):UP.clone(),t=a.cross(n).normalize(),b=n.clone().cross(t).normalize(),p=this.point(n);
  const normal=this.point(n.clone().addScaledVector(t,.0001)).sub(p).cross(this.point(n.clone().addScaledVector(b,.0001)).sub(p)).normalize();return normal.dot(n)<0?normal.negate():normal;
 }
 sample(direction,level=7,resolution=12){
  const cell=cellAt(direction,level,resolution),vertex=(i,j)=>{
   const key=[this.seed,cell.face,cell.grid,i,j].join('/');let p=this.cache.get(key);
   if(!p){p=this.point(cubeDirection(cell.face,-1+i/cell.grid*2,-1+j/cell.grid*2));this.cache.set(key,p);if(this.cache.size>8192)this.cache.delete(this.cache.keys().next().value)}return p;
  };
  return sampleCell(direction,cell,vertex);
 }
 biome(direction){const h=this.height(direction),n=direction.clone().normalize();return h<0?'Ocean':Math.abs(n.y)>.82?'Polar':h>95?'Mountains':Math.sin(n.x*7+this.seed)>.35?'Desert':h<30?'Plains':'Forest'}
 coordinates(position){const r=position.length(),n=position.clone().normalize();return {latitude:Math.asin(clamp(n.y,-1,1))*180/Math.PI,longitude:Math.atan2(n.z,n.x)*180/Math.PI,altitude:r-this.sample(n).radius,seaAltitude:r-RADIUS,biome:this.biome(n)}}
}
export class SpherePhysics{
 constructor(terrain,{surface}={}){
  this.terrain=terrain;this.surfaceAt=surface||((n)=>terrain.sample(n));this.position=V();this.velocity=V();this.q=new T.Quaternion();this.normal=UP.clone();this.contact=4.23;
  this.boost=new ShipBoost();this.walker={position:V(),velocity:V(),q:new T.Quaternion(),pitch:0};this.jumpHeld=false;this.place('surface');
 }
 get subject(){return this.onFoot?this.walker.position:this.position}
 get subjectVelocity(){return this.onFoot?this.walker.velocity:this.velocity}
 ground(position=this.subject){return this.surfaceAt(position.clone().normalize())}
 get altitude(){return Math.max(0,this.subject.length()-Math.max(RADIUS,this.ground().radius))}
 gravity(position=this.subject){const r=Math.max(RADIUS*.8,position.length());return position.clone().normalize().multiplyScalar(-9.81*RADIUS*RADIUS/(r*r))}
 suitable(direction){const ground=this.ground(direction);return ground.radius>=RADIUS+.05&&ground.normal.dot(direction.clone().normalize())>.85}
 floor(position,clearance=this.contact,useHull=clearance===this.contact){const n=position.clone().normalize(),s=this.ground(n),water=s.radius<RADIUS,normal=water?n:s.normal;let support=clearance;if(useHull&&this.hull){const local=normal.clone().applyQuaternion(this.q.clone().invert());support=.12;for(const axis of ['x','y','z'])support-=local[axis]*(local[axis]>=0?this.hull.min[axis]:this.hull.max[axis])}return {radius:Math.max(RADIUS,s.radius)+support/Math.max(.65,normal.dot(n)),normal,water}}
 place(kind){
  this.onFoot=false;this.landing=false;this.launchGoal=null;this.throttle=0;this.velocity.set(0,0,0);this.boost.selected=this.boost.active=false;
  const n=UP.clone(),floor=this.terrain.sample(n).radius;this.position.copy(n).multiplyScalar(floor+(kind==='surface'?this.contact:kind==='orbit'?2000:9000));this.landed=kind==='surface';this.gear=this.landed;this.assist=kind!=='orbit';
  if(kind==='orbit')this.velocity.set(Math.sqrt(9.81*RADIUS*RADIUS/this.position.length()),0,0);
  this.q.copy(tangentFrame(n,kind==='orbit'?this.velocity:V(0,0,-1)));this.normal.copy(n);return this;
 }
 land(){if(this.onFoot||this.landed||this.altitude>800||!this.suitable(this.position))return false;this.landing=true;this.launchGoal=null;this.gear=true;return true}
 launch(){
  if(this.onFoot||!this.landed)return false;const up=this.position.clone().normalize(),forward=V(0,0,-1).applyQuaternion(this.q);
  this.landed=false;this.landing=false;this.velocity.copy(up).multiplyScalar(20);this.position.addScaledVector(up,.1);
  this.launchGoal=tangentFrame(up,forward).multiply(new T.Quaternion().setFromAxisAngle(V(1,0,0),1.22));this.launchTime=0;return true;
 }
 toggleWalk(){
  if(this.onFoot){if(this.walker.position.distanceTo(this.position)>12)return false;this.onFoot=false;return true}
  if(!this.landed)return false;const side=V(1,0,0).applyQuaternion(this.q),pos=this.position.clone().addScaledVector(side,8),up=pos.normalize(),floor=this.floor(up,1.7);
  this.walker.position.copy(up).multiplyScalar(floor.radius);this.walker.velocity.set(0,0,0);this.walker.q.copy(tangentFrame(up,V(0,0,-1).applyQuaternion(this.q)));this.walker.pitch=0;this.onFoot=true;this.jumpHeld=false;return true;
 }
 look(dx,dy){if(this.onFoot){const up=this.walker.position.clone().normalize();this.walker.q.premultiply(new T.Quaternion().setFromAxisAngle(up,-dx)).normalize();this.walker.pitch=clamp(this.walker.pitch-dy,-1.45,1.45)}else{this.launchGoal=null;this.q.multiply(new T.Quaternion().setFromEuler(new T.Euler(-dy,-dx,0,'YXZ'))).normalize()}}
 step(dt,input={}){let remaining=Math.max(0,Math.min(.1,dt));while(remaining>1e-7){const h=Math.min(remaining,1/120);this.onFoot?this.walk(h,input):this.fly(h,input);remaining-=h}}
 walk(dt,input){
  // Keep the parked ship anchored when LOD/regeneration changes beneath it,
  // even while the walker owns the simulation subject.
  if(this.landed){const up=this.position.clone().normalize(),floor=this.floor(up);this.position.copy(up).multiplyScalar(floor.radius);this.q.slerp(tangentFrame(floor.normal,V(0,0,-1).applyQuaternion(this.q)),1-Math.exp(-dt*8)).normalize()}
  const w=this.walker,old=w.position.clone().normalize(),floor=this.floor(old,1.7),forward=V(0,0,-1).applyQuaternion(w.q),right=V(1,0,0).applyQuaternion(w.q);
  const desired=forward.multiplyScalar(input.walkZ||0).addScaledVector(right,input.walkX||0);if(desired.length()>1)desired.normalize();desired.multiplyScalar(floor.water?3:input.run?10:5);
  const radial=w.velocity.dot(old);w.velocity.addScaledVector(old,-radial).lerp(desired,1-Math.exp(-dt*15)).addScaledVector(old,radial);
  if(input.jump&&!this.jumpHeld&&w.position.length()<=floor.radius+.04)w.velocity.addScaledVector(old,5.8);this.jumpHeld=!!input.jump;
  w.velocity.addScaledVector(this.gravity(w.position),dt);w.position.addScaledVector(w.velocity,dt);
  const up=w.position.clone().normalize(),next=this.floor(up,1.7);if(w.position.length()<next.radius){w.position.copy(up).multiplyScalar(next.radius);const down=w.velocity.dot(up);if(down<0)w.velocity.addScaledVector(up,-down)}
  w.q.premultiply(new T.Quaternion().setFromUnitVectors(old,up)).normalize();
 }
 fly(dt,input){
  const up=this.position.clone().normalize(),manualTurn=Math.abs(input.pitch||0)+Math.abs(input.yaw||0)+Math.abs(input.roll||0)>.01;
  if(this.landed){const floor=this.floor(up);this.position.copy(up).multiplyScalar(floor.radius);this.q.slerp(tangentFrame(floor.normal,V(0,0,-1).applyQuaternion(this.q)),1-Math.exp(-dt*10)).normalize();this.velocity.set(0,0,0);if(input.y>0||input.z>0)this.launch();else return}
  if(this.launchGoal&&!manualTurn){this.launchTime+=dt;this.q.slerp(this.launchGoal,1-Math.exp(-dt*5));if(this.launchTime>1.3)this.launchGoal=null}else{this.launchGoal=null;rotateShip(this.q,input,dt,input.rotationSpeed||1)}
  // SAS/assist never erases gravity or an orbital trajectory in vacuum.
  this.velocity.addScaledVector(this.gravity(this.position),dt);
  const thrust=clamp((input.z||0)+this.throttle,-1,1),boost=this.boost.step(dt,thrust>0,this.altitude>=ATMOSPHERE),forward=V(0,0,-1).applyQuaternion(this.q),right=V(1,0,0).applyQuaternion(this.q);
  this.velocity.addScaledVector(forward,thrust*(boost?100:35)*dt).addScaledVector(right,(input.x||0)*25*dt).addScaledVector(up,(input.y||0)*70*dt);
  if(this.altitude<ATMOSPHERE){const density=1-T.MathUtils.smoothstep(this.altitude,0,ATMOSPHERE);this.velocity.multiplyScalar(Math.exp(-dt*density*(this.assist?.015:.003)))}
  if(input.brake){this.throttle=0;this.velocity.multiplyScalar(Math.exp(-dt*7))}
  if(this.landing){const radial=this.velocity.dot(up),target=-Math.min(35,Math.max(.8,(this.altitude-this.contact)*.65));const tangent=this.velocity.clone().addScaledVector(up,-radial);this.velocity.addScaledVector(tangent,-(1-Math.exp(-dt*4))).addScaledVector(up,(target-radial)*(1-Math.exp(-dt*4)));const floor=this.floor(up);this.q.slerp(tangentFrame(floor.normal,V(0,0,-1).applyQuaternion(this.q)),1-Math.exp(-dt*4)).normalize()}
  const cap=T.MathUtils.lerp(450,boost?4000:2000,T.MathUtils.smoothstep(this.altitude,800,1200));if(this.velocity.length()>cap)this.velocity.multiplyScalar(T.MathUtils.lerp(1,cap/this.velocity.length(),1-Math.exp(-dt*3)));
  // At 120 Hz even boosted motion travels <34 m, far smaller than the planet.
  this.position.addScaledVector(this.velocity,dt);const n=this.position.clone().normalize(),floor=this.floor(n);
  if(this.position.length()<floor.radius){this.position.copy(n).multiplyScalar(floor.radius);const inward=this.velocity.dot(floor.normal);if(inward<0)this.velocity.addScaledVector(floor.normal,-inward);if(!floor.water&&this.gear&&this.suitable(n)&&(this.landing||this.velocity.length()<12)){this.landed=true;this.landing=false;this.velocity.set(0,0,0);this.throttle=0}}
  this.normal.copy(n);
 }
}
