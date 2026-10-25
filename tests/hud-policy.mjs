import assert from 'node:assert/strict';
import {focusedMineral} from '../public/hud-policy.js';
const ore=(id,x=0,y=0,distance=5,hp=100,z=-3)=>({id,x,y,distance,hp,z});
assert.equal(focusedMineral([ore('far',0,0,40),ore('dead',0,0,3,0),ore('behind',0,0,3,20,2)]),null);
assert.equal(focusedMineral([ore('side',.7,.1,3),ore('center',.02,0,5)]),'center');
assert.equal(focusedMineral([ore('edge',.9,0),ore('top',0,.8),ore('invalid',NaN,0)]),null);
assert.equal(focusedMineral(Array.from({length:24},(_,i)=>ore('node'+i,i*.02,0))),'node0');
console.log('PASS: one nearby label, aim priority, depleted/behind/offscreen/invalid labels hidden.');
