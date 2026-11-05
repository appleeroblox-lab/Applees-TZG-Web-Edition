import {ACHIEVEMENTS,RARITIES} from './achievement-catalog.js?v=174';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!==undefined)n.textContent=text;return n};
const rarityOrder=Object.keys(RARITIES);
const sortedAchievements=[...ACHIEVEMENTS].sort((a,b)=>rarityOrder.indexOf(a.rarity)-rarityOrder.indexOf(b.rarity)||a.id.localeCompare(b.id));
const progressEvents=new Set(['tzg_player_save','tzg_system_unlock','tzg_social_action','tzg_social_create','tzg_social_group','tzg_social_public_join','tzg_exploration_event']);
const button=(text,fn)=>{const n=el('button','',text);n.type='button';n.onclick=fn;return n};
function achievementIcon(a){const n=el('span','achievementIcon');n.setAttribute('aria-hidden','true');n.style.setProperty('--achievement-icon',`url(icons/${['rocket_launch','route','public','pan_tool','settings','gift','achievement','group'][Math.floor((+a.id-1)/10)]}.svg)`);return n}
export class Achievements{
 constructor({account,sound,anchor=document.querySelector('#gameTop nav')}){
  Object.assign(this,{account,sound,anchor});this.rows=new Map();this.queue=[];this.epoch=0;this.error='';this.playing=false;
  const css=el('link');css.rel='stylesheet';css.href='./achievements.css?v=175';document.head.append(css);
  this.trigger=button('',()=>this.root.open?this.close():this.open());this.trigger.id='achievementsBtn';const trophy=el('img','uiIcon');trophy.src='icons/achievement.svg';trophy.alt='';this.trigger.append(trophy);this.trigger.title='Achievements';this.trigger.setAttribute('aria-label','Achievements');this.trigger.setAttribute('aria-haspopup','dialog');this.trigger.setAttribute('aria-expanded','false');const accountButton=document.getElementById('accountBtn');accountButton.after(this.trigger);this.trigger.className=accountButton.className;const sizeButton=()=>{const box=accountButton.getBoundingClientRect();if(box.width&&box.height){for(const key of ['width','min-width','max-width'])this.trigger.style.setProperty(key,box.width+'px','important');for(const key of ['height','min-height','max-height'])this.trigger.style.setProperty(key,box.height+'px','important')}};this.buttonObserver=new ResizeObserver(sizeButton);this.buttonObserver.observe(accountButton);sizeButton();
  this.root=el('dialog');this.root.id='achievementsMenu';this.root.setAttribute('aria-label','Achievements');
  const head=el('div','achievementHead');head.append(el('h2','','Achievements'));const close=button('×',()=>this.close());close.className='achievementClose';close.setAttribute('aria-label','Close achievements');head.append(close);
  this.summary=el('p','achievementSummary');this.total=el('small','','Lifetime catalog rewards: 100,000 FP · 10,000 RC');this.overall=el('progress');this.overall.max=80;
  this.status=el('p','achievementStatus');this.status.setAttribute('role','status');this.retry=button('Retry',()=>{this.refresh();window.dispatchEvent(new Event('tzg-achievement-retry'))});this.retry.hidden=true;
  const tools=el('div','achievementTools');this.search=el('input');this.search.type='search';this.search.placeholder='Search achievements…';this.search.setAttribute('aria-label','Search achievements');this.search.oninput=()=>this.draw();
  this.filter=el('select');this.filter.setAttribute('aria-label','Achievement rarity');for(const rarity of ['All',...Object.keys(RARITIES)]){const opt=el('option','',rarity==='All'?'Rarity: All':rarity);opt.value=rarity;this.filter.append(opt)}this.filter.onchange=()=>this.draw();tools.append(this.search,this.filter);
  this.list=el('div','achievementList');this.list.tabIndex=0;this.list.setAttribute('aria-label','Achievement list');this.root.append(head,this.summary,this.overall,this.total,tools,this.status,this.retry,this.list);document.body.append(this.root);
  this.root.addEventListener('click',e=>{const r=this.trigger.getBoundingClientRect();if(e.clientX>=r.left&&e.clientX<=r.right&&e.clientY>=r.top&&e.clientY<=r.bottom){e.preventDefault();this.close()}});
  this.root.addEventListener('close',()=>this.trigger.setAttribute('aria-expanded',String(this.root.open)));
  for(const event of ['keydown','keyup','pointerdown','pointerup','wheel'])this.root.addEventListener(event,e=>e.stopPropagation());
  const rpc=account.rpc.bind(account);account.rpc=async(name,args)=>{const result=await rpc(name,args);if(progressEvents.has(name))this.schedule();return result};
  window.addEventListener('tzg-signed-in',()=>{this.reset();this.refresh()});window.addEventListener('tzg-guest-start',()=>{this.reset();this.draw()});window.addEventListener('tzg-play',()=>{this.playing=true;this.refresh();this.nextToast()});window.addEventListener('online',()=>this.refresh());window.addEventListener('tzg-member-continue',()=>this.refresh());
  this.timer=setInterval(()=>{if(!document.hidden&&this.playing)this.refresh()},15000);this.timer.unref?.();
  this.observer=new MutationObserver(records=>{for(const record of records){const n=record.target;if(n.tagName==='DIALOG'&&n.open&&n.matches(':modal'))this.topModal=n;else if(n===this.topModal&&!n.open)this.topModal=null}if(this.toast)this.layerToast()});this.observer.observe(document.body,{subtree:true,attributes:true,attributeFilter:['open']});
  this.draw();
 }
 member(){return !!(this.account.ready&&!this.account.guest&&this.account.loadedId)}
 reset(){this.epoch++;this.rows.clear();this.queue=[];this.dismissToast();this.error='';this.draw()}
 schedule(){clearTimeout(this.refreshTimer);this.refreshTimer=setTimeout(()=>this.refresh(),300);this.refreshTimer.unref?.()}
 async refresh(){
  if(!this.member())return;if(this.busy){this.refreshAgain=true;return}const epoch=this.epoch,id=this.account.loadedId;this.busy=true;
  const current=()=>epoch===this.epoch&&id===this.account.loadedId&&this.member();
  try{
   const state=await this.account.rpc('tzg_achievement_state');if(!current())return;this.rows=new Map(state.map(row=>[row.id,row]));this.error='';this.draw();
   if(this.playing&&this.account.gate?.hidden){const notices=await this.account.rpc('tzg_achievement_notices');if(!current())return;for(const id of notices)if(!this.queue.includes(id)&&this.toastId!==id)this.queue.push(id);this.nextToast()}
   if(state.some(r=>r.completed_at&&!r.claimed_at)||this.account.cloud?.externalPending?.name==='tzg_achievement_claim'){
    if(this.account.cloud?.externalRunning)return;
    const result=await this.account.cloud.serverMutation('tzg_achievement_claim',{p_kind:'achievements',p_body:null},(state,before)=>{if(current())this.account.applyReward(state.fp-before.fp,state.rc-before.rc)});
    if(!current())return;for(const id of result.ids||[]){const row=this.rows.get(id);if(row){row.claimed_at=new Date().toISOString();row.completed_at??=row.claimed_at;row.progress=row.target}}this.draw();
   }
  }catch(e){if(current()){this.error=e.message||'Achievements could not sync. Retry when connected.';this.draw()}}finally{this.busy=false;if(this.refreshAgain){this.refreshAgain=false;this.schedule()}}
 }
 open(id){if(id&&this.root.open)this.root.close();if(!this.root.open){this.account.clearControls?.();this.root.showModal()}this.topModal=this.root;this.trigger.setAttribute('aria-expanded','true');this.draw();if(id){this.search.value='';this.filter.value='All';this.draw();requestAnimationFrame(()=>{const card=this.list.querySelector('[data-achievement="'+id+'"]');card?.scrollIntoView({block:'center',behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});card?.classList.add('achievementFocus');setTimeout(()=>card?.classList.remove('achievementFocus'),2500)})}else this.refresh();this.layerToast()}
 close(){this.root.close();this.trigger.setAttribute('aria-expanded','false')}
 draw(){
  const member=this.member(),count=[...this.rows.values()].filter(r=>r.completed_at).length;this.summary.textContent=count+' / 80 completed · '+Math.round(count/80*100)+'%';this.overall.value=count;
  this.status.textContent=!member?'Sign in to earn achievements. Guests can browse only.':this.error||this.trackingError||'All 80 achievements track validated activity. Rewards auto-claim. New activity starts with this update; existing verified milestones count.';this.retry.hidden=!member||!(this.error||this.trackingError);
  const scroll=this.list.scrollTop,query=this.search.value.trim().toLowerCase(),rarity=this.filter.value;this.list.replaceChildren();
  for(const a of sortedAchievements){if(query&&!`${a.name} ${a.requirement}`.toLowerCase().includes(query)||rarity!=='All'&&rarity!==a.rarity)continue;
   const row=this.rows.get(a.id),available=!!row?.available,card=el('article','achievementCard');card.dataset.achievement=a.id;card.style.setProperty('--rarity',RARITIES[a.rarity]);
   const icon=achievementIcon(a);icon.setAttribute('aria-hidden','true');const info=el('div','achievementInfo');info.append(el('strong','achievementName',a.name),el('small','achievementRequirement',a.requirement));
   const meta=el('div','achievementMeta');meta.append(el('span','achievementRarity',a.rarity),el('span','achievementRewards',a.fp.toLocaleString()+' FP · '+a.rc.toLocaleString()+' RC'));info.append(meta);
   const progress=el('progress');progress.max=row?.target||a.target;progress.value=member?row?.progress||0:0;progress.setAttribute('aria-label',a.name+' progress');info.append(progress,el('small','achievementCount',progress.value.toLocaleString()+' / '+progress.max.toLocaleString()));
   const claim=button(row?.claimed_at?'Claimed':row?.completed_at?'Claim / Retry':member&&!available?'Unavailable':'Incomplete',()=>this.refresh());claim.disabled=!member||!row?.completed_at||!!row.claimed_at;claim.setAttribute('aria-label',a.name+': '+claim.textContent);
   if(member&&!available)claim.title='Trusted server tracking for this requirement is not available yet.';
   card.append(icon,info,claim);this.list.append(card);
  }
  if(!this.list.children.length)this.list.append(el('p','','No matching achievements.'));this.list.scrollTop=scroll;
 }
 async playSound(){
  const toast=this.toast,s=this.sound;if(!s?.enabled||!s.unlocked||!s.active||!s.context||s.context.state!=='running'||s.volume<=0)return;
  try{const epoch=s.epoch,buffer=await s.loadBuffer('sounds/achievement-unlocked.mp3');if(this.toast!==toast||epoch!==s.epoch||!s.enabled||s.context.state!=='running')return;
   const source=s.context.createBufferSource(),gain=s.context.createGain();source.buffer=buffer;gain.gain.value=s.volume*s.level('achievement');source.connect(gain).connect(s.context.destination);const node={source,gain,name:'achievement',base:1};s.nodes.add(node);source.onended=()=>{s.nodes.delete(node);source.disconnect();gain.disconnect()};source.start();this.soundNode=node;
  }catch{/* Browser/audio decode failures are not reported as successful playback. */}
 }
 nextToast(){
  if(this.toast||!this.queue.length||!this.member()||!this.playing||!this.account.gate?.hidden)return;
  const id=this.queue.shift(),a=ACHIEVEMENTS.find(a=>a.id===id);if(!a)return this.nextToast();this.toastId=id;
  const toast=this.toast=button('',()=>{this.dismissToast();this.open(id);this.nextToast()});toast.className='achievementToast';toast.setAttribute('popover','manual');toast.style.setProperty('--rarity',RARITIES[a.rarity]);toast.setAttribute('aria-label','Achievement Unlocked! '+a.name+'. Open achievements');toast.setAttribute('aria-live','polite');
  const text=el('span');text.append(el('strong','','Achievement Unlocked!'),el('span','',a.name));toast.append(achievementIcon(a),text);document.body.append(toast);this.layerToast();requestAnimationFrame(()=>requestAnimationFrame(()=>toast.classList.add('achievementToastIn')));this.playSound();
  this.toastTimer=setTimeout(()=>{toast.classList.remove('achievementToastIn');this.toastTimer=setTimeout(()=>{this.dismissToast();this.nextToast()},matchMedia('(prefers-reduced-motion: reduce)').matches?0:250)},5000);
  const tick=()=>{if(this.toast!==toast)return;this.positionToast();this.toastFrame=requestAnimationFrame(tick)};tick();
 }
 layerToast(){
  const toast=this.toast;if(!toast)return;const dialogs=[...document.querySelectorAll('dialog[open]')],parent=this.topModal?.open?this.topModal:dialogs.filter(d=>{try{return d.matches(':modal')}catch{return true}}).at(-1)||document.body;
  if(toast.parentElement!==parent){if(toast.matches(':popover-open'))toast.hidePopover();parent.append(toast)}
  // Re-add to the top layer after a modal opens, including the minimap/map.
  if(toast.matches(':popover-open'))toast.hidePopover();toast.showPopover();this.positionToast();
 }
 positionToast(){const toast=this.toast;if(!toast)return;const frame=this.anchor?.getBoundingClientRect(),viewport=window.visualViewport;const top=viewport?.offsetTop||0,height=viewport?.height||innerHeight;toast.style.setProperty('--achievement-top',Math.min(top+height-toast.offsetHeight-8,Math.max(top+8,(frame?.bottom||top)+8))+'px')}
 dismissToast(){clearTimeout(this.toastTimer);cancelAnimationFrame(this.toastFrame);if(this.soundNode){try{this.soundNode.source.stop()}catch{}this.soundNode=null}this.toast?.remove();this.toast=null;this.toastId=null}
}

