import * as T from './vendor/three.module.js';
export const STAR_RENDER_SCALE=1.3,BLACK_HOLE_RENDER_SCALE=1.35;
export const SHINE_RESPONSE=.12;
let textures;
// Two shared, bounded textures; black pixels disappear under additive blending.
export function stellarTextures(){
 if(!textures){const loader=new T.TextureLoader();textures={};for(const kind of ['glow','shine']){const map=loader.load(new URL('./textures/stellar-'+kind+'.webp',import.meta.url).href,()=>{globalThis.dispatchEvent?.(new Event('tzg-stellar-textures'));});map.colorSpace=T.SRGBColorSpace;textures[kind]=map;}}
 return textures;
}
export function attachStarEffects(parent,radius,color=0xffffff,maps=stellarTextures()){
 const effects={};for(const [kind,size,order,opacity] of [['glow',8,10,.65],['shine',7,11,.8]]){
  const sprite=new T.Sprite(new T.SpriteMaterial({map:maps[kind],color,transparent:true,opacity,blending:T.AdditiveBlending,depthTest:true,depthWrite:false,toneMapped:false,fog:false}));
  sprite.visible=!!maps[kind].image;sprite.name='Star '+kind;sprite.scale.set(radius*size*1.5,radius*size,1);sprite.renderOrder=order;sprite.userData.stellarEffect=kind;parent.add(sprite);effects[kind]=sprite;
 }
 parent.userData.starEffects=effects;return effects;
}
// Camera-local yaw/pitch deltas also work with spherical gravity and rolled cameras.
export class StarCameraMotion{
 constructor(){this.previous=new T.Quaternion();this.current=new T.Quaternion();this.delta=new T.Quaternion();this.turn=new T.Euler(0,0,0,'YXZ');this.angle=0;this.ready=false;}
 update(camera){camera.getWorldQuaternion(this.current);if(this.ready){this.delta.copy(this.previous).invert().multiply(this.current);this.turn.setFromQuaternion(this.delta,'YXZ');this.angle+=SHINE_RESPONSE*(this.turn.y-this.turn.x);}this.previous.copy(this.current);this.ready=true;return this.angle;}

}
export function updateStarEffects(parent,angle){const fx=parent.userData.starEffects;if(fx){fx.glow.visible=!!fx.glow.material.map?.image;fx.shine.visible=!!fx.shine.material.map?.image;fx.glow.material.rotation=0;fx.shine.material.rotation=angle;}}
// Same angle and direction as the existing day/night clock; only sky texture coordinates rotate.
export function earthSkyAngle(hour){return (hour-6)/24*Math.PI*2;}
