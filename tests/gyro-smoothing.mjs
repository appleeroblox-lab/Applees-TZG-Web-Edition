import assert from 'node:assert/strict';
import {GyroSmoother} from '../public/device-gyro.js';
for(const fps of [20,30,60,120]){
 const filter=new GyroSmoother();let previous=0;
 for(let i=0;i<fps*4;i++){
  const target=i<fps?1:i<fps*2?-1:0;
  const value=filter.step({pitch:target,roll:-target},i*1000/fps);
  assert(Number.isFinite(value.pitch)&&Math.abs(value.pitch)<=1);
  assert(Math.abs(value.pitch-previous)<=2.5*(i?1/fps:1/60)+1e-9);
  previous=value.pitch;
 }
 assert(Math.abs(previous)<.00001,'steering settles back to neutral');
 const noise=new GyroSmoother();
 for(let i=0;i<fps;i++)assert.equal(noise.step({pitch:.015*Math.sin(i),roll:0},i*1000/fps).pitch,0);
}
console.log('PASS gyro reversals, settling and neutral jitter at 20/30/60/120 FPS');
