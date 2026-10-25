// A moon belongs to its local planet, rather than the whole stellar system.
export function localMoonFamily(bodies,position,system){
 let closest=null,best=Infinity;
 for(const parent of bodies){
  if(parent.system!==system||parent.type==='MOON')continue;
  const moons=bodies.filter(b=>b.system===system&&b.parent===parent.name);
  if(!moons.length)continue;
  const reach=Math.max(parent.r*25,...moons.map(m=>m.pos.distanceTo(parent.pos)*1.6));
  const distance=position.distanceTo(parent.pos);
  if(distance<=reach&&distance<best){closest=parent.name;best=distance}
 }
 return closest;
}
export function bodyLabelAllowed(body,system,family){
 return body.system===system&&(body.type!=='MOON'||body.parent===family);
}
export function labelProjection(relative,camera,width,height){
 // Update camera matrices before calling this, in the same frame as rendering.
 const view=relative.clone().applyMatrix4(camera.matrixWorldInverse);
 if(view.z>=0)return null;
 const p=relative.clone().project(camera);
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||Math.abs(p.x)>.96||Math.abs(p.y)>.92)return null;
 return {x:(p.x*.5+.5)*width,y:(-p.y*.5+.5)*height};
}

export function labelOccluded(origin,target,occluders){const delta=target.pos.clone().sub(origin),distance=delta.length();if(distance<=target.r)return false;const dir=delta.multiplyScalar(1/distance),end=distance-target.r;for(const body of occluders){if(body===target||body.id===target.id||!(body.r>0))continue;const rel=body.pos.clone().sub(origin),along=rel.dot(dir),perp2=Math.max(0,rel.lengthSq()-along*along),radius2=body.r*body.r;if(perp2>=radius2)continue;const hit=along-Math.sqrt(radius2-perp2);if(hit>.0001&&hit<end-.0001)return true}return false}
