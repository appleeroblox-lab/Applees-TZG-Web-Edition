import * as T from './vendor/three.module.js';
import {Flight} from './flight.js';
import {SurfaceSession,surfaceHeight} from './surface.js';
import {SurfaceView} from './surface-view.js';
import {SurfaceStream} from './surface-streaming.js';
import {GroundWeather} from './ground-weather.js';
import {makeShip} from './visuals.js';
import {GlobalShadows} from './global-shadows.js';
import {NeonLights} from './neon-lights.js';
import {WarpShipMotion} from './warp-effects.js';

// Use the gameplay generators and environment without moving the saved flight.
export class HomeWorld{
 constructor(context,character){
  this.context=context;this.character=character;
  this.flight=new Flight(context.bodies);this.session=new SurfaceSession(this.flight);
  this.rig=makeShip();this.session.shipRig=this.rig;
  this.rig.shipTrailTips=[new T.Vector3(-3.7,-.76,.9),new T.Vector3(3.7,-.76,.9)];
  this.trailPreview=new WarpShipMotion(this.rig.ship);
  this.rig.trailPreview=this.trailPreview.trails;
  this.flightPreview=null;this.previewTime=0;
  this.padPosition=new T.Vector3();this.previewPoint=new T.Vector3();this.previewInverse=new T.Quaternion();
  this.trailPath=Array.from({length:2},()=>Array.from({length:17},()=>new T.Vector3()));
  this.trailHead=0;this.trailCount=0;this.lastTrailSample=-Infinity;

  this.view=new SurfaceView(this.session,context.bodies);this.scene=this.view.scene;
  this.view.environment=context.view.environment;this.view.quality=context.quality;this.view.mobile=context.mobile;
  if(context.sky)this.view.setSky(context.sky);
  this.stream=new SurfaceStream(this.view);this.stream.radius=context.stream.radius;
  this.stream.decorations=context.stream.decorations;this.stream.grassAmount=context.stream.grassAmount;
  this.weather=new GroundWeather(this.view);
  this.scene.add(this.rig.ship,character.group);
  this.scene.userData.warpShipTrails=this.trailPreview.trails;
  this.shadows=new GlobalShadows(context.renderer,[this.scene,this.scene],[this.view.sun,this.view.sun]);
  this.neon=new NeonLights(this.scene);this.syncSettings(context);
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
  this.placements?.removeFromParent();this.placements=null;
  if(this.context.surface.body===this.session.body){this.placements=this.context.building.group.clone(true);this.placements.visible=true;this.scene.add(this.placements)}
  this.stream.update(this.session.crew.pos,this.context.quality,{mobile:this.context.mobile,compatibility:this.context.compatibility});
 }
 setFlightPreview(mode){
  if(this.flightPreview===mode)return;
  const flying=!!this.flightPreview;
  this.flightPreview=mode;
  if(mode&&!flying){
   this.previewTime=0;this.trailCount=0;this.trailHead=0;this.lastTrailSample=-Infinity;
  }
  if(!mode){
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
  const time=this.previewTime,ship=this.rig.ship;
  const lift=T.MathUtils.smoothstep(time,0,1.8);
  const angle=Math.max(0,time-1.3)*.42;
  ship.position.copy(this.padPosition);
  ship.position.x+=Math.sin(angle)*20;
  ship.position.y+=lift*(7+Math.sin(angle)*1.2);
  ship.position.z+=(1-Math.cos(angle))*20;
  ship.rotation.set(0,Math.PI-lift*(Math.PI/2+angle),0);
  this.rig.model.rotation.x=this.rig.exhaust.rotation.x=(1-lift)*Math.PI/2;
  this.rig.gear.visible=lift<.3;
  for(const flame of this.rig.flames)flame.scale.z=.72+Math.sin(time*25)*.16;
  if(time-this.lastTrailSample>=.045){
   this.lastTrailSample=time;
   this.trailHead=(this.trailHead+16)%17;
   this.trailCount=Math.min(17,this.trailCount+1);
   for(let wing=0;wing<2;wing++){
    this.trailPath[wing][this.trailHead].copy(this.rig.shipTrailTips[wing]).applyQuaternion(this.rig.model.quaternion).applyQuaternion(ship.quaternion).add(ship.position);
   }
  }
  const inverse=this.previewInverse.copy(ship.quaternion).invert(),point=this.previewPoint;
  for(let wing=0;wing<2;wing++){
   for(let i=0;i<17;i++){
    const index=(this.trailHead+Math.min(i,this.trailCount-1))%17;
    point.copy(this.trailPath[wing][index]).sub(ship.position).applyQuaternion(inverse);
    this.trailPreview.positions.setXYZ(wing*17+i,point.x,point.y,point.z);
   }
  }
  this.trailPreview.positions.needsUpdate=true;
 }

 update(now,dt,camera,{interacting=false}={}){
  this.view.environment.step(dt);
  if(interacting){
   if(this.view.skyDome)this.view.skyDome.position.copy(camera.position);
   this.view.celestial.update(camera);
   return;
  }
  if(this.lastViewUpdate===undefined||now-this.lastViewUpdate>=1/15){
   this.view.update(now,this.rig,this.lastViewUpdate===undefined?dt:Math.min(.1,now-this.lastViewUpdate));
   this.lastViewUpdate=now;
  }
  if(this.view.skyDome)this.view.skyDome.position.copy(camera.position);
  this.view.celestial.update(camera);
  if(this.lastWeatherUpdate===undefined||now-this.lastWeatherUpdate>=.1){
   this.weather.update(camera,this.session.earthEnvironment,this.context.quality,this.context.compatibility,this.context.mobile);
   this.lastWeatherUpdate=now;
  }
  this.shadows.update(dt,this.session,this.session.crew,camera,true);this.neon.update(now,camera,true);
 }
}
