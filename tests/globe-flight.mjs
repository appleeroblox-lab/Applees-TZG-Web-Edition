import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {bodies} from '../public/catalog.js';
import {atmosphereProfile} from '../public/atmosphere-profiles.js';
import {hasAtmosphere,canLandHere,advanceLocalDay,surfaceExitRadius} from '../public/atmospheric-flight.js';
import {atmosphere,SurfaceSession} from '../public/surface.js';
import {cloudPosition} from '../public/atmosphere-effects.js';
import {atmosphereFogRange,updateSurfaceAir,getAirUniforms} from '../public/spherical-atmosphere.js';
import {PlanetTransition} from '../public/planet-transition.js';
import {ShipFlightEffects} from '../public/ship-flight-effects.js';
import {Flight} from '../public/flight.js';
const earth=bodies.find(b=>b.name==='Earth'),mars=bodies.find(b=>b.name==='Mars');
for(const body of [earth,mars,...bodies.filter(b=>b.name==='Io'||/^TRAPPIST-1 [efg]$/.test(b.name)||b.solid&&b.fictional)]){assert(hasAtmosphere(body),body.name);assert.deepEqual(atmosphere(body),atmosphereProfile(body).air);assert(cloudPosition(body,0,5).distanceTo(cloudPosition(body,0,0))>50);}
for(const name of ['Moon','Mercury','TRAPPIST-1 b'])assert(!hasAtmosphere(bodies.find(b=>b.name===name)));
assert.notEqual(atmosphereProfile(mars).rim,atmosphereProfile(earth).rim);
for(const h of [1500,2500,3900]){const fog=atmosphereFogRange(h);assert(fog.far<h-350,'terrain and lower clouds are completely behind the fog veil');assert(fog.near<fog.far);}
for(const body of [earth,mars,bodies.find(b=>b.name==='Io')]){
 const f=new Flight(bodies),s=new SurfaceSession(f);s.enter(body,true);s.phase='flying';s.pos.y=s.floor+799;assert(canLandHere(s));s.pos.y=s.floor+800;assert(!canLandHere(s));s.pos.y=s.floor+4500;
 body.mesh=new T.Mesh(new T.SphereGeometry(body.r),new T.MeshStandardMaterial({map:new T.Texture()}));const original=body.mesh.quaternion.clone(),originalMat=body.mesh.material,view={session:s,scene:new T.Scene(),celestial:{group:new T.Group(),bodies},sun:new T.DirectionalLight()};view.scene.add(view.celestial.group);const tr=view.transition=new PlanetTransition(view),ship=new T.Group();view.scene.add(ship);
 for(let i=0;i<60;i++)tr.update({ship},1/60);assert.equal(tr.cover.mode,'orbit');assert(!advanceLocalDay(s,tr));assert.equal(tr.surface.material.map,originalMat.map);assert.equal(tr.surface.material.fog,false);updateSurfaceAir(view);assert.equal(getAirUniforms(tr.surface.material),undefined);assert(tr.limb.material.uniforms.limbTint.value.equals(new T.Color(atmosphereProfile(body).rim)));assert(tr.limb.material.fragmentShader.includes('discard'),'rim cannot overlay the textured disk');assert.equal(tr.globe.children.length,2,'no blurry full-disk cloud shells');
 const q=tr.globe.quaternion.clone();s.pos.x+=100;tr.update({ship},1);assert(tr.globe.quaternion.angleTo(q)>0);const moved=tr.globe.quaternion.clone();tr.update({ship},1);assert(tr.globe.quaternion.angleTo(moved)<1e-7,'stationary ship never turns the globe');s.pos.x-=100;tr.update({ship},1);assert(tr.globe.quaternion.angleTo(q)<1e-7,'reverse flight reverses surface travel');assert(body.mesh.quaternion.equals(original));assert.equal(body.mesh.material,originalMat);
 s.pos.y=s.floor+5001;s.vel.set(0,50,0);s.step(1/60,{});assert(!s.active);assert(f.pos.distanceTo(body.pos)>=surfaceExitRadius(body)-.001);assert(f.pos.distanceTo(body.pos)-body.r>=19.99);assert(!advanceLocalDay(s,tr));tr.reset();
}
for(const name of ['Moon','Jupiter']){const b=bodies.find(b=>b.name===name),f=new Flight(bodies),s=new SurfaceSession(f);s.enter(b);if(b.solid){s.pos.y=s.floor+s.exitHeight+1;s.vel.set(0,50,0)}else{s.pos.set(0,s.exitDistance+1,0);s.vel.set(0,50,0)}s.step(1/60,{});assert(!s.active);assert(f.pos.distanceTo(b.pos)-b.r>=19.99)}
const f=new Flight(bodies),s=new SurfaceSession(f);s.enter(earth,true);assert(advanceLocalDay(s,{cover:{mode:'ground'}}));s.pos.y=s.floor+4500;assert(!advanceLocalDay(s,{cover:{mode:'ground'}}));
const rig={ship:new T.Group(),model:new T.Group()},fx=new ShipFlightEffects(rig,new T.Scene()),flight={vel:new T.Vector3(0,0,-100000),pos:new T.Vector3(1e10,0,1e10),q:new T.Quaternion()},surface={active:false,vel:new T.Vector3()},crew={onFoot:false},camera=new T.PerspectiveCamera();
for(let i=0;i<15;i++){flight.pos.addScaledVector(flight.vel,1/30);fx.update(1/30,i/30,{flight,surface,crew,camera,quality:'Ultra+'});assert(fx.geometry.drawRange.count<=4,'high-speed trail clips once per wing instead of bunching old endpoints');const a=fx.geometry.attributes.alpha,p=fx.geometry.attributes.position;for(let j=1;j<fx.geometry.drawRange.count;j+=2){assert.equal(a.getX(j),0);const end=new T.Vector3().fromBufferAttribute(p,j),start=new T.Vector3().fromBufferAttribute(p,j-1);assert(Math.abs(start.distanceTo(end)-65)<.01);assert(start.distanceTo(fx.tips[(j-1)/2])<.01)}}
console.log('PASS per-body and new atmosphere palettes, opaque lower fog, unwashed globe textures, silhouette-only limb, reversible ship-driven globe motion, paused orbital clock, landing visibility eligibility, safe space exit and bounded high-speed trail tails.');
