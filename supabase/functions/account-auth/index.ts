// @ts-nocheck
// Credentials stay in the Edge runtime. No service key is bundled with the game.
export const INTERNAL_DOMAIN='accounts.tzg.invalid';
export function createHandler({env=name=>Deno.env.get(name),fetcher=fetch}={}){
 const url=env('SUPABASE_URL'),service=env('SUPABASE_SERVICE_ROLE_KEY'),anon=env('SUPABASE_ANON_KEY');
 const internal=email=>typeof email==='string'&&email.endsWith('@'+INTERNAL_DOMAIN);
 return async req=>{
 const origin=req.headers.get('origin'),allowed=[...new Set(['https://appleeroblox-lab.github.io','https://applees-tzg-web-edition.space',...(env('TZG_ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean)])];
 const headers={'Content-Type':'application/json','Cache-Control':'no-store','Access-Control-Allow-Origin':allowed.includes(origin)?origin:allowed[0],'Access-Control-Allow-Headers':'authorization,apikey,content-type,x-client-info','Access-Control-Allow-Methods':'POST,OPTIONS','Vary':'Origin'};
 const reply=(data,status=200)=>new Response(JSON.stringify(data),{status,headers});
 if(origin&&!allowed.includes(origin))return reply({error:'Origin is not allowed.'},403);
 if(req.method==='OPTIONS')return new Response(null,{status:204,headers});
 if(req.method!=='POST')return reply({error:'Use POST.'},405);
 if(!url||!service||!anon)return reply({error:'Account service is not configured.'},503);
 const call=async(path,body,{admin=false,token,method='POST'}={})=>{const key=admin?service:anon;const r=await fetcher(url+path,{method,headers:{apikey:key,Authorization:'Bearer '+(token||key),'Content-Type':'application/json'},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(12000)});const data=await r.json().catch(()=>({}));if(!r.ok){const error=Error(data.msg||data.message||data.error_description||data.error||'Account service unavailable.');error.status=r.status;error.code=data.code||data.error_code;throw error}return data};
 const rpc=(name,args)=>call('/rest/v1/rpc/'+name,args,{admin:true});
 try{
  const raw=await req.text();if(raw.length>50000)return reply({error:'Request is too large.'},413);
  let input;try{input=JSON.parse(raw)}catch{return reply({error:'Invalid request.'},400)}
  const action=input?.action;if(!['signup','login','recover','email_start','email_remove'].includes(action))return reply({error:'Invalid action.'},400);
  const ip=req.headers.get('cf-connecting-ip')||req.headers.get('x-forwarded-for')?.split(',').at(-1)?.trim()||'unknown';
  const digest=async value=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(value)))).map(b=>b.toString(16).padStart(2,'0')).join('');
  if(!await rpc('tzg_auth_rate',{p_key:action+':'+await digest(ip),p_limit:action==='signup'?5:action==='login'?30:5,p_seconds:action==='login'?60:3600}))return reply({error:'Too many attempts. Please try again later.'},429);
  const identifier=String(input.identifier||'').trim().toLowerCase(),password=String(input.password||'');
  const signIn=(email,secret)=>call('/auth/v1/token?grant_type=password',{email,password:secret});
  const redirect=String(input.redirect_to||'https://appleeroblox-lab.github.io/Applees-TZG-Web-Edition/index.html');
  if(['recover','email_start'].includes(action)){let target;try{target=new URL(redirect)}catch{return reply({error:'Invalid return address.'},400)}if(!allowed.includes(target.origin))return reply({error:'Invalid return address.'},400);}
  if(action==='signup'){
   const username=String(input.username||'').trim().toLowerCase(),name=String(input.display_name||'').trim(),birth=String(input.date_of_birth||''),avatar=input.avatar??null;
   if(!/^[a-z0-9_]{3,36}$/.test(username)||username.startsWith('p_'))return reply({error:'Choose a valid username.'},400);
   if(!name||name.length>32||password.length<12||password.length>128)return reply({error:'Use a display name and a password with 12–128 characters.'},400);
   const d=new Date(birth+'T00:00:00Z'),now=new Date();if(!/^\d{4}-\d{2}-\d{2}$/.test(birth)||!Number.isFinite(d.getTime())||d.toISOString().slice(0,10)!==birth||d>now||d.getUTCFullYear()<Math.max(1900,now.getUTCFullYear()-125))return reply({error:'Choose a valid birthday.'},400);
   if(avatar!==null&&(typeof avatar!=='string'||avatar.length>40000||!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(avatar)))return reply({error:'Choose a smaller profile image.'},400);
   if(!await rpc('tzg_username_available',{p_username:username}))return reply({error:'Username already taken.'},409);
   const email=crypto.randomUUID()+'@'+INTERNAL_DOMAIN;let created;
   try{created=await call('/auth/v1/admin/users',{email,password,email_confirm:true,user_metadata:{username,display_name:name},app_metadata:{tzg_optional_email:true}},{admin:true});await rpc('tzg_auth_register',{p_user:created.id,p_date:birth,p_avatar:avatar});}catch(e){if(created?.id)await call('/auth/v1/admin/users/'+created.id,undefined,{admin:true,method:'DELETE'}).catch(()=>{});throw e}
   return reply({session:await signIn(email,password)});
  }
  if(action==='login'||action==='recover'){
   if(identifier.length<3||identifier.length>254)return reply({error:'Incorrect email, username or password.'},400);
   if(action==='login'&&!await rpc('tzg_auth_rate',{p_key:'identifier:'+await digest(identifier),p_limit:50,p_seconds:3600}))return reply({error:'Too many attempts. Please try again later.'},429);
   const match=await rpc('tzg_auth_lookup',{p_identifier:identifier});
   if(action==='recover'){if(match?.email&&!internal(match.email)&&match.email_confirmed)await call('/auth/v1/recover?redirect_to='+encodeURIComponent(redirect),{email:match.email});return reply({ok:true})}
   // Always make a password attempt to keep missing usernames from becoming a timing oracle.
   try{return reply({session:await signIn(match?.email||'missing@'+INTERNAL_DOMAIN,password)})}catch{return reply({error:'Incorrect email, username or password.'},400)}
  }
  const token=(req.headers.get('authorization')||'').replace(/^Bearer\s+/i,'');if(!token)return reply({error:'Sign in again.'},401);
  const user=await call('/auth/v1/user',undefined,{token,method:'GET'});if(!user?.id||user.is_anonymous)return reply({error:'Sign in again.'},401);
  // Reauthenticate removal and every change of a real recovery address.
  if(action==='email_remove'||!internal(user.email)){if(!password)return reply({error:'Enter your current password.'},400);try{const proof=await signIn(user.email,password);await call('/auth/v1/logout?scope=local',undefined,{token:proof.access_token}).catch(()=>{})}catch{return reply({error:'Current password is incorrect.'},400)}}
  if(action==='email_remove'){
   if(internal(user.email))return reply({ok:true});const email=crypto.randomUUID()+'@'+INTERNAL_DOMAIN;
   await call('/auth/v1/admin/users/'+user.id,{email,email_confirm:true},{admin:true});return reply({ok:true,session:await signIn(email,password)});
  }
  const email=String(input.email||'').trim().toLowerCase();if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)||email.length>254||internal(email))return reply({error:'Enter a valid email address.'},400);
  await call('/auth/v1/user?redirect_to='+encodeURIComponent(redirect),{email},{token,method:'PUT'});
  if(internal(user.email)){
   // The placeholder inbox belongs to this service, never to another player.
   // Approve only that side of secure email change; the real inbox must still verify its link.
   try{const link=await call('/auth/v1/admin/generate_link',{type:'email_change_current',email:user.email,new_email:email},{admin:true});if(!link.hashed_token)throw Error('Email verification setup failed.');await call('/auth/v1/verify',{token_hash:link.hashed_token,type:'email_change'});}catch(e){if(!String(e.message).includes('Enable secure email change'))throw e;}
  }
  return reply({ok:true});
 }catch(e){const invalid=(e.status&&e.status<500)||/username|birthday|image|password/i.test(e.message);return reply({error:invalid?String(e.message).slice(0,180):'Account service is unavailable. Please retry.'},invalid?400:503);}
 };
}
if(typeof Deno!=='undefined')Deno.serve(createHandler());
