import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {bodies,earth} from '../public/catalog.js?v=100';
import {localMoonFamily,bodyLabelAllowed,labelProjection} from '../public/body-labels.js?v=102';
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
const {labelCategory,labelFilterAllows}=await import('../public/body-labels.js');for(const [type,system,key]of [['TERRESTRIAL PLANET','Sol','solar'],['EXOPLANET','Proxima','proxima'],['EXOPLANET','TRAPPIST-1','trappist'],['BLACK HOLE','Beyond','blackholes'],['STAR CLUSTER','Beyond','clusters'],['GALAXY','Beyond','galaxies'],['NEBULA','Beyond','nebulae'],['STAR','Beyond','other']]){const b={name:'Visible Object',type,system};assert.equal(labelCategory(b),key);assert(labelFilterAllows(b,{}));assert(!labelFilterAllows(b,{[key]:false}),'selected and unselected bodies share the same filter');}console.log('PASS shared category filtering includes locked destinations across every settings category.');
const {readFileSync}=await import('node:fs'),{runInNewContext}=await import('node:vm');const gameSource=readFileSync('public/game.js','utf8'),labelCode=gameSource.slice(gameSource.indexOf('function updateObjectLabels()'),gameSource.indexOf('function updateSurvey()'));const locked={id:1,name:'Earth',type:'TERRESTRIAL PLANET',system:'Sol',r:1,pos:new T.Vector3(0,0,-100)};const filters={solar:true},nodes=new Map(),env={T,warpTunnel:{enclosed:false},labelLayer:{append(){}},objectLabels:nodes,localMoonFamily:()=>null,bodies:[locked],flight:{pos:new T.Vector3(),system:'Sol'},explorer:{labels:true},cockpit:false,crew:{onFoot:false},surface:{active:false,skyBodies:[{body:locked,direction:new T.Vector3(0,1,-1).normalize(),radius:1,distance:100}]},bodyLabelAllowed:()=>true,labelFilterAllows,labelFilters:filters,planetLabelsMode:'overlap',camera:new T.PerspectiveCamera(),innerWidth:1000,innerHeight:800,target:locked,destinationOffset:()=>new T.Vector3(0,0,-100),labelProjection:()=>({x:100,y:100}),document:{createElement:()=>({classList:{toggle(){}},style:{},setAttribute(){}})},distanceText:()=>'',destinationLightYears:()=>1};runInNewContext(labelCode+';updateObjectLabels()',env);assert.equal(nodes.get(1).hidden,false);filters.solar=false;runInNewContext('updateObjectLabels()',env);assert.equal(nodes.get(1).hidden,true,'selected space target must hide when its category is disabled');env.surface.active=true;filters.solar=true;runInNewContext('updateObjectLabels()',env);assert.equal(nodes.get(1).hidden,false);filters.solar=false;runInNewContext('updateObjectLabels()',env);assert.equal(nodes.get(1).hidden,true,'selected surface target must hide too');console.log('PASS actual locked-target label rendering obeys filters in space and on surfaces.');
const {parseHTML}=await import('linkedom'),{installDeviceSettings}=await import('../public/device-settings.js');const store=new Map(),storage={getItem:k=>store.get(k)||null,setItem:(k,v)=>store.set(k,v)},firstDoc=parseHTML('<html><body><input type="checkbox" id="labelFilter-solar"></body></html>').document;firstDoc.getElementById('labelFilter-solar').checked=false;installDeviceSettings(firstDoc,storage);const restoredDoc=parseHTML('<html><body><input type="checkbox" id="labelFilter-solar"></body></html>').document;let restoredFilter=true;restoredDoc.getElementById('labelFilter-solar').checked=true;restoredDoc.getElementById('labelFilter-solar').onchange=e=>restoredFilter=e.target.checked;installDeviceSettings(restoredDoc,storage);assert.equal(restoredFilter,false);console.log('PASS category label preferences restore through the device settings handler, including guest sessions.');
