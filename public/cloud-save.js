export function cloudInventory(economy){return {fp:economy.fp,rc:economy.rc,inventory:[...economy.inventory.values()].map(({body,type,qty})=>({body,type,qty})).sort((a,b)=>(a.body+'|'+a.type).localeCompare(b.body+'|'+b.type))}}
export class CloudSave{
 constructor({rpc,userId,snapshot,onStatus=()=>{},onProgress=()=>{},onFailure=()=>{},delay=400}){Object.assign(this,{rpc,userId,snapshot,onStatus,onProgress,onFailure,delay});this.ready=false;this.revision=0;this.pending=null;this.running=null;this.confirmed='';this.timer=null;this.blocked=false}
 hydrate(state){this.revision=state.revision;this.confirmed=JSON.stringify(this.snapshot());this.ready=true;this.blocked=false;this.onStatus('Saved to server')}
 get dirty(){return !!this.externalPending||!!this.pending||this.ready&&JSON.stringify(this.snapshot())!==this.confirmed}
 changed(){if(!this.ready||this.blocked||this.externalPending||this.externalRunning)return;if(!this.dirty)return;this.onStatus('Saving…');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),this.delay)}
 async flush(){clearTimeout(this.timer);if(this.externalPending)throw Error('A reward is pending. Open Daily Rewards to retry before saving.');if(this.running)return this.running;if(!this.ready)return;if(this.blocked)throw Error('Reload to resolve the cloud save conflict.');this.running=this.drain();try{return await this.running}finally{this.running=null}}
 async drain(){try{while(this.dirty){if(!this.pending){const state=this.snapshot();this.pending={state,signature:JSON.stringify(state),mutation:crypto.randomUUID(),revision:this.revision}}
 const p=this.pending,result=await this.rpc('tzg_player_save',{p_account:this.userId,p_expected_revision:p.revision,p_mutation:p.mutation,p_state:p.state});
 if(!Number.isSafeInteger(result?.revision)||result.revision<=p.revision)throw Error('Server did not confirm this save.');this.revision=result.revision;this.confirmed=p.signature;this.pending=null;if(result.progress)this.onProgress(result.progress)}
 this.onStatus('Saved to server');
 }catch(e){this.blocked=e.code==='40001'||String(e.message).includes('CLOUD_CONFLICT');this.onStatus(this.blocked?'Save conflict — reload required':'Not saved — connection interrupted');this.onFailure(e,this.blocked);throw e}}
 async serverMutation(name,args,apply){
 if(this.externalRunning)throw Error('A reward is already being confirmed.');
 if(!this.ready||this.blocked)throw Error('Reconnect before claiming rewards.');
 this.externalRunning=true;clearTimeout(this.timer);
 try{
  if(!this.externalPending){await this.flush();this.externalPending={name,args:{...args,p_expected_revision:this.revision,p_mutation:crypto.randomUUID()},before:structuredClone(this.snapshot())};}
  const p=this.externalPending;if(p.name!==name||p.args.p_kind!==args.p_kind||p.args.p_body!==args.p_body)throw Error('Retry the pending reward first.');
  const result=await this.rpc(p.name,p.args);
  if(!this.ready)throw Error('Account changed while confirming reward.');
  if(!Number.isSafeInteger(result?.revision)||result.revision<this.revision||!result.state||!Number.isSafeInteger(result.state.fp)||!Number.isSafeInteger(result.state.rc))throw Error('Server did not confirm this reward.');
  apply(result.state,p.before);this.revision=result.revision;this.confirmed=JSON.stringify(result.state);this.externalPending=null;this.onStatus('Saved to server');return result;
 }catch(e){if(e.code&&/^(22|23|42|P0)/.test(e.code))this.externalPending=null;if(e.code==='40001'){this.blocked=true;this.onFailure(e,true);}throw e;
 }finally{this.externalRunning=false;if(!this.externalPending)this.changed();}
 }
 dispose(){clearTimeout(this.timer);this.ready=false}
}
