import {entryBackdropHost} from '../public/entry-backdrop.js';
import {accountGate} from '../public/account-gate.js';
import {installEntryPresentation} from '../public/entry-presentation.js';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import {DeviceGyro,GyroSmoother,installGyroControls} from '../public/device-gyro.js';
import {installSettingsAppearance} from '../public/settings-appearance.js';
const {document,window}=parseHTML(fs.readFileSync('public/index.html','utf8'));
Object.assign(globalThis,{document,window});
installGyroControls({doc:document,win:window,mobile:true});
installSettingsAppearance(document,{});
document.getElementById('settingsTab-controls').click();
const toggle=document.getElementById('gyroControls'),section=toggle.closest('.settingsSection');
assert(section);assert.equal(section.dataset.pages,'controls');assert(!section.hidden);assert(!toggle.checked,'Gyro defaults OFF');assert.equal(toggle.closest('label').textContent,'Gyro Controls');assert(section.contains(document.getElementById('gyroStatus')));
const sensor=new DeviceGyro({addEventListener(){},DeviceOrientationEvent:{},screen:{orientation:{angle:0}}});
const origin={beta:0,gamma:0,time:Date.now()};
const a=sensor.axes(origin,{beta:120,gamma:30,time:Date.now()}),b=sensor.axes(origin,{beta:60,gamma:-150,time:Date.now()});
assert(Math.abs(a.pitch-b.pitch)<1e-8);assert(Math.abs(a.roll-b.roll)<1e-8,'equivalent Euler readings cannot flip steering');
const filter=new GyroSmoother();let value=filter.step({pitch:1,roll:-1},0);assert(value.pitch<.05);
for(let time=16;time<1000;time+=16){const before=value;value=filter.step({pitch:time<500?1:-1,roll:0},time);assert(Math.abs(value.pitch-before.pitch)<=.041,'fast reversals are rate limited');assert(Math.abs(value.pitch)<=1)}
filter.reset();assert.deepEqual(filter.value,{pitch:0,roll:0});
const css=fs.readFileSync('public/entry-menu.css','utf8');assert.match(css,/top:50%!important;transform:translate\(-50%,-50%\)!important/);
console.log('PASS Controls-tab toggle placement/default OFF, equivalent-orientation continuity, fast-reversal rate limit and loading-stack centering.');

const gate=accountGate(document),boot=document.getElementById('boot');gate.hidden=false;assert.equal(entryBackdropHost(gate,boot),gate);gate.hidden=true;document.body.classList.add('authenticatedBoot');boot.classList.remove('hidden');assert.equal(entryBackdropHost(gate,boot),boot);boot.classList.add('hidden');assert.equal(entryBackdropHost(gate,boot),null);
const releases=[],durations=[];for(const node of [boot.querySelector('.bootTitle'),boot.querySelector('.bootProgressRow')])node.animate=(frames,options)=>{durations.push(options.duration);return {finished:new Promise(resolve=>releases.push(resolve))}};
gate.hidden=false;const presentation=installEntryPresentation(gate);let complete=false;const loading=presentation.load(async update=>update(90)).then(()=>complete=true);await new Promise(r=>setImmediate(r));assert(!complete);assert(!boot.classList.contains('hidden'),'quick sign-in keeps loading visible until entrance finishes');assert(durations.every(ms=>ms===650));for(const release of releases)release();await loading;assert(complete);assert(boot.classList.contains('hidden'));console.log('PASS one background transfers from sign-in to loading, pauses after play, and fast sign-ins wait for the slower loading entrance.');
