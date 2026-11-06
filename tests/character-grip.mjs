import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {CapsuleCharacter} from '../public/capsule-character.js';
import {mountAtGrip,gripPose} from '../public/character-grip.js';
const avatar=new CapsuleCharacter(),scene=new T.Scene();scene.add(avatar.group);assert(avatar.mouth);avatar.body.geometry.computeBoundingBox();assert(avatar.body.geometry.boundingBox.getSize(new T.Vector3()).y<1.15,'shorter capsule body');
for(let frame=0;frame<120;frame++){
 avatar.update({feet:new T.Vector3(20,2,-30),rotation:new T.Quaternion().setFromEuler(new T.Euler(.4,frame/20,-.2)),time:frame/20,moving:true,running:true,grounded:frame%3===0,vertical:frame%2?3:-3,holding:true});
 avatar.group.updateWorldMatrix(true,true);
 // Test connection in character-local space, independent of planetary orientation.
 const body=new T.Box3().setFromObject(avatar.body);for(const leg of avatar.legs)assert(body.intersectsBox(new T.Box3().setFromObject(leg)),'leg always overlaps body');
 for(const kind of ['pickaxe','shovel','saw','torch','ladder','gray-concrete','resource']){
  const object=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(.2,.8,.2));object.add(mesh);scene.add(object);object.scale.setScalar(kind==='pickaxe'?.45:1);mesh.scale.setScalar(kind==='saw'?1.1:.68);
  const child=['pickaxe','shovel','resource'].includes(kind)?null:mesh,swing=(Math.sin(frame)+1)/2;
  mountAtGrip(object,avatar.rightGrip,kind,{swing,mesh:child});
  const point=gripPose(kind,swing).point;if(child){child.updateMatrix();point.applyMatrix4(child.matrix)}
  const actual=object.localToWorld(point),expected=avatar.rightGrip.getWorldPosition(new T.Vector3());assert(actual.distanceTo(expected)<1e-6,kind+' handle stays in palm throughout swing and rotation');
  scene.remove(object);mesh.geometry.dispose();
 }
}
const pickaxe=JSON.parse(fs.readFileSync('public/models/pickaxe.json','utf8')),handle=pickaxe.meshes.find(m=>m.name==='Wood shaft'),point=gripPose('pickaxe').point;for(let i=0;i<3;i++)assert(point.getComponent(i)>=Math.min(...handle.positions.filter((_,j)=>j%3===i))&&point.getComponent(i)<=Math.max(...handle.positions.filter((_,j)=>j%3===i)),'grip lies on authored shaft');avatar.dispose();console.log('PASS shorter capsule, mouth, attached animated legs and authored tool grips under arbitrary gravity/heading/swing');
