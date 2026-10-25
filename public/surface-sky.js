import {starShineColor} from './star-colors.js';
import {bodySphereGeometry} from './texture-geometry.js';
import {surfaceFrame} from './surface-frame.js';
import * as T from './vendor/three.module.js';
// Celestial directions use the same surface frame as the pad and the pilot.
export function surfaceSkyLayout(session,bodies){
 const body=session.body;if(!body||body.solid===false)return [];
 const parent=bodies.find(b=>b.name===body.parent),up=session.normal.clone(),local=surfaceFrame(body,up,bodies);
 const origin=body.pos.clone().addScaledVector(up,body.r),family=body.parent||body.name;
 return bodies.filter(b=>b!==body&&b.system===body.system&&(b===parent||b.parent===family||b.type==='STAR')).map(b=>{
  const delta=b.pos.clone().sub(origin),distance=delta.length(),direction=delta.normalize().transformDirection(local);
  return {body:b,direction,radius:Math.max(b.type==='STAR'?8:4,6000*b.r/Math.max(distance,b.r*1.1)),distance};
 });
}
export class SurfaceSky{
 constructor(session,bodies){this.session=session;this.bodies=bodies;this.group=new T.Group();this.loader=new T.TextureLoader();this.maps=new Map();this.glow=null;if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');if(x?.createRadialGradient){const g=x.createRadialGradient(32,32,0,32,32,32);g.addColorStop(0,'#fff');g.addColorStop(.2,'#ffffffaa');g.addColorStop(1,'#fff0');x.fillStyle=g;x.fillRect(0,0,64,64);this.glow=new T.CanvasTexture(c)}}this.generation=0;this.body=null;session.skyBodies=[]}
 build(){this.generation++;for(const m of this.group.children){m.geometry.dispose();m.material.dispose();for(const c of m.children){c.geometry?.dispose();c.material?.dispose()}}this.group.clear();for(const map of this.maps.values())map.dispose();this.maps.clear();this.body=this.session.body;const generation=this.generation;
  this.session.skyBodies=surfaceSkyLayout(this.session,this.bodies);
  for(const item of this.session.skyBodies){
   item.skyDistance=this.body?.name==='Earth'&&['Sun','Moon'].includes(item.body.name)?1200:6000;if(item.skyDistance===1200)item.radius=item.body.name==='Sun'?7:12;const mesh=new T.Mesh(bodySphereGeometry(item.body,item.radius,16,40,24),new T.MeshBasicMaterial({color:item.body.type==='STAR'?starShineColor(item.body):item.body.color,toneMapped:false,fog:false}));mesh.userData.skyBody=item;item.mesh=mesh;mesh.position.copy(item.direction).multiplyScalar(item.skyDistance);this.group.add(mesh);if(item.body.type==='STAR'){const halo=new T.Sprite(new T.SpriteMaterial({map:this.glow,color:starShineColor(item.body),transparent:true,opacity:.5,depthWrite:false,fog:false,blending:T.AdditiveBlending}));halo.scale.setScalar(item.radius*7);mesh.add(halo);item.halo=halo}
   if(item.body.rings){const ring=new T.Mesh(new T.RingGeometry(item.radius*1.25,item.radius*2.1,80),new T.MeshBasicMaterial({color:0xc9b995,side:T.DoubleSide,transparent:true,opacity:.6,fog:false,toneMapped:false}));ring.rotation.x=-Math.PI/2.3;mesh.add(ring)}
   if(item.body.texture&&item.body.type!=='STAR')this.loader.load('./textures/'+item.body.texture,map=>{if(generation!==this.generation){map.dispose();return}map.colorSpace=T.SRGBColorSpace;this.maps.set(item.body.id,map);mesh.material.map=map;mesh.material.color.set(0xffffff);mesh.material.needsUpdate=true},undefined,()=>{});
  }
 }
 update(camera){if(this.body!==this.session.body)this.build();this.group.position.copy(camera.position)}
}
