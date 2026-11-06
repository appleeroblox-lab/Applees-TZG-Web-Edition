import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import * as T from '../public/vendor/three.module.js';
import {Economy} from '../public/economy.js';
import {nearestIgnitableTNT,installTNTIgnitePrompt} from '../public/tnt-ignite-prompt.js';
const body={id:'Earth',name:'Earth',solid:true},economy=new Economy([body]),surface={active:true,body},crew={onFoot:true,eye:()=>new T.Vector3(0,1.5,0)};
economy.add('torch',1);economy.equipped='Earth|torch';economy.placements=[{id:'near',type:'tnt',body:'Earth',x:0,y:.5,z:-2},{id:'far',type:'tnt',body:'Earth',x:0,y:.5,z:-12}];assert.equal(nearestIgnitableTNT(economy,surface,crew)?.id,'near');
const {document}=parseHTML('<html><body><div id="gearBar"></div></body></html>');let blocked=false,lit=0;const prompt=installTNTIgnitePrompt({doc:document,economy,surface,crew,blocked:()=>blocked,onIgnite:()=>lit++});prompt.update();assert(!prompt.button.hidden);assert(prompt.button.onclick());assert.equal(economy.placements[0].fuse,4);assert.equal(lit,1);assert(prompt.button.hidden);assert(!prompt.button.onclick());assert.equal(lit,1,'repeat click does not relight fuse');economy.placements[0].fuse=undefined;blocked=true;prompt.update();assert(prompt.button.hidden);blocked=false;crew.onFoot=false;prompt.update();assert(prompt.button.hidden);crew.onFoot=true;economy.equipped=null;prompt.update();assert(prompt.button.hidden);console.log('PASS nearby torch-only TNT prompt, exact range, fuse callback, repeat/blocked/equipment/ship guards');
