import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import * as T from '../public/vendor/three.module.js';
import {entryPlaneSize,ENTRY_MAX_ANGLE} from '../public/entry-backdrop.js';
import {DeviceGyro,installGyroControls} from '../public/device-gyro.js';
import {accountGate} from '../public/account-gate.js';
import {AccountAuthFlow} from '../public/account-auth-flow.js';
import {acceptRules} from './rules-helper.mjs';
// No corner ray can miss the background decal at any permitted camera angle.
for(const aspect of [.35,.56,1,1.78,2.4,4,8]){
 const camera=new T.PerspectiveCamera(45,aspect,.1,20);camera.position.z=5;
 const size=entryPlaneSize(camera);
 for(const px of [-1,-.5,0,.5,1])for(const py of [-1,-.5,0,.5,1]){
  camera.rotation.set(px*ENTRY_MAX_ANGLE,py*ENTRY_MAX_ANGLE,0,'YXZ');camera.updateMatrixWorld();
  for(const u of [-1,1])for(const v of [-1,1]){const ray=new T.Vector3(u,v,.5).unproject(camera).sub(camera.position).normalize(),t=-5/ray.z;assert(Math.abs(ray.x*t)<size.width/2);assert(Math.abs(ray.y*t)<size.height/2)}
 }
}
const {document,window}=parseHTML('<html><body><div id="boot" class="hidden"><h1 class="bootTitle">Loading</h1><div class="bootProgressRow"><div id="sourceProgress"></div><b id="sourcePercent"></b></div><p id="bootStatus"></p><p id="sourceDetail"></p><button id="launchBtn"></button></div><button id="tiltEnable"></button><button id="tiltCalibrate"></button></body></html>');
Object.assign(globalThis,{window,document,location:{origin:'https://game.test',pathname:'/'}});
const storage=new Map([['tzg-rules-accepted','2026-11-13']]);window.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
const root=accountGate(document),create=()=>new AccountAuthFlow({root,client:()=>({}),onSuccess(){}});let flow=create();
assert(!document.getElementById('accountRulesAccepted').checked,'old preaccepted consent is not reused');
document.getElementById('accountRulesAccepted').checked=true;document.getElementById('accountRulesAccepted').onchange();assert(!root.rulesAllowed(),'checkbox alone cannot bypass Scroll and Accept');
acceptRules(document);assert(root.rulesAllowed());
for(let i=0;i<3;i++){flow=create();assert.equal(root.querySelectorAll('.birthdaySelects button').length,3,'one Month, Day and Year after every remount');assert(root.rulesAllowed(),'verified consent survives reuse');}
root.hidden=false;root.dataset.entry='form';const presentation=flow.presentation;let loads=0;
for(let i=0;i<2;i++){await presentation.load(async update=>{loads++;assert(root.hidden);assert(!document.getElementById('boot').classList.contains('hidden'));assert.equal(document.getElementById('sourcePercent').textContent,'Preparing · 0%');update(65);assert.equal(document.getElementById('sourceProgress').style.width,'65%')});assert(!root.hidden);assert(document.getElementById('boot').classList.contains('hidden'));assert.equal(document.getElementById('sourcePercent').textContent,'Ready · 100%')}
assert.equal(loads,2);await assert.rejects(presentation.load(async()=>{throw Error('Connection failed')}));assert(!root.hidden);assert(document.getElementById('boot').classList.contains('hidden'),'failed login releases loading overlay');
// Sensor permission, finite samples, screen rotation and stale-data neutral input.
let handler,permission='denied';const fake={DeviceOrientationEvent:{requestPermission:async()=>permission},screen:{orientation:{angle:0}},addEventListener:(name,fn)=>handler=fn};const sensor=new DeviceGyro(fake);assert(!await sensor.request());permission='granted';assert(await sensor.request());handler({beta:null,gamma:null});assert.equal(sensor.sample,null);handler({beta:0,gamma:0});const origin=sensor.sample;handler({beta:25,gamma:-25});assert.equal(sensor.axes(origin).pitch,1);assert(sensor.axes(origin).roll<-.8);fake.screen.orientation.angle=90;const axes=sensor.axes(origin);assert(axes.pitch<-.8);assert(Math.abs(axes.roll+1)<1e-6);sensor.sample.time-=1000;assert.deepEqual(sensor.axes(origin),{pitch:0,roll:0});
const control=installGyroControls({doc:document,win:window,mobile:true});assert(document.getElementById('gyroControls').disabled);assert.match(document.getElementById('gyroStatus').textContent,/This device does not support Gyro Controls/);assert.deepEqual(control.axes(),{pitch:0,roll:0});
const html=fs.readFileSync('public/index.html','utf8');const {document:entry}=parseHTML(html);assert(entry.getElementById('sourcePercent').closest('.bootProgressTrack'),'percentage is inside the progress track');
console.log('PASS decal edge coverage at 7 aspect ratios, consent scroll enforcement, repeated birthday remounts, every-login loading/recovery, orientation permissions/calibration/stale samples and unsupported-device feedback.');
