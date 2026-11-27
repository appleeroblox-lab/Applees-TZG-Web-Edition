import {isPaintHex,paintGradient} from './paint-gradient.js';
export const SPACE_RANGE=30000;
export const SURFACE_RANGE=1200;
export const locationRange=location=>location.startsWith('space:')?SPACE_RANGE:SURFACE_RANGE;
const clock=()=>performance.now();
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1],a[2]-b[2]);
const states=['idle','walk','run','jump','fall','fly','boost','land','takeoff','warp'];
const finite=(a,count,max)=>Array.isArray(a)&&a.length===count&&a.every(n=>Number.isFinite(n)&&Math.abs(n)<=max);
const seconds=ms=>Math.max(0,Math.ceil(ms/1000));
export const roomTime=ms=>{const n=seconds(ms);return Math.floor(n/60)+':'+String(n%60).padStart(2,'0')};
const paintParts={
 foot:new Set(['leftLeg','leftHand','rightLeg','rightHand','head','torso']),
 ship:new Set(['body','wings','cockpit','cockpitWindow','tail','accents','lights','exhaust','trails','redParts','whiteParts','blueParts','darkParts'])
};
export function multiplayerPaint(mode,paint={}){
 const source=typeof paint==='object'&&paint?paint:{};
 const parts=Object.create(null);
 for(const [key,value] of Object.entries(source.parts||{})){
  if(!paintParts[mode]?.has(key)&&!(mode==='ship'&&isPaintHex(key)))continue;
  if(isPaintHex(value))parts[key]=value;
  else if(paintGradient(value))parts[key]=value.map(({color,position})=>({color,position:Math.round(position*10000)/10000}));
  if(Object.keys(parts).length>=16)break;
 }
 const face=['Neutral','Happy','Surprised','Sleepy','Wink','Serious'].includes(source.face)?source.face:'Neutral';
 return {base:isPaintHex(source.base)?source.base:'#f7f4ff',face,parts};
}
export function readPose(value){
 if(!Array.isArray(value)||![7,8].includes(value.length))return null;
 const [sequence,group,pos,q,mode,state,paint,parked]=value;
 if(!Number.isSafeInteger(sequence)||sequence<0||typeof group!=='string'||group.length>100||
 !finite(pos,3,1e13)||!finite(q,4,1.01)||Math.abs(Math.hypot(...q)-1)>.04||
 !['ship','foot'].includes(mode)||!states.includes(state)||!paint||typeof paint!=='object'||Array.isArray(paint))return null;
 const fx=paint.warpFx;
 let warpFx=null;
 if(mode==='ship'&&state==='warp'&&group.startsWith('space:')&&fx&&
  Number.isFinite(fx.elapsed)&&fx.elapsed>=0&&fx.elapsed<=60){
  if(fx.kind==='portal'&&fx.elapsed<3)warpFx={kind:'portal',elapsed:fx.elapsed};
  if(fx.kind==='local'&&finite(fx.start,3,1e13)&&finite(fx.end,3,1e13)&&
   Number.isFinite(fx.duration)&&fx.duration>1&&fx.duration<=60){
   warpFx={kind:'local',elapsed:fx.elapsed,start:fx.start,end:fx.end,duration:fx.duration};
  }
 }
 let parkedShip;
 if(mode==='foot'&&parked&&finite(parked[0],3,1e13)&&finite(parked[1],4,1.01)&&Math.abs(Math.hypot(...parked[1])-1)<=.04&&distance(parked[0],pos)<1000){
  parkedShip={mode:'ship',pos:parked[0],q:parked[1],paint:multiplayerPaint('ship',parked[2]),group,state:'idle'};
 }
 return {sequence,group,pos,q,mode,state,engine:typeof paint.engine==='boolean'?paint.engine:undefined,paint:multiplayerPaint(mode,paint),parkedShip,warpFx};
}

// Keep a small receive-time buffer to bridge irregular packet arrivals.
export function remotePoseFrame(peer,now){
 const latest=peer.pose,frames=peer.frames;
 if(!latest||!frames||frames.length<2)return {from:latest,to:latest,alpha:1};
 const delay=Math.max(peer.interval>700?1100:0,Math.min(420,165+Math.max(0,((peer.ping??0)-100)*.25)+(peer.jitter||0)*2));
 const playback=peer.playback=Math.max(peer.playback??-Infinity,now-delay);
 const index=frames.findIndex(frame=>frame.at>=playback);
 if(index<=0){
  const pose=index===0?frames[0].pose:latest;
  return {from:pose,to:pose,alpha:1};
 }
 const from=frames[index-1],to=frames[index];
 return {from:from.pose,to:to.pose,alpha:(playback-from.at)/Math.max(1,to.at-from.at)};
}

export class MultiplayerNetwork {
 constructor({endpoint,token,onChange=()=>{},onError=()=>{},onNotice=()=>{},onExit=()=>{}}){
  Object.assign(this,{endpoint,token,onChange,onError,onNotice,onExit});
  this.peers=new Map();this.relayPeers=new Map();this.stats={sent:0,received:0,sentBytes:0,receivedBytes:0};
  this.sequence=0;this.status='Offline';this.retryDelay=700;
 }
 async authorize(){
  if(!this.endpoint)return false;
  const jwt=await this.token();
  if(!jwt)return false;
  const response=await fetch(this.endpoint+'/access',{headers:{Authorization:'Bearer '+jwt},signal:AbortSignal.timeout(7000)});
  if(!response.ok)return false;
  this.version=(await response.json()).version;return true;
 }
 send(message){
  if(this.socket?.readyState!==1)return false;
  this.socket.send(JSON.stringify(message));return true;
 }
 async connect(){
  if(this.socket?.readyState===1&&this.snapshot)return;
  if(this.connecting)return this.connecting;
  const generation=this.generation||0;
  const run=async()=>{
   const jwt=await this.token();
   if(!jwt)throw Error('Sign in to an authorized tester account.');
   if(generation!==(this.generation||0))throw Error('Connection cancelled.');
   this.status=this.room?'Reconnecting…':'Connecting…';this.onChange();
   const url=new URL(this.endpoint+'/socket');url.protocol=url.protocol==='https:'?'wss:':'ws:';
   const sentAt=clock();
   const socket=this.socket=new WebSocket(url,['tzg-beta',jwt]);
   await new Promise((resolve,reject)=>{
    const fail=()=>{clearTimeout(timer);reject(Error('Could not connect to multiplayer signaling.'))};
    const timer=setTimeout(()=>{socket.close();fail()},8000);
    socket.onmessage=e=>{
     if(this.socket!==socket)return;
     let m;try{m=JSON.parse(e.data)}catch{return}
     if(m.type==='state'){if(!this.snapshot)this.directoryPing=Math.round(clock()-sentAt);clearTimeout(timer);this.receiveState(m);resolve()}
     if(m.type==='error'){this.lastError=m.message;this.onError(m.message)}
     if(m.type==='notice')this.onNotice(m.message);
     if(m.type==='removed'){this.room=null;this.onExit(m.message,'kicked')}
     if(m.type==='relay-pose'&&m.epoch===this.room?.epoch&&this.related().some(p=>p.id===m.from)){
      const now=clock(),previous=this.relayPeers.get(m.from);
      const peer=previous&&now-previous.seen<8500?previous:{};
      if(this.receivePose(peer,m.packet,now))this.relayPeers.set(m.from,peer);
     }
     if(m.type==='signal')this.signal(m).catch(()=>{this.lastError='Peer negotiation failed.'});
    };
    socket.onerror=fail;
    socket.onclose=()=>{
     fail();if(this.socket!==socket)return;
     this.socket=null;this.roomRecovery=null;this.snapshot=null;this.status=this.room?'Reconnecting…':'Offline';
     this.onChange();if(this.room)this.reconnect();
    };
   });
  };
  this.connecting=run();
  try{await this.connecting}finally{this.connecting=null}
 }
 receiveState(m){
  const previous=this.room;
  this.snapshot=m;this.self=m.self;this.serverOffset=m.now-Date.now();
  if(previous&&!m.room&&m.rooms?.some(room=>room.id===previous.id&&room.expires>m.now)){
   if(!this.roomRecovery)this.rejoin(previous.id);
   return;
  }
  this.room=m.room;
  this.status=this.room?'Connected':'Online';this.retryDelay=700;
  if(previous&&!this.room){this.clearPeers();this.onExit('This multiplayer server closed or expired.');return}
  if(this.roomRecovery&&this.room?.id===this.roomRecovery){
   this.roomRecovery=null;this.presenceSignature='';this.presenceAt=-Infinity;
  }
  if(previous?.epoch!==this.room?.epoch){
   this.clearPeers();this.presenceSignature='';
   if(previous&&this.room){
    this.migrationUntil=clock()+2500;this.status='Migrating Host…';
   }
  }
  this.reconcilePeers();this.onChange();
 }
 async rejoin(id){
  const socket=this.socket;
  this.roomRecovery=id;
  this.status='Reconnecting…';this.onChange();
  this.lastError=null;
  try{
   if(!this.send({type:'join',id}))return;
   await this.wait(()=>this.roomRecovery!==id||this.socket!==socket,8000);
  }catch(error){
   if(this.roomRecovery!==id||this.socket!==socket||!this.room)return;
   this.roomRecovery=null;this.room=null;this.clearPeers();
   this.onExit(error.message);
  }finally{
   if(this.socket===socket&&this.roomRecovery===id)this.roomRecovery=null;
  }
 }
 async enter(operation,id,pose,progress){
  this.lastError=null;this.pendingRoom=true;
  try{
   await this.connect();
   if(!this.send({type:operation,id}))throw Error('Multiplayer signaling disconnected.');
   await this.wait(()=>this.room&&(operation==='create'||operation==='quick'||this.room.id===id),8000);
   progress('Joined Global Server');
   this.update(pose(),true);
   // Admission is global. Nearby player links negotiate independently while the world loads.

  }catch(error){
   this.send({type:'leave'});this.close();throw error;
  }finally{this.pendingRoom=false}
 }
 async wait(predicate,timeout,message='The server did not respond.'){
  const until=clock()+timeout,generation=this.generation||0;
  while(!predicate()){
   if(this.lastError)throw Error(this.lastError);
   if(generation!==(this.generation||0))throw Error('Connection cancelled.');
   if(clock()>=until)throw Error(message);
   await new Promise(resolve=>setTimeout(resolve,100));
  }
 }
 reconnect(){
  if(this.reconnectTimer||!this.room)return;
  this.reconnectTimer=setTimeout(async()=>{
   this.reconnectTimer=null;
   try{await this.connect();if(this.local)this.update(this.local,true)}
   catch{this.retryDelay=Math.min(30000,this.retryDelay*2);this.reconnect()}
  },this.retryDelay);
 }
 related(){
  const local=this.local;
  if(!local||!this.room)return [];
  return this.room.players.filter(p=>p.id!==this.self&&p.location===local.group&&p.anchor&&
   distance(p.anchor,local.pos)<=locationRange(local.group)*1.25);
 }
 reconcilePeers(){
  if(typeof globalThis.RTCPeerConnection!=='function')return;
  const wanted=new Set(this.related().map(p=>p.id));
  for(const id of this.peers.keys())if(!wanted.has(id))this.drop(id);
  for(const id of wanted)if(!this.peers.has(id)&&this.self<id){this.createPeer(id,true).catch(()=>this.drop(id))}
 }
 async createPeer(id,offer){
  const pc=new RTCPeerConnection({iceServers:[{urls:'stun:stun.cloudflare.com:3478'}]});
  const peer={pc,pending:[],epoch:this.room.epoch,rxAt:0,rxCount:0,created:clock()};
  this.peers.set(id,peer);
  pc.onicecandidate=e=>{if(e.candidate)this.relay(id,{type:'ice',candidate:e.candidate.toJSON()},peer.epoch)};
  pc.ondatachannel=e=>{if(e.channel.label==='tzg-state')this.bind(peer,e.channel);else e.channel.close()};
  pc.onconnectionstatechange=()=>{if(pc.connectionState==='failed'&&this.peers.get(id)===peer)this.drop(id)};
  if(offer){
   this.bind(peer,pc.createDataChannel('tzg-state',{ordered:false,maxRetransmits:0}));
   await pc.setLocalDescription(await pc.createOffer());
   this.relay(id,{type:'offer',sdp:pc.localDescription.sdp},peer.epoch);
  }
  return peer;
 }
 relay(to,signal,epoch){this.send({type:'signal',to,signal,epoch})}
 async signal({from,epoch,signal}){
  if(typeof globalThis.RTCPeerConnection!=='function'||epoch!==this.room?.epoch||!this.related().some(p=>p.id===from))return;
  let peer=this.peers.get(from);
  if(!peer)peer=await this.createPeer(from,false);
  const {pc}=peer;
  if(signal.type==='ice'){
   if(pc.remoteDescription)await pc.addIceCandidate(signal.candidate);
   else if(peer.pending.length<64)peer.pending.push(signal.candidate);
  }else{
   await pc.setRemoteDescription({type:signal.type,sdp:signal.sdp});
   for(const candidate of peer.pending.splice(0))await pc.addIceCandidate(candidate).catch(()=>{});
   if(signal.type==='offer'){
    await pc.setLocalDescription(await pc.createAnswer());this.relay(from,{type:'answer',sdp:pc.localDescription.sdp},epoch);
   }
  }
 }
 bind(peer,channel){
  peer.channel=channel;
  channel.onopen=()=>{if(this.local)this.transmit(peer,this.local,true)};
  channel.onmessage=e=>{
   if(typeof e.data!=='string'||e.data.length>6500||!this.local)return;
   const now=clock();
   if(now-peer.rxAt>=1000){peer.rxAt=now;peer.rxCount=0}
   if(++peer.rxCount>24)return;
   let packet;try{packet=JSON.parse(e.data)}catch{return}
   if(packet?.p==='q'&&Number.isFinite(packet.t)){channel.send(JSON.stringify({p:'a',t:packet.t}));return}
   if(packet?.p==='a'&&packet.t===peer.pingAt){peer.ping=Math.round(Math.max(0,now-packet.t));return}
   if(this.receivePose(peer,packet,now))this.stats.receivedBytes+=e.data.length;
  };
 }
 receivePose(peer,packet,now){
   const pose=readPose(packet),local=this.local;
   if(!pose||!local||pose.group!==local.group||distance(pose.pos,local.pos)>locationRange(local.group))return;
   if(peer.pose&&pose.sequence<=peer.pose.sequence)return;
   const threshold=pose.group.startsWith('space:')?50000:500;
   if(peer.pose&&now-peer.seen<450&&distance(peer.pose.pos,pose.pos)>threshold&&pose.state!=='warp')return;
   const gap=now-peer.seen;
   if(!peer.pose||gap>1600||pose.mode!==peer.pose.mode||distance(peer.pose.pos,pose.pos)>(pose.group.startsWith('space:')?4000:70)){
    peer.frames=[];peer.jitter=0;peer.interval=peer.playback=undefined;
   }else{
    peer.interval??=gap;
    peer.jitter=(peer.jitter||0)*.8+Math.abs(gap-peer.interval)*.2;
    peer.interval=peer.interval*.8+gap*.2;
   }
   (peer.frames??=[]).push({at:now,pose});
   if(peer.frames.length>12)peer.frames.shift();
   peer.pose=pose;peer.seen=now;this.stats.received++;
   return true;
 }
 poseValues(pose){
  const values=[pose.group,pose.pos.map(n=>Math.round(n*100)/100),pose.q.map(n=>Math.round(n*10000)/10000),pose.mode,pose.state,pose.mode==='ship'?{...pose.paint,engine:pose.engine,warpFx:pose.warpFx}:pose.paint];
  if(pose.parked)values.push(pose.parked);
  return values;
 }
 transmitRelay(pose,now,warpChanged){
  if(!this.snapshot?.poseRelay||!warpChanged&&now-(this.relayAt??-Infinity)<1000)return;
  this.relayAt=now;
  const to=this.related().filter(p=>this.peers.get(p.id)?.channel?.readyState!=='open').map(p=>p.id);
  if(!to.length||this.socket?.bufferedAmount>8192)return;
  const values=this.poseValues(pose),signature=JSON.stringify([to,values]);
  if(signature===this.relaySignature&&now-this.relaySentAt<4500)return;
  if(this.send({type:'relay-pose',epoch:this.room.epoch,to,packet:[++this.sequence,...values]})){
   this.relaySignature=signature;this.relaySentAt=now;
  }
 }
 remotePeers(){
  const peers=new Map(this.relayPeers);
  for(const [id,peer] of this.peers)if(peer.seen>=(peers.get(id)?.seen??-Infinity))peers.set(id,peer);
  return peers;
 }

 transmit(peer,pose,force=false){
  const channel=peer.channel,now=clock();
  if(channel?.readyState!=='open'||channel.bufferedAmount>8192)return;
  const interval=['boost','takeoff','warp'].includes(pose.state)?100:150;
  if(!force&&now-(peer.sentAt||0)<interval)return;
  const values=this.poseValues(pose);
  const signature=JSON.stringify(values);
  if(!force&&signature===peer.signature&&now-peer.sentAt<4500)return;
  const packet=JSON.stringify([++this.sequence,...values]);
  channel.send(packet);peer.sentAt=now;peer.signature=signature;
  this.stats.sent++;this.stats.sentBytes+=packet.length;
  if(now-(peer.pingAt||0)>6000){peer.pingAt=now;channel.send(JSON.stringify({p:'q',t:now}))}
 }
 measureServerPing(now){
  if(this.pingProbe||now-(this.pingAt??-Infinity)<45000)return;
  this.pingAt=now;
  const socket=this.socket,roomId=this.room.id;
  const started=clock();
  this.pingProbe=fetch(this.endpoint+'/health',{mode:'no-cors',cache:'no-store',signal:AbortSignal.timeout(5000)})
   .then(response=>{
    if(!response.ok&&response.type!=='opaque')return;
    if(this.socket!==socket||this.room?.id!==roomId)return;
    this.serverPing=Math.min(998,Math.max(1,Math.round(clock()-started)));
    if(this.local)this.update(this.local,true);
   })
   .catch(()=>{})
   .finally(()=>{this.pingProbe=null});
 }
 update(pose,force=false){
  if(!pose||!this.room||this.roomRecovery)return;
  if(Date.now()+(this.serverOffset||0)>=this.room.expires){this.onExit('This multiplayer server expired.');return}
  const warpChanged=this.local?.warpFx?.kind!==pose.warpFx?.kind;
  this.local=pose;
  const now=clock(),cell=locationRange(pose.group)/5,anchor=pose.pos.map(n=>Math.round(n/cell)*cell);
  const signature=JSON.stringify([pose.group,anchor,!document.hidden]);
  const nearbyGroup=this.room.players.some(p=>p.id!==this.self&&p.location===pose.group);
  if(force||warpChanged||pose.group!==this.presenceGroup||nearbyGroup&&signature!==this.presenceSignature&&now-(this.presenceAt||0)>8000||now-(this.presenceAt||0)>45000){
   const ping=this.serverPing??this.directoryPing;
   if(this.send({type:'presence',location:pose.group,anchor,foreground:!document.hidden,capability:navigator.hardwareConcurrency||1,device:pose.device,level:pose.level,ping})){
    this.presenceAt=now;this.presenceSignature=signature;this.presenceGroup=pose.group;
    this.measureServerPing(now);
   }
  }
  if(this.migrationUntil&&now>=this.migrationUntil){this.migrationUntil=0;this.status=this.socket?'Connected':'Reconnecting…';this.onChange()}
  if(now-(this.peerCheck||0)>1500){
   this.peerCheck=now;
   for(const [id,peer] of this.peers)if(peer.channel?.readyState!=='open'&&now-peer.created>8000)this.drop(id);
   this.reconcilePeers();
  }
  for(const peer of this.peers.values())this.transmit(peer,pose,force||warpChanged);
  this.transmitRelay(pose,now,warpChanged);
 }
 drop(id){const peer=this.peers.get(id);if(peer)this.peers.delete(id);peer?.pc.close()}
 clearPeers(){this.relayPeers.clear();this.relaySignature='';for(const id of this.peers.keys())this.drop(id)}
 close(){
  this.generation=(this.generation||0)+1;
  clearTimeout(this.reconnectTimer);this.reconnectTimer=null;
  this.clearPeers();const socket=this.socket;this.socket=null;socket?.close();
  this.room=null;this.roomRecovery=null;this.local=null;this.snapshot=null;this.status='Offline';
  this.serverPing=this.directoryPing=this.pingAt=undefined;
  this.presenceSignature='';this.onChange();
 }
 leave(){this.send({type:'leave'});this.close()}
}
