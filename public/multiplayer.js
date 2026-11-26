import * as T from './vendor/three.module.js';
import {MultiplayerNetwork,locationRange,roomTime} from './multiplayer-network.js';
import {menuMotion} from './menu-motion.js?v=187';

const endpoint='https://tzg-multiplayer-beta.appleeroblox.workers.dev';
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const locationName=(key,bodies)=>key.startsWith('space:')?'Space · '+key.slice(6):key.startsWith('warp:')?'Warp · '+key.slice(5):bodies.find(b=>b.id===key.slice(5))?.name||key.slice(5);
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;if(tag==='button')el.type='button';return el};
const openPanel=element=>{element.hidden=false;menuMotion(element,true,()=>{},'scale')};
const closePanel=element=>{menuMotion(element,false,()=>{element.hidden=true},'scale')};

export function installMultiplayer({home,account,bodies,pose,enter,leave,model,notify,ready=()=>{},active=()=>true,lifecycle}){
 const style=node('link');style.rel='stylesheet';style.href='./multiplayer.css?v=296';document.head.append(style);
 const launch=node('button','Multiplayer','homeMultiplayer');launch.hidden=true;
 home.root.querySelector('.homeBottom').append(launch);
 const menu=node('section',null,'multiplayerPanel');menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Multiplayer');
 const header=node('header'),close=node('button','×');close.setAttribute('aria-label','Close multiplayer');
 header.append(node('h2','Multiplayer'),close);
 const overview=node('div',null,'multiplayerStats'),online=node('span'),servers=node('span'),status=node('span');
 overview.append(online,servers,status);
 const toolbar=node('div',null,'multiplayerToolbar'),refresh=node('button','Refresh');
 toolbar.append(node('h3','Public Servers'),refresh);
 const list=node('div',null,'multiplayerServers'),create=node('button','Create Server'),foot=node('footer'),message=node('p');
 message.setAttribute('role','status');create.append(node('small','Free during Beta'));foot.append(create);
 menu.append(header,node('p','Experimental Beta · Direct connections only.'),overview,toolbar,message,list,foot);
 home.root.append(menu);
 const loading=node('div',null,'multiplayerLoading');loading.hidden=true;
 const loadingTitle=node('h2'),retry=node('button','Retry'),back=node('button','Back to Home');
 loadingTitle.setAttribute('role','status');loading.append(loadingTitle,retry,back);document.body.append(loading);
 const information=node('section',null,'multiplayerPanel multiplayerInfo');information.hidden=true;
 const infoHeader=node('header'),infoClose=node('button','×'),infoText=node('div'),exit=node('button','Leave Server');
 infoClose.setAttribute('aria-label','Close multiplayer information');
 infoHeader.append(node('h2','Multiplayer'),infoClose);information.setAttribute('role','dialog');information.setAttribute('aria-label','Multiplayer information');information.append(infoHeader,infoText,exit);document.body.append(information);
 const infoButton=node('button','Multiplayer','multiplayerInfoButton');infoButton.hidden=true;document.body.append(infoButton);
 const tokens=async()=>{
  const player=account();
  if(!player?.ready||player.guest||!player.client)return null;
  const {data}=await player.client.auth.getSession();
  return data?.session?.access_token||null;
 };
 const network=new MultiplayerNetwork({endpoint,token:tokens,onChange:renderMenu,onError:error=>{message.textContent=error},onExit:reason=>returnHome(reason)});
 const ghosts=new Map();
 let busy=false,operation=null,roomId=null,approved=null,checking=null,lastPaint=0,statsTime=0,sample=null,entered=false;
 async function checkAccess(force=false){
  const user=account()?.user?.id;
  if(!user){approved=null;launch.hidden=true;return}
  if(!force&&approved===user||checking)return checking;
  checking=(async()=>{
   try{if(await network.authorize()&&account()?.user?.id===user){approved=user;launch.hidden=false}}
   catch{launch.hidden=true}
  })();
  try{await checking}finally{checking=null}
 }
 function renderMenu(){
  const snapshot=network.snapshot,rooms=snapshot?.rooms||[],time=Date.now()+(network.serverOffset||0);
  online.textContent=rooms.reduce((n,r)=>n+r.count,0)+' players online';
  servers.textContent=rooms.length+' / '+(snapshot?.maxRooms||2)+' active servers';
  status.textContent=network.status+(network.directoryPing===undefined?'':' · '+network.directoryPing+' ms signaling');
  create.disabled=busy||!snapshot||rooms.length>=snapshot.maxRooms;
  if(!menu.hidden){
   list.replaceChildren();
   if(!rooms.length)list.append(node('p',snapshot?'No active servers.':'Connecting to server directory…'));
   for(const room of rooms){
    const card=node('article'),detail=node('div'),join=node('button','Join');
    detail.append(node('h3',room.name),node('p','Host · '+room.host),node('p',room.count+' / '+room.capacity+' players · '+roomTime(room.expires-time)+' remaining'));
    const labels=node('div',null,'multiplayerLocations');
    for(const [group,count] of Object.entries(room.locations))labels.append(node('span',locationName(group,bodies)+' · '+count));
    const locations=node('div',null,'multiplayerLocationBlock');if(labels.childNodes.length)locations.append(node('strong','Locations (Players)'),labels);join.disabled=busy||room.full||!room.count||room.expires<=time;
    join.onclick=()=>start('join',room.id);card.append(detail,locations,join);list.append(card);
   }
  }
  const room=network.room;
  infoButton.hidden=!room||busy||!entered;
  if(room&&!information.hidden){
   const local=network.local,group=local?.group;
   const ping=[...network.peers.values()].map(p=>p.ping).filter(Number.isFinite);
   infoText.replaceChildren(...[room.name,'Host · '+room.host,room.count+' / '+room.capacity+' players',
    roomTime(room.expires-time)+' remaining',group?locationName(group,bodies):'Entering world',
    (room.locations[group]||0)+' in this location',room.players.filter(p=>p.location===group).map(p=>p.name).join(', '),ping.length?Math.min(...ping)+' ms to nearest peer':'Peer ping unavailable',network.status].map(value=>node('p',value)));
  }
 }
 async function refreshList(){
  refresh.disabled=true;message.textContent='';
  try{await network.connect();network.send({type:'list'})}
  catch(error){message.textContent=error.message;renderMenu()}
  finally{refresh.disabled=false}
 }
 async function start(action,id){
  if(busy||!approved||home.leaving||!home.active)return;
  loading.hidden=true;busy=true;operation=action;roomId=id;menu.hidden=true;
  // Cover the multiplayer handshake at the existing Play animation handoff.
  await home.play(async()=>{
   loading.hidden=false;loading.classList.remove('revealed');retry.hidden=back.hidden=true;
   loadingTitle.textContent=action==='create'?'Creating Multiplayer Server...':'Joining Multiplayer Server...';
   try{
    await network.enter(action,id,pose,text=>loadingTitle.textContent=text);
    loadingTitle.textContent='Preparing World...';
    await ready();
    home.close();entered=true;enter();loading.classList.add('revealed');
    setTimeout(()=>{if(!busy)loading.hidden=true},350);
   }catch(error){
    network.close();loadingTitle.textContent=error.message;retry.hidden=back.hidden=false;
   }finally{busy=false;renderMenu()}
  });
 }
 async function returnHome(reason){
  entered=false;network.leave();clearGhosts();closePanel(information);loading.hidden=true;
  await leave();if(reason)notify(reason);
 }
 function removeGhost(ghost){ghost.removeFromParent();ghost.userData.dispose?.()}
 function clearGhosts(){for(const ghost of ghosts.values())removeGhost(ghost);ghosts.clear()}
 function update(dt,scene,origin){
  if(!network.room||!entered){clearGhosts();return}
  const local=pose();network.update(local);
  if(!scene||!active()){clearGhosts();return}
  const now=performance.now(),keep=new Set();
  const draw=(key,packet)=>{
   if(distance(packet.pos,local.pos)>locationRange(local.group))return;
   keep.add(key);
   let ghost=ghosts.get(key);
   if(!ghost||ghost.userData.mode!==packet.mode){
    if(ghost)removeGhost(ghost);
    ghost=model(packet.mode);ghost.userData.mode=packet.mode;ghosts.set(key,ghost);
    ghost.userData.worldPosition=new T.Vector3(...packet.pos);
    ghost.quaternion.fromArray(packet.q);
   }
   if(ghost.parent!==scene)scene.add(ghost);
   const alpha=1-Math.exp(-dt*13),target=new T.Vector3(...packet.pos);
   const world=ghost.userData.worldPosition;
   if(world.distanceTo(target)>(packet.group.startsWith('space:')?4000:70))world.copy(target);
   else world.lerp(target,alpha);
   ghost.position.copy(world);if(origin)ghost.position.sub(origin);
   ghost.quaternion.slerp(new T.Quaternion(...packet.q),alpha);
   ghost.userData.animate?.(packet,now);
  };
  for(const [id,peer] of network.peers){
   const packet=peer.pose;
   if(!packet||now-peer.seen>8500||packet.group!==local.group)continue;
   draw(id,packet);if(packet.parkedShip)draw(id+':ship',packet.parkedShip);
  }
  for(const [id,ghost] of ghosts)if(!keep.has(id)){removeGhost(ghost);ghosts.delete(id)}
  if(now-lastPaint>750){lastPaint=now;renderMenu()}
 }
 launch.onclick=()=>{openPanel(menu);refreshList()};
 refresh.onclick=refreshList;
 close.onclick=()=>{closePanel(menu);if(!network.room)network.close()};
 create.onclick=()=>{if(globalThis.confirm('Create a free experimental server?'))start('create')};
 retry.onclick=()=>start(operation,roomId);back.onclick=()=>{loading.hidden=true};
 infoButton.onclick=()=>{openPanel(information);renderMenu()};infoClose.onclick=()=>closePanel(information);exit.onclick=()=>returnHome();
 const timer=setInterval(()=>{if(!menu.hidden||!information.hidden)renderMenu()},1000);timer.unref?.();
 window.addEventListener('tzg-home-ready',()=>checkAccess());
 window.addEventListener('tzg-signed-in',()=>checkAccess());
 window.addEventListener('tzg-signed-out',()=>{approved=null;launch.hidden=true;entered=false;network.leave();clearGhosts();menu.hidden=information.hidden=loading.hidden=true});
 lifecycle?.subscribe(visible=>{if(!network.room)return;if(visible&&!network.socket)network.reconnect();if(network.local)network.update(network.local,true)});
 const debug=node('section',null,'debugCommandCard'),inspect=node('button','Check multiplayer beta access'),debugText=node('pre');
 debug.append(node('h3','Multiplayer Test'),inspect,debugText);document.getElementById('debugExperimental')?.append(debug);
 const diagnostic=()=>{
  const now=performance.now(),counts=network.stats;
  if(now-statsTime>=1000){const elapsed=(now-statsTime)/1000;
   const perSecond=key=>sample?Math.round((counts[key]-sample[key])/elapsed):0;
   debugText.textContent=JSON.stringify({backend:network.version||'—',status:network.status,host:network.room?.host,players:network.room?.count??0,groups:network.room?.locations||{},latencyMs:[...network.peers.values()].map(p=>p.ping??null),sentPerSecond:perSecond('sent'),receivedPerSecond:perSecond('received'),uploadBytesPerSecond:perSecond('sentBytes'),downloadBytesPerSecond:perSecond('receivedBytes'),signalingEventsToday:network.snapshot?.signalingEventsToday??null,dailySignalingCap:35000,lastError:network.lastError||null},null,2);
   sample={...counts};statsTime=now;
  }
 };
 inspect.onclick=async()=>{await checkAccess(true);diagnostic();notify(approved?'Multiplayer beta access verified.':'This account has no multiplayer beta access, or signaling is unavailable.')};
 const diagnosticTimer=setInterval(()=>{if(debug.offsetParent)diagnostic()},1000);diagnosticTimer.unref?.();
 return {update,network,returnHome,checkAccess,get entered(){return entered}};
}
