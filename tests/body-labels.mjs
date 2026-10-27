import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {bodies,earth} from '../public/catalog.js?v=99';
import {localMoonFamily,bodyLabelAllowed,labelProjection} from '../public/body-labels.js?v=99';
const jupiter=bodies.find(b=>b.id==='Jupiter'),moon=bodies.find(b=>b.id==='Moon'),io=bodies.find(b=>b.id==='Io');
for(const parent of [earth,jupiter]){
 const family=localMoonFamily(bodies,parent.pos,parent.system);
 assert.equal(family,parent.name);
 const labels=bodies.filter(b=>b.type==='MOON'&&bodyLabelAllowed(b,parent.system,family));
 assert(labels.length>0);
 assert(labels.every(b=>b.parent===parent.name),'other planets moons are hidden');
 for(const child of labels)assert.equal(localMoonFamily(bodies,child.pos,parent.system),parent.name,'moon orbit remains in family');
}
assert.equal(moon.parent,'Earth');assert(bodyLabelAllowed(moon,'Sol','Earth'));assert(!bodyLabelAllowed(io,'Sol','Earth'));
assert(!bodyLabelAllowed(moon,'Proxima','Earth'),'other stellar systems hidden');
assert.equal(localMoonFamily(bodies,new T.Vector3(1e9,0,1e9),'Sol'),null);
assert(!bodyLabelAllowed(moon,'Sol',null),'no moon labels in deep space');
const camera=new T.PerspectiveCamera(60,2,.01,1e9),body=new T.Vector3(0,0,-100);
camera.updateMatrixWorld();assert.deepEqual(labelProjection(body,camera,1000,500),{x:500,y:250});
camera.position.x=8;camera.updateMatrixWorld();const moved=labelProjection(body,camera,1000,500);assert(moved.x<500,'camera movement is reflected immediately');
camera.rotation.y=.1;camera.updateMatrixWorld();assert.notEqual(labelProjection(body,camera,1000,500).x,moved.x,'rotation follows same frame');
assert.equal(labelProjection(new T.Vector3(0,0,100),camera,1000,500),null);
assert.equal(labelProjection(new T.Vector3(NaN,0,-100),camera,1000,500),null);
assert.equal(labelProjection(new T.Vector3(10000,0,-100),camera,1000,500),null);
console.log('PASS: Earth/Jupiter moon families, moon-orbit proximity, deep-space and cross-system filtering, centered projection and immediate camera movement/rotation.');
