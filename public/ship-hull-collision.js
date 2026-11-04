import * as T from './vendor/three.module.js';
const CELL=1.5,cache=new WeakMap(),unit=new T.Vector3(1,1,1),Y=new T.Vector3(0,1,0);
const point=new T.Vector3(),closest=new T.Vector3(),onRay=new T.Vector3(),onEdge=new T.Vector3(),normal=new T.Vector3(),direction=new T.Vector3();
const ray=new T.Ray(),pose=new T.Matrix4(),inverse=new T.Matrix4(),rotation=new T.Quaternion(),modelRotation=new T.Matrix4(),position=new T.Vector3();
function hull(model){
 let entry=cache.get(model);if(entry&&entry.first===model.children[0]&&entry.count===model.children.length)return entry;
 entry={first:model.children[0],count:model.children.length,cells:new Map(),bounds:new T.Box3()};model.updateWorldMatrix(true,true);const rootInverse=model.matrixWorld.clone().invert();
 model.traverse(mesh=>{if(!mesh.isMesh||mesh.material?.isShaderMaterial||mesh.material?.colorWrite===false||mesh.userData.neonPart)return;const a=mesh.geometry?.attributes.position;if(!a)return;const indices=mesh.geometry.index,matrix=new T.Matrix4().multiplyMatrices(rootInverse,mesh.matrixWorld),count=indices?indices.count:a.count;
 for(let i=0;i<count;i+=3){const triangle=new T.Triangle(...[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(a,indices?indices.getX(i+k):i+k).applyMatrix4(matrix))),bounds=new T.Box3().setFromPoints([triangle.a,triangle.b,triangle.c]);entry.bounds.union(bounds);
  for(let x=Math.floor(bounds.min.x/CELL);x<=Math.floor(bounds.max.x/CELL);x++)for(let y=Math.floor(bounds.min.y/CELL);y<=Math.floor(bounds.max.y/CELL);y++)for(let z=Math.floor(bounds.min.z/CELL);z<=Math.floor(bounds.max.z/CELL);z++){const key=x+','+y+','+z;if(!entry.cells.has(key))entry.cells.set(key,[]);entry.cells.get(key).push(triangle)}
 }});cache.set(model,entry);return entry;
}
function prepare(surface){const rig=surface.shipRig;if(!rig?.model||!surface.active)return null;const upright=['parked','countdown'].includes(surface.phase);rotation.copy(surface.flight.q);position.copy(surface.pos);if(upright&&rig.padOffset)position.add(point.copy(rig.padOffset).applyQuaternion(rotation));pose.compose(position,rotation,unit);modelRotation.makeRotationX(upright?Math.PI/2:0);pose.multiply(modelRotation);inverse.copy(pose).invert();return hull(rig.model)}
function triangles(entry,bounds){const out=new Set();if(!entry.bounds.intersectsBox(bounds))return out;for(let x=Math.floor(bounds.min.x/CELL);x<=Math.floor(bounds.max.x/CELL);x++)for(let y=Math.floor(bounds.min.y/CELL);y<=Math.floor(bounds.max.y/CELL);y++)for(let z=Math.floor(bounds.min.z/CELL);z<=Math.floor(bounds.max.z/CELL);z++)for(const triangle of entry.cells.get(x+','+y+','+z)||[])out.add(triangle);return out}
export function shipBlocksCrew(surface,x,z,feet,radius=.27){
 if(!surface.shipRig?.model)return !surface.collisions&&!!surface.active&&Math.hypot(x-surface.pos.x,z-surface.pos.z)<1.6&&feet<surface.pos.y+4.5&&feet+1.7>surface.pos.y-4.23;if(Math.hypot(x-surface.pos.x,z-surface.pos.z)>14)return false;const entry=prepare(surface);if(!entry)return false;
 const a=new T.Vector3(x,feet+radius,z).applyMatrix4(inverse),b=new T.Vector3(x,feet+1.7-radius,z).applyMatrix4(inverse),bounds=new T.Box3().setFromPoints([a,b]).expandByScalar(radius),length=a.distanceTo(b);direction.copy(b).sub(a).normalize();ray.set(a,direction);
 for(const triangle of triangles(entry,bounds)){
  if(triangle.closestPointToPoint(a,closest).distanceToSquared(a)<radius*radius||triangle.closestPointToPoint(b,closest).distanceToSquared(b)<radius*radius)return true;
  triangle.getNormal(normal);const denom=normal.dot(direction);if(Math.abs(denom)>1e-9){const t=normal.dot(point.copy(triangle.a).sub(a))/denom;if(t>=0&&t<=length&&triangle.containsPoint(point.copy(direction).multiplyScalar(t).add(a)))return true}
  for(const [u,v] of [[triangle.a,triangle.b],[triangle.b,triangle.c],[triangle.c,triangle.a]]){const distance=ray.distanceSqToSegment(u,v,onRay,onEdge);if(onRay.distanceToSquared(a)<=length*length+1e-8&&distance<radius*radius)return true}
 }return false;
}
export function shipVerticalHit(surface,x,z,from,to){
 if(!surface.shipRig?.model||Math.hypot(x-surface.pos.x,z-surface.pos.z)>14||from===to)return null;const entry=prepare(surface);if(!entry)return null;const a=new T.Vector3(x,from,z).applyMatrix4(inverse),b=new T.Vector3(x,to,z).applyMatrix4(inverse),length=a.distanceTo(b),bounds=new T.Box3().setFromPoints([a,b]).expandByScalar(.01);ray.set(a,direction.copy(b).sub(a).normalize());let result=null;
 for(const triangle of triangles(entry,bounds)){const hit=ray.intersectTriangle(triangle.a,triangle.b,triangle.c,false,point);if(!hit||hit.distanceTo(a)>length+.001)continue;triangle.getNormal(normal).transformDirection(pose);if(from>to&&normal.y<.2||from<to&&normal.y>-.2)continue;const y=hit.clone().applyMatrix4(pose).y;if(result===null||from>to&&y>result||from<to&&y<result)result=y}
 return result;
}

export function warmShipHull(model){if(model)hull(model)}
