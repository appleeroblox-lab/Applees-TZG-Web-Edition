import {hasAtmosphere} from './atmospheric-flight.js?v=168';
import {DistantTerrain} from './distant-terrain.js?v=170';
import {addTerrainDetail,terrainMaterial,setTerrainDetailEnabled} from './terrain-detail.js?v=122';
import {earthBiome} from './earth-biomes.js?v=122';
import {onSurfaceRoad} from './surface-roads.js?v=170';
import {settlementContains} from './settlements.js?v=170';
import {biomeColor,biomeWeather} from './earth-biomes.js?v=122';
import {sceneryPoints} from './tree-data.js?v=170';
import {graphicsPolicy} from './graphics-policy.js?v=182';
import {PAD_RADIUS,PAD_SIGN} from './surface-layout.js';
import * as T from './vendor/three.module.js';
import {surfaceHeight} from './surface.js?v=170';
import {terrainColor} from './surface-palette.js';
export const CHUNK_SIZE=96;
export function chunkKey(x,z){return Math.floor((x+48)/96)+','+Math.floor((z+48)/96)}
export function terrainFog(radius=2){const far=radius*CHUNK_SIZE*.82;return {near:far*.3,far}}
export const TERRAIN_ANIMATIONS={loading:true,fade:true,unloading:false,trees:true};
const animationSeconds=.22, exitSeconds=.12, safetyMargin=10;
const distanceToChunk=(pos,x,z,height)=>Math.hypot(Math.max(0,Math.abs(pos.x-x*96)-48),Math.max(0,Math.abs(pos.z-z*96)-48),height);
export function sceneryBudget(quality='Medium',mobile=false,compatibility=false){const p=graphicsPolicy(quality),cap=mobile||compatibility||quality==='Ultra+';return {count:cap?p.mobileScenery:p.scenery,distance:cap?Math.min(p.sceneryDistance,quality==='Low'||quality==='Medium'?100:Math.min(150,85+p.mobileScenery*5)):p.sceneryDistance}}
// Reuse primitive templates; each nearby chunk becomes one colored scenery mesh.
const templates={trunk:new T.CylinderGeometry(.2,.3,4,5).toNonIndexed(),broad:new T.DodecahedronGeometry(2.3,0),leaves:new T.ConeGeometry(2,6,5).toNonIndexed(),rock:new T.DodecahedronGeometry(1,0),pole:new T.CylinderGeometry(.08,.08,3,5).toNonIndexed(),panel:new T.BoxGeometry(5,.12,3).toNonIndexed()};
function ditherFade(material){
 const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
 material.alphaHash=true;
 material.onBeforeCompile=shader=>{
  compile(shader);
  shader.fragmentShader=shader.fragmentShader.replace('#include <alphahash_fragment>',`if(diffuseColor.a < 0.999) {
   #include <alphahash_fragment>
  }`);
 };
 material.customProgramCacheKey=()=>key+'-dither-fade';
 return material;
}
function disposeChunk(g){g.traverse(o=>{o.geometry?.dispose();o.material?.dispose()})}
export class SurfaceStream{
 constructor(view){this.view=view;this.distant=new DistantTerrain(view.scene);view.session.stream=this;this.group=new T.Group();view.scene.add(this.group);this.chunks=new Map();this.collisionRevision=0;this.body=null;this.last='';this.policy='';this.visibilityAt=null;this.radius=null;this.treeRevision='';this.decorations=true;this.grassCount=96;this.grassAmount=30;this.animations={...TERRAIN_ANIMATIONS};this.frustum=new T.Frustum();this.projection=new T.Matrix4();this.frustumBounds=new T.Box3();this.collisionChunks=new Map();this.frame=0;try{const options=JSON.parse(localStorage.getItem('zero-gravity-terrain-animations'));for(const option of Object.keys(this.animations))if(typeof options?.[option]==='boolean')this.animations[option]=options[option];const saved=Number(localStorage.getItem('zero-gravity-terrain-radius'));if(saved>=1&&saved<=4)this.radius=Math.round(saved)}catch{}}
 setAnimation(option,value){
  if(!(option in TERRAIN_ANIMATIONS))return;
  this.animations[option]=!!value;
  try{localStorage.setItem('zero-gravity-terrain-animations',JSON.stringify(this.animations))}catch{}
 }
 setDecorations(value){this.collisionRevision++;this.decorations=!!value;setTerrainDetailEnabled(this.decorations);if(this.viewStreaming){this.viewSceneryPolicy=null;return}for(const group of this.chunks.values()){const mesh=group.userData.scenery;if(mesh){disposeChunk(mesh);group.remove(mesh);group.userData.scenery=null}}this.visibilityAt=null;this.treeCache=null;this.viewSceneryPolicy=null;}
 setGrassAmount(value){this.collisionRevision++;const amount=Number(value);this.grassAmount=Math.max(0,Math.min(100,Number.isFinite(amount)?amount:30));if(this.viewStreaming){this.viewSceneryPolicy=null;return}for(const group of this.chunks.values()){const mesh=group.userData.scenery;if(mesh){disposeChunk(mesh);group.remove(mesh);group.userData.scenery=null}}this.visibilityAt=null;this.treeCache=null;this.viewSceneryPolicy=null;}
 setRadius(value){this.radius=T.MathUtils.clamp(Math.round(Number(value)||2),1,4);this.last='';this.visibilityAt=null;try{localStorage.setItem('zero-gravity-terrain-radius',String(this.radius))}catch{}}
 clear(){this.view.cloudField?.clear();this.distant.clear();this.collisionRevision++;for(const g of this.chunks.values()){disposeChunk(g);this.group.remove(g)}this.chunks.clear();this.collisionChunks.clear();this.treeCache=null;this.discoveryCell=null;this.viewCollisionKey=null;this.viewSceneryPolicy=null;this.last='';this.visibilityAt=null}
 update(pos,quality='Medium',{mobile=false,compatibility=false,incremental=false,deferOuter=false,camera=null,dt=0}={}){if(camera)return this.updateVisible(pos,quality,{mobile,compatibility,deferOuter,camera,dt});if(this.viewStreaming){this.clear();this.viewStreaming=false;if(this.view.baseGround)this.view.baseGround.visible=true}const body=this.view.session.body,budget=sceneryBudget(quality,mobile,compatibility),policy=quality+':'+mobile+':'+compatibility+':'+this.decorations+':'+this.grassAmount;if(body!==this.body||policy!==this.policy){this.clear();this.body=body;this.policy=policy;this.last=''}if(!body?.solid){this.distant.clear();return}this.distant.update(body,pos);this.grassCount=Math.round((mobile||compatibility?graphicsPolicy(quality).mobileGrass*.55:graphicsPolicy(quality).grass)*this.grassAmount/100);const [cx,cz]=chunkKey(pos.x,pos.z).split(',').map(Number),radius=airlessTerrainRadius(body,this.radius??graphicsPolicy(quality).terrainRadius,Math.max(0,pos.y-surfaceHeight(pos.x,pos.z)),this.radius===null&&(mobile||compatibility)?3:4),key=body.id+cx+','+cz+radius;this.view.session.terrainFog=terrainFog(radius);this.view.session.terrainRadius=radius;this.view.session.prospecting?.economy.discoverVillages(body,pos,mobile?1:radius);if(key!==this.last){
  this.last=key;
  const needed=new Map();
  for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++)needed.set(x+','+z,[x,z]);
  for(const [id,g] of this.chunks)if(!needed.has(id)){disposeChunk(g);this.group.remove(g);this.chunks.delete(id)}
  this.pendingChunks=[...needed].filter(([id])=>!this.chunks.has(id))
   .sort(([,a],[,b])=>Math.max(Math.abs(a[0]-cx),Math.abs(a[1]-cz))-Math.max(Math.abs(b[0]-cx),Math.abs(b[1]-cz)));
  this.visibilityAt=null;
 }
 let outerBudget=deferOuter?0:incremental?2:Infinity;
 while(this.pendingChunks?.length){
  const [id,[x,z]]=this.pendingChunks[0];
  const nearby=Math.abs(x-cx)<=1&&Math.abs(z-cz)<=1;
  if(!nearby&&outerBudget--<=0)break;
  this.pendingChunks.shift();
  const g=this.make(body,x,z);
  this.chunks.set(id,g);this.group.add(g);this.visibilityAt=null;
 }
 this.view.cloudField?.sync(this.chunks,pos,this.view.cloudTime||0,graphicsPolicy(quality).clouds);
 const economy=this.view.session.prospecting?.economy,revision=(economy?.cycle||0)+':'+(economy?.treeRevision||0);if(revision!==this.treeRevision){this.collisionRevision++;this.treeRevision=revision;for(const g of this.chunks.values()){const mesh=g.userData.scenery;if(mesh){disposeChunk(mesh);g.remove(mesh);g.userData.scenery=null}}this.visibilityAt=null}
 // Avoid touching scene visibility every frame while standing still.
 this.updateTreeSnow();if(this.visibilityAt&&this.visibilityAt.distanceToSquared(pos)<16)return;this.visibilityAt=pos.clone();const heightAboveTerrain=pos.y-surfaceHeight(pos.x,pos.z);for(const g of this.chunks.values()){const {cx,cz}=g.userData,dx=Math.max(0,Math.abs(pos.x-cx*96)-48),dz=Math.max(0,Math.abs(pos.z-cz*96)-48),visible=Math.hypot(dx,dz,heightAboveTerrain)<budget.distance;if(visible&&!g.userData.scenery){const mesh=this.decorate(body,cx,cz,budget.count);g.userData.scenery=mesh;g.add(mesh);this.collisionRevision++}if(g.userData.scenery){if(g.userData.scenery.visible!==visible)this.collisionRevision++;g.userData.scenery.visible=visible}}}
 updateVisible(pos,quality,{mobile,compatibility,deferOuter,camera,dt}){
  const body=this.view.session.body;
  const viewPolicy=quality+':'+mobile+':'+compatibility;
  if(body!==this.body||viewPolicy!==this.policy||!this.viewStreaming){
   this.clear();this.body=body;this.policy=viewPolicy;this.viewStreaming=true;
  }
  if(!body?.solid)return;
  if(this.view.baseGround)this.view.baseGround.visible=false;
  this.distant.update(body,pos);
  const groundHeight=surfaceHeight(pos.x,pos.z),height=Math.max(0,pos.y-groundHeight);
  const graphics=graphicsPolicy(quality), budget=sceneryBudget(quality,mobile,compatibility);
  const radius=airlessTerrainRadius(body,this.radius??graphics.terrainRadius,height,this.radius===null&&(mobile||compatibility)?3:4);
  this.view.session.terrainFog=terrainFog(radius);this.view.session.terrainRadius=radius;
  const economy=this.view.session.prospecting?.economy;
  const [cx,cz]=chunkKey(pos.x,pos.z).split(',').map(Number);
  const sceneryPolicy=[this.decorations,this.grassAmount,economy?.cycle,economy?.treeRevision].join(':');
  if(this.viewSceneryPolicy!==sceneryPolicy){
   this.viewSceneryPolicy=sceneryPolicy;
   for(const chunk of this.chunks.values())this.releaseViewScenery(chunk);
  }
  this.grassCount=Math.round((mobile||compatibility?graphics.mobileGrass*.55:graphics.grass)*this.grassAmount/100);
  this.syncViewCollision(body,cx,cz,budget.count,sceneryPolicy);
  const cell=body.id+':'+cx+','+cz+':'+radius;
  if(this.discoveryCell!==cell){
   this.discoveryCell=cell;this.cloudOwners=new Map();
   for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++)this.cloudOwners.set(x+','+z,true);
   economy?.discoverVillages(body,pos,mobile?1:radius);
  }
  camera.updateMatrixWorld();
  this.projection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
  this.frustum.setFromProjectionMatrix(this.projection);
  const elapsed=Math.max(0,Math.min(dt,.08));
  const pending=[],active=new Map();
  this.frame++;
  for(let z=cz-radius;z<=cz+radius;z++)for(let x=cx-radius;x<=cx+radius;x++){
   if(!this.inView(x,z,safetyMargin))continue;
   const id=x+','+z;
   const chunk=this.chunks.get(id);
   if(chunk)active.set(id,chunk);
   else pending.push({id,x,z,distance:distanceToChunk(pos,x,z,height),visible:this.inView(x,z,0)});
  }
  pending.sort((a,b)=>Number(b.visible)-Number(a.visible)||a.distance-b.distance);
  for(const {id,x,z} of pending.slice(0,deferOuter?0:mobile||compatibility?2:4)){
   const chunk=this.make(body,x,z);
   this.chunks.set(id,chunk);this.group.add(chunk);active.set(id,chunk);
  }
  let sceneryUploads=mobile||compatibility?1:3;
  for(const [id,chunk] of active){
   const data=chunk.userData;
   const visible=this.inView(data.cx,data.cz,0);
   if(!visible){chunk.visible=false;data.inView=false;data.lastUsed=this.frame;continue}
   if(!data.inView){data.appear=0;data.disappear=0;data.inView=true;data.treeStates?.clear()}
   chunk.visible=true;data.lastUsed=this.frame;
   data.appear=Math.min(1,data.appear+elapsed/animationSeconds);
   this.paintChunk(chunk,this.animations.fade?data.appear:1,this.animations.loading?(1-data.appear)**2*.65:0);
   const distance=distanceToChunk(pos,data.cx,data.cz,height);
   const wantNear=distance<106;
   const wantTrees=distance<Math.max(115,budget.distance)&&height<160;
   const wantProps=distance<Math.min(85,budget.distance);
   if(wantTrees&&(!wantNear||this.animations.trees)&&!data.billboards&&sceneryUploads>0){
    data.billboards=this.billboards(body,data.cx,data.cz,budget.count);
    chunk.add(data.billboards);sceneryUploads--;
   }
   if(wantTrees&&wantNear&&!data.nearTrees&&sceneryUploads>0){
    data.nearTrees=this.decorate(body,data.cx,data.cz,budget.count,{kind:'trees'});
    chunk.add(data.nearTrees);sceneryUploads--;
   }
   if(wantProps&&!data.props&&sceneryUploads>0){
    data.props=this.decorate(body,data.cx,data.cz,budget.count,{kind:'props'});
    chunk.add(data.props);sceneryUploads--;
   }
   this.updateTreeLOD(data,pos,wantTrees,elapsed);
   this.updateProps(data.props,pos,wantProps,this.animations.fade?data.appear:1);
   data.scenery=data.nearTrees;
  }
  const inactive=[];
  for(const [id,chunk] of this.chunks){
   if(active.has(id))continue;
   const data=chunk.userData;
   if(data.inView&&this.animations.unloading&&this.inView(data.cx,data.cz,0)){
    data.disappear=(data.disappear||0)+elapsed;
    if(data.disappear<exitSeconds){
     this.paintChunk(chunk,1-data.disappear/exitSeconds,0);
     continue;
    }
   }
   chunk.visible=false;data.inView=false;inactive.push([id,chunk]);
  }
  inactive.sort((a,b)=>(a[1].userData.lastUsed||0)-(b[1].userData.lastUsed||0));
  for(const [id,chunk] of inactive.slice(0,Math.max(0,inactive.length-(mobile?12:20)))){
   disposeChunk(chunk);chunk.removeFromParent();this.chunks.delete(id);
  }
  this.view.cloudField?.sync(this.cloudOwners,pos,this.view.cloudTime||0,graphics.clouds);
  this.updateTreeSnow();
 }
 inView(x,z,margin){
  this.frustumBounds.min.set(x*96-48-margin,-12-margin,z*96-48-margin);
  this.frustumBounds.max.set(x*96+48+margin,64+margin,z*96+48+margin);
  return this.frustum.intersectsBox(this.frustumBounds);
 }
 updateTreeLOD(data,pos,enabled,dt){
  if(!data.nearTrees&&!data.billboards)return;
  const states=data.treeStates??=new Map();
  // Both representations share per-tree state. Count down only when approaching.
  const values=data.treeValues??=new Map();
  values.clear();
  const nearIds=data.nearTrees?.userData.treeIds;
  const farIds=data.billboards?.userData.treeIds;
  const trees=data.billboards?.userData.segments||data.nearTrees.userData.segments;
  if(enabled)for(const {tree} of trees){
   if(!this.sceneryInView(tree.x,tree.y+4,tree.z,6))continue;
   const distance=Math.hypot(tree.x-pos.x,tree.y-pos.y,tree.z-pos.z);
   if(distance>240)continue;
   const current=states.get(tree.id)||{near:false,blend:0};
   current.near=nearIds?.has(tree.id)&&distance<(current.near?104:82);
   if(!current.near)current.blend=0;
   else if(!this.animations.trees||!farIds?.has(tree.id))current.blend=1;
   else current.blend=Math.min(1,current.blend+dt/animationSeconds);
   states.set(tree.id,current);values.set(tree.id,current.blend);
  }
  const alpha=this.animations.fade?data.appear:1;
  this.drawTreeSegments(data.nearTrees,values,true,alpha);
  this.drawTreeSegments(data.billboards,values,false,alpha);
 }
 sceneryInView(x,y,z,radius){
  for(const plane of this.frustum.planes){
   const n=plane.normal;
   if(n.x*x+n.y*y+n.z*z+plane.constant < -radius)return false;
  }
  return true;
 }
 updateProps(mesh,pos,enabled,alpha){
  if(!mesh||!enabled){this.paintMesh(mesh,0);return}
  this.drawScenerySegments(mesh,({tree})=>{
   const {x,y,z,size}=tree;
   const distance=Math.hypot(x-pos.x,y-pos.y,z-pos.z);
   return distance<(tree.grass?38:82)&&this.sceneryInView(x,y+size,z,Math.max(1,size*2))?1:0;
  },alpha);
 }
 drawTreeSegments(mesh,values,near,alpha){
  this.drawScenerySegments(mesh,({tree})=>{
   const value=values.get(tree.id);
   return value===undefined?0:near?value:1-value;
  },alpha);
 }
 drawScenerySegments(mesh,opacityFor,alpha){
  if(!mesh)return;
  const {geometry}=mesh,{segments}=mesh.userData,index=geometry.index,blend=geometry.attributes.lodBlend;
  let write=0,indexChanged=false,blendChanged=false;
  for(const segment of segments){
   const opacity=opacityFor(segment);
   if(opacity<=0)continue;
   for(let vertex=segment.start;vertex<segment.end;vertex++){
    if(index.array[write]!==vertex){index.array[write]=vertex;indexChanged=true}
    write++;
   }
   if(segment.opacity!==opacity){
    blend.array.fill(opacity,segment.start,segment.end);
    segment.opacity=opacity;blendChanged=true;
   }
  }
  if(indexChanged)index.needsUpdate=true;
  if(blendChanged)blend.needsUpdate=true;
  geometry.setDrawRange(0,write);
  this.paintMesh(mesh,write?alpha:0);
 }
 scenerySegments(mesh,segments){
  const {geometry,material}=mesh,count=geometry.attributes.position.count;
  geometry.setIndex(new T.BufferAttribute(new (count>65535?Uint32Array:Uint16Array)(count),1).setUsage(T.DynamicDrawUsage));
  geometry.setAttribute('lodBlend',new T.BufferAttribute(new Float32Array(count),1).setUsage(T.DynamicDrawUsage));
  mesh.userData.segments=segments;
  mesh.userData.treeIds=new Set(segments.map(segment=>segment.tree.id));
  const previous=material.onBeforeCompile;
  material.onBeforeCompile=shader=>{
   previous(shader);
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute float lodBlend; varying float treeOpacity;').replace('#include <begin_vertex>','#include <begin_vertex>\ntreeOpacity=lodBlend;');
   shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nvarying float treeOpacity;').replace('#include <color_fragment>','#include <color_fragment>\ndiffuseColor.a *= treeOpacity;');
  };
  material.customProgramCacheKey=()=>mesh.name+'-tree-lod';
  return mesh;
 }
 paintMesh(mesh,alpha){
  if(!mesh)return;
  mesh.visible=alpha>0;
  mesh.material.opacity=alpha;
 }
 paintChunk(chunk,alpha,lift){
  chunk.position.y=lift;
  for(const mesh of chunk.children)mesh.material.opacity=alpha;
 }
 releaseViewScenery(chunk){
  const data=chunk.userData;
  for(const key of ['props','nearTrees','billboards'])if(data[key]){
   disposeChunk(data[key]);data[key].removeFromParent();data[key]=null;
  }
  data.scenery=null;data.treeStates?.clear();
 }
 syncViewCollision(body,cx,cz,count,policy){
  const key=[body.id,cx,cz,count,policy].join(':');
  if(key===this.viewCollisionKey)return;
  this.viewCollisionKey=key;
  const previous=this.collisionChunks,next=new Map();
  for(let z=cz-1;z<=cz+1;z++)for(let x=cx-1;x<=cx+1;x++){
   const id=[body.id,x,z,count,policy].join(':');
   next.set(id,previous.get(id)||this.decorate(body,x,z,count,{kind:'collision'}));
  }
  this.collisionChunks=next;
  this.treeCache=[...next.values()].flatMap(chunk=>chunk.trees);
  this.collisionRevision++;
 }
 get collisionBoxes(){return [...this.collisionChunks.values()].flatMap(chunk=>chunk.colliders)}
 billboards(body,cx,cz,count){
  const geometry=new T.BufferGeometry(),positions=[],centers=[],colors=[],normals=[],segments=[];
  const depleted=this.view.session.prospecting?.economy.depleted;
  for(const tree of sceneryPoints(body,cx,cz,count)){
   if(!(tree.tree||tree.alien)||depleted?.has(tree.id))continue;
   const {x,y,z,vegetation,alien,i}=tree;
   const start=positions.length/3;
   const vertex=(dx,dy,c)=>{positions.push(x+dx,y+dy,z);centers.push(x,z);colors.push(c.r,c.g,c.b);normals.push(0,1,0)};
   const shape=(points,color)=>{
    const c=new T.Color(color);
    for(let n=1;n<points.length-1;n++)for(const [dx,dy] of [points[0],points[n],points[n+1]])vertex(dx,dy,c);
   };
   const broad=alien||vegetation==='oak'||vegetation==='birch',half=vegetation==='spruce'?1.6:2;
   shape([[-.25,0],[.25,0],[.2,4],[-.2,4]],alien?'#615475':vegetation==='birch'?'#c8c7b0':'#765039');
   const tint=alien?i%2?'#9f74b5':'#61a6a2':vegetation==='oak'?'#537c38':i%2?'#3e7549':'#315f42';
   if(broad){
    const low=alien?3.55:3,high=alien?5:7;
    shape([[-2.3,low+.25],[-1.4,low],[1.4,low],[2.3,low+.25],[2.3,high-.5],[1.25,high],[-1.25,high],[-2.3,high-.5]],tint);
   }else shape([[-half,vegetation==='spruce'?2.1:2],[half,vegetation==='spruce'?2.1:2],[0,vegetation==='spruce'?6.9:8]],tint);
   segments.push({tree,start,end:positions.length/3});
  }
  geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));
  geometry.setAttribute('centerXZ',new T.Float32BufferAttribute(centers,2));
  geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));
  // Upward lighting stays stable as the tree silhouette turns toward the camera.
  geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));
  const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
  material.onBeforeCompile=shader=>{
   shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec2 centerXZ;').replace('#include <begin_vertex>',`#include <begin_vertex>
    vec2 viewXZ = cameraPosition.xz - centerXZ;
    vec2 rightXZ = vec2(viewXZ.y, -viewXZ.x) / max(length(viewXZ), 0.001);
    transformed.xz = centerXZ + rightXZ * (position.x - centerXZ.x);`);
  };
  const mesh=new T.Mesh(geometry,ditherFade(material));mesh.name='Terrain tree billboards';mesh.frustumCulled=false;
  return this.scenerySegments(mesh,segments);
 }
 make(body,cx,cz){const g=new T.Group();g.userData={cx,cz};const geo=new T.PlaneGeometry(96,96,16,16);geo.rotateX(-Math.PI/2);const p=geo.attributes.position,colors=[];for(let i=0;i<p.count;i++){const x=p.getX(i)+cx*96,z=p.getZ(i)+cz*96;p.setXYZ(i,x,surfaceHeight(x,z)-.025,z);const c=body.name==='Earth'?biomeColor(x,z):terrainColor(body,x,z);colors.push(c.r,c.g,c.b)}geo.setAttribute('color',new T.Float32BufferAttribute(colors,3));geo.computeVertexNormals();const ground=new T.Mesh(addTerrainDetail(geo,body),ditherFade(terrainMaterial(body)));ground.userData.terrain=true;g.add(ground);return g}
 get trees(){if(this.viewStreaming)return this.treeCache||[];if(!this.treeCache||this.treeCacheAt!==this.visibilityAt){this.treeCacheAt=this.visibilityAt;this.treeCache=[...this.chunks.values()].flatMap(g=>g.userData.scenery?.visible?g.userData.scenery.userData.trees||[]:[])}return this.treeCache}
 updateTreeSnow(){const state=this.view.session.earthEnvironment;if(!state||state.elapsed<(this.snowAt||0))return;this.snowAt=state.elapsed+1;for(const g of this.chunks.values()){const mesh=g.userData.scenery,caps=mesh?.userData.snowCaps;if(!g.visible||!mesh?.visible||!caps?.length)continue;const a=mesh.geometry.attributes.color,dt=Math.max(0,state.elapsed-(mesh.userData.snowAt??state.elapsed));mesh.userData.snowAt=state.elapsed;a.clearUpdateRanges();let dirty=false;for(const cap of caps){const local=biomeWeather(state,cap.x,cap.z),amount=cap.cover=Math.max(0,Math.min(1,(cap.cover??state.snowCover??0)+dt*(local.snow*.004-(local.snow>.02?0:.0015))));if(cap.uploaded!==undefined&&Math.abs(amount-cap.uploaded)<.01)continue;cap.uploaded=amount;const color=new T.Color('#315f42').lerp(new T.Color('#f2f7fb'),amount);for(let i=cap.start;i<cap.end;i++)a.setXYZ(i,color.r,color.g,color.b);a.addUpdateRange(cap.start*3,(cap.end-cap.start)*3);dirty=true}if(dirty)a.needsUpdate=true}}

 decorate(body,cx,cz,count,{kind='all'}={}){const positions=[],normals=[],colors=[],boxes=[],seed=Math.sin(cx*127.1+cz*311.7+body.id.length*43)*43758.5453,random=i=>{const n=Math.sin(seed+i*78.233)*43758.5453;return n-Math.floor(n)},v=new T.Vector3(),n=new T.Vector3(),q=new T.Quaternion();let trees=0,alienTrees=0;
 const part=(name,x,y,z,color,scale=new T.Vector3(1,1,1),angle=0)=>{const geo=templates[name],a=geo.attributes.position,b=geo.attributes.normal,c=new T.Color(color),translation=new T.Vector3(x,y,z),min=new T.Vector3(Infinity,Infinity,Infinity),max=new T.Vector3(-Infinity,-Infinity,-Infinity);q.setFromAxisAngle(new T.Vector3(0,0,1),angle);for(let i=0;i<a.count;i++){v.fromBufferAttribute(a,i).multiply(scale).applyQuaternion(q).add(translation);if(kind!=='collision'){n.fromBufferAttribute(b,i).divide(scale).applyQuaternion(q).normalize();positions.push(v.x,v.y,v.z);normals.push(n.x,n.y,n.z);colors.push(c.r,c.g,c.b)}min.min(v);max.max(v)}boxes.push(new T.Box3(min,max))};
 const treeNodes=[],snowCaps=[],segments=[];for(const p of sceneryPoints(body,cx,cz,count)){const {x,y,z,size,i}=p;const start=positions.length/3;const isTree=p.alien||p.tree;if(kind==='trees'&&!isTree||kind==='props'&&isTree)continue;if(p.alien){treeNodes.push(p);if(this.view.session.prospecting?.economy.depleted.has(p.id))continue;trees++;const tint=i%2?'#9f74b5':'#61a6a2';part('trunk',x,y+2.2,z,'#615475',new T.Vector3(.65,1.1,.65));part('broad',x,y+4.3,z,tint,new T.Vector3(1.15,.28,1.15));part('broad',x+.8,y+3.3,z,'#86c3ac',new T.Vector3(.5,.22,.5));alienTrees++}else if(p.tree){treeNodes.push(p);if(this.view.session.prospecting?.economy.depleted.has(p.id))continue;const leaf=['oak','birch'].includes(p.vegetation)?'broad':'leaves';part('trunk',x,y+2,z,p.vegetation==='birch'?'#c8c7b0':'#765039');part(leaf,x,y+(p.vegetation==='spruce'?4.5:5),z,p.vegetation==='oak'?'#537c38':i%2?'#3e7549':'#315f42',p.vegetation==='spruce'?new T.Vector3(.8,.8,.8):new T.Vector3(1,1,1));if(biomeWeather({snow:1},x,z).snow>0){const start=positions.length/3,scale=p.vegetation==='spruce'?.8:1;part(leaf,x,y+(p.vegetation==='spruce'?4.5:5)+.04,z,'#315f42',new T.Vector3(scale*1.015,scale*1.006,scale*1.015));snowCaps.push({start,end:positions.length/3,x,z})}trees++}else if(p.vegetation==='cactus'&&i%3!==0){part('trunk',x,y+1.7,z,'#4d8452',new T.Vector3(1.8,.85,1.8));part('trunk',x+.65,y+2,z,'#578c52',new T.Vector3(1.1,.32,1.1));part('trunk',x+.35,y+1.55,z,'#578c52',new T.Vector3(1,.2,1),-Math.PI/2)}else part('rock',x,y+size*.35,z,terrainColor(body,x,z),new T.Vector3(size,size*.65,size));if(kind!=='trees'&&i===count-1&&['Moon','Mars'].includes(body.name)){part('pole',x,y+1.5,z,'#b4c5d2');part('panel',x,y+2,z,'#244d85',new T.Vector3(1,1,1),.3)}if(kind==='trees'||kind==='props')segments.push({tree:p,start,end:positions.length/3})}
 // Grass shares the single scenery draw call and has no collisions or per-frame animation.
 let grassBlades=0;if((kind==='all'||kind==='props')&&this.decorations&&body.name==='Earth')for(let i=0;i<this.grassCount;i++){const side=Math.ceil(Math.sqrt(this.grassCount)),x=cx*96+((i%side+random(i*5+500))/side-.5)*94,z=cz*96+((Math.floor(i/side)+random(i*5+501))/side-.5)*94;if(earthBiome(x,z).sound!=='grass'||Math.hypot(x,z)<PAD_RADIUS+8||onSurfaceRoad(body,x,z,3)||settlementContains(body,x,z,3)||Math.abs(x)<40&&z<0&&z>-60)continue;const y=surfaceHeight(x,z),start=positions.length/3;for(let blade=0;blade<3;blade++){const angle=random(i*5+502)*6.28+blade*2.09,dx=Math.cos(angle)*.24,dz=Math.sin(angle)*.24,height=.28+random(i*5+503)*.32,c=new T.Color(blade%2?'#7e9a50':'#567638');positions.push(x-dx,y,z-dz,x+dx,y,z+dz,x+dx*.4,y+height,z+dz*.4);for(let v=0;v<3;v++){normals.push(0,1,0);colors.push(c.r,c.g,c.b)}grassBlades++;}if(kind==='props')segments.push({tree:{x,y,z,size:.6,grass:true},start,end:positions.length/3});}
 const colliders=boxes.map(b=>({min:{x:b.min.x,y:b.min.y,z:b.min.z},max:{x:b.max.x,y:b.max.y,z:b.max.z},kind:'terrain decoration'}));
 if(kind==='collision')return {colliders,trees:treeNodes};
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('color',new T.Float32BufferAttribute(colors,3));geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,ditherFade(new T.MeshStandardMaterial({vertexColors:true,roughness:1})));mesh.name='Batched surface scenery';mesh.userData.occlusionBoxes=boxes;mesh.userData.colliders=colliders;mesh.userData.alienTreeCount=alienTrees;mesh.userData.treeCount=trees;mesh.userData.grassBlades=grassBlades;mesh.userData.trees=treeNodes;mesh.userData.snowCaps=snowCaps;return kind==='trees'||kind==='props'?this.scenerySegments(mesh,segments):mesh}
}

export function airlessTerrainRadius(body,configured,height,nearRadius=4){if(hasAtmosphere(body))return configured;return Math.ceil(T.MathUtils.lerp(Math.max(nearRadius,configured),configured,T.MathUtils.smoothstep(height,200,1400)));}
