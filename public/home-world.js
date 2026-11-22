import * as T from './vendor/three.module.js';
import {Flight} from './flight.js';
import {SurfaceSession,surfaceHeight} from './surface.js';
import {SurfaceView} from './surface-view.js';
import {SurfaceStream} from './surface-streaming.js';
import {GroundWeather} from './ground-weather.js';
import {makeShip,makeStars} from './visuals.js';
import {GlobalShadows} from './global-shadows.js';
import {loadBlenderModel} from './models.js';
import {CRAFT_LAYOUT} from './surface-layout.js';
import {TRADER} from './economy.js?v=170';
import {WarpShipMotion} from './warp-effects.js';

// Use the gameplay generators and environment without moving the saved flight.
export class HomeWorld{
 constructor(context,character){
  this.context=context;this.character=character;
  this.flight=new Flight(context.bodies);this.session=new SurfaceSession(this.flight);
  this.rig=makeShip();this.session.shipRig=this.rig;
  this.rig.shipTrailTips=[new T.Vector3(-3.7,-.76,2.15),new T.Vector3(3.7,-.76,2.15)];
  this.trailPreview=new WarpShipMotion(this.rig.ship);
  this.rig.trailPreview=this.trailPreview.trails;
  this.flightPreview=null;this.previewTime=0;
  this.padPosition=new T.Vector3();

  this.spaceScene=new T.Scene();
  this.spaceScene.userData.shipRig=this.rig;
  this.spaceScene.userData.warpShipTrails=this.trailPreview.trails;
  this.spaceScene.background=new T.Color(0x030713);
  this.spaceScene.add(new T.HemisphereLight(0xdceeff,0x455775,2));
  const sun=new T.DirectionalLight(0xf4f7ff,2.4);
  sun.position.set(-5,9,4);this.spaceScene.add(sun);
  this.spaceSky=context.sky?new T.Mesh(new T.SphereGeometry(9000,32,20),
   new T.MeshBasicMaterial({map:context.sky,side:T.BackSide,depthWrite:false,toneMapped:false})):makeStars();
  this.spaceScene.add(this.spaceSky);
  this.previewStars=Array.from({length:48},(_,i)=>new T.Vector3(
   ((i*31%53)/53-.5)*85,((i*17%59)/59-.5)*60,(i*43%101)/101*100
  ));
  const streakGeometry=new T.BufferGeometry();
  this.streakPositions=new T.Float32BufferAttribute(new Float32Array(this.previewStars.length*6),3).setUsage(T.DynamicDrawUsage);
  streakGeometry.setAttribute('position',this.streakPositions);
  this.previewStreaks=new T.LineSegments(streakGeometry,new T.LineBasicMaterial({color:0xafd9ff,transparent:true,opacity:.45,depthWrite:false}));
  this.previewStreaks.frustumCulled=false;
  this.spaceScene.add(this.previewStreaks);

  this.view=new SurfaceView(this.session,context.bodies);this.scene=this.view.scene;
  this.view.environment=context.view.environment;this.view.quality=context.quality;this.view.mobile=context.mobile;
  if(context.sky)this.view.setSky(context.sky);
  this.stream=new SurfaceStream(this.view);this.stream.radius=context.stream.radius;
  this.stream.decorations=context.stream.decorations;this.stream.grassAmount=context.stream.grassAmount;
  this.weather=new GroundWeather(this.view);
  this.scene.add(this.rig.ship,character.group);
  this.scene.userData.warpShipTrails=this.trailPreview.trails;
  this.shadows=new GlobalShadows(context.renderer,[this.scene,this.scene],[this.view.sun,this.view.sun]);
  this.shipLights=[];this.syncSettings(context);
 }
 syncSettings(context){
  const key=[context.quality,context.mobile,context.globalShadow,context.stream.radius,context.stream.decorations,context.stream.grassAmount].join(':');this.context=context;if(this.settingsKey===key)return;this.settingsKey=key;
  this.view.quality=context.quality;this.view.mobile=context.mobile;this.stream.radius=context.stream.radius;this.stream.decorations=context.stream.decorations;this.stream.grassAmount=context.stream.grassAmount;
  this.shadows.set(context.globalShadow,context.quality,context.mobile);
  if(this.session.active)this.stream.update(this.session.crew?.pos||this.session.pos,context.quality,{mobile:context.mobile,compatibility:context.compatibility});
 }
 enter(body){
  this.session.enter(body?.solid?body:this.context.earth,true);this.session.pos.y=this.session.floor;
  this.flight.q.setFromAxisAngle(new T.Vector3(0,1,0),Math.PI);
  this.session.crew={onFoot:true,pos:new T.Vector3(-3,0,-14),reset(){},ground:()=>surfaceHeight(-3,-14)};
  this.character.group.position.copy(this.session.crew.pos);this.character.group.position.y=surfaceHeight(-3,-14);
  this.rig.model.rotation.x=Math.PI/2;this.rig.exhaust.rotation.x=Math.PI/2;
  this.rig.gear.visible=true;this.view.build();this.lastWeatherUpdate=undefined;this.lastViewUpdate=undefined;
  this.rig.ship.position.copy(this.session.pos).add(this.rig.padOffset.clone().applyQuaternion(this.flight.q));this.rig.ship.quaternion.copy(this.flight.q);
  this.padPosition.copy(this.rig.ship.position);
  this.rig.ship.updateWorldMatrix(true,false);
  this.placements?.removeFromParent();this.placements=null;
  if(this.context.surface.body===this.session.body){
   const building=this.context.building;
   this.placements=building.group.clone(false);
   for(const child of building.group.children)if(child!==building.hall)this.placements.add(child.clone(true));
   this.placements.visible=true;this.scene.add(this.placements);
  }
  if(this.session.body?.name==='Earth'&&!this.centers){
   const trade=new T.Group(),craft=new T.Group();
   trade.name='Trade Center';trade.position.copy(TRADER);
   craft.name='Crafting Center';craft.position.set(CRAFT_LAYOUT.x,0,CRAFT_LAYOUT.z);craft.rotation.y=CRAFT_LAYOUT.yaw;
   loadBlenderModel(trade,'trading-hall');loadBlenderModel(craft,'crafting-center-v96');
   this.centers=new T.Group();this.centers.add(trade,craft);this.scene.add(this.centers);
  }
  if(this.centers)this.centers.visible=this.session.body?.name==='Earth';
  this.stream.update(this.session.crew.pos,this.context.quality,{mobile:this.context.mobile,compatibility:this.context.compatibility});
 }
 prepareShipDetails(){
  // Use representative emitters for both wings, both engines and the cabin.
  const emitters=/^(Wing_Navigation_Light_[LR]|Engine_Glow_Core_[LR]|Ceiling_Lamp)$/;
  const point=new T.Vector3();
  this.rig.model.traverse(mesh=>{
   if(!mesh.userData.neonPart)return;
   for(const {name,start,count} of mesh.userData.sourceParts||[]){
    if(!emitters.test(name))continue;
    const bounds=new T.Box3(),positions=mesh.geometry.attributes.position;
    for(let i=start;i<start+count;i++)bounds.expandByPoint(point.fromBufferAttribute(positions,i));
    const light=new T.PointLight(mesh.material.emissive,1.6,5,2);
    bounds.getCenter(light.position);
    if(name.startsWith('Wing'))light.position.y+=.1;
    else if(name.startsWith('Engine'))light.position.z+=.15;
    else light.position.y-=.12;
    this.shipLights.push({mesh,light});
   }
  });
  for(const {mesh,light} of this.shipLights)mesh.add(light);

  const wingNames=['Wing_Tip_Red_R','Wing_Tip_Red_L'];
  this.rig.model.updateWorldMatrix(true,true);
  const inverse=this.rig.model.matrixWorld.clone().invert(),matrix=new T.Matrix4();
  this.rig.model.traverse(mesh=>{
   for(const {name,start,count} of mesh.userData.sourceParts||[]){
    const wing=wingNames.indexOf(name);
    if(wing<0)continue;
    matrix.multiplyMatrices(inverse,mesh.matrixWorld);
    const tip=this.rig.shipTrailTips[wing],positions=mesh.geometry.attributes.position;
    let best=-Infinity;
    for(let i=start;i<start+count;i++){
     point.fromBufferAttribute(positions,i).applyMatrix4(matrix);
     const score=Math.abs(point.x)+point.z*.45;
     if(score>best){best=score;tip.copy(point);}
    }
   }
  });
 }
 setFlightPreview(mode){
  if(this.flightPreview===mode)return;
  const flying=!!this.flightPreview;
  this.flightPreview=mode;
  if(mode&&!flying){
   this.previewTime=0;
   this.spaceScene.add(this.rig.ship);
   this.rig.model.rotation.x=this.rig.exhaust.rotation.x=0;
   this.rig.gear.visible=false;
   this.animateFlightPreview(0);
  }
  if(!mode){
   this.scene.add(this.rig.ship);
   this.rig.ship.position.copy(this.padPosition);
   this.rig.ship.quaternion.copy(this.flight.q);
   this.rig.model.rotation.x=this.rig.exhaust.rotation.x=Math.PI/2;
   this.rig.gear.visible=true;
  }
  this.trailPreview.trails.visible=!!mode;
  for(const flame of this.rig.flames){flame.visible=!!mode;flame.scale.z=1;}
  for(const halo of this.rig.engines)halo.visible=!!mode;
 }
 animateFlightPreview(dt){
  if(!this.flightPreview)return;
  this.previewTime+=dt;
  const time=this.previewTime,ship=this.rig.ship,distance=time*32;
  ship.position.copy(this.padPosition);
  ship.position.z-=distance;
  ship.quaternion.identity();
  for(const flame of this.rig.flames)flame.scale.z=1.03+Math.sin(time*25)*.2;
  for(let wing=0;wing<2;wing++){
   const tip=this.rig.shipTrailTips[wing];
   for(let i=0;i<17;i++)this.trailPreview.positions.setXYZ(wing*17+i,tip.x,tip.y,tip.z+i*1.5);
  }
  this.trailPreview.updateRibbon();
  this.previewStreaks.position.copy(ship.position);
  for(const [i,star] of this.previewStars.entries()){
   const z=(star.z+distance)%100-80;
   this.streakPositions.setXYZ(i*2,star.x,star.y,z);
   this.streakPositions.setXYZ(i*2+1,star.x,star.y,z+1.6);
  }
  this.streakPositions.needsUpdate=true;
 }

 update(now,dt,camera,{interacting=false}={}){
  for(const {light,mesh} of this.shipLights){
   const material=mesh.material;
   if(material.vertexColors&&material.userData.fallbackColor)light.color.set(material.userData.fallbackColor);
   else light.color.copy(material.emissive);
  }
  this.view.environment.step(dt);
  if(this.flightPreview){this.spaceSky.position.copy(camera.position);return;}
  if(this.lastViewUpdate===undefined||now-this.lastViewUpdate>=1/15){
   this.view.update(now,this.rig,this.lastViewUpdate===undefined?dt:Math.min(.1,now-this.lastViewUpdate));
   this.lastViewUpdate=now;
  }
  if(this.view.skyDome)this.view.skyDome.position.copy(camera.position);
  this.view.celestial.update(camera);
  this.shadows.update(dt,this.session,this.session.crew,camera,true);
  if(interacting)return;
  if(this.lastWeatherUpdate===undefined||now-this.lastWeatherUpdate>=.1){
   this.weather.update(camera,this.session.earthEnvironment,this.context.quality,this.context.compatibility,this.context.mobile);
   this.lastWeatherUpdate=now;
  }
 }
}
