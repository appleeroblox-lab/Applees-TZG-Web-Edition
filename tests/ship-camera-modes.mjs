import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {ShipCameraModes} from '../public/ship-camera-modes.js';
import {starVisualRadius} from '../public/star-size.js';
import {bodies} from '../public/catalog.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),q=new T.Quaternion(),m=new ShipCameraModes();
let last=m.up.clone();for(let i=0;i<600;i++){const up=V(Math.sin(i*.01),Math.cos(i*.01),0);m.align(q,up,1/60);assert(last.angleTo(m.up)<.06,'planet transport has no discontinuous flips');last.copy(m.up);assert(Math.abs(q.length()-1)<1e-9)}
for(let i=0;i<500;i++)m.align(q,V(0,-1,0),1/60);assert(m.up.dot(V(0,-1,0))>.999);
const camera=new T.PerspectiveCamera();camera.position.set(20,10,20);m.select('flyby');m.valid=false;m.blend=0;const subject=V(),origin=V(100000,0,0),velocity=V(0,0,-5),args={dt:1/60,subject,origin,velocity,forward:V(0,0,-1),context:'space'};m.apply(camera,args);const anchor=m.anchor.clone();for(let i=0;i<30;i++){origin.z-=.05;m.apply(camera,args);assert(m.anchor.distanceTo(anchor)<1e-7,'world anchor stays fixed while ship flies past')}
origin.z-=300;let frames=0;while(frames++<400){m.apply(camera,args);if(!m.repositioning)break}assert(frames<400,'flyby smoothly completes reposition');assert(m.anchor.distanceTo(anchor)>100);const settled=m.anchor.clone();m.apply(camera,args);assert(m.anchor.distanceTo(settled)<1e-7,'new shot holds stationary');
const snapshot=bodies.map(b=>[b.r,...b.pos.toArray()]);for(const star of bodies.filter(b=>b.type==='STAR'))assert(starVisualRadius(star,bodies)>=star.r);const sun=bodies.find(b=>b.name==='Sun'),jupiter=bodies.find(b=>b.name==='Jupiter');assert(starVisualRadius(sun,bodies)>jupiter.r*1.5);assert.deepEqual(bodies.map(b=>[b.r,...b.pos.toArray()]),snapshot,'star visuals never change catalog geometry/distances');
console.log('PASS gradual planet-up transport, antipodal alignment, absolute stationary flyby anchors, smooth repeated shots, display-only star sizes and unchanged catalog positions/radii.');
