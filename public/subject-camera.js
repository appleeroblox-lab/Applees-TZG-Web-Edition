import * as T from './vendor/three.module.js';
export const ORBIT_MIN=6,ORBIT_MAX=120;
const origin=new T.Vector3(),worldUp=new T.Vector3(0,1,0),frame=new T.Quaternion(),local=new T.Quaternion(),angles=new T.Euler(0,0,0,'YXZ'),offset=new T.Vector3();
export function rotateSubjectOrbit(q,dx,dy,sensitivity=1,up=worldUp){
 frame.setFromUnitVectors(worldUp,up);local.copy(frame).invert().multiply(q);angles.setFromQuaternion(local,'YXZ');angles.x=T.MathUtils.clamp(angles.x-dy*.002*sensitivity,-1.45,1.45);angles.y-=dx*.002*sensitivity;angles.z=0;q.copy(frame).multiply(local.setFromEuler(angles)).normalize();return q;
}
export function shipCameraSubject(rig,out=new T.Vector3()){
 rig.model.updateWorldMatrix(true,false);return out.copy(rig.subjectCenter||origin).applyMatrix4(rig.model.matrixWorld);
}
export function placeSubjectOrbit(camera,q,subject,distance,{up=worldUp,groundAt=null}={}){
 offset.set(0,0,T.MathUtils.clamp(distance,ORBIT_MIN,ORBIT_MAX)).applyQuaternion(q);camera.position.copy(subject).add(offset);if(groundAt)camera.position.y=Math.max(camera.position.y,groundAt(camera.position.x,camera.position.z));camera.up.copy(up);camera.lookAt(subject);q.copy(camera.quaternion);return camera;
}
