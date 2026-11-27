import * as T from './vendor/three.module.js';
import {createTreeLog} from './wood-models.js';
import {createSaw} from './tool-models.js';
import {createBlockModel} from './block-models.js';
export class HeldItemView{
 constructor(scene){this.group=new T.Group();this.group.name='First person held item';scene.add(this.group);this.type=null;this.mesh=null}
 update(economy,crew,camera,time){const d=economy.definition(economy.held?.type),type=d?.kind==='block'||d?.kind==='saw'||['tree-log','snow-ball'].includes(d?.id)?d.id:null;if(type!==this.type){this.group.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});this.group.clear();this.type=type;this.mesh=type?createHeldMesh(d):null;if(this.mesh){this.group.add(this.mesh)}}this.group.visible=!!type&&crew.onFoot;if(!this.group.visible)return;const bob=crew.moving?Math.sin(time*9)*.012:Math.sin(time*2)*.003;const sawSwing=d.kind==='saw'&&economy.swing>0?Math.sin((1-economy.swing/.36)*Math.PI):0;this.group.position.set(.42-sawSwing*.12,-.34+bob,-.9-sawSwing*.25).applyQuaternion(camera.quaternion).add(camera.position);this.group.quaternion.copy(camera.quaternion).multiply(new T.Quaternion().setFromEuler(new T.Euler(.06,.3,-.1)));this.group.updateWorldMatrix(true,true)}
}

export function createHeldMesh(def){
 const mesh=def.id==='snow-ball'?new T.Mesh(new T.SphereGeometry(.7,12,8),new T.MeshStandardMaterial({color:def.color,roughness:1})):
  def.id==='tree-log'?createTreeLog():def.kind==='saw'?createSaw(def.color):createBlockModel(def);
 mesh.name='Held '+def.name;
 mesh.scale.setScalar(def.kind==='saw'?1.1:def.id==='torch'?.68:def.id==='ladder'?.4:def.id==='door'?.28:.34);
 return mesh;
}
