self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));

const KINDS=['global','party','friends'];
const ROOM_ID=/^[0-9a-f-]{36}$/i;

self.addEventListener('push',event=>event.waitUntil((async()=>{
 let payload;try{payload=event.data.json()}catch{return}
 if(!KINDS.includes(payload?.kind))return;
 const scope=self.registration.scope;
 await self.registration.showNotification(String(payload.title||'The Zero Gravity').slice(0,120),{
  body:String(payload.body||'New activity in the game').slice(0,200),
  icon:new URL('images/app-icon.png',scope).href,
  badge:new URL('images/favicon.png',scope).href,
  tag:'tzg-'+String(payload.tag||payload.kind).slice(0,100),
  data:{kind:payload.kind,room:payload.room||null}
 });
 const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
 for(const client of clients)if(client.url.startsWith(scope)&&client.focused){
  client.postMessage({type:'tzg-push',kind:payload.kind});
 }
})()));

self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const data=event.notification.data||{},scope=self.registration.scope,url=new URL('index.html',scope);
  const kind=KINDS.includes(data.kind)?data.kind:'friends';
  const room=ROOM_ID.test(data.room||'')?data.room:null;
  url.searchParams.set('notify',kind);
  if(room)url.searchParams.set('room',room);
  const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of clients)if(client.url.startsWith(scope)&&[url.pathname,new URL(scope).pathname].includes(new URL(client.url).pathname)){
   try{await client.focus();client.postMessage({type:'tzg-open-push',kind,room});return}catch{}
  }
  return self.clients.openWindow(url.href);
 })());
});
