import {attachStarEffects,updateStarEffects,StarCameraMotion,STAR_RENDER_SCALE,stellarDistanceScale} from './star-effects.js?v=194';
import {starVisualRadius} from './star-size.js?v=170';
import {applySmallBody,smallBodyFallback} from './small-body-models.js?v=100';
import {starShineColor} from './star-colors.js';
import {bodySphereGeometry} from './texture-geometry.js';
import {PLANET_VIEW_RADIUS} from './atmospheric-flight.js?v=168';
import {surfaceFrame} from './surface-frame.js';
import * as T from './vendor/three.module.js';
// Celestial directions use the same surface frame as the pad and the pilot.
export function surfaceSkyLayout(session,bodies){
 const body=session.body;if(!body||body.solid===false)return [];
 const parent=bodies.find(b=>b.name===body.parent),up=session.normal.clone(),local=surfaceFrame(body,up,bodies);
 const origin=body.pos.clone().addScaledVector(up,body.r),family=body.parent||body.name;
 return bodies.filter(b=>b!==body&&b.system===body.system&&(b===parent||b.parent===family||b.type==='STAR'||body.proto&&(body.terrainBase==='Earth'&&b.name==='Proto Theia'||body.terrainBase==='Theia'&&b.name==='Proto Earth'))).map(b=>{
  const delta=b.pos.clone().sub(origin),distance=delta.length(),direction=delta.normalize().transformDirection(local);
  return {body:b,direction,radius:Math.max(b.type==='STAR'?8/stellarDistanceScale(distance):4,6000*b.r/Math.max(distance,b.r*1.1)),distance};
 });
}
export class SurfaceSky{
 constructor(session,bodies){this.motion=new StarCameraMotion();this.session=session;this.bodies=bodies;this.group=new T.Group();this.loader=new T.TextureLoader();this.maps=new Map();this.generation=0;this.body=null;session.skyBodies=[]}
 build(){this.generation++;for(const m of this.group.children){m.userData.disposed=true;m.geometry.dispose();m.material.dispose();for(const c of m.children){c.geometry?.dispose();c.material?.dispose()}}this.group.clear();for(const map of this.maps.values())map.dispose();this.maps.clear();this.body=this.session.body;const generation=this.generation;
  this.session.skyBodies=surfaceSkyLayout(this.session,this.bodies);
  for(const item of this.session.skyBodies){
   item.skyDistance=(this.body?.name==='Earth'||this.body?.proto&&this.body.terrainBase==='Earth')&&['Sun','Proto Sun','Moon'].includes(item.body.name)?1200:6000;if(item.skyDistance===1200)item.radius=item.body.type==='STAR'?7:12;item.visualRadius=item.body.type==='STAR'?item.radius*starVisualRadius(item.body,this.bodies)/item.body.r*STAR_RENDER_SCALE:item.radius;const mesh=new T.Mesh(item.body.modelFile?smallBodyFallback(item.body,item.radius):bodySphereGeometry(item.body,item.visualRadius,16,40,24),new T.MeshBasicMaterial({color:item.body.color,toneMapped:false,fog:false}));mesh.userData.skyBody=item;item.mesh=mesh;item.baseDirection=item.direction.clone();if(item.body.type==='STAR')mesh.userData.starDistanceScale=stellarDistanceScale(item.distance);if(item.body.modelFile)mesh.userData.shapeReady=applySmallBody(mesh,item.body,item.radius);mesh.position.copy(item.direction).multiplyScalar(item.skyDistance);this.group.add(mesh);
   if(item.body.type==='STAR'){const fx=attachStarEffects(mesh,item.visualRadius,starShineColor(item.body));item.halo=fx.glow;item.shine=fx.shine;}
   if(item.body.rings){const ring=new T.Mesh(new T.RingGeometry(item.radius*1.25,item.radius*2.1,80),new T.MeshBasicMaterial({color:0xc9b995,side:T.DoubleSide,transparent:true,opacity:.6,fog:false,toneMapped:false}));ring.rotation.x=-Math.PI/2.3;mesh.add(ring)}
   if(item.body.texture&&item.body.type!=='STAR')this.loader.load('./textures/'+item.body.texture,map=>{if(generation!==this.generation){map.dispose();return}map.colorSpace=T.SRGBColorSpace;this.maps.set(item.body.id,map);mesh.material.map=map;mesh.material.color.set(0xffffff);mesh.material.needsUpdate=true},undefined,()=>{});
  }
 }
 update(camera){if(this.body!==this.session.body)this.build();const angle=this.motion.update(camera);this.group.position.copy(camera.position);const orbit=this.session.planetView?.cover.mode==='orbit';for(const item of this.session.skyBodies){const base=item.skyDistance||6000;item.renderDistance=orbit?240000:base;item.mesh.position.copy(item.direction).multiplyScalar(item.renderDistance);item.mesh.scale.setScalar(item.renderDistance/base);updateStarEffects(item.mesh,angle);if(this.body.proto&&['Proto Theia','Proto Earth'].includes(item.body.name)){const globe=this.session.planetView?.globe;if(globe?.visible&&!skyBodyOutsideGlobe(camera.position,item.direction,item.renderDistance,item.visualRadius*item.mesh.scale.x,globe.position,PLANET_VIEW_RADIUS))item.mesh.visible=false;}if(this.session.earthEnvironment){const fx=item.mesh.userData.starEffects;if(fx){const fade=1-this.session.earthEnvironment.cloud*.8;fx.glow.material.opacity*=fade;if(fx.shine)fx.shine.material.opacity*=fade;}}}}
}

export function skyBodyOutsideGlobe(eye,direction,distance,radius,center,globeRadius){const hit=new T.Ray(eye,direction.clone().normalize()).intersectSphere(new T.Sphere(center,globeRadius),new T.Vector3());return !hit||hit.distanceTo(eye)>=distance-radius;}
