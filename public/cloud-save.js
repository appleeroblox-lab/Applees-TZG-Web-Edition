export function cloudInventory(economy){return {fp:economy.fp,rc:economy.rc,inventory:[...economy.inventory.values()].map(({body,type,qty})=>({body,type,qty})).sort((a,b)=>(a.body+'|'+a.type).localeCompare(b.body+'|'+b.type))}}
export class CloudSave{
 constructor({rpc,userId,snapshot,onStatus=()=>{},onFailure=()=>{},delay=400}){Object.assign(this,{rpc,userId,snapshot,onStatus,onFailure,delay});this.ready=false;this.revision=0;this.pending=null;this.running=null;this.confirmed='';this.timer=null;this.blocked=false}
 hydrate(state){this.revision=state.revision;this.confirmed=JSON.stringify(this.snapshot());this.ready=true;this.blocked=false;this.onStatus('Saved to server')}
 get dirty(){return !!this.pending||this.ready&&JSON.stringify(this.snapshot())!==this.confirmed}
 changed(){if(!this.ready||this.blocked)return;if(!this.dirty)return;this.onStatus('Saving…');clearTimeout(this.timer);this.timer=setTimeout(()=>this.flush().catch(()=>{}),this.delay)}
 async flush(){clearTimeout(this.timer);if(this.running)return this.running;if(!this.ready)return;if(this.blocked)throw Error('Reload to resolve the cloud save conflict.');this.running=this.drain();try{return await this.running}finally{this.running=null}}
 async drain(){try{while(this.dirty){if(!this.pending){const state=this.snapshot();this.pending={state,signature:JSON.stringify(state),mutation:crypto.randomUUID(),revision:this.revision}}
 const p=this.pending,result=await this.rpc('tzg_player_save',{p_account:this.userId,p_expected_revision:p.revision,p_mutation:p.mutation,p_state:p.state});
 if(!Number.isSafeInteger(result?.revision)||result.revision<=p.revision)throw Error('Server did not confirm this save.');this.revision=result.revision;this.confirmed=p.signature;this.pending=null}
 this.onStatus('Saved to server');
 }catch(e){this.blocked=e.code==='40001'||String(e.message).includes('CLOUD_CONFLICT');this.onStatus(this.blocked?'Save conflict — reload required':'Not saved — connection interrupted');this.onFailure(e,this.blocked);throw e}}
 dispose(){clearTimeout(this.timer);this.ready=false}
}
