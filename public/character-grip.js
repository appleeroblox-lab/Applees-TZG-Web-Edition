import * as T from './vendor/three.module.js';
// Authored handle points, before the held object's own scale is applied.
export function gripPose(kind,swing=0){
 const point=new T.Vector3(0,0,.5),rotation=new T.Euler();
 if(kind==='resource'){point.set(0,0,.12)}
 else if(kind==='tree-log'){point.set(0,0,.3)}
 else if(kind==='snow-ball'){point.set(0,0,.6)}
 else if(kind==='pickaxe'){point.set(0,-.22,0);rotation.set(0,Math.PI/2,-.10)}
 else if(kind==='shovel'){point.set(0,.24,0);rotation.set(-.12,0,.08)}
 else if(kind==='saw'){point.set(-.28,-.01,.0175);rotation.set(0,Math.PI/2,0)}
 else if(kind==='torch'){point.set(0,-.18,0)}
 else if(kind==='ladder'){point.set(.35,0,0)}
 return {point,rotation:new T.Quaternion().setFromEuler(rotation)};
}
export function mountAtGrip(object,socket,kind,{swing=0,mesh=null}={}){
 if(!object?.visible)return;const pose=gripPose(kind,swing),grip=pose.point;
 if(mesh){mesh.updateMatrix();grip.applyMatrix4(mesh.matrix)}
 // Match grip positions exactly, even with scaled hands or transformed parents.
 socket.updateWorldMatrix(true,false);const target=socket.getWorldPosition(new T.Vector3()),bodyQ=socket.getWorldQuaternion(new T.Quaternion()),q=bodyQ.multiply(pose.rotation);
 object.quaternion.copy(q);if(object.parent){const parentQ=object.parent.getWorldQuaternion(new T.Quaternion());object.quaternion.premultiply(parentQ.invert())}
 const offset=grip.multiply(object.scale).applyQuaternion(q);target.sub(offset);object.position.copy(object.parent?object.parent.worldToLocal(target):target);object.updateWorldMatrix(true,true);
}
