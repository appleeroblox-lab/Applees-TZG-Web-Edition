// Achievement-only observers: original methods/return values and gameplay rules stay intact.
export class AchievementTracking{
 constructor({account,achievements,economy,flight,surface,crew,shipBoost,context=()=>({})}){
  Object.assign(this,{account,achievements,economy,flight,surface,crew,shipBoost,context});this.queue=[];this.epoch=0;this.playing=false;this.lastInput=0;this.seq=0;
  for(const type of ['pointerdown','pointermove','keydown','wheel','touchmove'])window.addEventListener(type,e=>{if(e.isTrusted)this.lastInput=performance.now()},{passive:true});
  window.addEventListener('tzg-play',()=>{this.playing=true;this.start()});window.addEventListener('tzg-signed-in',()=>{this.reset();this.start()});window.addEventListener('tzg-member-continue',()=>this.start());window.addEventListener('tzg-guest-start',()=>this.reset());window.addEventListener('online',()=>this.drain());window.addEventListener('tzg-achievement-retry',()=>this.run?this.drain():this.start());
  document.addEventListener('visibilitychange',()=>this.activityMode(document.hidden?'paused':'manual'));
  this.timer=setInterval(()=>{if(!document.hidden)this.enqueue({type:'sample'})},5000);this.timer.unref?.();
  const rpc=account.rpc.bind(account);account.rpc=async(name,args)=>{const result=await rpc(name,args);if(name==='tzg_player_save')this.lastSaveMutation=args.p_mutation;return result};
  const wrap=(object,name,observe)=>{const original=object[name];object[name]=(...args)=>{const before=name==='step'?object.nav:name==='place'?object.held?.type:null;const result=original.apply(object,args);try{observe(result,args,before)}catch(e){this.failure(e)}return result}};
  wrap(surface,'requestLaunch',ok=>{if(ok)this.enqueue({type:'countdown'})});
  wrap(surface,'enter',(ok,args)=>{if(ok&&!args[1])this.enqueue({type:'entry'})});
  wrap(surface,'step',()=>{const event=surface.event;if(!event)return;const type={ignition:'ignition',touchdown:'landing',exit:'exit'}[event.type];if(type==='exit'){const before={...this.snapshot(),system:event.b.system,body:event.b.id,pos:surface.pos.toArray(),altitude:Math.max(0,surface.pos.y-1.39),phase:event.gas?'gas':'flying',foot:false,boost:false,mode:'manual'};this.enqueue({type:'sample'},{sample:before})}if(type)this.enqueue({type})});
  wrap(flight,'navigate',ok=>{if(ok&&flight.nav?.kind==='warp')this.enqueue({type:'warp_start',target:flight.nav.b.id},{flush:true})});
  wrap(flight,'cancel',()=>{if(this.warpPending){this.warpPending=false;this.enqueue({type:'warp_cancel'})}});
  wrap(flight,'step',(_,args,before)=>{if(flight.event?.type==='enter')this.enqueue({type:'sample'});if(before?.kind==='warp'&&flight.event?.type==='arrive'){this.warpPending=false;this.enqueue({type:'warp_finish',target:before.b.id})}});
  const boostStep=shipBoost.step.bind(shipBoost);shipBoost.step=(...args)=>{const active=shipBoost.active,result=boostStep(...args);if(active!==shipBoost.active)this.enqueue({type:'sample'});return result};
  wrap(crew,'leave',ok=>{if(ok)this.enqueue({type:'sample'})});wrap(crew,'board',ok=>{if(ok)this.enqueue({type:'sample'})});
  wrap(economy,'place',(ok,args,type)=>{if(ok&&type==='tnt'){const block=economy.placements.at(-1);this.enqueue({type:'tnt_place',block:block.id,pos:[block.x,block.y,block.z]},{flush:true})}});
  wrap(economy,'igniteTNT',(ok,args)=>{if(ok)this.enqueue({type:'tnt_ignite',block:args[0]})});
  wrap(economy,'detonateTNT',(result,args)=>{if(result)this.enqueue({type:'tnt_explode',block:args[0]})});
  wrap(economy,'hit',(result,args)=>{if(result?.ok)this.enqueue({type:'mine',node:args[0],tool:economy.held?.type||'pickaxe'})});
  wrap(economy,'craft',ok=>{if(ok)this.enqueue({type:'craft'},{save:true})});
  wrap(economy,'sell',result=>{if(result?.ok)this.enqueue({type:'sale'},{save:true})});
 }
 member(){return this.playing&&this.account.ready&&!this.account.guest&&!!this.account.loadedId}
 reset(){this.epoch++;clearTimeout(this.retry);this.run=null;this.seq=0;this.queue=[];this.warpPending=false;this.lastInput=0;this.started=false;this.lastConfirmedSample=null;this.activity=null}
 async start(){if(!this.member())return;if(this.run)return;const baseline=this.snapshot();this.run=crypto.randomUUID();const epoch=this.epoch,id=this.account.loadedId;try{const state=await this.account.rpc('tzg_achievement_tracker_start',{p_run:this.run});if(epoch!==this.epoch||id!==this.account.loadedId||!this.member())return;this.seq=state.seq;this.started=true;if(baseline)this.queue.unshift({action:{type:'sample'},sample:baseline,options:{}});this.drain()}catch(e){if(epoch===this.epoch){this.run=null;this.started=false;this.failure(e);clearTimeout(this.retry);this.retry=setTimeout(()=>this.start(),10000)}}}
 snapshot(){const c=this.context();if(c.experimental||!this.member()||document.hidden)return null;
  const {surface:s,flight:f,crew}=this,body=s.active?s.body:null;const controls=f.input||{},held=Object.entries(controls).some(([key,v])=>!['boost','brake'].includes(key)&&typeof v==='number'&&Math.abs(v)>.04);
  const input=(held||performance.now()-this.lastInput<15000)&&!document.querySelector?.('dialog[open]'),mode=c.debug?'debug':c.free?'free':c.paused?'paused':f.nav?.kind||'manual';
  return {system:f.system,body:body?.id||null,pos:(s.active?(crew.onFoot?crew.eye():s.pos):f.pos).toArray(),altitude:s.active?Math.max(0,s.altitude||0):0,phase:s.active?s.phase==='ascent'?'flying':s.phase:'space',input,boost:!s.active&&this.shipBoost.active&&!!controls.boost,foot:!!crew.onFoot,mode};
 }
 activityMode(mode){if(mode===this.activity)return;this.activity=mode;if(mode!=='manual'&&this.lastConfirmedSample)this.enqueue({type:'sample'},{sample:{...this.lastConfirmedSample,input:false,boost:false,mode},marker:true});else if(mode==='manual')this.enqueue({type:'sample'})}
 enqueue(action,options={}){const c=this.context();if(!this.member()||(!options.marker&&(c.experimental||c.debug||c.free)))return;const sample=options.sample||this.snapshot();if(!sample||!options.marker&&(sample.mode==='debug'||sample.mode==='free'))return;
  // Avoid unbounded offline queues and stale heartbeat credit. Real actions are retained first.
  if(action.type==='sample'&&!options.marker&&this.flight.nav?.kind==='warp')return;
  if(action.type==='sample'&&!options.marker&&this.queue.some(e=>e.action.type==='sample'&&!e.options.marker))return;
  if(this.queue.length>=256){this.failure(Error('Achievement tracking is delayed. Reconnect to resume.'));return}
  if(action.type==='warp_start')this.warpPending=true;
  this.queue.push({action,sample,options});if(!this.run)this.start();else this.drain();
 }
 failure(error){this.achievements.trackingError='Achievement tracking: '+(error.message||'connection interrupted')+'. Actions retry when connected.';this.achievements.draw()}
 async drain(){if(this.busy||!this.member()||!this.started||!this.run)return;this.busy=true;const epoch=this.epoch,id=this.account.loadedId;try{
  while(this.queue.length&&this.member()&&epoch===this.epoch&&id===this.account.loadedId){const item=this.queue[0];
   if(item.options.flush&&!item.flushed){await this.account.cloud.flush();item.flushed=true;item.action.mutation=this.lastSaveMutation;}
   const args={p_run:this.run,p_seq:this.seq+1,p_sample:item.sample,p_action:item.action};let result;
   try{result=await this.account.rpc('tzg_achievement_observe',args)}catch(e){
    if(e.code&&/^(22|42|P0|42501)/.test(e.code)){
     // A rejected action cannot be retried as an unlock. Advance only an inert baseline.
     try{await this.account.rpc('tzg_achievement_observe',{...args,p_sample:{...item.sample,mode:'paused'},p_action:{type:'sample'}});this.seq++;this.lastConfirmedSample={...item.sample,mode:'paused'}}catch{/* Rejected baselines earn nothing and do not advance the sequence. */}this.queue.shift();this.failure(e);continue;
    }throw e;
   }
   if(epoch!==this.epoch||id!==this.account.loadedId||!this.member())return;
   if(result.seq!==this.seq+1)throw Error('Achievement event was not confirmed');this.seq=result.seq;this.lastConfirmedSample=item.sample;this.queue.shift();if(this.achievements.trackingError){this.achievements.trackingError='';this.achievements.draw()}
   if(item.options.save)await this.account.cloud.flush();
   if(item.action.type!=='sample'||result.changed)this.achievements.schedule();
  }
 }catch(e){if(epoch===this.epoch){this.failure(e);clearTimeout(this.retry);this.retry=setTimeout(()=>this.drain(),5000)}}finally{this.busy=false}}
 }
