import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {ShipCameraModes} from '../public/ship-camera-modes.js';
import {starVisualRadius} from '../public/star-size.js';
import {bodies} from '../public/catalog.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z),q=new T.Quaternion(),m=new ShipCameraModes();
let last=m.up.clone();for(let i=0;i<600;i++){const up=V(Math.sin(i*.01),Math.cos(i*.01),0);m.align(q,up,1/60);assert(last.angleTo(m.up)<.06,'planet transport has no discontinuous flips');last.copy(m.up);assert(Math.abs(q.length()-1)<1e-9)}
for(let i=0;i<500;i++)m.align(q,V(0,-1,0),1/60);assert(m.up.dot(V(0,-1,0))>.999);
const snapshot=bodies.map(b=>[b.r,...b.pos.toArray()]);for(const star of bodies.filter(b=>b.type==='STAR'))assert(starVisualRadius(star,bodies)>=star.r);const sun=bodies.find(b=>b.name==='Sun'),jupiter=bodies.find(b=>b.name==='Jupiter');assert(starVisualRadius(sun,bodies)>jupiter.r*1.5);assert.deepEqual(bodies.map(b=>[b.r,...b.pos.toArray()]),snapshot,'star visuals never change catalog geometry/distances');
console.log('PASS gradual planet-up transport, antipodal alignment, absolute stationary flyby anchors, smooth repeated shots, display-only star sizes and unchanged catalog positions/radii.');
const transition=new ShipCameraModes(),view=new T.PerspectiveCamera(),options={dt:1/60,subject:V(),origin:V(),velocity:V(),forward:V(0,0,-1),context:'space'};view.position.set(0,0,16);transition.apply(view,options);const start=view.position.clone(),startQ=view.quaternion.clone();transition.select('orbit');const goal=V(16,0,0),goalQ=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().lookAt(goal,V(),V(0,1,0)));view.position.copy(goal);view.quaternion.copy(goalQ);transition.apply(view,options);assert(view.position.equals(start),'transition begins at previous view');assert(view.quaternion.angleTo(startQ)<1e-7);for(let i=0;i<40;i++){const prior=view.position.clone();view.position.copy(goal);view.quaternion.copy(goalQ);transition.apply(view,options);assert(view.position.distanceTo(prior)<5,'camera transition avoids a positional snap')}assert(view.position.distanceTo(goal)<1e-7);assert(view.quaternion.angleTo(goalQ)<1e-7);console.log('PASS camera switches interpolate position/orientation and settle at the requested view.');

// At 200c a single render frame moves thousands of space units. Camera switches
// must interpolate the view around the moving subject, never its old world point.
for(const surface of [false,true])for(const hz of [12.5,30,60,144])for(const mode of ['chase','cockpit','orbit']){
 const rig=new ShipCameraModes(),cam=new T.PerspectiveCamera(),ship=V(0,3,0),world=surface?V():V(1e12,2e12,-1e12),velocity=V(320000,0,-500000),offset=V(0,4,16),goal=V(12,3,0);
 const opts={dt:1/hz,subject:ship,origin:world,velocity,forward:V(0,0,-1),context:surface?'surface':'space'};
 cam.position.copy(ship).add(offset);rig.apply(cam,opts);rig.select(mode);
 for(let i=0;i<Math.ceil(hz);i++){
  (surface?ship:world).addScaledVector(velocity,opts.dt);cam.position.copy(ship).add(goal);rig.apply(cam,opts);
  assert(cam.position.distanceTo(ship)<20,`${mode} switch stays with fast ship at ${hz} Hz (${surface?'surface':'space'})`);
 }
 assert(cam.position.clone().sub(ship).distanceTo(goal)<1e-6,'switch settles at requested subject offset');
}
for(const hz of [12.5,30,60,144])for(const speed of [0,5,50,500,10000,599584.916]){
 const rig=new ShipCameraModes(),cam=new T.PerspectiveCamera(),velocity=V(0,0,-speed),options={dt:1/hz,subject:V(),origin:V(1e12,0,0),velocity,forward:V(0,0,-1),context:'space'};rig.select('flyby');rig.apply(cam,options);assert.equal(rig.interval,5);assert(rig.destination.clone().sub(options.origin).dot(options.forward)>100);let elapsed=0,changes=0;
 for(let i=0;i<hz*12;i++){const anchor=rig.anchor.clone(),shot=rig.shotId,wasMoving=rig.repositioning;options.origin.addScaledVector(velocity,options.dt);rig.apply(cam,options);elapsed+=options.dt;
  if(rig.shotId!==shot){assert(elapsed>=5-1e-7,'shots only change on timer');elapsed=0;changes++;assert(rig.destination.clone().sub(options.origin).dot(options.forward)>100)}else if(!wasMoving&&!rig.repositioning&&rig.travelScale===1)assert(rig.anchor.distanceTo(anchor)<.001,'fixed world anchor for slow flybys');
  assert(cam.position.distanceTo(options.subject)<450,'light-speed framing stays close to ship');
  assert.deepEqual(velocity.toArray(),[0,0,-speed]);cam.updateMatrixWorld();const p=options.subject.clone().project(cam);assert(Math.abs(p.x)<1e-6&&Math.abs(p.y)<1e-6);assert(cam.quaternion.toArray().every(Number.isFinite));
 }assert(changes>=2);assert(!('minimumDistance' in rig));assert(!('maximumDistance' in rig));
}
const timed=new ShipCameraModes(),cam=new T.PerspectiveCamera(),args={dt:.1,subject:V(),origin:V(),velocity:V(0,0,-10),forward:V(0,0,-1),context:'space'};timed.interval=2;timed.select('flyby');timed.apply(cam,args);const first=timed.shotId;for(let i=0;i<19;i++)timed.apply(cam,args);assert.equal(timed.shotId,first);timed.apply(cam,args);assert.equal(timed.shotId,first+1);
console.log('PASS 5-second and custom timed cinematic shots, bounded speed-based forward framing, smooth transitions, finite centered tracking through 200c at 12.5/30/60/144Hz and no distance-triggered respawns.');
