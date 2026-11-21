import {createClient} from 'npm:@supabase/supabase-js@2.49.1';

const url=Deno.env.get('SUPABASE_URL')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const allowedOrigins=new Set(['https://appleeroblox-lab.github.io','https://applees-tzg-web-edition.space']);
const webhookURL=/^https:\/\/discord\.com\/api\/webhooks\/[0-9]{15,22}\/[A-Za-z0-9_-]{20,200}$/;
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const seen=new Map<string,number>();
const nextAlert={guest:0,member:0};
let discordBackoff=0;

function browserInfo(agent:string) {
 const ua=agent.toLowerCase();
 const browser=/edg(e|a|ios)?\//.test(ua)?'Edge':/opr\/|opios\//.test(ua)?'Opera':
  ua.includes('samsungbrowser/')?'Samsung Internet':/firefox\/|fxios\//.test(ua)?'Firefox':
  /chrome\/|crios\//.test(ua)?'Chrome':ua.includes('safari/')?'Safari':'Other';
 const device=ua.includes('android')?'Android':/iphone|ipad|ipod/.test(ua)?'iOS / iPadOS':
  /windows|macintosh|x11|linux/.test(ua)?'Desktop':'Other';
 return {browser,device};
}

function jwtSessionId(token:string):string|null {
 try {
  const encoded=token.split('.')[1].replace(/-/g,'+').replace(/_/g,'/');
  const id=JSON.parse(atob(encoded)).session_id;
  return typeof id==='string'&&uuid.test(id)?id:null;
 } catch {return null}
}

Deno.serve(async request=>{
 const origin=request.headers.get('origin')||'';
 if(!allowedOrigins.has(origin))return new Response(null,{status:403});
 const headers={
  'Access-Control-Allow-Origin':origin,
  'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info',
  'Access-Control-Allow-Methods':'POST,OPTIONS',
  'Vary':'Origin',
 };
 const done=()=>new Response(null,{status:204,headers});
 if(request.method==='OPTIONS')return done();
 if(request.method!=='POST')return new Response(null,{status:405,headers});
 if(!url||!serviceKey)return done();

 try {
  const text=await request.text();
  if(text.length>160)return done();
  const {kind,visitor}=JSON.parse(text);
  if(kind!=='member'&&kind!=='guest')return done();

  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  let sessionId=null,userId=null,guestId=null;
  if(kind==='member'){
   const token=(request.headers.get('authorization')||'').match(/^Bearer (\S+)$/i)?.[1];
   if(!token)return done();
   const result=await admin.auth.getUser(token);
   if(result.error||!result.data.user)return done();
   userId=result.data.user.id;
   sessionId=jwtSessionId(token);
   if(!sessionId)return done();
  }else{
   if(typeof visitor!=='string'||!uuid.test(visitor))return done();
   guestId=visitor;
  }
  const key=kind+':'+(sessionId||guestId);
  const now=Date.now();
  for(const [id,expiry] of seen)if(expiry<=now)seen.delete(id);
  if(seen.has(key)||now<discordBackoff||now<nextAlert[kind])return done();

  const {data:webhook,error}=await admin.rpc('tzg_discord_live_config',{
   p_member_session:sessionId,p_member_user:userId,p_guest_visitor:guestId,
  });
  if(error||typeof webhook!=='string'||!webhookURL.test(webhook))return done();

  const dispatchTime=Date.now();
  if(seen.has(key)||dispatchTime<discordBackoff||dispatchTime<nextAlert[kind])return done();
  seen.set(key,dispatchTime+(kind==='guest'?30000:120000));
  nextAlert[kind]=dispatchTime+5000;
  const {browser,device}=browserInfo((request.headers.get('user-agent')||'').slice(0,1024));
  const utc=new Date(dispatchTime).toISOString().slice(0,19).replace('T',' ');
  const label=kind==='member'?'Member sign-in':'Guest entry';
  const response=await fetch(webhook,{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(3000),
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({content:`**${label}** · ${browser} · ${device} · ${utc} UTC`,allowed_mentions:{parse:[]}}),
  });
  if(response.status===429){
   const seconds=Number(response.headers.get('retry-after'));
   discordBackoff=Date.now()+(seconds>0?Math.min(seconds,300):5)*1000;
  }
  await response.body?.cancel();
 }catch{
  // Analytics must never block the game or log the webhook credential.
 }
 return done();
});
