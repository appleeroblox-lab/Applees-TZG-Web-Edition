import * as T from './vendor/three.module.js';
// Local -Z faces forward; leg pivots overlap the body throughout their animation.
export class CapsuleCharacter{
 constructor(){
  this.group=new T.Group();this.group.name='On-foot capsule character';
  this.torso=new T.Group();this.torso.name='Breathing torso';this.group.add(this.torso);
  const white=new T.MeshStandardMaterial({color:0xf7f4ff,roughness:.42}),black=new T.MeshStandardMaterial({color:0x171321,roughness:.6});
  this.body=new T.Mesh(new T.CapsuleGeometry(.34,.54,6,14),white);this.body.position.y=.87;this.torso.add(this.body);
  this.hands=[];this.feet=[];this.legs=[];this.eyes=[];
  for(const side of [-1,1]){
   const hand=new T.Mesh(new T.SphereGeometry(.115,10,8),white);hand.scale.set(.85,1.2,1);hand.position.set(side*.46,.76,0);this.hands.push(hand);this.torso.add(hand);
   const leg=new T.Group();leg.position.set(side*.17,.39,0);const foot=new T.Mesh(new T.CapsuleGeometry(.13,.16,4,10),white);foot.position.y=-.20;leg.add(foot);this.legs.push(leg);this.feet.push(foot);this.group.add(leg);
   const eye=new T.Mesh(new T.CapsuleGeometry(.039,.075,4,8),black);eye.position.set(side*.12,1.13,-.327);this.eyes.push(eye);this.torso.add(eye);
  }
  this.mouth=new T.Mesh(new T.CapsuleGeometry(.012,.10,3,8),black);this.mouth.rotation.z=Math.PI/2;this.mouth.position.set(0,.98,-.342);this.torso.add(this.mouth);
  this.rightGrip=new T.Object3D();this.rightGrip.name='Right palm grip';this.rightGrip.position.set(0,-.01,-.105);this.hands[1].add(this.rightGrip);
  const pixels=new Uint8Array(32*32*4);for(let y=0;y<32;y++)for(let x=0;x<32;x++){const r=Math.hypot((x-15.5)/15.5,(y-15.5)/15.5),i=(y*32+x)*4;pixels[i+3]=Math.round(Math.max(0,1-r)**2*160)}const map=new T.DataTexture(pixels,32,32,T.RGBAFormat);map.needsUpdate=true;this.shadow=new T.Mesh(new T.PlaneGeometry(1.15,.88),new T.MeshBasicMaterial({map,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1}));this.shadow.name='Character contact shadow';this.shadow.renderOrder=1;this.group.add(this.shadow);
  this.group.traverse(o=>{if(o.isMesh){o.castShadow=o!==this.shadow;o.receiveShadow=o!==this.shadow}});
 }
 update({feet,rotation,time,moving=false,running=false,vertical=0,grounded=true,holding=false,action=0,tool=null,groundPoint=null,up=new T.Vector3(0,1,0),visible=true}){
  this.group.visible=visible;if(!visible)return;this.group.position.copy(feet);this.group.quaternion.copy(rotation);
  const floor=groundPoint||feet,altitude=Math.max(0,feet.clone().sub(floor).dot(up));this.group.updateWorldMatrix(true,false);this.shadow.position.copy(this.group.worldToLocal(floor.clone().addScaledVector(up,.018)));const localUp=up.clone().applyQuaternion(rotation.clone().invert());this.shadow.quaternion.setFromUnitVectors(new T.Vector3(0,0,1),localUp);this.shadow.material.opacity=Math.max(0,.65-altitude*.12);this.shadow.scale.setScalar(1+Math.min(altitude,3)*.12);
  const dt=this.lastTime===undefined?1/60:Math.min(.1,Math.max(0,time-this.lastTime));this.lastTime=time;const blend=this.poseReady?1-Math.exp(-dt*16):1;this.poseReady=true;
  const cycle=time*(running?15:10),stride=moving&&grounded?Math.sin(cycle)*(running?.42:.30):0;
  if(this.wasGrounded===false&&grounded)this.landing=.045;this.wasGrounded=grounded;this.landing=(this.landing||0)*Math.exp(-dt*12);
  this.torso.position.y=Math.sin(time*2.5)*.012+(moving&&grounded?Math.abs(Math.sin(cycle))*.018:0)-(this.landing||0);
  this.legs.forEach((leg,i)=>{leg.scale.y=1;const x=grounded?stride*(i?1:-1):vertical>0?-.50+(i?.15:-.15):Math.sin(time*7+i*Math.PI)*.25+.22;leg.rotation.x=T.MathUtils.lerp(leg.rotation.x,x,blend);leg.rotation.z=T.MathUtils.lerp(leg.rotation.z,grounded?0:(i?1:-1)*.10,blend);});
  this.hands.forEach((h,i)=>{const previous=h.position.clone(),previousRotation=h.rotation.clone();h.position.z=holding&&i===1?-.12:-stride*.4*(i?1:-1);h.position.y=.76+(grounded?0:.09);h.rotation.set(0,0,0);if(holding&&i===1){h.position.y+=action*.08;h.position.z-=action*(tool==='saw'?.20:.10);h.rotation.x=-action*(tool==='saw'?.25:1.05)}if(!grounded&&vertical<=0){h.position.y=1.35+Math.sin(time*5+i)*.025;h.position.z=0;h.rotation.x=-.65;h.rotation.z=(i?1:-1)*-.35}h.position.lerpVectors(previous,h.position,blend);h.rotation.x=T.MathUtils.lerp(previousRotation.x,h.rotation.x,blend);h.rotation.z=T.MathUtils.lerp(previousRotation.z,h.rotation.z,blend)});
  const blink=time%4.7>4.56?.08:1;this.eyes.forEach(e=>e.scale.y=blink);
 }
 dispose(){const geometries=new Set(),materials=new Set();
  this.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)});geometries.forEach(g=>g.dispose());materials.forEach(m=>{m.map?.dispose();m.dispose()});this.group.removeFromParent()}
}
