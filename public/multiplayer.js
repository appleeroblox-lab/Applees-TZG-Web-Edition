import {WormholeVisual} from './proto-visuals.js?v=195';
import {setAvatar} from './social-ui.js?v=187';
import {setVerifiedName} from './identity-ui.js?v=91';
import * as T from './vendor/three.module.js';
import {MultiplayerNetwork,locationRange,remotePoseFrame,roomTime} from './multiplayer-network.js';
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

export function installMultiplayer({home,account,bodies,pose,enter,leave,model,sky=()=>null,notify,closeSettings=()=>document.getElementById('settingsDialog')?.close(),ready=()=>{},active=()=>true,lifecycle}){
 const style=node('link');style.rel='stylesheet';style.href='./multiplayer.css?v=306';document.head.append(style);
 const launch=home.multiplayerButton;
 const menu=node('section',null,'multiplayerPanel');menu.id='multiplayerLobby';menu.hidden=true;menu.setAttribute('role','dialog');menu.setAttribute('aria-label','Multiplayer');
 const icon=(file,cls='')=>{const img=node('img',null,cls);img.src='./icons/'+file;img.alt='';return img};
 const header=node('header',null,'dialogHead'),close=node('button','×','multiplayerClose');
 close.setAttribute('aria-label','Close multiplayer');
 const lobbyTitle=node('h2','Multiplayer'),badge=node('span','Experimental Beta','multiplayerBeta');
 header.append(icon('group.svg','multiplayerHeaderIcon'),lobbyTitle,badge,close);
 const stat=picture=>{
  const tile=node('div',null,'multiplayerStat'),label=node('span');
  tile.append(picture,label);return {tile,label};
 };
 const overview=node('div',null,'multiplayerStats');
 const population=stat(icon('group.svg')),capacity=stat(icon('ui/database.svg'));
 const wifi=node('span',null,'multiplayerWifi');wifi.setAttribute('aria-hidden','true');
 const connection=stat(wifi);
 const online=population.label,servers=capacity.label,status=connection.label;
 overview.append(population.tile,capacity.tile,connection.tile);
 const toolbar=node('div',null,'multiplayerToolbar'),refresh=node('button','Refresh');
 refresh.prepend(icon('rotate_right.svg'));
 toolbar.append(icon('public.svg'),node('h3','Public Servers'),refresh);
 const list=node('div',null,'multiplayerServers'),quick=node('button','Quick Join'),foot=node('footer'),message=node('p',null,'multiplayerLobbyMessage');
 quick.prepend(icon('flight.svg'));
 message.setAttribute('role','status');foot.append(quick);
 const directory=node('section',null,'multiplayerDirectory');
 directory.append(toolbar,message,list);
 const lobbyBody=node('div',null,'multiplayerLobbyBody');
 lobbyBody.append(overview,directory);
 menu.append(header,lobbyBody,foot);
 home.root.append(menu);
 const loading=node('div',null,'multiplayerLoading');loading.hidden=true;
 const loadingTitle=node('h2'),retry=node('button','Retry'),back=node('button','Back to Home');
 const create=node('button','Create new server');create.hidden=true;
 const loadingActions=node('div',null,'multiplayerLoadingActions');loadingActions.append(create,retry,back);
 loadingTitle.setAttribute('role','status');loading.append(loadingTitle,loadingActions);document.body.append(loading);
 const exitNotice=node('div',null,'multiplayerExitNotice');
 exitNotice.hidden=true;exitNotice.setAttribute('role','alertdialog');exitNotice.setAttribute('aria-labelledby','multiplayerExitTitle');
 const exitTitle=node('h2'),exitMessage=node('p'),dismiss=node('button','OK');
 exitTitle.id='multiplayerExitTitle';dismiss.onclick=()=>closePanel(exitNotice);
 exitNotice.append(exitTitle,exitMessage,dismiss);document.body.append(exitNotice);
 const roster=document.getElementById('settingsPlayersPage'),playersTab=document.getElementById('settingsTab-players');
 const banner=node('div',null,'multiplayerRosterStatus');
 const title=node('h3','Players (Multiplayer)');
 const groupIcon=node('img');groupIcon.src='./icons/group.svg';groupIcon.alt='';title.prepend(groupIcon);
 const server=node('span',null,'multiplayerRosterServer'),count=node('span',null,'multiplayerRosterCount'),serverTime=node('span',null,'multiplayerRosterTime');
 banner.append(title,server,count,serverTime);
 const heading=node('div',null,'multiplayerRosterRow multiplayerRosterHeading');
 for(const title of ['#','Player','Location','Ping','Actions'])heading.append(node('span',title));
 const rows=node('div',null,'multiplayerRosterList');
 const rosterStatus=node('p',null,'multiplayerRosterFeedback');rosterStatus.setAttribute('role','status');
 roster?.append(banner,heading,rows,rosterStatus);
 const profiles=new Map(),sentRequests=new Set();
 const profileInfo=node('dialog',null,'multiplayerConfirmation');
 profileInfo.setAttribute('aria-label','Player information');
 const profileHeading=node('h2'),profileImage=node('img',null,'multiplayerInfoAvatar'),profileLocation=node('p'),profileClose=node('button','Close');
 profileClose.onclick=()=>profileInfo.close();
 profileInfo.append(profileImage,profileHeading,profileLocation,profileClose);
 document.body.append(profileInfo);
 function loadRosterProfile(player){
  const member=account(),username=player.username||(player.id===network.self?member?.profile?.username:null);
  if(!username)return Promise.resolve(null);
  if(player.id===network.self&&member?.profile)return Promise.resolve(member.profile);
  const cached=profiles.get(username);
  if(cached&&Date.now()-cached.started<60000)return cached.result;
  const result=member.rpc('tzg_social_profile',{p_username:username});
  const entry={started:Date.now(),result};profiles.set(username,entry);
  result.catch(()=>{if(profiles.get(username)===entry)profiles.delete(username)});
  return result;
 }
 async function openRosterProfile(player){
  closeOptions();
  const profile=await loadRosterProfile(player).catch(()=>null);
  if(!network.room?.players.some(p=>p.id===player.id))return;
  const view=account()?.profileView;
  if(profile&&view){
   closeSettings();
   await view.open(profile);
   return;
  }
  setVerifiedName(profileHeading,player.name,player.verified);
  setAvatar(profileImage,player.avatar);
  profileLocation.textContent=player.location?locationName(player.location,bodies):'Connecting';
  if(!profileInfo.open)profileInfo.showModal();
 }

 const confirmation=node('dialog',null,'multiplayerConfirmation');
 confirmation.setAttribute('aria-labelledby','multiplayerConfirmTitle');
 const confirmationTitle=node('h2'),confirmationText=node('p'),reasonLabel=node('label','Reason');
 confirmationTitle.id='multiplayerConfirmTitle';
 const reasonField=node('textarea');reasonField.maxLength=300;reasonField.rows=3;
 reasonLabel.append(reasonField);
 const confirmationActions=node('div'),cancelAction=node('button','Cancel'),confirmAction=node('button');
 const confirmationError=node('p');confirmationError.setAttribute('role','status');
 confirmationActions.append(cancelAction,confirmAction);
 confirmation.append(confirmationTitle,confirmationText,reasonLabel,confirmationError,confirmationActions);
 document.body.append(confirmation);
 let actionTarget=null;
 function confirmPlayerAction(type,player){
  closeOptions();
  actionTarget={type,playerId:player.id,roomId:network.room?.id};
  const reporting=type==='report';
  confirmationTitle.textContent=(reporting?'Report ':'Kick ')+player.name+'?';
  confirmationText.textContent=reporting?'Tell us why you’re reporting this player.':'This player will be removed from the server.';
  reasonLabel.hidden=!reporting;reasonField.value='';confirmationError.textContent='';
  confirmAction.textContent=reporting?'Submit report':'Kick player';confirmAction.disabled=reporting;
  if(!confirmation.open)confirmation.showModal();
  (reporting?reasonField:cancelAction).focus();
 }
 cancelAction.onclick=()=>confirmation.close();
 reasonField.oninput=()=>{confirmAction.disabled=!reasonField.value.trim()};
 confirmAction.onclick=()=>{
  const {type,playerId,roomId}=actionTarget;
  const room=network.room;
  const reason=reasonField.value.trim();
  try{
   if(room?.id!==roomId||!room?.players.some(p=>p.id===playerId))throw Error('That player is no longer in this server.');
   if(type==='kick'&&room.hostId!==network.self)throw Error('Only the host can kick players.');
   if(type==='report'&&!reason)return;
   sendAction({type,to:playerId,...type==='report'&&{reason}});
   confirmation.close();
  }catch(error){confirmationError.textContent=error.message}
 };
 let rosterSignature='',more=null;
 const playerCells=new Map();
 function closeOptions(){
  more?.remove();more=null;
  document.removeEventListener('pointerdown',dismissOptions,true);
 }
 function dismissOptions(event){
  if(more&&!more.contains(event.target)&&!event.target.closest?.('[data-player-options]'))closeOptions();
 }
 const settings=roster?.closest('dialog');
 settings?.addEventListener('close',closeOptions);
 settings?.querySelector('.settingsTabs')?.addEventListener('click',closeOptions);
 playersTab?.addEventListener('click',()=>{
  rosterSignature='';renderRoster(Date.now()+(network.serverOffset||0));
 });
 const tokens=async()=>{
  const player=account();
  if(!player?.ready||player.guest||!player.client)return null;
  const {data}=await player.client.auth.getSession();
  return data?.session?.access_token||null;
 };
 const network=new MultiplayerNetwork({endpoint,token:tokens,onChange:renderMenu,onError:error=>{message.textContent=error;if(entered)notify(error)},onNotice:notify,onExit:(reason,kind)=>returnHome(reason,kind)});
 const sendAction=payload=>{if(!network.send(payload))throw Error('Multiplayer is reconnecting. Try again shortly.')};
 const ghosts=new Map(),nameplates=new Map();
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
  const playerCount=rooms.reduce((n,r)=>n+r.count,0);
  online.textContent=playerCount+(playerCount===1?' player online':' players online');
  servers.textContent=rooms.length+' / '+(snapshot?.maxRooms||2)+' active servers';
  const latency=network.serverPing??network.directoryPing;
  status.textContent=network.status+(latency===undefined?'':' · '+latency+' ms signaling');
  quick.disabled=busy||!snapshot;
  if(!menu.hidden){
   const scrollTop=list.scrollTop;
   const focusedRoom=list.contains(document.activeElement)?document.activeElement.dataset.roomId:null;
   list.replaceChildren();
   if(!rooms.length)list.append(node('p',snapshot?'No active servers.':'Connecting to server directory…'));
   for(const room of rooms){
    const card=node('article'),detail=node('div',null,'multiplayerServerDetails'),join=node('button','Join','multiplayerJoin');
    const thumbnail=node('div',null,'multiplayerServerArt');thumbnail.setAttribute('aria-hidden','true');
    const host=node('p','Host · '+room.host,'multiplayerHostLine');
    const crown=node('span','👑');crown.setAttribute('aria-hidden','true');host.prepend(crown);
    const occupancy=node('p',room.count+' / '+room.capacity+' players · '+roomTime(room.expires-time)+' remaining');
    occupancy.prepend(icon('group.svg'));
    detail.append(node('h3',room.name),host,occupancy);
    const locations=node('p',null,'multiplayerLocationBlock');
    const places=Object.entries(room.locations).map(([group,count])=>locationName(group,bodies)+' · '+count);
    if(places.length){locations.append(icon('ui/pin.svg'),node('strong','Locations (Players):'),node('span',places.join(' · ')));detail.append(locations)}
    join.prepend(icon('play_arrow.svg'));
    join.disabled=busy||room.full||!room.count||room.expires<=time;
    join.dataset.roomId=room.id;
    join.onclick=()=>start('join',room.id);card.append(thumbnail,detail,join);list.append(card);
    if(focusedRoom===room.id&&!join.disabled)join.focus({preventScroll:true});

   }
   list.scrollTop=scrollTop;
  }
  renderRoster(time);
 }
 function updatePlayerCells(player){
  const {location,signal,ping}=playerCells.get(player.id);
  const place=player.location?locationName(player.location,bodies):'Connecting';
  if(location.textContent!==place)location.textContent=location.title=place;
  const latency=player.id===network.self?(network.serverPing??network.directoryPing??player.ping):player.ping;
  const label=!Number.isFinite(latency)?'—':latency+' ms';
  if(ping.textContent!==label){
   ping.textContent=label;ping.title='Latency to multiplayer server';
   signal.dataset.strength=!Number.isFinite(latency)?'unknown':latency<120?'good':latency<200?'fair':'poor';
  }
 }
 function renderRoster(time){
  if(!roster||!playersTab)return;
  const room=entered?network.room:null;
  playersTab.hidden=!room;
  if(!room){
   rosterSignature='';rows.replaceChildren();playerCells.clear();profiles.clear();sentRequests.clear();rosterStatus.textContent='';closeOptions();
   if(playersTab.getAttribute('aria-selected')==='true')document.getElementById('settingsTab-game')?.click();
   return;
  }
  server.textContent='Server: '+room.name;
  count.textContent=room.count+'/'+room.capacity;
  count.setAttribute('aria-label',room.count+' of '+room.capacity+' players');
  serverTime.textContent=roomTime(room.expires-time).padStart(5,'0')+' left';
  const ordered=[...room.players].sort((a,b)=>(a.joined||0)-(b.joined||0));
  const signature=JSON.stringify([room.hostId,ordered.map(({id,name,username,avatar,verified})=>[id,name,username,avatar,verified])]);
  if(signature===rosterSignature){
   for(const player of ordered)updatePlayerCells(player);
   return;
  }
  rosterSignature=signature;closeOptions();rows.replaceChildren();playerCells.clear();
  const action=(label,text,run)=>{
   const button=node('button',text);button.title=label;button.setAttribute('aria-label',label);
   button.onclick=async()=>{try{await run()}catch(error){rosterStatus.textContent=error.message||'Player action failed.'}};
   return button;
  };
  ordered.forEach((player,index)=>{
   const row=node('div',null,'multiplayerRosterRow'),identity=node('div',null,'multiplayerRosterIdentity');
   const name=node('strong'),details=node('div'),avatar=node('img');
   avatar.referrerPolicy='no-referrer';
   setAvatar(avatar,player.id===network.self?(account()?.profile?.avatar||player.avatar):player.avatar);
   if(player.username&&player.id!==network.self&&playersTab.getAttribute('aria-selected')==='true'){
    loadRosterProfile(player).then(profile=>{if(profile?.avatar)setAvatar(avatar,profile.avatar)}).catch(()=>{});
   }
   setVerifiedName(name,player.name,player.verified);
   if(player.id===network.self)name.append(node('span',' (You)','multiplayerYou'));
   details.append(name);if(player.id===room.hostId)details.append(node('small','Host'));
   const hostMark=node('span',player.id===room.hostId?'👑':'','multiplayerHostMark');hostMark.setAttribute('aria-hidden','true');
   const profileButton=action('View profile of '+player.name,'',()=>openRosterProfile(player));
   profileButton.className='multiplayerProfileLink';profileButton.append(avatar,details);
   identity.append(hostMark,profileButton);
   const actions=node('div',null,'multiplayerRosterActions');
   if(player.id!==network.self){
    const add=action('Add friend','+',async()=>{
     if(!player.username){rosterStatus.textContent='Friend requests are unavailable for '+player.name+' until their account name loads.';return}
     add.disabled=true;
     try{
      await account().rpc('tzg_social_action',{p_action:'request',p_username:player.username});
      sentRequests.add(player.id);
      add.textContent='✓';add.title='Friend request sent';
      add.setAttribute('aria-label','Friend request sent');
      rosterStatus.textContent='Friend request sent to '+player.name+'.';
     }finally{add.disabled=sentRequests.has(player.id)}
    });
    if(sentRequests.has(player.id)){add.disabled=true;add.textContent='✓';add.title='Friend request sent';add.setAttribute('aria-label',add.title)}
    actions.append(add,action('Report player','⚠',()=>confirmPlayerAction('report',player)));
    const options=action('More player actions','⋯',()=>{
     const wasOpen=more?.dataset.player===player.id;closeOptions();
     if(wasOpen||network.room?.hostId!==network.self||!settings)return;
     const popup=node('div',null,'multiplayerPlayerOptions');popup.dataset.player=player.id;more=popup;
     const anchor=options.getBoundingClientRect(),panel=settings;
     panel.append(popup);
     const transfer=()=>{closeOptions();if(network.room?.hostId===network.self&&globalThis.confirm('Transfer host to '+player.name+'?'))sendAction({type:'transfer',to:player.id})};
     popup.append(action('Transfer Host','Transfer Host',transfer),action('Kick','Kick',()=>confirmPlayerAction('kick',player)));
     const box=popup.getBoundingClientRect(),bounds=panel.getBoundingClientRect();
     popup.style.left=Math.max(4,Math.min(bounds.width-box.width-4,anchor.right-bounds.left-box.width))+'px';
     popup.style.top=Math.max(4,Math.min(bounds.height-box.height-4,anchor.bottom-bounds.top))+'px';
     document.addEventListener('pointerdown',dismissOptions,true);
    });
    options.dataset.playerOptions='';
    options.disabled=room.hostId!==network.self;
    actions.append(options);
   }
   const location=node('span'),pingCell=node('span',null,'multiplayerRosterPing');
   const signal=node('span',null,'multiplayerSignal'),ping=node('span');
   signal.setAttribute('aria-hidden','true');signal.append(node('i'),node('i'),node('i'));
   pingCell.append(signal,ping);
   playerCells.set(player.id,{location,signal,ping});
   updatePlayerCells(player);
   row.append(node('span',String(index+1)),identity,location,pingCell,actions);
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
   if(action==='join'||action==='quick')await home.play(prepare);
   else await prepare();
  }finally{busy=false;renderMenu()}
 }

 function disconnect(){if(confirmation.open)confirmation.close();if(profileInfo.open)profileInfo.close();entered=false;network.leave();clearGhosts();closeOptions();loading.hidden=true}
 async function returnHome(reason,kind){
  disconnect();
  try{await leave()}finally{
   if(reason){
    exitTitle.textContent=kind==='kicked'?'Removed from server':'Multiplayer disconnected';
    exitMessage.textContent=reason;
    openPanel(exitNotice);dismiss.focus();
   }
  }
 }
 function removeGhost(ghost){
  const portal=ghost.userData.portal;
  portal?.dispose();
  ghost.removeFromParent();ghost.userData.dispose?.()}
 function clearGhosts(){for(const ghost of ghosts.values())removeGhost(ghost);ghosts.clear();for(const plate of nameplates.values())plate.remove();nameplates.clear()}
 const projected=new T.Vector3(),marker=new T.Vector3(),cameraPoint=new T.Vector3(),targetRotation=new T.Quaternion();
 const warpEnd=new T.Vector3(),portalCenter=new T.Vector3(),portalForward=new T.Vector3();
 function animateWarp(ghost,packet,age,camera,nowSeconds){
  const fx=packet.warpFx;
  const portal=ghost.userData.portal;
  if(portal)portal.group.visible=false;
  ghost.visible=true;
  if(!fx)return;
  const elapsed=fx.elapsed+age;
  if(fx.kind==='local'){
   const fraction=T.MathUtils.clamp((elapsed-1)/(fx.duration-1),0,1);
   warpEnd.fromArray(fx.end);
   ghost.position.addScaledVector(warpEnd.sub(marker.fromArray(fx.start)),fraction*fraction*(3-2*fraction));
   const facing=T.MathUtils.smoothstep(elapsed,0,1);
   if(warpEnd.lengthSq()>.001){
    portalForward.set(0,0,-1);
    targetRotation.setFromUnitVectors(portalForward,warpEnd.normalize());
    ghost.quaternion.slerp(targetRotation,facing);
   }
   return;
  }
  const effect=portal??(ghost.userData.portal=new WormholeVisual(12));
  if(effect.group.parent!==ghost.parent)ghost.parent.add(effect.group);
  const exiting=fx.kind==='exit';
  portalForward.set(0,0,-1).applyQuaternion(ghost.quaternion);
  portalCenter.copy(ghost.position).addScaledVector(portalForward,exiting?-85:85);
  effect.group.position.copy(portalCenter);
  const size=T.MathUtils.smoothstep(elapsed,0,.6)*(1-T.MathUtils.smoothstep(elapsed,1.85,2.75));
  effect.group.scale.setScalar(size);
  effect.group.visible=size>0;
  if(camera&&size>0)effect.update(camera,sky(),nowSeconds);
  if(exiting){
   const progress=T.MathUtils.smoothstep(elapsed,.6,2.15);
   ghost.position.lerp(portalCenter,1-progress);
   ghost.visible=elapsed>=.6;
  }else{
   ghost.position.lerp(portalCenter,T.MathUtils.smoothstep(elapsed,.45,1.85));
   ghost.visible=elapsed<1.85;
  }
 }
 function drawNameplate(player,position,separation,camera,now,approximate,inSpace){
  let plate=nameplates.get(player.id);
  if(!plate){
   plate=node('div',null,'multiplayerNameplate');plate.append(node('strong'),node('span'),node('span'));
   nameplates.set(player.id,plate);document.body.append(plate);
  }
  const identity=player.name+'|'+player.verified+'|'+player.device+'|'+player.level;
  if(plate.dataset.identity!==identity){
   plate.dataset.identity=identity;setVerifiedName(plate.children[0],player.name,player.verified);
   plate.children[1].textContent=(player.device||'Unknown')+' (Lv-'+(player.level||1)+')';
  }
  const range=(approximate?'≈ ':'')+multiplayerDistance(separation,inSpace);
  if(plate.children[2].textContent!==range)plate.children[2].textContent=range;
  cameraPoint.copy(position).applyMatrix4(camera.matrixWorldInverse);
  projected.copy(position).project(camera);
  const offscreen=cameraPoint.z>=0||Math.abs(projected.x)>1||Math.abs(projected.y)>1;
  let x=projected.x,y=projected.y;
  if(offscreen){
   x=cameraPoint.x;y=cameraPoint.y;
   if(Math.abs(x)+Math.abs(y)<.001)y=-1;
   const scale=Math.max(Math.abs(x),Math.abs(y));
   x/=scale;y/=scale;
  }
  const half=plate.offsetWidth/2,height=plate.offsetHeight;
  x=T.MathUtils.clamp((x*.5+.5)*innerWidth,half+10,innerWidth-half-10);
  y=T.MathUtils.clamp((.5-y*.5)*innerHeight,height+10,innerHeight-10);
  plate.style.left=x+'px';plate.style.top=y+'px';
 }
 function update(dt,scene,origin,camera){
  if(!network.room||!entered){clearGhosts();return}
  const local=pose();network.update(local);
  if(!scene||!active()){clearGhosts();return}
  const now=performance.now(),keep=new Set(),visiblePlayers=new Set(),peers=network.remotePeers();
  const draw=(key,packet,from=packet,alpha=1,age=0)=>{
   keep.add(key);
   let ghost=ghosts.get(key);
   if(!ghost||ghost.userData.mode!==packet.mode){
    if(ghost)removeGhost(ghost);
    ghost=model(packet.mode);ghost.userData.mode=packet.mode;ghosts.set(key,ghost);
   }
   if(ghost.parent!==scene)scene.add(ghost);
   ghost.position.fromArray(from.pos);
   if(alpha!==0)ghost.position.lerp(projected.fromArray(packet.pos),alpha);
   if(origin)ghost.position.sub(origin);
   ghost.quaternion.fromArray(from.q).slerp(targetRotation.fromArray(packet.q),alpha);
   if(packet.warpFx?.kind==='local'){
    ghost.position.fromArray(packet.warpFx.start);
    if(origin)ghost.position.sub(origin);
   }
   animateWarp(ghost,packet,age,camera,now/1000);
   marker.copy(ghost.position);
   if(origin)marker.add(origin);
   if(marker.distanceToSquared(projected.fromArray(local.pos))>locationRange(local.group)**2)ghost.visible=false;
   ghost.userData.animate?.(packet,now,{dt,origin,camera});
   return ghost;
  };
  for(const player of network.room.players){
   if(player.id===network.self||player.location!==local.group)continue;
   const peer=peers.get(player.id),packet=peer?.pose;
   const nearby=packet&&now-peer.seen<=8500&&packet.group===local.group&&distance(packet.pos,local.pos)<=locationRange(local.group);
   let separation;
   if(nearby){
    const {from,to,alpha}=remotePoseFrame(peer,now);
    const ghost=packet.warpFx||from.warpFx||to.warpFx
     ?draw(player.id,packet,packet,1,Math.max(0,(now-peer.seen)/1000))
     :draw(player.id,to,from,alpha);
    // Predicted warp motion can take the ship out of model range between packets.
    marker.copy(ghost.position);
    if(origin)marker.add(origin);
    separation=distance(marker.toArray(),local.pos);
    if(to.parkedShip&&distance(to.parkedShip.pos,local.pos)<=locationRange(local.group))draw(player.id+':ship',to.parkedShip,from.parkedShip??to.parkedShip,alpha);
    marker.copy(ghost.position);
    if(camera)marker.addScaledVector(camera.up,to.mode==='foot'?2.1:7);

   }else if(player.anchor){
    marker.fromArray(player.anchor);
    if(origin)marker.sub(origin);
    separation=distance(player.anchor,local.pos);
   }else continue;
   if(camera){
    visiblePlayers.add(player.id);
    drawNameplate(player,marker,separation,camera,now,!nearby,!!origin);
   }
  }
  for(const [id,ghost] of ghosts)if(!keep.has(id)){removeGhost(ghost);ghosts.delete(id)}
  for(const [id,plate] of nameplates)if(!visiblePlayers.has(id)){plate.remove();nameplates.delete(id)}
  if(now-lastPaint>750){lastPaint=now;renderMenu()}
 }
 launch.onclick=()=>{openPanel(menu);refreshList()};
 refresh.onclick=refreshList;
 close.onclick=()=>{closePanel(menu);if(!network.room)network.close()};
 quick.onclick=()=>start('quick');create.onclick=()=>start('create');
 retry.onclick=()=>start(operation,roomId);back.onclick=()=>{loading.hidden=true};
 const timer=setInterval(()=>{
  if(entered&&network.room&&network.local)network.update(document.hidden?network.local:pose());
  if(!menu.hidden||entered)renderMenu();
 },1000);timer.unref?.();
 window.addEventListener('tzg-home-ready',()=>checkAccess());
 window.addEventListener('tzg-signed-in',()=>checkAccess());
 window.addEventListener('tzg-signed-out',()=>{approved=null;launch.disabled=true;entered=false;network.leave();clearGhosts();closeOptions();menu.hidden=loading.hidden=true});
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
