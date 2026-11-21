import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {CLIENT_VERSION,semanticVersion,installRuntimeVersions} from '../public/runtime-versions.js';
import {HomeExperiment} from '../public/home-experiment.js';
import {mixCameraInput} from '../public/device-gyro.js';
import {TerrainClouds} from '../public/terrain-clouds.js';
import * as T from '../public/vendor/three.module.js';
assert.equal(semanticVersion(242),'v0.0.242');assert.equal(semanticVersion('0.1.2'),'v0.1.2');assert.equal(semanticVersion('bad'),null);
const {document}=parseHTML('<html><body><div class="entryRelease"></div></body></html>');let requests=0;
const tracker=installRuntimeVersions(document,async url=>{requests++;assert(url.endsWith('/rpc/tzg_backend_version'));return {ok:true,json:async()=>({version:'v0.0.1'})}});await tracker.ready;
assert(document.querySelector('.entryRelease').textContent.includes('Client Version: '+CLIENT_VERSION));assert(document.querySelector('.entryRelease').textContent.includes('Backend Version: v0.0.1'));
const label=document.createElement('small');label.id='runtimeVersions';document.body.append(label);installRuntimeVersions(document);assert.equal(requests,1,'reuse the backend result instead of polling each frame');assert(label.textContent.includes('v0.0.1'));
const offline=parseHTML('<html><body><div class="entryRelease"></div></body></html>').document;await installRuntimeVersions(offline,async()=>{throw Error('offline')}).ready;assert(offline.querySelector('.entryRelease').textContent.endsWith('Backend Version: —'),'never invent a backend version from the client build');
assert.deepEqual(mixCameraInput({roll:.2,pitch:.3},{x:.4,y:-.1}),{roll:.6000000000000001,pitch:.19999999999999998});assert.deepEqual(mixCameraInput({roll:1,pitch:-1},{x:1,y:-1}),{roll:1,pitch:-1});assert.deepEqual(mixCameraInput(null,null),{roll:0,pitch:0});
let keyReads=0;class Chunks extends Map{keys(){keyReads++;return super.keys()}}const chunks=new Chunks();for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)chunks.set(x+','+z,{});
const clouds=new TerrainClouds(Array.from({length:4},()=>new T.Mesh(new T.SphereGeometry(),new T.MeshBasicMaterial())),{body:{id:'Earth',name:'Earth'},altitude:0});
for(let i=0;i<60;i++)clouds.sync(chunks,new T.Vector3(1,0,1),i/60,4);assert.equal(keyReads,1,'reuse cloud ownership throughout stationary frames');clouds.sync(chunks,new T.Vector3(100,0,1),2,4);assert.equal(keyReads,2,'refresh ownership after travelling');
console.log('PASS independent versions, offline reporting, cached metadata, sensor/finger blending and retained cloud ownership across 60 frames');

const preview=new T.Group();
preview.add(new T.Mesh(new T.SphereGeometry(.7,16,12),new T.MeshBasicMaterial()));
const camera=new T.PerspectiveCamera(50,2,.1,100);
camera.position.z=5;
const home=Object.assign(Object.create(HomeExperiment.prototype),{
 active:true,camera,preview:{group:preview},host:{getBoundingClientRect:()=>({left:10,top:20,width:400,height:200})}
});
assert.equal(home.hitsCharacter(210,120),true,'a drag may start on the projected character');
assert.equal(home.hitsCharacter(360,120),false,'the background cannot start character rotation');
