import assert from 'node:assert/strict';
import worker,{Lobby,MultiplayerLobby,BACKEND_VERSION} from '../multiplayer/worker.mjs';
import {MultiplayerNetwork,readPose,multiplayerPaint} from '../public/multiplayer-network.js';

const now=Date.now();
const users=Array.from({length:11},(_,i)=>({id:'u'+i,name:'Pilot '+i,authUntil:now+3600000}));
const directory=new Lobby([],{}),room=directory.join(users[0],null,now,true);
for(let i=1;i<5;i++)directory.join(users[i],room.id,now);
assert.throws(()=>directory.join(users[5],room.id,now),/full/);
const second=directory.join(users[5],null,now,true);
for(let i=6;i<10;i++)directory.join(users[i],second.id,now);
assert.throws(()=>directory.join(users[10],null,now,true),/occupied/);
assert.throws(()=>directory.join(users[0],second.id,now),/Leave/);
room.players[0].location='body:Earth';room.players[1].location='body:Earth';room.players[2].location='space:Sol';
assert.equal(directory.summary(room).locations['body:Earth'],2);
assert.equal(directory.summary(room).locations['space:Sol'],1);
directory.disconnect(users[0].id,now+100);
assert.equal(room.host,users[1].id);assert.equal(room.epoch,2);
directory.join(users[0],room.id,now+200);
assert.equal(room.host,users[1].id);assert.equal(room.expires,now+3600000);
directory.prune(now+3600001);assert.equal(directory.rooms.length,0);
const cleanup=directory.join(users[0],null,now,true);directory.remove(users[0].id,now+200);
assert(!directory.rooms.includes(cleanup));

let accepted=0;
const env={BETA_ENABLED:'true',ALLOWED_ORIGINS:'https://beta.example',SUPABASE_URL:'https://auth.example',SUPABASE_PUBLIC_KEY:'publishable'};
const prod=globalThis.fetch;
globalThis.fetch=async url=>String(url).includes('/rpc/')?Response.json({display_name:'Real Pilot'}):Response.json({id:'u1',user_metadata:{tzg_multiplayer:true},is_anonymous:accepted===0,email_confirmed_at:'yes'});
const request=(path,origin='https://beta.example')=>new Request('https://worker.example'+path,{headers:{Origin:origin,Authorization:'Bearer token'}});
assert.equal((await worker.fetch(request('/access'),env)).status,403,'anonymous sessions cannot join');
accepted=1;
assert.equal((await worker.fetch(request('/access'),env)).status,200);
assert.equal((await worker.fetch(request('/access','https://unauthorized.example'),env)).status,403);
assert.equal((await (await worker.fetch(request('/health'),env)).json()).version,BACKEND_VERSION);
globalThis.fetch=prod;

const storage=new Map();
let alarm=null,boot;
const sockets=users.slice(0,2).map(user=>({
 readyState:1,data:{...user,messages:0,window:0},messages:[],
 deserializeAttachment(){return this.data},serializeAttachment(data){this.data=data},
 send(data){this.messages.push(JSON.parse(data))},close(){this.readyState=3}
}));
const ctx={getWebSockets:id=>sockets.filter(s=>!id||s.data.id===id),blockConcurrencyWhile(fn){boot=fn()},storage:{get:key=>storage.get(key),put:(key,value)=>storage.set(key,structuredClone(value)),sql:{exec:()=>[]},getAlarm:()=>alarm,setAlarm:value=>{alarm=value}}};
const lobby=new MultiplayerLobby(ctx,{});await boot;
const message=(socket,m)=>lobby.webSocketMessage(socket,JSON.stringify(m));
await message(sockets[0],{type:'create'});const id=lobby.lobby.rooms[0].id;
await message(sockets[1],{type:'join',id});assert.equal(lobby.stateFor('u1').room.count,2);
await message(sockets[0],{type:'presence',location:'body:Earth',anchor:[0,0,0]});
await message(sockets[1],{type:'presence',location:'body:Mars',anchor:[0,0,0]});
await message(sockets[0],{type:'signal',to:'u1',epoch:1,signal:{type:'offer',sdp:'test SDP'}});
assert(!sockets[1].messages.some(m=>m.type==='signal'),'different bodies do not exchange ICE/signaling');
await message(sockets[1],{type:'presence',location:'body:Earth',anchor:[15,0,0]});
await message(sockets[0],{type:'signal',to:'u1',epoch:1,signal:{type:'offer',sdp:'test SDP'}});
assert(sockets[1].messages.some(m=>m.type==='signal'));
sockets[0].readyState=3;await lobby.webSocketClose(sockets[0]);assert.equal(lobby.stateFor('u1').room.hostId,'u1');
assert.equal(storage.get('rooms')[0].id,id);assert(alarm);

const paint=multiplayerPaint('foot',{base:'#123456',face:'Happy',parts:{torso:'#abcdef',bad:'#111111'}});
assert.equal(paint.parts.torso,'#abcdef');assert.equal(paint.parts.bad,undefined);
const wire=[2,'body:Earth',[10,0,0],[0,0,0,1],'foot','walk',paint];
assert(readPose(wire));assert.equal(readPose([...wire.slice(0,2),[1e24,0,0],...wire.slice(3)]),null);
const net=new MultiplayerNetwork({endpoint:'https://worker.example',token:async()=>''});
net.local={group:'body:Earth',pos:[0,0,0]};
const peer={},channel={readyState:'open',send(){}};
net.bind(peer,channel);
channel.onmessage({data:JSON.stringify(wire)});assert.equal(net.stats.received,1);
channel.onmessage({data:JSON.stringify(wire)});assert.equal(net.stats.received,1,'stale packets are discarded');
channel.onmessage({data:JSON.stringify([3,'body:Mars',...wire.slice(2)])});assert.equal(net.stats.received,1);
net.self='u0';net.room={players:[{id:'u1',location:'body:Earth',anchor:[15,0,0]},{id:'u2',location:'body:Earth',anchor:[5000,0,0]}]};
assert.deepEqual(net.related().map(v=>v.id),['u1']);
console.log('PASS two-peer coordination, capacity 2×5, expiry, empty cleanup, authorization, relay isolation, scoped packets and host migration.');
