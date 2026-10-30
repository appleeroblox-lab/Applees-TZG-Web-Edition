import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {GameSound,ambienceFor} from '../public/sound.js';
import {StellarGlare} from '../public/stellar-glare.js';
import {SurfaceSky} from '../public/surface-sky.js';
import {audioFixture,flushAudio} from './audio-fakes.mjs';
const flight={active:[],pos:new T.Vector3()};
for(const hour of [10,23])for(const altitude of [0,999,1000,1001,6000]){const s={active:true,body:{name:'Earth',solid:true},altitude,earthEnvironment:{hour}};assert.equal(ambienceFor(s,flight),altitude>=1000?'reentry':hour===10?'day':'night')}
for(const altitude of [0,999,1000,6000]){assert.equal(ambienceFor({active:true,body:{name:'Mars',solid:true},altitude},flight),altitude>=1000?'reentry':'spaceDeep');assert.equal(ambienceFor({active:true,body:{name:'Moon',solid:true},altitude},flight),'spaceDeep')}
assert.equal(ambienceFor({active:false},flight),'space');
const fixture=audioFixture();globalThis.localStorage={getItem(){return null},setItem(){}};globalThis.Audio=class{constructor(){this.volume=0}play(){return Promise.resolve()}pause(){}removeAttribute(){}load(){}};const sound=new GameSound();sound.unlock();sound.context.sampleRate=8000;sound.context.createBuffer=(_,length)=>({data:new Float32Array(length),getChannelData(){return this.data}});
for(const name of ['day','night','spaceDeep']){sound.ambience(true,name);assert.equal(sound.streams.get(name).loop,true)}sound.ambience(true,'reentry');await flushAudio();const node=[...sound.nodes].find(n=>n.name==='reentry');assert(node);assert.equal(node.source.loop,true);assert(node.source.buffer.data.some(x=>x!==0));const original=sound.reentryBuffer;sound.ambience(true,'reentry');assert.equal(sound.reentryBuffer,original);sound.setActive(false);assert(node.source.stopped);fixture.restore();delete globalThis.Audio;
globalThis.innerWidth=800;globalThis.innerHeight=600;const glare={canvas:{width:800,height:600},x:{clearRect(){}}};StellarGlare.prototype.update.call(glare,null,null,null,{active:true},new Proxy([],{get(){throw Error('surface glare must not inspect scene geometry')}}));
const gradient={addColorStop(){}};globalThis.document={createElement(){return {width:0,height:0,getContext(){return {createRadialGradient(){return gradient},fillRect(){}}}}},createElementNS(){return {addEventListener(){},removeEventListener(){},set src(v){}}}};
const earth={name:'Earth',solid:true,system:'Sol',r:1,pos:new T.Vector3()},sun={name:'Sun',type:'STAR',system:'Sol',r:10,pos:new T.Vector3(0,100,0),color:'#fff'};const session={body:earth,normal:new T.Vector3(0,1,0)};const sky=new SurfaceSky(session,[earth,sun]);sky.build();const halo=session.skyBodies[0].halo;assert(halo?.isSprite);assert.equal(halo.material.depthTest,true);assert.equal(halo.material.depthWrite,false);assert.equal(halo.scale.x,56);const camera=new T.PerspectiveCamera();sky.update(camera);assert.equal(session.skyBodies[0].halo,halo,'one retained GPU glow');delete globalThis.document;
console.log('PASS 1000m day/night/reentry bands, airless isolation, looped/reused reentry rumble, background cleanup, zero surface CPU occlusion and depth-tested GPU glow.');
