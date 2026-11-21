import {createClient} from 'npm:@supabase/supabase-js@2.49.1';

const url=Deno.env.get('SUPABASE_URL')||'';
const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'';
const allowedOrigins=new Set(['https://appleeroblox-lab.github.io','https://applees-tzg-web-edition.space']);
const webhookURL=/^https:\/\/discord\.com\/api\/webhooks\/[0-9]{15,22}\/[A-Za-z0-9_-]{20,200}$/;
const uuid=/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i;
const seen=new Map<string,number>();
const nextAlert={guest:0,member:0,test:0};
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
 const reply=(data:object,status=200)=>new Response(JSON.stringify(data),{status,headers:{...headers,'Content-Type':'application/json'}});
 let test=false;
 if(request.method==='OPTIONS')return done();
 if(request.method!=='POST')return new Response(null,{status:405,headers});
 if(!url||!serviceKey)return done();

 try {
  const text=await request.text();
  if(text.length>160)return done();
  const {kind,visitor,restored}=JSON.parse(text);
  if(kind!=='member'&&kind!=='guest'&&kind!=='test')return done();
  test=kind==='test';

  const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
  let sessionId=null,userId=null,guestId=null;
  if(kind!=='guest'){
   const token=(request.headers.get('authorization')||'').match(/^Bearer (\S+)$/i)?.[1];
   if(!token)return test?reply({error:'Developer sign-in required.'},401):done();
   const result=await admin.auth.getUser(token);
   if(result.error||!result.data.user)return test?reply({error:'Developer sign-in required.'},401):done();
   userId=result.data.user.id;
   sessionId=jwtSessionId(token);
   if(!sessionId)return test?reply({error:'Developer sign-in required.'},401):done();
   if(test){
    const dev=createClient(url,Deno.env.get('SUPABASE_ANON_KEY')||'',{global:{headers:{Authorization:'Bearer '+token}},auth:{persistSession:false,autoRefreshToken:false}});
    const access=await dev.rpc('tzg_debug_authorize',{p_command:null});
    if(access.error||access.data?.authorized!==true)return reply({error:'Developer access denied.'},403);
   }
  }else{
   if(typeof visitor!=='string'||!uuid.test(visitor))return done();
   guestId=visitor;
  }
  const key=kind+':'+(sessionId||guestId);
  const now=Date.now();
  for(const [id,expiry] of seen)if(expiry<=now)seen.delete(id);
  if((!test&&seen.has(key))||now<discordBackoff||now<nextAlert[kind])return test?reply({error:'Wait a few seconds before testing again.'},429):done();

  const {data:secret,error}=await admin.rpc('tzg_discord_delivery_config',{
   p_member_session:sessionId,p_member_user:userId,p_guest_visitor:guestId,p_test:test,
  });
  if(error||typeof secret!=='string')return test?reply({error:'Save a webhook URL before testing.'},400):done();
  const config=secret.startsWith('{')?JSON.parse(secret):{url:secret};
  const webhook=config.url;
  const settings=config.settings||{};
  if(typeof webhook!=='string'||!webhookURL.test(webhook))return test?reply({error:'The saved webhook URL is invalid.'},400):done();
  if(!test&&settings[kind]===false)return done();

  const dispatchTime=Date.now();
  if((!test&&seen.has(key))||dispatchTime<discordBackoff||dispatchTime<nextAlert[kind])return test?reply({error:'Wait a few seconds before testing again.'},429):done();
  if(!test)seen.set(key,dispatchTime+(kind==='guest'?30000:120000));
  nextAlert[kind]=dispatchTime+5000;
  const {browser,device}=browserInfo((request.headers.get('user-agent')||'').slice(0,1024));
  const label=test?'Webhook test':kind==='member'?(restored===true?'Member auto-login':'Member sign-in'):'Guest entry';
  const color=/^#[0-9a-f]{6}$/i.test(settings.color||'')?parseInt(settings.color.slice(1),16):0x3498db;
  const fields=[
   ...(settings.browser===false?[]:[{name:'Browser',value:browser,inline:true}]),
   ...(settings.device===false?[]:[{name:'Device',value:device,inline:true}]),
  ];
  const details=config.details||{};
  const addField=(name:string,value:unknown)=>{
   if(typeof value==='string'&&value)fields.push({name,value:value.slice(0,250),inline:true});
   else if(typeof value==='number'&&Number.isFinite(value))fields.push({name,value:value.toLocaleString('en-US'),inline:true});
  };
  if(settings.account!==false){
   addField('Display name',details.display_name);
   addField('Username',details.username);
   addField('Public player ID',details.public_id);
  }
  if(settings.currency!==false){
   addField('Flight Points (FP)',details.fp);
   addField('Rocket Coins (RC)',details.rc);
  }
  if(settings.progress!==false){
   addField('XP',details.xp);
   addField('Level',details.level);
  }
  if(settings.ip===true)addField('Member sign-in IP',details.ip);
  const embed={title:label,color,fields,...(settings.utc===false?{}:{timestamp:new Date(dispatchTime).toISOString()})};
  const response=await fetch(webhook+'?wait=true',{
   method:'POST',redirect:'error',signal:AbortSignal.timeout(7000),
   headers:{'Content-Type':'application/json'},
   body:JSON.stringify({embeds:[embed],allowed_mentions:{parse:[]}}),
  });
  if(response.status===429){
   const seconds=Number(response.headers.get('retry-after'));
   discordBackoff=Date.now()+(seconds>0?Math.min(seconds,300):5)*1000;
  }
  await response.body?.cancel();
  if(test)return response.ok?reply({ok:true}):reply({error:'Discord rejected the request (HTTP '+response.status+'). Check or replace the webhook URL.'},502);
  if(!response.ok)console.warn('Discord sign-in notification rejected',response.status);
 }catch{
  if(test)return reply({error:'Could not reach Discord. Try again.'},502);
  console.warn('Discord sign-in notification failed');
  // Analytics must never block the game or log the webhook credential.
 }
 return done();
});
