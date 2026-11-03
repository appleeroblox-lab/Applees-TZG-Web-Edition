import * as T from '../vendor/three.module.js';
import {cubeDirection,cubeCoordinates,cellAt,sampleCell,PLANET_RADIUS as RADIUS} from './coordinates.js?v=157';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),clamp=T.MathUtils.clamp;
const palette=Object.fromEntries(Object.entries({forest:'#376d45',desert:'#bca270',rock:'#827968',ice:'#d9e6e8',shore:'#827958'}).map(([name,color])=>[name,new T.Color(color)]));
const key=(f,l,x,y)=>[f,l,x,y].join('/');
function findLeaf(plan,direction){
 const {face,u,v}=cubeCoordinates(direction);let l=0,x=0,y=0;
 while(plan.split.has(key(face,l,x,y))){l++;const scale=2**l;x=Math.min(scale-1,Math.floor((u+1)*.5*scale));y=Math.min(scale-1,Math.floor((v+1)*.5*scale))}
 return plan.leaves.get(key(face,l,x,y));
}
function node(face,l,x,y){return {key:key(face,l,x,y),f:face,l,x,y,center:cubeDirection(face,-1+(x+.5)*2/2**l,-1+(y+.5)*2/2**l).multiplyScalar(RADIUS)}}
function edges(n){const s=2/2**n.l,u=-1+n.x*s,v=-1+n.y*s,e=s*1e-5;return [[u-e,v+s*.5],[u+s+e,v+s*.5],[u+s*.5,v-e],[u+s*.5,v+s+e]]}
// One terrain draw, one optional diagnostic draw. Leaf data is CPU-only and bounded.
export class SphereChunks{
 constructor(terrain,{mobile=false}={}){
  this.terrain=terrain;this.mobile=mobile;this.resolution=mobile?12:16;this.maxLevel=mobile?6:7;this.limit=mobile?384:640;
  this.group=new T.Group();this.material=new T.MeshLambertMaterial({vertexColors:true});this.lineMaterial=new T.LineBasicMaterial({color:0xffdf68,depthTest:true});
  this.nodes=new Map();this.debug=false;this.time=0;this.blend=1;this.rebuilds=0;this.lastPlan=-1;this.lastPosition=V(Infinity,0,0);
  const roots={split:new Set(),leaves:new Map()};for(let f=0;f<6;f++){const n=node(f,0,0,0);roots.leaves.set(n.key,n)}
  for(const n of roots.leaves.values())this.buildTile(n,roots);this.commit(roots,true);
 }
 plan(position,maxLevel=this.maxLevel){
  const plan={split:new Set(),leaves:new Map()};
  const visit=n=>{const width=RADIUS*2/2**n.l;
   if(n.l<Math.min(2,maxLevel)||(n.l<maxLevel&&n.center.distanceTo(position)<width*(this.mobile?1.3:1.5))){plan.split.add(n.key);for(let y=0;y<2;y++)for(let x=0;x<2;x++)visit(node(n.f,n.l+1,n.x*2+x,n.y*2+y))}
   else plan.leaves.set(n.key,n);
  };for(let f=0;f<6;f++)visit(node(f,0,0,0));
  // Neighboring patches differ by at most one level, including across cube faces.
  for(let pass=0;pass<maxLevel;pass++){let changed=false;
   for(const n of [...plan.leaves.values()])for(const [u,v]of edges(n)){const other=findLeaf(plan,cubeDirection(n.f,u,v));if(other&&n.l-other.l>1){plan.leaves.delete(other.key);plan.split.add(other.key);for(let y=0;y<2;y++)for(let x=0;x<2;x++){const c=node(other.f,other.l+1,other.x*2+x,other.y*2+y);plan.leaves.set(c.key,c)}changed=true}}
   if(!changed)break;
  }return plan;
 }
 buildTile(n,plan){
  const r=this.resolution,count=(r+1)**2,positions=new Float32Array(count*3),normals=new Float32Array(count*3),color=new Float32Array(count*3),size=2/2**n.l,u0=-1+n.x*size,v0=-1+n.y*size;
  for(let j=0;j<=r;j++)for(let i=0;i<=r;i++){
   const u=u0+i/r*size,v=v0+j/r*size,dir=cubeDirection(n.f,u,v);let radius=this.terrain.radius(dir);
   // Weld T-junctions to the neighbor's actual coarse triangle, not a vertical skirt.
   if(i===0||i===r||j===0||j===r){let coarse=n.l;const e=size*1e-5;
    for(const du of [-e,e])for(const dv of [-e,e]){const neighbor=findLeaf(plan,cubeDirection(n.f,u+du,v+dv));if(neighbor)coarse=Math.min(coarse,neighbor.l)}
    if(coarse<n.l)radius=this.terrain.sample(dir,coarse,r).radius;
   }
   const p=dir.clone().multiplyScalar(radius),normal=this.terrain.normal(dir),height=this.terrain.height(dir),c=new T.Color('#699647');c.lerp(palette.forest,T.MathUtils.smoothstep(height,20,90));c.lerp(palette.desert,T.MathUtils.smoothstep(Math.sin(dir.x*7+this.terrain.seed),.1,.7)*(1-T.MathUtils.smoothstep(Math.abs(dir.y),.65,.85)));c.lerp(palette.rock,T.MathUtils.smoothstep(height,70,150));c.lerp(palette.ice,T.MathUtils.smoothstep(Math.abs(dir.y),.73,.91));c.lerp(palette.shore,1-T.MathUtils.smoothstep(height,-8,8));
   c.multiplyScalar(.96+.04*Math.sin(dir.x*123+dir.z*99));const o=(j*(r+1)+i)*3;p.toArray(positions,o);normal.toArray(normals,o);c.toArray(color,o);
  }
  n.positions=positions;n.normals=normals;n.colors=color;return n;
 }
 commit(plan,initial=false){
  const leaves=[...plan.leaves.values()],r=this.resolution,verts=(r+1)**2,total=leaves.length*verts;
  const start=new Float32Array(total*3),target=new Float32Array(total*3),normal=new Float32Array(total*3),color=new Float32Array(total*3),indices=new Uint32Array(leaves.length*r*r*6),lines=[];
  const targetSample=direction=>{
   const tile=findLeaf(plan,direction),cell=cellAt(direction,tile.l,r);
   return sampleCell(direction,cell,(i,j)=>V().fromArray(tile.positions,((j-tile.y*r)*(r+1)+i-tile.x*r)*3));
  };
  const sourceCache=new Map();
  const sourceVertex=(face,level,i,j)=>{
   const id=[face,level,i,j].join('/');if(sourceCache.has(id))return sourceCache.get(id);
   const grid=2**level*r,u=-1+i/grid*2,v=-1+j/grid*2,dir=cubeDirection(face,u,v);let coarse=level;
   if(i%r===0||j%r===0)for(const du of [-1e-7,1e-7])for(const dv of [-1e-7,1e-7]){const neighbor=findLeaf(plan,cubeDirection(face,u+du,v+dv));if(neighbor)coarse=Math.min(coarse,neighbor.l)}
   let point;if(coarse<level){const cell=cellAt(dir,coarse,r),coords=cell.a+cell.b<=1?[[cell.i,cell.j],[cell.i,cell.j+1],[cell.i+1,cell.j]]:[[cell.i+1,cell.j],[cell.i,cell.j+1],[cell.i+1,cell.j+1]];
    const target=coords.map(([a,b])=>targetSample(cubeDirection(cell.face,-1+a/cell.grid*2,-1+b/cell.grid*2)).point),weights=new T.Triangle(...target).getBarycoord(targetSample(dir).point,V());
    point=V();for(let k=0;k<3;k++)point.addScaledVector(sourceVertex(cell.face,coarse,...coords[k]),[weights.x,weights.y,weights.z][k]);
   }
   else point=dir.multiplyScalar(this.sample(dir).radius);
   sourceCache.set(id,point);return point;
  };
  let at=0,ix=0;
  for(const n of leaves){n.offset=at;n.source=new Float32Array(n.positions.length);target.set(n.positions,at*3);normal.set(n.normals,at*3);color.set(n.colors,at*3);
   const old=this.active?.leaves.get(n.key);if(!initial&&old&&this.blend===1)n.source.set(old.positions);else n.source.set(n.positions);
   if(!initial)for(let j=0;j<=r;j++)for(let i=0;i<=r;i++)if(!old||this.blend!==1||i===0||i===r||j===0||j===r)sourceVertex(n.f,n.l,n.x*r+i,n.y*r+j).toArray(n.source,(j*(r+1)+i)*3);
   start.set(n.source,at*3);
   for(let j=0;j<r;j++)for(let i=0;i<r;i++){const a=at+j*(r+1)+i,b=a+1,c=a+r+1,d=c+1;indices[ix++]=a;indices[ix++]=b;indices[ix++]=c;indices[ix++]=b;indices[ix++]=d;indices[ix++]=c}
   for(let j=0;j<r;j++)for(const [a,b]of [[j,j+1],[j*(r+1)+r,(j+1)*(r+1)+r],[r*(r+1)+j,r*(r+1)+j+1],[j*(r+1),(j+1)*(r+1)]]){lines.push(at+a,at+b)}
   at+=verts;
  }
  const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(start,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));geometry.setAttribute('color',new T.BufferAttribute(color,3));geometry.setIndex(new T.BufferAttribute(indices,1));geometry.morphAttributes.position=[new T.BufferAttribute(target,3)];geometry.computeBoundingSphere();
  const mesh=new T.Mesh(geometry,this.material);mesh.name='Sphere Test / continuous welded terrain';mesh.frustumCulled=true;mesh.morphTargetInfluences[0]=initial?1:0;
  const debugGeo=new T.BufferGeometry();debugGeo.setAttribute('position',new T.BufferAttribute(start.slice(),3));debugGeo.setIndex(lines);
  const debugMesh=new T.LineSegments(debugGeo,this.lineMaterial);debugMesh.visible=this.debug;debugMesh.frustumCulled=false;
  // LineSegments do not support morph targets; diagnostic vertices update only while visible.
  this.mesh?.geometry.dispose();this.mesh?.removeFromParent();this.lines?.geometry.dispose();this.lines?.removeFromParent();this.mesh=mesh;this.lines=debugMesh;this.group.add(mesh,debugMesh);
  this.active=plan;this.nodes=new Map(plan.leaves);this.visible=leaves.length;this.level=Math.max(...leaves.map(n=>n.l));this.blend=initial?1:0;this.progress=this.blend;this.rebuilds++;
 }
 sample(direction){
  if(!this.active)return this.terrain.sample(direction);
  const n=findLeaf(this.active,direction);if(!n)return this.terrain.sample(direction);
  const c=cellAt(direction,n.l,this.resolution),r=this.resolution,x0=n.x*r,y0=n.y*r,t=this.blend;
  const vertex=(i,j)=>{const o=((j-y0)*(r+1)+i-x0)*3;return V().fromArray(n.source,o).lerp(V().fromArray(n.positions,o),t)};
  if(t>0&&t<1){
   // Welded morph vertices can move along an edge; intersect the actual triangles,
   // including the neighboring grid cell, rather than assuming a fixed UV diagonal.
   const ray=new T.Ray(V(),direction.clone().normalize());
   for(const [dx,dy]of [[0,0],[-1,0],[1,0],[0,-1],[0,1],[-1,-1],[1,-1],[-1,1],[1,1]]){const i=c.i+dx,j=c.j+dy;if(i<x0||j<y0||i>=x0+r||j>=y0+r)continue;const a=vertex(i,j),b=vertex(i+1,j),d=vertex(i,j+1),e=vertex(i+1,j+1);
    for(const vertices of [[a,b,d],[b,e,d]]){const point=ray.intersectTriangle(...vertices,false,V());if(point){const normal=new T.Triangle(...vertices).getNormal(V());if(normal.dot(direction)<0)normal.negate();return {point,radius:point.length(),normal,level:n.l}}}
   }
  }
  const out=sampleCell(direction,c,vertex);out.level=n.l;return out;
 }
 update(position,dt=.016){
  this.time+=dt;this.progress=Math.min(1,this.progress+dt/.5);this.blend=this.progress*this.progress*(3-2*this.progress);this.mesh.morphTargetInfluences[0]=this.blend;
  this.lines.visible=this.debug;
  if(this.debug){const a=this.lines.geometry.attributes.position,s=this.mesh.geometry.attributes.position,t=this.mesh.geometry.morphAttributes.position[0];for(let i=0;i<a.array.length;i++)a.array[i]=(s.array[i]+(t.array[i]-s.array[i])*this.blend)*1.0005;a.needsUpdate=true}
  const settled=this.progress>=1;
  if(!this.pending&&settled&&(this.time-this.lastPlan>.2)&&(this.lastPosition.distanceTo(position)>10||this.lastPlan<0)){
   let max=this.maxLevel,plan=this.plan(position,max);while(plan.leaves.size>this.limit*.8&&max>1)plan=this.plan(position,--max);
   this.lastPlan=this.time;this.lastPosition.copy(position);
   if([...plan.leaves.keys()].join('|')!==[...this.active.leaves.keys()].join('|'))this.pending={plan,queue:[...plan.leaves.values()]};
  }
  if(this.pending){for(let i=0;i<(this.mobile?2:4)&&this.pending.queue.length;i++)this.buildTile(this.pending.queue.shift(),this.pending.plan);
   if(!this.pending.queue.length){const plan=this.pending.plan;this.pending=null;this.commit(plan)}
  }

 }
 regenerate(seed){this.terrain.seed=seed;this.terrain.clearCache();const position=this.lastPosition.toArray().every(Number.isFinite)?this.lastPosition:V(0,2024,0);let max=this.maxLevel,plan=this.plan(position,max);while(plan.leaves.size>this.limit*.8&&max>1)plan=this.plan(position,--max);this.pending={plan,queue:[...plan.leaves.values()]}}

 dispose(){this.pending=null;this.mesh.geometry.dispose();this.lines.geometry.dispose();this.material.dispose();this.lineMaterial.dispose();this.group.clear();this.nodes.clear();this.active=null}
}
// Standalone same-LOD geometry retained for seam/collision verification.
export function tileGeometry(terrain,face,level,x,y,resolution=12){
 const plan={split:new Set(),leaves:new Map()},n=node(face,level,x,y);plan.leaves.set(n.key,n);
 const fake={terrain,resolution};SphereChunks.prototype.buildTile.call(fake,n,plan);
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(n.positions,3));geometry.setAttribute('normal',new T.BufferAttribute(n.normals,3));geometry.setAttribute('color',new T.BufferAttribute(n.colors,3));const indices=[];
 for(let j=0;j<resolution;j++)for(let i=0;i<resolution;i++){const a=j*(resolution+1)+i,b=a+1,c=a+resolution+1,d=c+1;const pa=V().fromArray(n.positions,a*3),pb=V().fromArray(n.positions,b*3),pc=V().fromArray(n.positions,c*3);indices.push(...(pb.sub(pa).cross(pc.sub(pa)).dot(pa)>0?[a,b,c,b,d,c]:[a,c,b,b,c,d]))}geometry.setIndex(indices);geometry.computeBoundingSphere();return geometry;
}
