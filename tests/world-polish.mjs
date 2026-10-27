import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {bodies,earth} from '../public/catalog.js';
import {Flight,V} from '../public/flight.js';
import {SurfaceSession} from '../public/surface.js';
import {SurfaceCollisions} from '../public/surface-collision.js';
import {applyShipBlast} from '../public/ship-respawn.js';
import {Economy} from '../public/economy.js';
import {settlementSites,settlementBlocks} from '../public/settlements.js';
import {heldResourcePose} from '../public/prospecting.js';
import {GameSound} from '../public/sound.js';
import {audioFixture,flushAudio} from './audio-fakes.mjs';

const economy=new Economy(bodies),sites=settlementSites(earth),near=sites.find(s=>s.nearPad);
assert(near&&Math.hypot(near.x,near.z)<150,'a complete village is within a short walk of the launch pad');
assert(economy.discoverVillages(earth,V(),1),'mobile startup streams the nearby village');
assert.equal(economy.placements.filter(p=>p.type==='door').length,6);
const removed=economy.placements.find(p=>p.type==='wood-planks');economy.add('shovel',1);economy.equipped='Earth|shovel';assert(economy.reclaim(removed.id,true));
const restored=new Economy(bodies,economy.serialize());restored.discoverVillages(earth,V(),1);assert(!restored.placements.some(p=>p.id===removed.id));
assert(settlementBlocks(earth,near).every(p=>p.x>=-144&&p.x<=144&&p.z>=-144&&p.z<=144),'village fits the minimum streamed terrain around spawn');

const f=new Flight(bodies),surface=new SurfaceSession(f);surface.enter(earth,true);surface.shipRig={contactHeight:4.23};surface.building={economy:new Economy(bodies)};const collisions=new SurfaceCollisions(surface);
assert(collisions.blockedCrew(-32,-15,10),'solid tower shaft');
assert(!collisions.blockedCrew(-28,-15,10),'empty space alongside the narrower shaft stays open');
assert(collisions.blockedCrew(-28,-15,4),'actual tower platform collides');
assert(collisions.blockedCrew(-12,-15,39),'tower arm collides');
surface.stream={collisionRevision:1,chunks:new Map([['tree',{userData:{scenery:{visible:true,userData:{colliders:[{min:{x:299,y:0,z:-1},max:{x:301,y:10,z:1},kind:'terrain decoration'}]}}}}]])};
surface.phase='flying';surface.pos.set(300,9,0);surface.vel.set(0,-30,0);assert.equal(collisions.moveShip(V(300,30,0)).type,'obstacleContact','a treetop triggers recovery instead of parking on a tree');
surface.pos.set(-32,25,-15);surface.phase='flying';assert(surface.requestLand(true));
const target=surface.landingTarget.clone();assert(target.distanceTo(surface.pos)>5);
for(let i=0;i<2400&&surface.phase!=='parked';i++)surface.step(1/60);
assert.equal(surface.phase,'parked');assert(Math.hypot(surface.pos.x-target.x,surface.pos.z-target.z)<.01);surface.shipRig=null;assert(!collisions.blockedCrew(surface.pos.x,surface.pos.z,surface.pos.y));surface.shipRig={contactHeight:4.23};

surface.crew={onFoot:true,pos:V(110,0,30)};surface.pos.set(100,8,30);surface.phase='flying';const player=surface.crew.pos.clone();
assert(!applyShipBlast(surface,{body:'Moon',pos:surface.pos.clone(),radius:6}));
assert(!applyShipBlast(surface,{body:'Earth',pos:surface.pos.clone().add(V(20,0,0)),radius:6}));
assert(applyShipBlast(surface,{body:'Earth',pos:surface.pos.clone(),radius:6}));
assert.equal(surface.phase,'parked');assert.equal(surface.pos.x,0);assert.equal(surface.pos.z,0);assert(surface.onGround);assert(surface.crew.pos.equals(player));assert(surface.crew.onFoot);
assert(!applyShipBlast(surface,{body:'Earth',pos:surface.pos.clone(),radius:6}),'chain blasts cannot repeatedly destroy the replacement immediately');
surface.step(3);surface.crew.onFoot=false;surface.pos.set(100,8,30);assert(applyShipBlast(surface,{body:'Earth',pos:surface.pos.clone(),radius:6}));assert(!surface.crew.onFoot,'aboard player stays aboard after replacement');

const charge=new Economy(bodies);charge.add('torch',1);charge.equipped='Earth|torch';charge.placements=[{id:'fuse',body:'Earth',type:'tnt',x:300,y:1,z:0}];let elapsed=0,ticks=[];charge.onFuseTick=()=>ticks.push(elapsed);assert(charge.igniteTNT('fuse',earth,V(300,1,1),true));
for(let i=0;i<240;i++){elapsed=(i+1)/60;charge.tick(1/60)}
assert.equal(ticks.length,4);for(let i=0;i<4;i++)assert(Math.abs(ticks[i]-i)<.02,'one beep at ignition and each second before detonation');assert.equal(charge.placements.length,0);

const camera=new T.PerspectiveCamera();camera.position.set(17,4,-11);
for(const angle of [0,.6,1.5,Math.PI]){camera.quaternion.setFromEuler(new T.Euler(.2,angle,.1));const pose=heldResourcePose(camera),local=pose.position.clone().sub(camera.position).applyQuaternion(camera.quaternion.clone().invert());assert(local.distanceTo(V(.42,-.34,-.9))<1e-10);const relative=camera.quaternion.clone().invert().multiply(pose.quaternion);assert(relative.angleTo(new T.Quaternion().setFromEuler(new T.Euler(.06,.3,-.1)))<1e-7)}

const fixture=audioFixture();const sound=new GameSound();sound.unlock();sound.play('uiOpen');sound.play('ui');sound.play('uiClose');await flushAudio();assert.equal(fixture.sources.length,1,'one UI action cannot layer open/close and generic clicks');
sound.last.set('interface',Date.now()-200);sound.play('ui');await flushAudio();assert.equal(fixture.sources.length,2,'a later click still plays');
sound.play('tntFuse');await flushAudio();assert(fixture.fetched.some(p=>p.endsWith('countdown.ogg')));assert(!fixture.fetched.some(p=>p.endsWith('tnt-fuse.wav')));fixture.restore();
console.log('PASS world polish: visible persisted village, precise tower parts, emergency landing, local ship blast/respawn with chain guard, timed fuse beeps, camera-relative resource pose and one UI sound per action.');
