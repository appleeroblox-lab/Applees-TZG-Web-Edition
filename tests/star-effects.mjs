import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {StarCameraMotion,attachStarEffects,updateStarEffects,earthSkyAngle,STAR_RENDER_SCALE} from '../public/star-effects.js';
import {collisionRadius,starVisualRadius} from '../public/star-size.js';
import {ambienceFor} from '../public/sound.js';
import {atlasBodyRadius} from '../public/atlas-renderer.js';
const camera=new T.PerspectiveCamera(),motion=new StarCameraMotion(),deg=Math.PI/180;
assert.equal(motion.update(camera),0);
camera.rotation.y=10*deg;assert(Math.abs(motion.update(camera)-1.2*deg)<1e-10,'left drag turns shine left at 12%');
assert.equal(motion.update(camera),motion.angle,'stationary camera retains accumulated rotation');
camera.rotation.y=0;assert(Math.abs(motion.update(camera))<1e-10);
camera.rotation.x=10*deg;assert(Math.abs(motion.update(camera)+1.2*deg)<1e-10,'up drag turns shine right');
camera.rotation.x=0;assert(Math.abs(motion.update(camera))<1e-10);
camera.rotation.y=179*deg;motion.update(camera);const before=motion.angle;camera.rotation.y=-179*deg;assert(Math.abs(motion.update(camera)-before-.24*deg)<1e-10,'yaw seam uses short delta');
const rolled=new T.PerspectiveCamera(),localMotion=new StarCameraMotion();rolled.rotation.z=Math.PI/2;localMotion.update(rolled);rolled.rotateX(10*deg);assert(Math.abs(localMotion.update(rolled)+1.2*deg)<1e-10,'up drag remains right rotation on a rolled planet camera');
const parent=new T.Group(),maps={glow:new T.Texture(),shine:new T.Texture()},fx=attachStarEffects(parent,10,0xffffff,maps);
assert(fx.glow.isSprite&&fx.shine.isSprite);assert(fx.shine.renderOrder>fx.glow.renderOrder);
for(const sprite of Object.values(fx)){assert.equal(sprite.material.depthTest,true);assert.equal(sprite.material.depthWrite,false);assert.equal(sprite.scale.x/sprite.scale.y,1.5);assert.equal(sprite.position.length(),0);}
assert.equal(fx.glow.visible,false,'avoid an untextured flash before image load');maps.glow.image={width:768,height:512};maps.shine.image={width:768,height:512};updateStarEffects(parent,.7);assert.equal(fx.glow.visible,true);assert.equal(fx.shine.material.rotation,.7);assert.equal(fx.glow.material.rotation,0);
const star={type:'STAR',system:'Sol',r:10,pos:new T.Vector3()},base=starVisualRadius(star,[star]);star.mesh={userData:{visualRadius:base,renderRadius:base*STAR_RENDER_SCALE}};assert.equal(collisionRadius(star,[star]),base);assert(star.mesh.userData.renderRadius>base);assert(atlasBodyRadius(star)>55);assert(atlasBodyRadius({type:'BLACK HOLE'})>12);
const bh={type:'BLACK HOLE',system:'BH',r:10,pos:new T.Vector3()},flight={system:'BH',active:[bh],pos:new T.Vector3(1e12,0,0)};
assert.equal(ambienceFor({active:false},flight),'hazard');assert.equal(ambienceFor({active:true,body:{name:'Earth'}},flight),'hazard');flight.system='Sol';flight.active=[star];assert.equal(ambienceFor({active:false},flight),'space');
assert(Math.abs(Math.sin(earthSkyAngle(24))-Math.sin(earthSkyAngle(0)))<1e-10);assert(earthSkyAngle(13)>earthSkyAngle(12));
for(const asset of ['stellar-glow.webp','stellar-shine.webp']){const bytes=fs.readFileSync(new URL('../public/textures/'+asset,import.meta.url));assert.equal(bytes.toString('ascii',0,4),'RIFF');assert(bytes.length<150000,'bounded mobile texture');}
console.log('PASS stellar camera motion, depth-tested shared billboards, visual-only sizes, black-hole system ambience and seamless Earth sky angle.');
