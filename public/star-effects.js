import {starEffectStyle} from './star-settings.js?v=193';
import * as T from './vendor/three.module.js';
export const STAR_RENDER_SCALE=1.3,BLACK_HOLE_RENDER_SCALE=1.35;
export const SHINE_RESPONSE=.12;
export const STAR_GLOW_SIZE=2.8,STAR_SHINE_SIZE=4,STAR_GLOW_OPACITY=.12,STAR_SHINE_OPACITY=.08;
let textures;
// Supplied RGBA PNGs are shared; additive blending retains alpha and scene depth.
export function stellarTextures(){
 if(!textures){const loader=new T.TextureLoader();textures={};for(const kind of ['glow','shine']){const map=loader.load(new URL('./textures/'+(kind==='glow'?'star-bloom.png':'star-flare.png'),import.meta.url).href,()=>{globalThis.dispatchEvent?.(new Event('tzg-stellar-textures'));});map.colorSpace=T.SRGBColorSpace;textures[kind]=map;}}
 return textures;
}
export function attachStarEffects(parent,radius,color=0xffffff,maps=stellarTextures(),{map=false}={}){
 if(parent.userData.starEffects){const old=parent.userData.starEffects;for(const sprite of Object.values(old)){parent.remove(sprite);sprite.material.dispose();}}
 parent.userData.starEffectRadius=radius;parent.userData.starEffectMap=map;const effects={};for(const [kind,size,order,opacity] of [['glow',STAR_GLOW_SIZE,10,STAR_GLOW_OPACITY],['shine',STAR_SHINE_SIZE,11,STAR_SHINE_OPACITY]]){
  if(map&&kind==='shine')continue;const sprite=new T.Sprite(new T.SpriteMaterial({map:maps[kind],color,transparent:true,opacity,blending:T.AdditiveBlending,depthTest:true,depthWrite:false,toneMapped:false,fog:false}));
  sprite.visible=!!maps[kind].image;sprite.name=kind==='glow'?'Star Bloom':'Star Flare';sprite.scale.set(radius*size,radius*size,1);sprite.renderOrder=order;sprite.userData.stellarEffect=kind;parent.add(sprite);effects[kind]=sprite;
 }
 parent.userData.starEffects=effects;updateStarEffects(parent,0);return effects;
}
// Camera-local yaw/pitch deltas also work with spherical gravity and rolled cameras.
export class StarCameraMotion{
 constructor(){this.previous=new T.Quaternion();this.current=new T.Quaternion();this.delta=new T.Quaternion();this.turn=new T.Euler(0,0,0,'YXZ');this.angle=0;this.ready=false;}
 update(camera){camera.getWorldQuaternion(this.current);if(this.ready){this.delta.copy(this.previous).invert().multiply(this.current);this.turn.setFromQuaternion(this.delta,'YXZ');this.angle+=SHINE_RESPONSE*(this.turn.y-this.turn.x);}this.previous.copy(this.current);this.ready=true;return this.angle;}

}
export function updateStarEffects(parent,angle){const fx=parent.userData.starEffects;if(!fx)return;const style=starEffectStyle(parent.userData.starEffectRadius,parent.userData.starEffectMap);fx.glow.visible=!!fx.glow.material.map?.image&&style.bloomSize>0;fx.glow.scale.set(style.bloomSize,style.bloomSize,1);fx.glow.material.opacity=style.bloomOpacity;fx.glow.material.rotation=0;if(fx.shine){fx.shine.visible=!!fx.shine.material.map?.image&&style.flareSize>0;fx.shine.scale.set(style.flareSize,style.flareSize,1);fx.shine.material.opacity=style.flareOpacity;fx.shine.material.rotation=angle;}}
// Same angle and direction as the existing day/night clock; only sky texture coordinates rotate.
export function earthSkyAngle(hour){return (hour-6)/24*Math.PI*2;}

// Canvas renderers use exactly the same pair, tint, rotation and size ratio as WebGL.
const canvasTints=new Map();
export function drawStarEffects(ctx,x,y,radius,angle,color=0xffffff,{shine=true,opacity=1,maps=stellarTextures(),map=false}={}){
 const tint=color?.isColor?color:new T.Color(color),key=tint.getHexString(),style=starEffectStyle(radius,map);
 for(const [kind,size,alpha] of [['glow',style.bloomSize,style.bloomOpacity],['shine',style.flareSize,style.flareOpacity]]){
  if(size<=0||kind==='shine'&&(!shine||map))continue;const source=maps[kind].image;if(!source?.width)continue;
  const cacheKey=kind+key;let image=canvasTints.get(cacheKey);
  if(!image){image=document.createElement('canvas');image.width=Math.min(384,source.width);image.height=Math.max(1,Math.round(source.height*image.width/source.width));const paint=image.getContext('2d');paint.drawImage(source,0,0,image.width,image.height);paint.globalCompositeOperation='multiply';paint.fillStyle=tint.getStyle();paint.fillRect(0,0,image.width,image.height);paint.globalCompositeOperation='destination-in';paint.drawImage(source,0,0,image.width,image.height);canvasTints.set(cacheKey,image);if(canvasTints.size>32)canvasTints.delete(canvasTints.keys().next().value);}
  ctx.save();ctx.translate(x,y);if(kind==='shine')ctx.rotate(-angle);ctx.globalCompositeOperation='screen';ctx.globalAlpha=alpha*opacity;ctx.drawImage(image,-size*.5,-size*.5,size,size);ctx.restore();
 }
}
