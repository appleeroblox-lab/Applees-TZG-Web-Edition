import assert from 'node:assert/strict';
import fs from 'node:fs';
import {parseHTML} from 'linkedom';
import * as T from '../public/vendor/three.module.js';
import {Flight,V} from '../public/flight.js';
import {SurfaceSession} from '../public/surface.js';
import {Crew} from '../public/crew.js';
import {earth,bodies} from '../public/catalog.js';
import {respawnParkedShip,SHIP_STATION} from '../public/ship-respawn.js';
import {SurfaceStream} from '../public/surface-streaming.js';
import {messageExpiry,expiredMessage,nextMessageExpiry} from '../public/chat-lifetime.js';
import {authenticateFirst,takePreAuthClient} from '../public/auth-first.js';
const now=Date.now(),old={created_at:new Date(now-300001).toISOString()},newer={created_at:new Date(now-60000).toISOString()};
assert(expiredMessage(old,'global',now));assert(!expiredMessage(newer,'global',now));assert.equal(messageExpiry(newer,'global'),Date.parse(newer.created_at)+300000);assert.equal(nextMessageExpiry([newer],'global',now),240000);
assert(expiredMessage({created_at:new Date(now-5*3600000-1).toISOString()},'private',now));assert(!expiredMessage({created_at:new Date(now-4*3600000).toISOString()},'private',now));
const f=new Flight(bodies),surface=new SurfaceSession(f),crew=new Crew(surface);surface.enter(earth,true);crew.leave();crew.pos.set(SHIP_STATION.x,0,SHIP_STATION.z);crew.yaw=.8;crew.pitch=.2;crew.velocityY=1.2;surface.pos.set(90,50,90);surface.vel.set(10,10,10);surface.phase='flying';f.cruiseSpeed=40;f.throttle=1;const player={pos:crew.pos.clone(),yaw:crew.yaw,pitch:crew.pitch,velocityY:crew.velocityY};
assert(respawnParkedShip(surface,crew));assert.equal(surface.pos.x,0);assert.equal(surface.pos.z,0);assert(surface.onGround);assert.equal(surface.phase,'parked');assert.equal(f.cruiseSpeed,0);assert.equal(surface.vel.length(),0);assert(crew.onFoot);assert(crew.pos.equals(player.pos));assert.equal(crew.yaw,player.yaw);assert.equal(crew.pitch,player.pitch);assert.equal(crew.velocityY,player.velocityY);crew.pos.x=100;assert(!respawnParkedShip(surface,crew));
const view={session:{body:earth,prospecting:{economy:{cycle:0,depleted:new Set(),discoverVillages(){}}}},scene:new T.Scene()};const stream=new SurfaceStream(view);assert.equal(stream.grassAmount,30);stream.setGrassAmount(200);assert.equal(stream.grassAmount,100);stream.grassCount=8000;const full=stream.decorate(earth,0,1,0);assert(full.userData.grassBlades>1000);assert.equal(full.children.length,0,'grass remains one batched mesh');stream.setGrassAmount(0);stream.grassCount=0;assert.equal(stream.decorate(earth,0,1,0).userData.grassBlades,0);
const craft=JSON.parse(fs.readFileSync(new URL('../public/models/crafting-center-v96.json',import.meta.url),'utf8'));assert.match(craft.generator,/Blender/);assert(craft.meshes.length<=8);assert(craft.meshes.reduce((n,m)=>n+m.positions.length/9,0)<4000);for(const mesh of craft.meshes){assert(mesh.positions.every(Number.isFinite));assert.equal(mesh.positions.length,mesh.normals.length)}
// Before authentication completes, no caller can proceed to load the game.
const makeDoc=()=>parseHTML('<html><body><div id="boot"></div></body></html>').document;globalThis.location={origin:'https://example.test',pathname:'/index.html',hash:''};
let doc=makeDoc(),finished=false,calls=[];const client={auth:{getSession:async()=>({data:{session:null}}),signInWithPassword:async details=>{calls.push(details);return{}},stopAutoRefresh(){}},rpc:async()=>({data:true})};
const pending=authenticateFirst({doc,config:{url:'https://project.test',publishableKey:'public'},requestSDK:async()=>({createClient:()=>client})}).then(()=>{finished=true});await new Promise(r=>setTimeout(r,0));assert(doc.querySelector('#accountGate'));assert.equal(finished,false);doc.querySelector('#accountEmail').value='player@example.test';doc.querySelector('#accountPassword').value='valid-password';await doc.querySelector('#accountForm').onsubmit({preventDefault(){}});await pending;assert.equal(calls.length,1);assert.equal(finished,true);assert(doc.body.classList.contains('authenticatedBoot'));assert(doc.querySelector('#accountGate').hidden);assert.equal(takePreAuthClient(),client);assert.equal(takePreAuthClient(),null);
// Existing sessions require Continue, and invalid credentials leave the gate in place.
doc=makeDoc();finished=false;const existing={auth:{getSession:async()=>({data:{session:{access_token:'fixture'}}}),getUser:async()=>({data:{user:{id:'fixture'}}}),stopAutoRefresh(){}}};const continued=authenticateFirst({doc,config:{},requestSDK:async()=>({createClient:()=>existing})}).then(()=>finished=true);await new Promise(r=>setTimeout(r,0));assert(!doc.querySelector('#accountContinue').hidden);assert.equal(finished,false);doc.querySelector('#accountContinue').onclick();await continued;assert.equal(takePreAuthClient(),existing);
console.log('PASS v96: independent message lifetimes, ship-only respawn with unchanged player state/range guards, bounded dense grass, finite low-poly Blender mesh, login/Continue gate before loading.');
