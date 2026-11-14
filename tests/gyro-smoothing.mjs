import assert from 'node:assert/strict';
import fs from 'node:fs';
import {DeviceGyro,GyroSmoother,installGyroControls} from '../public/device-gyro.js';
import {installEntryPresentation} from '../public/entry-presentation.js';
// Construct physical rotations independently, then convert to W3C Z-X-Y Euler
// readings. Exercise both landscape directions at multiple comfortable holds.
const mul=([x,y,z,w],[a,b,c,d])=>[w*a+x*d+y*c-z*b,w*b-x*c+y*d+z*a,w*c+x*b-y*a+z*d,w*d-x*a-y*b-z*c];
const axis=(x,y,z,degrees)=>{const h=degrees*Math.PI/360;return [x*Math.sin(h),y*Math.sin(h),z*Math.sin(h),Math.cos(h)]};
const reading=q=>{const [x,y,z,w]=q,r12=2*(x*y-z*w),r22=1-2*(x*x+z*z),r31=2*(x*z-y*w),r32=2*(y*z+x*w),r33=1-2*(x*x+y*y),d=180/Math.PI;return {alpha:Math.atan2(-r12,r22)*d,beta:Math.asin(Math.max(-1,Math.min(1,r32)))*d,gamma:Math.atan2(-r31,r33)*d,time:Date.now()}};
for(const angle of [0,90,180,270])for(const hold of [0,35,70]){
 const sensor=new DeviceGyro({DeviceOrientationEvent:{},screen:{orientation:{angle}},addEventListener(){}}),base=mul(axis(0,0,1,37),axis(1,0,0,hold)),theta=angle*Math.PI/180;
 const pitch=sensor.axes(reading(base),reading(mul(base,axis(Math.cos(theta),Math.sin(theta),0,10))));
 const side=sensor.axes(reading(base),reading(mul(base,axis(-Math.sin(theta),Math.cos(theta),0,10))));
 const twist=sensor.axes(reading(base),reading(mul(base,axis(0,0,1,15))));
 assert(Math.abs(pitch.pitch-.4)<1e-6&&Math.abs(pitch.roll)<1e-6,'up/down cannot turn left/right');
 assert(Math.abs(side.roll-.4)<1e-6&&Math.abs(side.pitch)<1e-6,'left/right cannot pitch');
 assert(Math.abs(twist.pitch)<1e-6&&Math.abs(twist.roll)<1e-6,'screen twist is ignored');
 const still=sensor.axes(reading(base),reading(base));assert(Math.abs(still.pitch)<1e-10&&Math.abs(still.roll)<1e-10);
}
for(const fps of [20,30,60,120]){
 const filter=new GyroSmoother();let previous=0;
 for(let i=0;i<fps*4;i++){
  const target=i<fps?1:i<fps*2?-1:0,value=filter.step({pitch:target,roll:-target},i*1000/fps);
  assert(Number.isFinite(value.pitch)&&Math.abs(value.pitch)<=1);
  assert(Math.abs(value.pitch-previous)<=2.5*(i?1/fps:1/60)+1e-9);previous=value.pitch;
 }
 assert(Math.abs(previous)<.00001,'steering settles back to neutral');
 const noise=new GyroSmoother();for(let i=0;i<fps;i++)assert.equal(noise.step({pitch:.015*Math.sin(i),roll:0},i*1000/fps).pitch,0);
}
// Run the installed controls, including permission/toggle, frame ticks and live
// sensor events. A stationary tilted phone must not keep steering the ship.
const elements=new Map();
const doc={hidden:false,querySelectorAll:()=>[],createTextNode:text=>({textContent:text}),getElementById:id=>elements.get(id),createElement(){const node={after(){},replaceWith(){},append(){},setAttribute(){},closest(){return null}};Object.defineProperty(node,'id',{set(v){elements.set(v,node)},get(){return [...elements].find(([,n])=>n===node)?.[0]}});return node}};
for(const id of ['tiltEnable','tiltCalibrate']){const n=doc.createElement();n.id=id;}
let now=1000;const realNow=Date.now,realPerformance=globalThis.performance;Date.now=()=>now;globalThis.performance={now:()=>now};
const handlers=new Map(),win={DeviceOrientationEvent:{},screen:{orientation:{angle:90}},addEventListener:(type,fn)=>handlers.set(type,fn)};
try{
 const control=installGyroControls({doc,win,mobile:true});const emit=(gamma,beta=60)=>handlers.get('deviceorientation')({alpha:0,beta,gamma});
 emit(0);assert.deepEqual(control.axes(),{pitch:0,yaw:0});const toggle=doc.getElementById('gyroControls');toggle.checked=true;await toggle.onchange();control.axes();
 let moving;for(let i=1;i<=30;i++){now+=16;emit(i*.5);moving=control.axes();}assert(moving.pitch<-.1&&Math.abs(moving.yaw)<1e-6,'raising the phone uses the corrected upward pitch');assert(!('roll' in moving));
 handlers.get('orientationchange')();control.axes();for(let i=1;i<=30;i++){now+=16;emit(15-i*.5);moving=control.axes();}assert(moving.pitch>.1&&Math.abs(moving.yaw)<1e-6,'lowering the phone reverses pitch without turning sideways');
 for(let i=0;i<100;i++){now+=16;emit(15);control.axes();}const still=control.axes();assert(Math.abs(still.pitch)<1e-5&&Math.abs(still.yaw)<1e-5);
 handlers.get('orientationchange')();assert.deepEqual(control.axes(),{pitch:0,yaw:0});
 toggle.checked=false;await toggle.onchange();assert.deepEqual(control.axes(),{pitch:0,yaw:0});
}finally{Date.now=realNow;globalThis.performance=realPerformance;}
// The real loading presentation must reveal a previously hidden loader before
// animating it, and keep it visible until a guest task finishes.
const classes=new Set(['hidden','ready']),boot={classList:{remove(...names){names.forEach(n=>classes.delete(n))},add(n){classes.add(n)}},querySelector:()=>null};
const nodes=new Map([['boot',boot],['sourceProgress',{style:{}}],['sourcePercent',{}],['bootStatus',{}],['sourceDetail',{}],['launchBtn',{disabled:false}]]);
const root={hidden:false,dataset:{entry:'welcome'},ownerDocument:{defaultView:{matchMedia:()=>({matches:true})},getElementById:id=>nodes.get(id)},querySelectorAll:()=>[],querySelector:()=>null};
const presentation=installEntryPresentation(root);await presentation.revealLoading();assert(!classes.has('hidden'));assert(!classes.has('ready'));
classes.add('hidden');let finish;const pending=presentation.load(async update=>{assert(!classes.has('hidden'));assert.equal(nodes.get('bootStatus').textContent,'Preparing guest flight…');update(40);await new Promise(resolve=>finish=resolve)},{guest:true});await new Promise(resolve=>setImmediate(resolve));assert(!classes.has('hidden'));finish();await pending;assert(classes.has('hidden'));
const game=fs.readFileSync('public/game.js','utf8');assert(game.includes('flight.input.yaw+=gyro.yaw'));assert(!game.includes('flight.input.roll+=gyro'));
console.log('PASS gyro axes at 4 screen angles × 3 holds, twist rejection, 20–120 FPS smoothing, stationary/off/reorient controls, yaw-only steering, guest loading visibility.');
