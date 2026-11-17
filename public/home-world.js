import * as T from './vendor/three.module.js';
import {Flight} from './flight.js';
import {SurfaceSession,surfaceHeight} from './surface.js';
import {SurfaceView} from './surface-view.js';
import {SurfaceStream} from './surface-streaming.js';
import {GroundWeather} from './ground-weather.js';
import {makeShip} from './visuals.js';

// Use the gameplay generators and environment without moving the saved flight.
export class HomeWorld{
 constructor(context,character){
  this.context=context;this.character=character;
  this.flight=new Flight(context.bodies);this.session=new SurfaceSession(this.flight);
  this.rig=makeShip();this.session.shipRig=this.rig;
  this.view=new SurfaceView(this.session,context.bodies);this.scene=this.view.scene;
  this.view.environment=context.view.environment;this.view.quality=context.quality;this.view.mobile=context.mobile;
  if(context.sky)this.view.setSky(context.sky);
  this.stream=new SurfaceStream(this.view);this.stream.radius=context.stream.radius;
  this.stream.decorations=context.stream.decorations;this.stream.grassAmount=context.stream.grassAmount;
  this.weather=new GroundWeather(this.view);
  this.scene.add(this.rig.ship,character.group);
 }
 enter(body){
  this.session.enter(body?.solid?body:this.context.earth,true);this.session.pos.y=this.session.floor;
  this.session.crew={onFoot:true,pos:new T.Vector3(-6,0,-7),reset(){},ground:()=>surfaceHeight(-6,-7)};
  this.character.group.position.copy(this.session.crew.pos);this.character.group.position.y=surfaceHeight(-6,-7);
  this.rig.model.rotation.x=Math.PI/2;this.rig.exhaust.rotation.x=Math.PI/2;
  this.rig.gear.visible=true;this.view.build();
  this.placements?.removeFromParent();this.placements=null;
  if(this.context.surface.body===this.session.body){this.placements=this.context.building.group.clone(true);this.placements.visible=true;this.scene.add(this.placements)}
  this.stream.update(this.session.crew.pos,this.context.quality,{mobile:this.context.mobile,compatibility:this.context.compatibility});
 }
 update(now,dt,camera){
  this.view.environment.step(dt);this.view.update(now,this.rig,dt);
  this.rig.ship.position.copy(this.session.pos).add(this.rig.padOffset.clone().applyQuaternion(this.flight.q));this.rig.ship.quaternion.copy(this.flight.q);
  if(this.view.skyDome)this.view.skyDome.position.copy(camera.position);
  this.view.celestial.update(camera);
  this.weather.update(camera,this.session.earthEnvironment,this.context.quality,this.context.compatibility,this.context.mobile);
 }
}
