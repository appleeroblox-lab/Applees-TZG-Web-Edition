export const NOTIFICATION_DEFAULTS={global:false,party:true,friends:true};
const WORKER='./service-worker.js';
const WORKER_OPTIONS={scope:'./',updateViaCache:'none'};
const ROOM_ID=/^[0-9a-f-]{36}$/i;

export class MobileNotifications{
 constructor(account,{doc=document,win=window}={}){
  Object.assign(this,{account,doc,win});
  this.prefs={...NOTIFICATION_DEFAULTS};this.active=false;
  this.status=doc.getElementById('mobileNotificationStatus');
  this.button=doc.getElementById('enableMobileNotifications');
  this.controls={global:doc.getElementById('mobileGlobalChatNotification'),party:doc.getElementById('partyChatNotification')};
  for(const [kind,node] of Object.entries(this.controls))if(node)node.onchange=()=>{
   this.prefs[kind]=node.checked;this.save();
   if(this.active)this.sync().catch(error=>this.paint(error.message));
  };
  if(this.button)this.button.onclick=()=>this.enable(true);
  this.paint();
  this.win.navigator?.serviceWorker?.addEventListener?.('message',({data})=>{
   if(data?.type==='tzg-open-push'){
    if(this.account.ready)this.openNotification(data.kind,data.room);
    else this.pendingNotification=data;
    return;
   }
   if(!this.account.ready)return;
   if(data?.type==='tzg-push'){
    if(data.kind==='global')this.account.chat.read();
    else this.account.friends.pollNotifications();
   }
  });
 }
 paint(text){
  for(const [kind,node] of Object.entries(this.controls))if(node)node.checked=this.prefs[kind];
  if(this.button)this.button.disabled=this.enabling===true;
  if(text&&this.status)this.status.textContent=text;
 }
 save(){try{this.win.localStorage.setItem('tzg-phone-notifications-'+(this.owner||'device'),JSON.stringify(this.prefs))}catch{}}
 supportError(){
  const nav=this.win.navigator;
  const ios=/iPhone|iPad|iPod/i.test(nav?.userAgent||'')||(/Mac/i.test(nav?.platform||'')&&nav?.maxTouchPoints>1);
  if(ios&&nav.standalone!==true&&!this.win.matchMedia?.('(display-mode: standalone)').matches){
   return 'On iPhone or iPad, add the game to your Home Screen, then open it from there to enable notifications.';
  }
  if(!this.win.Notification||!nav?.serviceWorker||this.win.isSecureContext===false){
   return 'Phone notifications require a supported browser on HTTPS. On iPhone or iPad, use the Home Screen app on iOS 16.4 or later.';
  }
  return '';
 }
 async connect(){
  this.owner=this.account.loadedId;
  this.prefs={...NOTIFICATION_DEFAULTS};
  try{Object.assign(this.prefs,JSON.parse(this.win.localStorage.getItem('tzg-phone-notifications-'+this.owner))||{})}catch{}
  const unsupported=this.supportError();
  this.paint(unsupported||'Tap Enable Phone Notifications to receive alerts while the game is closed.');
  this.openLink();
  if(this.pendingNotification){const {kind,room}=this.pendingNotification;this.pendingNotification=null;this.openNotification(kind,room)}
  if(unsupported)return;
  if(this.win.Notification.permission==='granted')await this.enable(false);
  else if(this.win.Notification.permission==='default')this.prepare(this.owner).catch(()=>{});
 }
 prepare(owner){
  if(this.prepared?.owner===owner)return this.prepared.promise;
  const state={owner};
  state.promise=(async()=>{
   const worker=this.win.navigator.serviceWorker;
   const registration=await worker.register(WORKER,WORKER_OPTIONS);
   if(!registration.pushManager)throw Error('Push is unavailable here. Open the installed game or try another supported browser.');
   await worker.ready;
   const session=await this.account.client.auth.getSession();
   const token=session.data?.session?.access_token;
   if(!token)throw Error('Sign in again to enable notifications.');
   const response=await fetch(this.account.config.url+'/functions/v1/push-dispatch',{
    method:'POST',headers:{Authorization:'Bearer '+token,apikey:this.account.config.publishableKey,'Content-Type':'application/json'},
    body:JSON.stringify({action:'config'})
   });
   const config=await response.json().catch(()=>null);
   if(!response.ok||!config?.publicKey)throw Error(config?.error||'The push server is unavailable. Try again in a moment.');
   const base=config.publicKey.replace(/-/g,'+').replace(/_/g,'/');
   const key=Uint8Array.from(atob(base+'='.repeat((4-base.length%4)%4)),c=>c.charCodeAt(0));
   state.config={registration,key};
   return state.config;
  })().catch(error=>{if(this.prepared===state)this.prepared=null;throw error});
  this.prepared=state;
  return state.promise;
 }
 async enable(ask){
  if(this.enabling)return;
  this.enabling=true;
  const owner=this.account.loadedId;
  const sessionCurrent=()=>this.account.ready&&this.account.loadedId===owner;
  let created=null;
  try{
   if(!sessionCurrent())throw Error('Sign in first.');
   const unsupported=this.supportError();
   if(unsupported)throw Error(unsupported);
   let permission=this.win.Notification.permission;
   const prepared=this.prepared?.owner===owner?this.prepared.config:null;
   if(permission==='default'&&ask)permission=await this.win.Notification.requestPermission();
   if(permission!=='granted')throw Error(permission==='denied'?'Notifications are blocked. Allow them in your phone or browser notification settings.':'Tap Enable Phone Notifications and choose Allow.');
   this.paint('Connecting phone notifications…');
   const {registration,key}=prepared||await this.prepare(owner);
   if(!sessionCurrent())return;
   const manager=registration.pushManager;
   let subscription=await manager.getSubscription();
   const previousKey=subscription?.options?.applicationServerKey;
   if(previousKey&&(previousKey.byteLength!==key.byteLength||new Uint8Array(previousKey).some((byte,index)=>byte!==key[index]))){
    await subscription.unsubscribe();subscription=null;
   }
   if(!subscription)subscription=created=await manager.subscribe({userVisibleOnly:true,applicationServerKey:key});
   if(!sessionCurrent()){await created?.unsubscribe();return}
   this.registration=registration;this.subscription=subscription;
   await this.sync();
   if(!sessionCurrent())return;
   this.active=true;this.paint('Phone notifications enabled.');
  }catch(error){if(sessionCurrent()){this.active=false;this.paint(error.message)}}
  finally{this.enabling=false;this.paint()}
 }
 async sync(){
  if(!this.subscription||!this.account.ready)return;
  await this.account.rpc('tzg_push_subscribe',{p_subscription:this.subscription.toJSON(),p_global:this.prefs.global,p_party:this.prefs.party,p_friends:true});
 }
 async notify(kind,title,body,tag){
  if(!this.prefs[kind]||this.active||!this.doc.hidden||this.win.Notification?.permission!=='granted')return;
  try{
   this.registration??=await this.win.navigator.serviceWorker.register(WORKER,WORKER_OPTIONS);
   await this.registration.showNotification(title,{body,tag:'tzg-'+tag,icon:'./images/app-icon.png',data:{kind}});
  }catch{}
 }
 async disconnect(){
  this.active=false;this.prepared=null;
  const subscription=this.subscription;this.subscription=null;
  if(subscription){
   try{await this.account.rpc('tzg_push_unsubscribe',{p_endpoint:subscription.endpoint})}catch{}
   try{await subscription.unsubscribe()}catch{}
  }
  try{for(const note of await this.registration?.getNotifications()||[])if(note.tag?.startsWith('tzg-'))note.close()}catch{}
 }
 openLink(){
  let url;try{url=new URL(this.win.location.href)}catch{return}
  const kind=url.searchParams.get('notify');if(!kind)return;
  const room=url.searchParams.get('room');url.searchParams.delete('notify');url.searchParams.delete('room');
  try{this.win.history.replaceState(null,'',url)}catch{}
  this.openNotification(kind,room);
 }
 openNotification(kind,room){
  if(kind==='global')this.account.chat.toggle(true);
  else if(kind==='friends'){
   this.account.friends.page='requests';this.account.friends.root.hidden=false;this.account.friends.refresh();
  }else if(kind==='party'){
   if(ROOM_ID.test(room||''))this.account.friends.openRoom(room).catch(()=>{});
   else{this.account.friends.root.hidden=false;this.account.friends.refresh()}
  }
 }
}
