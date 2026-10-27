import {createClient} from 'npm:@supabase/supabase-js@2.49.1';
import webpush from 'npm:web-push@3.6.7';
const url=Deno.env.get('SUPABASE_URL')||'',serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')||'',anon=Deno.env.get('SUPABASE_ANON_KEY')||'';
const cors={'Access-Control-Allow-Origin':'https://appleeroblox-lab.github.io','Access-Control-Allow-Headers':'authorization,apikey,content-type','Access-Control-Allow-Methods':'POST,OPTIONS'};
const json=(data:unknown,status=200)=>new Response(JSON.stringify(data),{status,headers:{...cors,'Content-Type':'application/json'}});
function endpointAllowed(endpoint:string){try{const u=new URL(endpoint);return u.protocol==='https:'&&!u.username&&!u.password&&(!u.port||u.port==='443')&&(/^(fcm(?:-x)?\.googleapis\.com|android\.googleapis\.com|web\.push\.apple\.com)$/.test(u.hostname)||u.hostname.endsWith('.push.services.mozilla.com')||u.hostname.endsWith('.notify.windows.com'))}catch{return false}}
Deno.serve(async request=>{
 if(request.method==='OPTIONS')return new Response(null,{headers:cors});if(request.method!=='POST')return json({error:'POST required'},405);if(!url||!serviceKey)return json({error:'Server configuration unavailable'},503);
 const admin=createClient(url,serviceKey,{auth:{persistSession:false,autoRefreshToken:false}});
 try{const body=await request.json().catch(()=>({}));
  if(body.action==='config'){
   const authorization=request.headers.get('authorization')||'';if(!authorization.startsWith('Bearer '))return json({error:'Sign in required'},401);
   const user=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false,autoRefreshToken:false}});
   const valid=await user.rpc('tzg_push_authorize');if(valid.error||!valid.data)return json({error:'An active account is required'},403);
   const generated=webpush.generateVAPIDKeys(),secret=crypto.randomUUID()+crypto.randomUUID();
   const init=await admin.rpc('tzg_push_server_config',{p_create:{public_key:generated.publicKey,private_key:generated.privateKey,dispatch_secret:secret,url:url+'/functions/v1/push-dispatch'}});if(init.error)throw init.error;
   return json({publicKey:init.data.public_key});
  }
  const config=await admin.rpc('tzg_push_server_config',{p_create:null});if(config.error)throw config.error;if(!config.data||request.headers.get('x-push-secret')!==config.data.dispatch_secret)return json({error:'Forbidden'},403);
  webpush.setVapidDetails('https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/index.html',config.data.public_key,config.data.private_key);
  const batch=await admin.rpc('tzg_push_claim');if(batch.error)throw batch.error;let sent=0;
  for(const job of batch.data||[]){let retry=false;for(const item of job.subscriptions||[]){if(!endpointAllowed(item.endpoint)){await admin.rpc('tzg_push_drop',{p_endpoint:item.endpoint});continue}try{await webpush.sendNotification({endpoint:item.endpoint,keys:item.keys},JSON.stringify(job.payload),{TTL:job.payload.kind==='friends'?86400:300,urgency:'normal',timeout:8000});sent++}catch(error){const status=Number((error as {statusCode?:number}).statusCode)||0;if(status===404||status===410)await admin.rpc('tzg_push_drop',{p_endpoint:item.endpoint});else retry=true}}
   await admin.rpc('tzg_push_ack',{p_id:job.id,p_retry:retry});
  }return json({sent});
 }catch(error){console.error('Push dispatch error',String((error as {code?:string}).code||'service-error').slice(0,30));return json({error:'Push service temporarily unavailable'},503)}
});
