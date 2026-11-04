import * as T from './vendor/three.module.js';
// Pick the visible body at its current floating-origin position.
export function pickSpaceBody(ray,bodies,origin){let result=null,nearest=Infinity;const hit=new T.Vector3();for(const b of bodies){if(!b.mesh?.visible||!(b.r>0))continue;const sphere=new T.Sphere(b.pos.clone().sub(origin),b.r);if(ray.intersectSphere(sphere,hit)){const distance=ray.origin.distanceTo(hit);if(distance<nearest){nearest=distance;result=b}}}return result}
// A moon belongs to its local planet, rather than the whole stellar system.
const families=new WeakMap();
export function localMoonFamily(bodies,position,system){
 let index=families.get(bodies);if(!index||index.length!==bodies.length){const moons=new Map();for(const b of bodies)if(b.parent){const key=b.system+'|'+b.parent;if(!moons.has(key))moons.set(key,[]);moons.get(key).push(b)}index={length:bodies.length,parents:bodies.filter(b=>moons.has(b.system+'|'+b.name)).map(parent=>({parent,moons:moons.get(parent.system+'|'+parent.name)}))};families.set(bodies,index)}
 let closest=null,best=Infinity;for(const {parent,moons} of index.parents){if(parent.system!==system)continue;const reach=Math.max(parent.r*25,...moons.map(m=>m.pos.distanceTo(parent.pos)*1.6)),distance=position.distanceTo(parent.pos);if(distance<=reach&&distance<best){closest=parent.name;best=distance}}return closest;
}
export function bodyLabelAllowed(body,system,family){
 return meaningfulBodyLabel(body)&&body.system===system&&(!body.parent||body.parent===family);
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

// Named bodies stay useful; procedural identifiers and fictional survey markers do not need labels.
export function meaningfulBodyLabel(body){if(!body||body.procedural||body.generated||body.fictional&&body.belt==='oort')return false;return !/^(?:(?:Asteroid\s*Belt|Kuiper\s*Belt|Oort\s*Cloud)\s*[•·:#-]?\s*[a-z0-9]{4,}|Belt\s*asteroid(?:\s*[•·:#-]\s*\w+)?)$/i.test(String(body.name||'').trim())}

export function labelCategory(b){if(['ASTEROID','KUIPER BELT OBJECT','OORT CLOUD OBJECT'].includes(b.type))return 'asteroids';if(b.type==='BLACK HOLE')return 'blackholes';if(b.type==='STAR CLUSTER')return 'clusters';if(b.type==='GALAXY')return 'galaxies';if(b.type==='NEBULA')return 'nebulae';return {Sol:'solar',Proxima:'proxima','TRAPPIST-1':'trappist'}[b.system]||'other'}
export function labelFilterAllows(body,filters){return meaningfulBodyLabel(body)&&filters[labelCategory(body)]!==false}
