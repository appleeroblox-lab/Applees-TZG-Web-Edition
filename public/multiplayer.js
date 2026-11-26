import {setVerifiedName} from './identity-ui.js?v=91';
import * as T from './vendor/three.module.js';
import {MultiplayerNetwork,locationRange,roomTime} from './multiplayer-network.js';
import {menuMotion} from './menu-motion.js?v=187';

const endpoint='https://tzg-multiplayer-beta.appleeroblox.workers.dev';
const distance=(a,b)=>Math.hypot(...a.map((n,i)=>n-b[i]));
const locationName=(key,bodies)=>key.startsWith('space:')?'Space · '+key.slice(6):key.startsWith('warp:')?'Warp · '+key.slice(5):bodies.find(b=>b.id===key.slice(5))?.name||key.slice(5);
export function multiplayerDistance(units,space){
 if(!space)return Math.round(units)+' m';
 const km=units*100;
 if(km>=1e9)return (km/299792.458).toFixed(2)+' c';
 if(km>=1e6)return (km/1e6).toFixed(2)+' Gm';
 if(km>=1000)return (km/1000).toFixed(2)+' Mm';
 return km.toFixed(1)+' km';
}
const node=(tag,text,cls)=>{const el=document.createElement(tag);if(text)el.textContent=text;if(cls)el.className=cls;if(tag==='button')el.type='button';return el};
const openPanel=element=>{element.hidden=false;menuMotion(element,true,()=>{},'y')};
const closingPanels=new WeakMap();
function closePanel(element){
 if(closingPanels.has(element))return closingPanels.get(element);
 const closing=new Promise(resolve=>menuMotion(element,false,()=>{element.hidden=true;resolve()},'y'));
 closingPanels.set(element,closing);
 closing.finally(()=>closingPanels.delete(element));
 return closing;
}

export function installMultiplayer({home,account,bodies,pose,enter,leave,model,notify,ready=()=>{},active=()=>true,lifecycle}){
 const style=node('link');style.rel='stylesheet';style.href='./multiplayer.css?v=299';document.head.append(style);
 const launch=home.multiplayerButton;
 const menu=node('section',null,'multiplayerPanel');menu.id='multiplayerLobby';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Multiplayer');
 const header=node('header',null,'dialogHead'),close=node('button','×');close.setAttribute('aria-label','Close multiplayer');
 header.append(node('h2','Multiplayer'),close);
 const overview=node('div',null,'multiplayerStats'),online=node('span'),servers=node('span'),status=node('span');
 overview.append(online,servers,status);
 const toolbar=node('div',null,'multiplayerToolbar'),refresh=node('button','Refresh');
 toolbar.append(node('h3','Public Servers'),refresh);
 const list=node('div',null,'multiplayerServers'),quick=node('button','Quick Join'),foot=node('footer'),message=node('p');
 message.setAttribute('role','status');foot.append(quick);
 const lobbyBody=node('div',null,'multiplayerLobbyBody');
 lobbyBody.append(node('p','Experimental Beta · Direct connections only.'),overview,toolbar,message,list,foot);
 menu.append(header,lobbyBody);
 home.root.append(menu);
 const loading=node('div',null,'multiplayerLoading');loading.hidden=true;
 const loadingTitle=node('h2'),retry=node('button','Retry'),back=node('button','Back to Home');
 const create=node('button','Create new server');create.hidden=true;
 const loadingActions=node('div',null,'multiplayerLoadingActions');loadingActions.append(create,retry,back);
 loadingTitle.setAttribute('role','status');loading.append(loadingTitle,loadingActions);document.body.append(loading);
 const roster=document.getElementById('settingsPlayersPage'),playersTab=document.getElementById('settingsTab-players');
 const banner=node('header',null,'multiplayerRosterHeader'),server=node('span'),serverTime=node('span');
 banner.append(node('h3','Players'),serverTime,server);
 const heading=node('div',null,'multiplayerRosterRow multiplayerRosterHeading');
 for(const title of ['#','Player','Location','Ping','Actions'])heading.append(node('span',title));
 const rows=node('div',null,'multiplayerRosterList');
 roster?.append(banner,heading,rows);
 let rosterSignature='',more=null;
 const tokens=async()=>{
  const player=account();
  if(!player?.ready||player.guest||!player.client)return null;
  const {data}=await player.client.auth.getSession();
  return data?.session?.access_token||null;
 };
 const network=new MultiplayerNetwork({endpoint,token:tokens,onChange:renderMenu,onError:error=>{message.textContent=error},onNotice:notify,onExit:reason=>returnHome(reason)});
 const ghosts=new Map();
 let busy=false,operation=null,roomId=null,approved=null,checking=null,lastPaint=0,statsTime=0,sample=null,entered=false;
 async function checkAccess(force=false){
  const user=account()?.user?.id;
  if(!user){approved=null;launch.disabled=true;return}
  if(!force&&approved===user||checking)return checking;
  checking=(async()=>{
   try{if(await network.authorize()&&account()?.user?.id===user){approved=user;launch.disabled=false}}
   catch{launch.disabled=true}
  })();
  try{await checking}finally{checking=null}
 }
 function renderMenu(){
  const snapshot=network.snapshot,rooms=snapshot?.rooms||[],time=Date.now()+(network.serverOffset||0);
  online.textContent=rooms.reduce((n,r)=>n+r.count,0)+' players online';
  servers.textContent=rooms.length+' / '+(snapshot?.maxRooms||2)+' active servers';
  status.textContent=network.status+(network.directoryPing===undefined?'':' · '+network.directoryPing+' ms signaling');
  quick.disabled=busy||!snapshot;
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
  renderRoster(time);
 }
 function renderRoster(time){
  if(!roster||!playersTab)return;
  const room=entered?network.room:null;
  playersTab.hidden=!room;
  if(!room){
   rosterSignature='';rows.replaceChildren();more?.remove();more=null;
   if(playersTab.getAttribute('aria-selected')==='true')document.getElementById('settingsTab-game')?.click();
   return;
  }
  server.textContent=room.count+'/'+room.capacity;
  serverTime.textContent='Server time · '+roomTime(room.expires-time);
  const ordered=[...room.players].sort((a,b)=>(a.joined||0)-(b.joined||0));
  const signature=JSON.stringify([room.hostId,ordered.map(({id,name,username,avatar,verified,joined,location,ping})=>[id,name,username,avatar,verified,joined,location,ping])]);
  if(signature===rosterSignature||more?.isConnected)return;
  rosterSignature=signature;rows.replaceChildren();
  const action=(label,text,run)=>{
   const button=node('button',text);button.title=label;button.setAttribute('aria-label',label);
   button.onclick=async()=>{try{await run()}catch(error){notify(error.message)}};
   return button;
  };
  ordered.forEach((player,index)=>{
   const row=node('div',null,'multiplayerRosterRow'),identity=node('div',null,'multiplayerRosterIdentity');
   const name=node('strong'),details=node('div'),avatar=node('img');
   avatar.alt='';avatar.referrerPolicy='no-referrer';
   if(player.avatar?.startsWith('https://'))avatar.src=player.avatar;else avatar.hidden=true;
   setVerifiedName(name,player.name,player.verified);
   if(player.id===network.self)name.append(document.createTextNode(' (You)'));
   details.append(name);if(player.id===room.hostId)details.append(node('small','Host'));
   identity.append(avatar,details);
   const actions=node('div',null,'multiplayerRosterActions');
   if(player.id!==network.self){
    const add=action('Add friend','+',async()=>{await account().rpc('tzg_social_action',{p_action:'request',p_username:player.username});notify('Friend request sent.')});
    add.disabled=!player.username;
    actions.append(add,action('Report player','⚑',()=>{
     const reason=globalThis.prompt('Why are you reporting '+player.name+'?');
     if(reason?.trim())network.send({type:'report',to:player.id,reason:reason.trim().slice(0,300)});
    }));
    const options=action('More player actions','⋯',()=>{
     const previous=more;previous?.remove();more=null;
     if(previous?.dataset.player===player.id)return;
     const popup=node('div',null,'multiplayerPlayerOptions');popup.dataset.player=player.id;more=popup;
     const anchor=options.getBoundingClientRect(),panel=roster.closest('dialog');
     if(!panel)return;
     panel.append(popup);
     const send=type=>{popup.remove();more=null;if(globalThis.confirm((type==='kick'?'Kick ':'Transfer host to ')+player.name+'?'))network.send({type,to:player.id})};
     popup.append(action('Transfer Host','Transfer Host',()=>send('transfer')),action('Kick','Kick',()=>send('kick')));
     const box=popup.getBoundingClientRect(),bounds=panel.getBoundingClientRect();
     popup.style.left=Math.max(4,Math.min(bounds.width-box.width-4,anchor.right-bounds.left-box.width))+'px';
     popup.style.top=Math.max(4,Math.min(bounds.height-box.height-4,anchor.bottom-bounds.top))+'px';
     requestAnimationFrame(()=>document.addEventListener('pointerdown',function dismiss(event){
      if(popup.contains(event.target)||options.contains(event.target))return;
      popup.remove();if(more===popup)more=null;document.removeEventListener('pointerdown',dismiss,true);
     },true));
    });
    options.disabled=room.hostId!==network.self;
    actions.append(options);
   }
   row.append(node('span',String(index+1)),identity,node('span',player.location?locationName(player.location,bodies):'Connecting'),node('span',Number.isFinite(player.ping)?player.ping+' ms':'—'),actions);
   rows.append(row);
  });
 }

 async function refreshList(){
  refresh.disabled=true;message.textContent='';
  try{await network.connect();network.send({type:'list'})}
  catch(error){message.textContent=error.message;renderMenu()}
  finally{refresh.disabled=false}
 }
 async function start(action,id){
  if(busy||!approved||home.leaving||!home.active)return;
  loading.hidden=true;busy=true;operation=action;roomId=id;
  try{
   if(!menu.hidden)await closePanel(menu);
   const prepare=async()=>{
    retry.hidden=back.hidden=create.hidden=true;
    loadingTitle.textContent=action==='quick'?'Searching for Multiplayer Server....':action==='create'?'Creating Multiplayer Server...':'Joining Multiplayer Server...';
    loading.classList.add('revealed');loading.hidden=false;
    loading.getBoundingClientRect();
    loading.classList.remove('revealed');
    try{
     await network.enter(action,id,pose,text=>loadingTitle.textContent=text);
     loadingTitle.textContent='Preparing World...';
     await ready();
     home.close();entered=true;enter();loading.classList.add('revealed');
     setTimeout(()=>{if(!busy)loading.hidden=true},350);
    }catch(error){
     network.close();
     const empty=error.message==='No active multiplayer server found.';
     const full=error.message==='All server are full now, Multiplayer Unavailable.';
     loadingTitle.textContent=empty?'No server found. Create a new server?':error.message;
     create.hidden=!empty;retry.hidden=empty||full;back.hidden=false;
    }
   };
   if(action==='join')await home.play(prepare);
   else await prepare();
  }finally{busy=false;renderMenu()}
 }

 function disconnect(){entered=false;network.leave();clearGhosts();more?.remove();more=null;loading.hidden=true}
 async function returnHome(reason){
  disconnect();
  await leave();if(reason)notify(reason);
 }
 function removeGhost(ghost){ghost.userData.nameplate?.remove();ghost.removeFromParent();ghost.userData.dispose?.()}
 function clearGhosts(){for(const ghost of ghosts.values())removeGhost(ghost);ghosts.clear()}
 function update(dt,scene,origin,camera){
  if(!network.room||!entered){clearGhosts();return}
  const local=pose();network.update(local);
  if(!scene||!active()){clearGhosts();return}
  const now=performance.now(),keep=new Set(),projected=new T.Vector3();
  const draw=(key,packet,player)=>{
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
   if(!camera||!player)return;
   let plate=ghost.userData.nameplate;
   if(!plate){
    plate=node('div',null,'multiplayerNameplate');plate.append(node('strong'),node('span'),node('span'));
    ghost.userData.nameplate=plate;document.body.append(plate);
   }
   const identity=player.name+'|'+player.verified+'|'+player.device+'|'+player.level;
   if(plate.dataset.identity!==identity){
    plate.dataset.identity=identity;setVerifiedName(plate.children[0],player.name,player.verified);
    plate.children[1].textContent=(player.device||'Unknown')+' (Lv-'+(player.level||1)+')';
   }
   plate.children[2].textContent=multiplayerDistance(distance(packet.pos,local.pos),!!origin);
   projected.copy(ghost.position).addScaledVector(camera.up,packet.mode==='foot'?2.1:7).project(camera);
   plate.hidden=projected.z< -1||projected.z>1||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
   if(!plate.hidden){plate.style.left=(projected.x*.5+.5)*100+'%';plate.style.top=(.5-projected.y*.5)*100+'%'}

  };
  for(const [id,peer] of network.peers){
   const packet=peer.pose;
   if(!packet||now-peer.seen>8500||packet.group!==local.group)continue;
   const player=network.room.players.find(p=>p.id===id&&p.location===local.group);
   if(!player)continue;
   draw(id,packet,player);if(packet.parkedShip)draw(id+':ship',packet.parkedShip,player);
  }
  for(const [id,ghost] of ghosts)if(!keep.has(id)){removeGhost(ghost);ghosts.delete(id)}
  if(now-lastPaint>750){lastPaint=now;renderMenu()}
 }
 launch.onclick=()=>{openPanel(menu);refreshList()};
 refresh.onclick=refreshList;
 close.onclick=()=>{closePanel(menu);if(!network.room)network.close()};
 quick.onclick=()=>start('quick');create.onclick=()=>start('create');
 retry.onclick=()=>start(operation,roomId);back.onclick=()=>{loading.hidden=true};
 document.getElementById('settingsDialog')?.addEventListener('close',()=>{more?.remove();more=null});
 const timer=setInterval(()=>{if(!menu.hidden||entered)renderMenu()},1000);timer.unref?.();
 window.addEventListener('tzg-home-ready',()=>checkAccess());
 window.addEventListener('tzg-signed-in',()=>checkAccess());
 window.addEventListener('tzg-signed-out',()=>{approved=null;launch.disabled=true;entered=false;network.leave();clearGhosts();more?.remove();more=null;menu.hidden=loading.hidden=true});
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
 return {update,network,disconnect,returnHome,checkAccess,get entered(){return entered}};
}
