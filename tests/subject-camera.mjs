import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {shipCameraSubject,rotateSubjectOrbit,placeSubjectOrbit,ORBIT_MIN,ORBIT_MAX} from '../public/subject-camera.js';
import {bodies} from '../public/catalog.js?v=100';
import {Flight} from '../public/flight.js?v=100';
import {SurfaceSession} from '../public/surface.js?v=100';
const ship=new T.Group(),model=new T.Group();ship.add(model);const rig={ship,model,subjectCenter:new T.Vector3(0,.2775,-.176)},camera=new T.PerspectiveCamera(60,2,.05,1e6),q=new T.Quaternion(),subject=new T.Vector3();
function centered(){camera.updateMatrixWorld();const p=subject.clone().project(camera);assert(Math.abs(p.x)<1e-7&&Math.abs(p.y)<1e-7,'ship subject stays at screen center');assert(new T.Vector3(0,1,0).applyQuaternion(camera.quaternion).dot(new T.Vector3(0,1,0))>=0,'no upside-down camera')}
for(const standing of [false,true]){ship.position.set(123,10,-350);ship.quaternion.setFromEuler(new T.Euler(.3,.7,-.2));model.rotation.x=standing?Math.PI/2:0;shipCameraSubject(rig,subject);for(const distance of [6,16,55,120]){rotateSubjectOrbit(q,600,-250,2);placeSubjectOrbit(camera,q,subject,distance);centered();assert(Math.abs(camera.position.distanceTo(subject)-distance)<1e-6)}}
const original=ship.quaternion.clone();for(let i=0;i<100;i++)rotateSubjectOrbit(q,170,1000,1);assert(ship.quaternion.equals(original),'orbit never steers ship');placeSubjectOrbit(camera,q,subject,16);centered();
placeSubjectOrbit(camera,q,subject,.01);assert(Math.abs(camera.position.distanceTo(subject)-ORBIT_MIN)<1e-6);placeSubjectOrbit(camera,q,subject,1e6);assert(Math.abs(camera.position.distanceTo(subject)-ORBIT_MAX)<1e-6);
q.setFromEuler(new T.Euler(1.3,.5,1));placeSubjectOrbit(camera,q,subject,10,{groundAt:()=>12});assert(camera.position.y>=12);centered();
const px=bodies.find(b=>b.name==='Planet X'),surface=new SurfaceSession(new Flight(bodies));assert(!px.solid);assert(surface.enter(px,true));assert.equal(surface.phase,'gas');assert.equal(surface.requestLand(),false);assert.equal(surface.requestLaunch(),false);
assert(surface.restore({body:'Planet X',pos:[0,4.78,0],q:[0,0,0,1],phase:'parked',orientation:'forward'},bodies));assert.equal(surface.phase,'gas');assert(surface.pos.length()>104,'legacy landed saves enter clear of gas core');
console.log('PASS: exact ship-center projection across orbit angles/zooms, moving and upright subjects, independent ship controls, pitch limits/no roll, zoom bounds, ground clearance and non-landable Planet X gas interior.');

for(const name of ['Proxima b','Proxima d']){const b=bodies.find(b=>b.name===name);assert(b.solid);assert(surface.enter(b,true));assert(surface.onGround);assert(surface.requestLaunch())}
const pc=bodies.find(b=>b.name==='Proxima c');assert.equal(pc.type,'GAS GIANT');assert(!pc.solid);assert(surface.enter(pc,true));assert.equal(surface.phase,'gas');assert.equal(surface.requestLand(),false);assert.equal(surface.requestLaunch(),false);assert(surface.restore({body:pc.id,pos:[0,5,0],q:[0,0,0,1],phase:'parked'},bodies));assert.equal(surface.phase,'gas');assert(surface.pos.length()>104);
console.log('PASS: Proxima b/d solid landings and launches, Proxima c gas entry with no landing and safe migration of old landed saves.');
