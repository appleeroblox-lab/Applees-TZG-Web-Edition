export const BACKEND_VERSION = 'multiplayer-v1';
const HOUR=3600000, LEASE=100000, GRACE=45000, MAX_MESSAGE=20000;
const limits=(value,maximum,fallback)=>Math.max(1,Math.min(maximum,Number.parseInt(value)||fallback));
const short=(value,max)=>typeof value==='string'&&value.length>0&&value.length<=max;
const finiteAnchor=(anchor)=>Array.isArray(anchor)&&anchor.length===3&&anchor.every(n=>Number.isFinite(n)&&Math.abs(n)<=1e13);

export class Lobby {
 constructor(storage,env){this.rooms=storage;this.capacity=limits(env.MAX_ROOM_PLAYERS,10,5);this.maximum=limits(env.MAX_ROOMS,5,2)}
 remove(id,now){
  for(const room of this.rooms){
   room.players=room.players.filter(p=>p.id!==id);
   this.elect(room,now);
  }
  this.rooms.splice(0,this.rooms.length,...this.rooms.filter(r=>r.players.length));
 }
 prune(now){
  this.rooms.splice(0,this.rooms.length,...this.rooms.filter(r=>r.expires>now));
  for(const room of this.rooms){
   room.players=room.players.filter(p=>p.until>now);
   for(const p of room.players)if(p.connected&&p.last+LEASE<=now)p.connected=false;
   this.elect(room,now);
  }
  this.rooms.splice(0,this.rooms.length,...this.rooms.filter(r=>r.players.length));
 }
 elect(room,now){
  const live=room.players.filter(p=>p.connected&&p.last+LEASE>now);
  if(live.some(p=>p.id===room.host&&p.foreground))return;
  const chosen=live.sort((a,b)=>Number(b.foreground)-Number(a.foreground)||((b.capability||0)-(a.capability||0))||((a.ping??999)-(b.ping??999))||a.joined-b.joined)[0];
  if(chosen&&chosen.id!==room.host){room.host=chosen.id;room.epoch++}
 }
 join(user,id,now,create=false){
  this.prune(now);
  let room=this.rooms.find(r=>r.id===id);
  const current=this.rooms.find(r=>r.players.some(p=>p.id===user.id));
  if(create&&current)return current;
  if(create){
   if(this.rooms.length>=this.maximum)throw Error('All experimental server slots are occupied.');
   const roomId=crypto.randomUUID();
   room={id:roomId,name:'Server '+roomId.slice(0,6).toUpperCase(),created:now,expires:now+HOUR,host:user.id,epoch:1,players:[]};
   this.rooms.push(room);
  }
  if(!room)throw Error('This server has expired or closed.');
  if(current&&current!==room)throw Error('Leave your current experimental server first.');
  let p=room.players.find(p=>p.id===user.id);
  if(!p){
   if(room.players.length>=this.capacity)throw Error('This server is full.');
   p={id:user.id,name:user.name,joined:now,location:'',anchor:null,foreground:true};
   room.players.push(p);
  }
  Object.assign(p,{connected:true,last:now,until:now+LEASE+GRACE});
  this.elect(room,now);return room;
 }
 disconnect(id,now){
  for(const r of this.rooms){
   const p=r.players.find(p=>p.id===id);if(!p)continue;
   p.connected=false;p.until=now+GRACE;this.elect(r,now);
  }
 }
 summary(room){
  const counts=Object.create(null);
  for(const p of room.players)if(p.connected&&p.location)counts[p.location]=(counts[p.location]||0)+1;
  return {id:room.id,name:room.name,host:room.players.find(p=>p.id===room.host)?.name||'Electing host',count:room.players.filter(p=>p.connected).length,full:room.players.length>=this.capacity,capacity:this.capacity,expires:room.expires,locations:counts};
 }
}

const origins=env=>(env.ALLOWED_ORIGINS||'').split(',').map(x=>x.trim());
const json=(body,status=200,origin='')=>Response.json(body,{status,headers:{'Cache-Control':'no-store',...(origin?{'Access-Control-Allow-Origin':origin,Vary:'Origin'}:{})}});
async function authenticate(token,env){
 if(!short(token,8192)||!env.SUPABASE_URL||!env.SUPABASE_PUBLIC_KEY)return null;
 const response=await fetch(new URL('/auth/v1/user',env.SUPABASE_URL),{headers:{Authorization:'Bearer '+token,apikey:env.SUPABASE_PUBLIC_KEY},signal:AbortSignal.timeout(6000)});
 if(!response.ok)return null;
 const u=await response.json();
 const trusted=u.app_metadata||{};
 const owners=(env.BETA_EMAILS||'').toLowerCase().split(',').map(s=>s.trim()).filter(Boolean);
 if(!short(u.id,80)||!(trusted.tzg_multiplayer===true||u.email_confirmed_at&&owners.includes(u.email?.toLowerCase())))return null;
 let profile;
 try{
  const result=await fetch(new URL('/rest/v1/rpc/tzg_player_profile',env.SUPABASE_URL),{
   method:'POST',headers:{Authorization:'Bearer '+token,apikey:env.SUPABASE_PUBLIC_KEY,'Content-Type':'application/json'},body:'{}',signal:AbortSignal.timeout(2500)
  });
  if(result.ok)profile=await result.json();
 }catch{}
 const name=String(profile?.display_name||u.user_metadata?.display_name||u.user_metadata?.full_name||u.user_metadata?.name||'Pilot').replace(/[\p{C}]/gu,'').trim().slice(0,40)||'Pilot';
 let expiry=Date.now()+HOUR;
 try{const payload=token.split('.')[1].replaceAll('-','+').replaceAll('_','/');const exp=JSON.parse(atob(payload)).exp;if(Number.isFinite(exp))expiry=Math.min(exp*1000,expiry)}catch{}
 return {id:u.id,name,authUntil:expiry};
}
export default {
 async fetch(request,env){
  const url=new URL(request.url),origin=request.headers.get('Origin')||'';
  if(url.pathname==='/health')return json({version:BACKEND_VERSION,enabled:env.BETA_ENABLED==='true'});
  if(!origins(env).includes(origin)||!origin)return json({error:'Origin unavailable.'},403);
  if(request.method==='OPTIONS')return new Response(null,{status:204,headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, OPTIONS','Access-Control-Allow-Headers':'Authorization',Vary:'Origin'}});
  if(env.BETA_ENABLED!=='true')return json({error:'Experimental multiplayer is disabled.'},503,origin);
  if(request.method!=='GET'||!['/access','/socket'].includes(url.pathname))return json({error:'Not found.'},404,origin);
  const protocols=(request.headers.get('Sec-WebSocket-Protocol')||'').split(',').map(s=>s.trim());
  if(url.pathname==='/socket'&&(request.headers.get('Upgrade')?.toLowerCase()!=='websocket'||protocols[0]!=='tzg-beta'))return json({error:'WebSocket required.'},426,origin);
  try{
   const token=url.pathname==='/socket'?protocols[1]:request.headers.get('Authorization')?.replace(/^Bearer /,'');
   const user=await authenticate(token,env);
   if(!user)return json({error:'This account does not have multiplayer beta access.'},403,origin);
   if(url.pathname==='/access')return json({version:BACKEND_VERSION,authorized:true},200,origin);
   const relay=new Request('https://internal/socket',{headers:{Upgrade:'websocket','X-Beta-User':encodeURIComponent(JSON.stringify(user))}});
   return await env.LOBBY.getByName('experimental-beta').fetch(relay);
  }catch{return json({error:'Multiplayer signaling is temporarily unavailable.'},503,origin)}
 }
};

export class MultiplayerLobby {
 constructor(ctx,env){
  this.ctx=ctx;this.env=env;
  ctx.blockConcurrencyWhile(async()=>{
   const state=await ctx.storage.get('rooms')||[];
   this.lobby=new Lobby(state,env);
   ctx.storage.sql.exec('CREATE TABLE IF NOT EXISTS usage (day INTEGER PRIMARY KEY, count INTEGER NOT NULL)');
  });
 }
 quota(){
  const day=Math.floor(Date.now()/86400000);
  const row=[...this.ctx.storage.sql.exec('SELECT count FROM usage WHERE day=?',day)][0];
  this.signalingEventsToday=row?.count||0;
  if(this.signalingEventsToday>=35000)return false;
  this.signalingEventsToday++;
  this.ctx.storage.sql.exec('INSERT INTO usage VALUES (?,1) ON CONFLICT(day) DO UPDATE SET count=count+1',day);
  if(!row)this.ctx.storage.sql.exec('DELETE FROM usage WHERE day<?',day-1);
  return true;
 }
 send(ws,value){try{ws.send(JSON.stringify(value))}catch{}}
 peers(id){return this.ctx.getWebSockets(id)}
 stateFor(user){
  const l=this.lobby,room=l.rooms.find(r=>r.players.some(p=>p.id===user));
  return {type:'state',self:user,now:Date.now(),rooms:l.rooms.map(r=>l.summary(r)),maxRooms:l.maximum,signalingEventsToday:this.signalingEventsToday,room:room?{...l.summary(room),hostId:room.host,epoch:room.epoch,created:room.created,players:room.players.filter(p=>p.connected).map(({id,name,location,anchor,foreground})=>({id,name,location,anchor,foreground}))}:null};
 }
 broadcast(){
  for(const ws of this.ctx.getWebSockets()){
   const state=ws.deserializeAttachment();if(state)this.send(ws,this.stateFor(state.id));
  }
 }
 async persist(){
  await this.ctx.storage.put('rooms',this.lobby.rooms);
  if(this.lobby.rooms.length&&await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+30000);
 }
 async fetch(request){
  if(!this.quota()||this.ctx.getWebSockets().length>=30)return new Response('Experimental capacity reached',{status:503});
  const user=JSON.parse(decodeURIComponent(request.headers.get('X-Beta-User')));
  if(this.peers(user.id).length)return new Response('Account already connected',{status:409});
  const [client,server]=Object.values(new WebSocketPair());
  this.ctx.acceptWebSocket(server,[user.id]);
  server.serializeAttachment({...user,window:0,messages:0});
  const current=this.lobby.rooms.find(r=>r.players.some(p=>p.id===user.id));
  this.lobby.prune(Date.now());
  if(current?.players.some(p=>p.id===user.id)&&this.lobby.rooms.includes(current)){
   this.lobby.join(user,current.id,Date.now());
   await this.persist();this.broadcast();
  }else this.send(server,this.stateFor(user.id));
  return new Response(null,{status:101,webSocket:client,headers:{'Sec-WebSocket-Protocol':'tzg-beta'}});
 }
 async webSocketMessage(ws,message){
  const a=ws.deserializeAttachment(),now=Date.now();
  if(a&&a.authUntil<=now){ws.close(1008,'Sign-in needs renewal');return}
  if(!a||typeof message!=='string'||message.length>MAX_MESSAGE){ws.close(1008,'Invalid message');return}
  if(now-a.window>=10000){a.window=now;a.messages=0}
  if(++a.messages>70||!this.quota()){ws.close(1008,'Experimental request limit');return}
  ws.serializeAttachment(a);
  let m;try{m=JSON.parse(message)}catch{return}
  if(!m||typeof m!=='object')return;
  this.lobby.prune(now);
  const room=this.lobby.rooms.find(r=>r.players.some(p=>p.id===a.id));
  const p=room?.players.find(p=>p.id===a.id);
  try{
   if(m.type==='list'){this.send(ws,this.stateFor(a.id));return}
   if(m.type==='create'||m.type==='join')this.lobby.join(a,m.id,now,m.type==='create');
   else if(m.type==='leave')this.lobby.remove(a.id,now);
   else if(m.type==='presence'&&p&&short(m.location,100)&&finiteAnchor(m.anchor)){
    Object.assign(p,{location:m.location,anchor:m.anchor,foreground:m.foreground!==false,last:now,until:now+LEASE+GRACE,connected:true,
     capability:Math.max(0,Math.min(32,Number(m.capability)||0)),ping:Math.max(0,Math.min(999,Number(m.ping)||999))});
    this.lobby.elect(room,now);
   }else if(m.type==='signal'&&p&&short(m.to,80)&&m.epoch===room.epoch&&m.to!==a.id){
    const target=room.players.find(row=>row.id===m.to&&row.connected&&row.location===p.location&&p.location);
    const s=m.signal;
    const valid=s&&((['offer','answer'].includes(s.type)&&short(s.sdp,17500))||(s.type==='ice'&&short(s.candidate?.candidate,1500)&&(s.candidate.sdpMid===null||typeof s.candidate.sdpMid==='string')&&(s.candidate.sdpMLineIndex===null||Number.isInteger(s.candidate.sdpMLineIndex))));
    if(target&&valid)for(const peer of this.peers(target.id))this.send(peer,{type:'signal',from:a.id,epoch:room.epoch,signal:s});
    return;
   }else return;
   await this.persist();this.broadcast();
  }catch(error){this.send(ws,{type:'error',message:error.message||'Multiplayer request failed.'})}
 }
 async webSocketClose(ws){
  const a=ws.deserializeAttachment();if(!a)return;
  if(this.peers(a.id).some(peer=>peer!==ws&&peer.readyState===1))return;
  this.lobby.disconnect(a.id,Date.now());await this.persist();this.broadcast();
 }
 async webSocketError(ws){await this.webSocketClose(ws)}
 async alarm(){
  const now=Date.now();
  for(const ws of this.ctx.getWebSockets())if(ws.deserializeAttachment()?.authUntil<=now)ws.close(1008,'Sign-in needs renewal');
  this.lobby.prune(now);await this.persist();this.broadcast();
  if(this.lobby.rooms.length)await this.ctx.storage.setAlarm(Date.now()+30000);
 }
}
