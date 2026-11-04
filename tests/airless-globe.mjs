import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {bodies} from '../public/catalog.js';
import {Flight} from '../public/flight.js';
import {SurfaceSession} from '../public/surface.js';
import {hasAtmosphere,hasGlobeMode,globeHeight,entryEffects,surfaceExitRadius} from '../public/atmospheric-flight.js';
import {PlanetTransition} from '../public/planet-transition.js';
import {ambienceFor} from '../public/sound.js';
import {NeonLights} from '../public/neon-lights.js';
import {NightAurora} from '../public/night-aurora.js';
import {SYSTEM_ORDER,systemUnlocked,systemUnlockQuote} from '../public/system-unlocks.js';

assert.deepEqual(new Set(SYSTEM_ORDER),new Set([...new Set(bodies.map(b=>b.system))].filter(s=>s!=='Sol')));
assert(!systemUnlocked('TRAPPIST-1',['TRAPPIST-1']));assert(systemUnlocked('TRAPPIST-1',['Proxima','TRAPPIST-1']));
assert.equal(systemUnlockQuote('Proxima').fp,1000);assert.equal(systemUnlockQuote('Blackholes').fp,10000);
const airless=bodies.filter(b=>hasGlobeMode(b)&&!hasAtmosphere(b));assert(airless.length>30);
for(const body of airless){
 const f=new Flight(bodies),s=new SurfaceSession(f);s.enter(body);assert.equal(s.exitHeight,4500,body.name);assert.equal(globeHeight(body),2000);
 assert(s.altitude>4400,'incoming airless flight starts in the globe, like atmospheric entry');
 body.mesh=new T.Mesh(new T.SphereGeometry(body.r,12,8),new T.MeshStandardMaterial({color:body.color}));
 const scene=new T.Scene(),rig={ship:new T.Group()},ground=new T.Group();scene.add(ground,rig.ship);
 const view={scene,session:s,celestial:{bodies,group:new T.Group()},sun:new T.DirectionalLight()},tr=new PlanetTransition(view);s.planetView=tr;
 s.pos.y=s.floor+1999;for(let i=0;i<60;i++)tr.update(rig,1/60);assert.equal(tr.cover.mode,'ground');
 s.pos.y=s.floor+2000;for(let i=0;i<60;i++)tr.update(rig,1/60);assert.equal(tr.cover.mode,'orbit');assert(tr.globe.visible);assert.equal(tr.limb,null,'airless globe never gets an atmosphere rim');assert.equal(tr.globe.children.length,1);assert(!ground.visible);
 const q=tr.travel.clone();s.pos.x+=100;tr.update(rig,1/60);assert(tr.travel.angleTo(q)>0,'ship motion turns the globe');s.pos.x-=100;tr.update(rig,1/60);assert(tr.travel.angleTo(q)<1e-7);
 for(const vertical of [-50,50]){const fx=entryEffects(body,2500,100,vertical);assert.equal(fx.plasma,0);assert.equal(fx.wind,0);assert.equal(fx.shake,0)}
 assert.equal(ambienceFor(s,f),'reentry');s.pos.y=s.floor+900;assert.equal(ambienceFor(s,f),'spaceDeep');
 s.pos.y=s.floor+4501;s.vel.set(0,50,0);s.step(1/60,{});assert(!s.active);assert(f.pos.distanceTo(body.pos)>=surfaceExitRadius(body)-.001);assert(f.vel.length()>0&&f.vel.length()<.01,'exit retains m/s momentum in space units');tr.reset();assert(ground.visible);
 body.mesh.geometry.dispose();body.mesh.material.dispose();delete body.mesh;
}
for(const body of bodies.filter(b=>b.type==='ASTEROID'))assert(!hasGlobeMode(body));
const scene=new T.Scene(),camera=new T.PerspectiveCamera(),mesh=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({color:'#ff2233',emissive:'#ff2233'}));mesh.userData.neonPart=true;scene.add(mesh);const lights=new NeonLights(scene);lights.update(1,camera);assert(lights.lights.some(l=>l.intensity>0&&l.color.equals(mesh.material.color)));mesh.visible=false;lights.update(1.1,camera);assert(lights.lights.every(l=>l.intensity===0));assert.equal(lights.lights.length,4);
const aurora=new NightAurora(new T.Scene());for(let t=0;t<2;t+=.05)aurora.update(t,{body:{name:'Earth'},pos:new T.Vector3(0,0,0)},{night:1});assert(aurora.group.visible);aurora.update(3,{body:{name:'Earth'},pos:new T.Vector3(15001,0,0)},{night:1});assert(!aurora.group.visible);aurora.update(4,{body:{name:'Earth'},pos:new T.Vector3(),crew:{onFoot:true,pos:new T.Vector3(16000,0,0)}},{night:1});assert(!aurora.group.visible);
console.log('PASS all airless globe bodies: 2000/4500m transitions, ship-driven rotation, momentum, no atmosphere/FX, reentry audio; asteroid exclusion, system coverage, bounded colored neon lights and 15km ship/on-foot aurora cutoff.');
