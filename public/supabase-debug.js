import {parseDebugCommand} from './debug-commands.js?v=105';

// Developer tokens stay in memory for this page only, separate from game saves.
export class SupabaseDebugService{
 constructor(config,request=(...args)=>fetch(...args)){
  const url=new URL(config.url);
  if(url.protocol!=='https:'||url.pathname!=='/'||url.search||url.hash||!config.publishableKey.startsWith('sb_publishable_'))throw Error('Invalid public backend configuration.');
  this.url=url.origin;this.key=config.publishableKey;this.request=request;this.token=null;this.expires=0;
 }
 async send(path,data,token,keepalive=false){
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
   const response=await this.request(this.url+path,{method:'POST',credentials:'omit',keepalive,signal:controller.signal,headers:{apikey:this.key,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(data)});
   let result;try{result=await response.json()}catch{if(response.ok)return {};throw Error('Developer service returned an unreadable response.')}
   if(!response.ok){let message=result?.msg||result?.message||result?.error_description||result?.error||'Developer authorization failed.';if(result?.code==='PGRST202')message='Developer database setup is missing. Run the Supabase account/social migrations first.';if(response.status===429)message='Too many login attempts. Wait a few minutes and retry.';if(response.status===401)message='Developer session expired or login was denied. Please sign in again.';throw Object.assign(Error(message),{status:response.status})}
   return result;
  }catch(e){if(e.name==='AbortError')throw Error('Developer service timed out. Check your connection and retry.');throw e}finally{clearTimeout(timer)}
 }
 async api(action,data={},keepalive=false){
  if(action==='status')return {configured:true,setupAllowed:false,provider:'supabase'};
  if(action==='logout'){const token=this.token;this.token=null;this.expires=0;if(token)await this.send('/auth/v1/logout?scope=local',{},token,keepalive);return {ok:true}}
  if(action==='login'){
   await this.api('logout').catch(()=>{});
   const session=await this.send('/auth/v1/token?grant_type=password',{email:String(data.email||'').trim(),password:data.code});
   if(!session.access_token||!Number.isFinite(Number(session.expires_in)))throw Error('Developer login did not return a valid session.');
   try{const access=await this.send('/rest/v1/rpc/tzg_debug_authorize',{p_command:null},session.access_token);if(access?.authorized!==true)throw Object.assign(Error('Developer access denied.'),{status:403})}
   catch(e){await this.send('/auth/v1/logout?scope=local',{},session.access_token).catch(()=>{});throw e}
   this.token=session.access_token;this.expires=Date.now()+Number(session.expires_in)*1000;return {ok:true};
  }
  if(action==='accounts'){
   if(!this.token||Date.now()>=this.expires)throw Object.assign(Error('Developer session expired. Please sign in again.'),{status:401});
   try{return await this.send('/rest/v1/rpc/tzg_debug_accounts',{p_offset:data.offset||0,p_search:String(data.search||'').slice(0,100)},this.token)}catch(e){if(e.status===401||e.status===403){this.token=null;this.expires=0;e.status=401}throw e}
  }
  const routes={'delete-report':['tzg_debug_report_delete',{p_report:data.report}],'verified-accounts':['tzg_debug_verified_accounts',{p_offset:data.offset||0,p_search:String(data.search||'').slice(0,100)}],'message-logs':['tzg_debug_message_logs',{p_offset:data.offset||0}],'message-log':['tzg_debug_message_log',{p_log:data.log}],'reports-status':['tzg_debug_reports_status',{p_after:data.after||'0'}],account:['tzg_debug_account',{p_target:data.target}], 'account-action':['tzg_debug_account_action',{p_target:data.target,p_action:data.action,p_reason:data.reason,p_data:data.data||{}}], reports:['tzg_debug_reports',{p_offset:data.offset||0,p_status:data.status||'open'}], 'review-report':['tzg_debug_report_review',{p_report:data.report,p_status:data.status}]};
  if(routes[action]){if(!this.token||Date.now()>=this.expires)throw Object.assign(Error('Developer session expired. Please sign in again.'),{status:401});try{return await this.send('/rest/v1/rpc/'+routes[action][0],routes[action][1],this.token)}catch(e){if(e.status===401||e.status===403){this.token=null;this.expires=0;e.status=401}throw e}}
  if(action==='command'){
   if(!this.token||Date.now()>=this.expires){this.token=null;throw Object.assign(Error('Developer session expired. Please sign in again.'),{status:401})}
   const command=parseDebugCommand(data.command);
   try{const access=await this.send('/rest/v1/rpc/tzg_debug_authorize',{p_command:data.command},this.token);if(access?.authorized!==true)throw Object.assign(Error('Developer access denied.'),{status:403});return {ok:true,command}}
   catch(e){if(e.status===401||e.status===403){this.token=null;this.expires=0;e.status=401}throw e}
  }
  throw Error('Unsupported developer authorization action.');
 }
}
