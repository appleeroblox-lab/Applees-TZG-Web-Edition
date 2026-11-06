import * as T from './vendor/three.module.js';
// Local -Z faces forward; leg pivots overlap the body throughout their animation.
export class CapsuleCharacter{
 constructor(){
  this.group=new T.Group();this.group.name='On-foot capsule character';
  this.torso=new T.Group();this.torso.name='Breathing torso';this.group.add(this.torso);
  const white=new T.MeshStandardMaterial({color:0xf7f4ff,roughness:.42}),black=new T.MeshStandardMaterial({color:0x171321,roughness:.6});
  this.body=new T.Mesh(new T.CapsuleGeometry(.34,.60,6,14),white);this.body.position.y=.90;this.torso.add(this.body);
  this.hands=[];this.feet=[];this.legs=[];this.eyes=[];
  for(const side of [-1,1]){
   const hand=new T.Mesh(new T.SphereGeometry(.115,10,8),white);hand.scale.set(.85,1.2,1);hand.position.set(side*.46,.76,0);this.hands.push(hand);this.torso.add(hand);
   const leg=new T.Group();leg.position.set(side*.17,.32,0);const foot=new T.Mesh(new T.CapsuleGeometry(.13,.12,4,10),white);foot.position.y=-.15;leg.add(foot);this.legs.push(leg);this.feet.push(foot);this.group.add(leg);
   const eye=new T.Mesh(new T.CapsuleGeometry(.039,.075,4,8),black);eye.position.set(side*.12,1.16,-.327);this.eyes.push(eye);this.torso.add(eye);
  }
  this.mouth=new T.Mesh(new T.CapsuleGeometry(.012,.10,3,8),black);this.mouth.rotation.z=Math.PI/2;this.mouth.position.set(0,1.01,-.342);this.torso.add(this.mouth);
  this.rightGrip=new T.Object3D();this.rightGrip.name='Right palm grip';this.rightGrip.position.set(0,-.01,-.105);this.hands[1].add(this.rightGrip);
  this.group.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 }
 update({feet,rotation,time,moving=false,running=false,vertical=0,grounded=true,holding=false,action=0,tool=null,visible=true}){
  this.group.visible=visible;if(!visible)return;this.group.position.copy(feet);this.group.quaternion.copy(rotation);
  const cycle=time*(running?15:10),stride=moving&&grounded?Math.sin(cycle)*(running?.42:.30):0;
  this.torso.position.y=Math.sin(time*2.5)*.012+(moving&&grounded?Math.abs(Math.sin(cycle))*.018:0);
  this.legs.forEach((leg,i)=>{leg.rotation.x=stride*(i?1:-1);leg.scale.y=grounded?1:vertical>0?.8:1.05;});
  this.hands.forEach((h,i)=>{h.position.z=holding&&i===1?-.12:-stride*.4*(i?1:-1);h.position.y=.76+(grounded?0:.09);h.rotation.set(0,0,0);if(holding&&i===1){h.position.y+=action*.08;h.position.z-=action*(tool==='saw'?.20:.10);h.rotation.x=-action*(tool==='saw'?.25:1.05)}});
  const blink=time%4.7>4.56?.08:1;this.eyes.forEach(e=>e.scale.y=blink);
 }
 dispose(){const geometries=new Set(),materials=new Set();this.group.traverse(o=>{if(o.geometry)geometries.add(o.geometry);if(o.material)materials.add(o.material)});geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());this.group.removeFromParent()}
}
