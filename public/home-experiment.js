import * as T from './vendor/three.module.js';
import {CapsuleCharacter} from './capsule-character.js';
import {deviceGyro,GyroSmoother,mixCameraInput} from './device-gyro.js';
import {setAvatar} from './social-ui.js';
import {storedGuestName} from './guest-profile.js';

export const CHARACTER_COLORS=['#f7f4ff','#b8c4d4','#424b60','#171c2b','#ff6464','#ff984c','#ffd95b','#c5ed68','#50cb91','#46d9d1','#57b9ff','#6378ed','#a080ed','#e188e6','#f6abc6','#b78a65'];
export const CHARACTER_FACES=['Neutral','Happy','Surprised','Sleepy','Wink','Serious'];
export function applyCharacterFace(character,face){if(CHARACTER_FACES.includes(face))character?.setFace?.(face)}
export function compactCurrency(value){const n=Math.max(0,Number(value)||0);for(const [size,suffix]of [[1e9,'b'],[1e6,'m'],[1e3,'k']])if(n>=size)return String(Number((n/size).toFixed(2)))+suffix;return String(Math.floor(n))}
const COLOR_KEY='tzg-character-color';
export function savedCharacterColor(){try{const value=localStorage.getItem(COLOR_KEY);return CHARACTER_COLORS.includes(value)?value:CHARACTER_COLORS[0]}catch{return CHARACTER_COLORS[0]}}
export function applyCharacterColor(character,color){if(CHARACTER_COLORS.includes(color))character.body.material.color.set(color)}

const SHIP_PAINT_KEY='tzg-ship-paint';
const originalPaint=new WeakMap();
function readShipPaint(){
 try{
  const data=JSON.parse(localStorage.getItem(SHIP_PAINT_KEY)||'{}');
  return data&&typeof data==='object'?data:{};
 }catch{return {}}
}
function shipPaintGroups(rig){
 const groups=new Map();
 rig?.model?.traverse(mesh=>{
  const material=mesh.material;
  if(!material?.color?.isColor)return;
  if(!originalPaint.has(material))originalPaint.set(material,{
   color:material.color.clone(),map:material.map,emissive:material.emissive?.clone(),
   fallback:material.userData.fallbackColor,
  });
  const original=originalPaint.get(material);
  const key=original.fallback||'#'+original.color.getHexString();
  if(!groups.has(key))groups.set(key,{label:mesh.name||'Hull',materials:new Set()});
  groups.get(key).materials.add(material);
 });
 return groups;
}
function tintPaintTexture(material,original,key,tint){
 if(!original.map||material.emissiveMap||material.emissiveIntensity>0)return;
 if(!original.paintAmount&&tint){
  const base=new T.Color(key);
  const brightness=Math.max(.025,base.r*.2126+base.g*.7152+base.b*.0722);
  const amount=original.paintAmount={value:0};
  const before=material.onBeforeCompile,cacheKey=material.customProgramCacheKey();
  material.onBeforeCompile=function(shader,renderer){
   before.call(this,shader,renderer);
   shader.uniforms.tzgShipPaint=amount;
   shader.fragmentShader='uniform float tzgShipPaint;\n'+shader.fragmentShader.replace(
    '#include <map_fragment>',
    T.ShaderChunk.map_fragment.replace('diffuseColor *= sampledDiffuseColor;',`
     float paintShade=clamp(dot(sampledDiffuseColor.rgb,vec3(.2126,.7152,.0722))/${brightness.toFixed(6)},.08,1.35);
     sampledDiffuseColor.rgb=mix(sampledDiffuseColor.rgb,vec3(paintShade),tzgShipPaint);
     diffuseColor *= sampledDiffuseColor;`)
   );
  };
  material.customProgramCacheKey=()=>cacheKey+'-ship-paint-'+key;
  material.needsUpdate=true;
 }
 if(original.paintAmount)original.paintAmount.value=tint?1:0;
}
export function applyShipPaint(rig,paint){
 for(const [key,{materials}] of shipPaintGroups(rig)){
  const tint=typeof paint[key]==='string'&&/^#[a-f0-9]{6}$/i.test(paint[key])?paint[key]:null;
  for(const material of materials){
   const original=originalPaint.get(material);
   material.color.set(tint||original.color);
   if(original.emissive&&material.emissiveIntensity>0)material.emissive.set(tint||original.emissive);
   tintPaintTexture(material,original,key,tint);
   if(tint||original.fallback)material.userData.fallbackColor=tint||original.fallback;
   else delete material.userData.fallbackColor;
  }
 }
}

export class HomeExperiment{
 constructor({debug,character,shipRig,account=()=>null,economy,backgroundBody=()=>null,worldContext=()=>null,openInventory,clearInputs=()=>{},notify=()=>{}}){
  Object.assign(this,{debug,character,shipRig,account,economy,backgroundBody,worldContext,openInventory,clearInputs,notify});this.active=false;this.busy=false;this.customizing=false;this.yaw=0;this.orbit=0;this.pitch=.12;this.distance=5.8;this.smoother=new GyroSmoother();this.cameraTarget=new T.Vector3();this.nextPosition=new T.Vector3();this.nextTarget=new T.Vector3();this.offset=new T.Vector3();this.markerPoint=new T.Vector3();this.shipPaint=readShipPaint();shipRig?.ready.then(()=>applyShipPaint(shipRig,this.shipPaint));this.face=localStorage.getItem('tzg-character-face')||'Neutral';applyCharacterFace(character,this.face);this.color=savedCharacterColor();applyCharacterColor(character,this.color);
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='./home-experiment.css?v=256';document.head.append(sheet);
  this.root=document.createElement('section');this.root.id='homeExperiment';this.root.hidden=true;this.root.setAttribute('aria-label','Home Page experiment');
  this.root.innerHTML=`<div class="homeScene" aria-label="Drag to rotate character"></div><div class="homeChrome"><div class="homeTop"><div class="homeBrand"></div><nav class="homeQuick" aria-label="Home menus"></nav></div><aside class="homeLeft"><button class="homeIdentity" type="button"><strong class="homeName"></strong><span class="homeId"></span><span class="homeBalance"></span></button><nav class="homeLinks" aria-label="Player menus"></nav></aside><aside class="homeNews"><small>Explore our universe</small><h2>Time Travel</h2><p>Discover the Proto Solar System</p><button type="button" data-home="mapBtn">Universe Map →</button></aside><footer class="homeBottom"><button type="button" data-home="chatToggle">Global Chat</button><button type="button" class="homePlay">▶ Play</button><button type="button" class="homeCustomize">Customization</button><button type="button" data-home="mapBtn">Universe Map</button></footer></div><section class="homeCustomization" hidden aria-label="Character customization"><header><h2>Character Customization</h2><button type="button" class="homeCustomClose" aria-label="Close customization">✕</button></header><p>Body Color</p><div class="homeColors" role="group" aria-label="Character colors"></div><p class="homeCustomHint">Drag your character to rotate · Saved on this device</p><div class="homeCustomActions"><button type="button" class="homeReset">Reset</button><button type="button" class="homeSave">Save</button></div></section><div class="homeNotice" role="status"></div>`;
  document.body.append(this.root);this.host=this.root.querySelector('.homeScene');
  this.fade=document.createElement('div');this.fade.id='homeExperimentFade';this.fade.hidden=true;document.body.append(this.fade);
  const brand=document.getElementById('brand')?.cloneNode(true);if(brand){brand.id='homeGameTitle';brand.querySelectorAll('[id]').forEach(n=>n.removeAttribute('id'));brand.removeAttribute('style');brand.onclick=null;brand.setAttribute('aria-label','The Zero Gravity Web Edition');this.root.querySelector('.homeBrand').append(brand)}
  const add=(selector,label,id)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.home=id;const source=document.getElementById(id),icon=source?.querySelector('img');if(icon){const copy=icon.cloneNode(true);copy.removeAttribute('id');b.prepend(copy)}this.root.querySelector(selector).append(b)};
  for(const [label,id] of [['Friends','friendsBtn'],['Account','accountBtn'],['Help','helpBtn'],['More','menuBtn']])add('.homeQuick',label,id);
  for(const [label,id] of [['Achievements','achievementsBtn'],['Daily Rewards','dailyRewardsOpen'],['Inventory','inventoryBtn'],['Settings','home-settings']])add('.homeLinks',label,id);
  this.root.querySelectorAll('[data-home]').forEach(b=>b.onclick=()=>this.openMenu(b.dataset.home));
  this.root.querySelector('.homeIdentity').onclick=()=>this.openMenu('accountBtn');this.root.querySelector('.homePlay').onclick=()=>this.play();this.root.querySelector('.homeCustomize').onclick=()=>this.customize(true);
  this.root.querySelector('.homeCustomClose').onclick=()=>this.customize(false);this.root.querySelector('.homeReset').onclick=()=>this.resetCustomization();this.root.querySelector('.homeSave').onclick=()=>this.saveCustomization();
  CHARACTER_COLORS.forEach((color,i)=>{const b=document.createElement('button');b.type='button';b.style.setProperty('background',color,'important');b.setAttribute('aria-label','Color '+(i+1));b.dataset.color=color;b.onclick=()=>this.choose(color);this.root.querySelector('.homeColors').append(b)});
  const entry=document.createElement('button');entry.type='button';entry.id='debugHomeExperiment';entry.textContent='Open Home Page';entry.onclick=()=>this.open();debug.root.querySelector('#debugExperimental .debugActions').append(entry);
  this.host.addEventListener('pointerdown',e=>{if(this.busy||this.drag||this.customizing&&this.customView!=='character'||e.button>0||!this.hitsCharacter(e.clientX,e.clientY))return;this.drag={id:e.pointerId,x:e.clientX,y:e.clientY};this.host.setPointerCapture?.(e.pointerId)});this.host.addEventListener('pointermove',e=>{if(this.drag?.id!==e.pointerId)return;this.yaw+=(e.clientX-this.drag.x)*.012;this.finger={x:T.MathUtils.clamp((e.clientX/Math.max(1,this.host.clientWidth)-.5)*.16,-.08,.08),y:T.MathUtils.clamp((.5-e.clientY/Math.max(1,this.host.clientHeight))*.12,-.06,.06)};this.drag.x=e.clientX;this.drag.y=e.clientY});const end=e=>{if(this.drag?.id===e.pointerId)this.drag=null};for(const type of ['pointerup','pointercancel','lostpointercapture'])this.host.addEventListener(type,end);
  this.sensor=deviceGyro();this.unsubscribe=this.sensor.subscribe(sample=>{if(!this.active)return;if(!this.gyroOrigin)this.gyroOrigin=sample;const axes=this.sensor.axes(this.gyroOrigin,sample);this.gyro={x:T.MathUtils.clamp(axes.roll,-.08,.08),y:T.MathUtils.clamp(axes.pitch,-.06,.06)}});
  this.onKey=e=>{if(!this.active)return;if(e.target.closest?.('input,textarea,select'))return;if(e.code==='Escape'&&this.customizing){e.preventDefault();this.customize(false)}if(!e.target.closest?.('dialog,[role="dialog"],#friendsPanel,#globalChat'))e.stopImmediatePropagation()};window.addEventListener('keydown',this.onKey,true);this.upgradeLayout();this.installCustomization();this.installShipCustomization();this.refresh();
 }
 hitsCharacter(x,y){
  const group=this.preview?.group;
  if(!this.active||!this.camera||!group?.visible)return false;
  const rect=this.host.getBoundingClientRect();
  if(!rect.width||!rect.height)return false;
  this.characterRay??=new T.Raycaster();
  this.characterPointer??=new T.Vector2();
  this.characterPointer.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
  group.updateWorldMatrix(true,true);
  this.camera.updateMatrixWorld();
  this.characterRay.setFromCamera(this.characterPointer,this.camera);
  return this.characterRay.intersectObject(group,true).some(({object})=>object.visible);
 }
 upgradeLayout(){
  this.root.querySelector('.homeNews')?.remove();this.root.querySelector('[data-home="home-settings"]')?.remove();const map=this.root.querySelector('.homeQuick [data-home="helpBtn"]');if(map){map.dataset.home='mapBtn';map.textContent='Universe Map';map.onclick=()=>this.openMenu('mapBtn')}
  const titleActions=document.createElement('div');titleActions.className='homeTitleActions';this.root.querySelector('.homeBrand').before(titleActions);titleActions.append(this.root.querySelector('.homeBrand'));this.root.querySelector('#homeGameTitle')?.remove();this.brand=document.getElementById('brand');this.brandOrigin=this.brand?{parent:this.brand.parentElement,next:this.brand.nextSibling}:null;const mapDialog=document.getElementById('mapDialog');if(typeof MutationObserver==='function'&&mapDialog){this.brandObserver=new MutationObserver(()=>this.dockBrand());this.brandObserver.observe(mapDialog,{attributes:true,attributeFilter:['open']});if(this.brandOrigin)this.brandObserver.observe(this.brandOrigin.parent,{childList:true})}
  const card=this.root.querySelector('.homeIdentity'),avatar=document.createElement('img');avatar.className='homeAvatar';avatar.alt='Profile image';card.prepend(avatar);const progress=document.createElement('div');progress.className='homeProgress';progress.innerHTML='<span class="homeLevel"></span><div class="homeXPTrack"><i></i></div><small class="homeXPText"></small>';card.append(progress);
  const help=document.createElement('button');help.type='button';help.id='homeMoreHelp';help.textContent='Help';help.hidden=true;help.onclick=()=>document.getElementById('helpBtn')?.click();document.getElementById('utilityMenu')?.append(help);
  this.chatDock=document.createElement('section');this.chatDock.className='homeChatDock';this.chatDock.setAttribute('aria-label','Home Global Chat');this.root.append(this.chatDock);
  this.root.querySelector('.homeQuick [data-home="mapBtn"]')?.remove();const mapButton=this.root.querySelector('.homeBottom [data-home="mapBtn"]');if(mapButton)mapButton.classList.add('homeMapButton');this.root.querySelector('.homeBottom [data-home="chatToggle"]')?.remove();
  this.host.addEventListener('wheel',e=>{if(!this.active||this.customizing)return;e.preventDefault();this.distance=T.MathUtils.clamp(this.distance+e.deltaY*.008,4,16)},{passive:false});
 }
 dockBrand(){if(!this.brand||!this.brandOrigin)return;const map=document.getElementById('mapDialog');if(map?.open||map?.hasAttribute('open'))return;const parent=this.active?this.root.querySelector('.homeBrand'):this.brandOrigin.parent;if(this.brand.parentElement!==parent)parent.insertBefore(this.brand,this.active?null:this.brandOrigin.next?.parentElement===parent?this.brandOrigin.next:null)}
 dockChat(on){const toggle=document.getElementById('chatToggle');if(!toggle)return;if(on){this.chatOrigin={parent:toggle.parentElement,next:toggle.nextSibling};this.root.querySelector('.homeTitleActions').append(toggle)}else if(this.chatOrigin){const o=this.chatOrigin;o.parent.insertBefore(toggle,o.next?.parentElement===o.parent?o.next:null);this.chatOrigin=null}}
 installCustomization(){const panel=this.root.querySelector('.homeCustomization'),close=this.root.querySelector('.homeCustomClose');this.root.append(close);close.hidden=true;const colors=this.root.querySelector('.homeColors'),hint=this.root.querySelector('.homeCustomHint');panel.querySelector('p').remove();const layout=document.createElement('div');layout.className='homeCustomLayout';layout.innerHTML='<nav class="homeCustomTabs" aria-label="Customization categories"><button type="button" data-category="faces">Faces</button><button type="button" data-category="colours">Colours</button></nav><div class="homeCustomContent"><div class="homeFaces" role="group" aria-label="Character faces"></div></div>';panel.insertBefore(layout,hint);layout.querySelector('.homeCustomContent').append(colors);CHARACTER_FACES.forEach((face,i)=>{const b=document.createElement('button');b.type='button';b.dataset.face=face;b.textContent=['• •  ─','⌒ ⌒  ◡','• •  O','─ ─  ─','• ─  ◡','• •  ━'][i];b.setAttribute('aria-label',face);b.title=face;b.onclick=()=>this.chooseFace(face);layout.querySelector('.homeFaces').append(b)});const category=name=>{colors.hidden=name!=='colours';layout.querySelector('.homeFaces').hidden=name!=='faces';layout.querySelectorAll('[data-category]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.category===name)))};layout.querySelectorAll('[data-category]').forEach(b=>b.onclick=()=>category(b.dataset.category));category('colours');this.host.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation()});this.host.addEventListener('pointermove',e=>{if(this.drag)e.preventDefault()})}
 installShipCustomization(){
  const panel=this.root.querySelector('.homeCustomization');
  this.customPanel=panel;
  this.customActions=panel.querySelector('.homeCustomActions');
  this.characterControls=panel.querySelector('.homeCustomLayout');
  this.customHint=panel.querySelector('.homeCustomHint');
  this.paintControls=document.createElement('div');
  this.paintControls.className='homeShipPaint';
  this.paintControls.hidden=true;
  this.customActions.before(this.paintControls);
  this.customChoices=document.createElement('nav');
  this.customChoices.className='homeCustomChoices';
  this.customChoices.hidden=true;
  this.customChoices.setAttribute('aria-label','Customize a model');
  this.customChoices.innerHTML='<button type="button" data-model="ship">Ship</button><button type="button" data-model="character">Character</button>';
  this.root.append(this.customChoices);
  this.modelButtons=[...this.customChoices.querySelectorAll('button')];
  for(const button of this.modelButtons)button.onclick=()=>this.selectCustomView(button.dataset.model);
  const back=document.createElement('button');
  back.type='button';back.className='homeCustomBack';back.textContent='← Models';back.onclick=()=>this.selectCustomView('overview');
  panel.querySelector('header').append(back);
 }
 selectCustomView(view){
  this.customView=view;
  this.cameraPanelKey=null;
  const overview=view==='overview',ship=view==='ship';
  this.customChoices.hidden=!overview;
  if(overview)for(const button of this.modelButtons)button.hidden=true;
  this.customPanel.hidden=overview;
  this.root.classList.toggle('homeCustomDetail',!overview);
  this.characterControls.hidden=ship;
  this.paintControls.hidden=!ship;
  this.customHint.hidden=ship;
  this.customPanel.querySelector('h2').textContent=ship?'Ship Customization':'Character Customization';
  if(ship)this.renderShipPaint();
 }
 renderShipPaint(){
  this.paintControls.replaceChildren();
  for(const [key,{label}] of shipPaintGroups(this.world?.rig)){
   const row=document.createElement('label');
   row.textContent=label;
   const color=document.createElement('input');
   color.type='color';color.value=this.draftShipPaint[key]||key;
   color.oninput=()=>{
    this.draftShipPaint[key]=color.value;
    applyShipPaint(this.world.rig,this.draftShipPaint);
   };
   row.append(color);this.paintControls.append(row);
  }
 }
 resetCustomization(){
  if(this.customView==='ship'){
   this.draftShipPaint={};applyShipPaint(this.world?.rig,this.draftShipPaint);this.renderShipPaint();
  }else{
   this.choose(CHARACTER_COLORS[0]);this.chooseFace(CHARACTER_FACES[0]);
  }
 }
 saveCustomization(){
  if(this.customView!=='ship'){this.saveColor();return}
  try{
   localStorage.setItem(SHIP_PAINT_KEY,JSON.stringify(this.draftShipPaint));
   this.shipPaint={...this.draftShipPaint};
   applyShipPaint(this.shipRig,this.shipPaint);
   this.customize(false);
  }catch{this.root.querySelector('.homeNotice').textContent='Could not save on this device. Please try again.'}
 }

 chooseFace(face){if(!CHARACTER_FACES.includes(face))return;this.draftFace=face;this.yaw=0;applyCharacterFace(this.preview,face);this.root.querySelectorAll('[data-face]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.face===face)))}

 refresh(){const a=this.account(),profile=a?.profile;this.root.querySelector('.homeName').textContent=profile?.display_name||(a?.guest?storedGuestName():'')||'Guest';this.root.querySelector('.homeId').textContent=a?.guest?'Guest':profile?.public_id?'TZG-Id_'+profile.public_id:'';this.drawCurrencies();const avatar=this.root.querySelector('.homeAvatar');if(avatar&&avatar.dataset.value!==String(profile?.avatar)){setAvatar(avatar,profile?.avatar);avatar.dataset.value=String(profile?.avatar)}const p=globalThis.tzgPlayerProgress||a?.pages?.dashboard?.progress;if(this.root.querySelector('.homeLevel')){this.root.querySelector('.homeLevel').textContent=a?.guest?'Guest explorer':p?'Level '+p.level:'Explorer';this.root.querySelector('.homeXPText').textContent=p?Number(p.level_xp||0).toLocaleString()+' / '+(p.required_xp??'MAX')+' XP':'';this.root.querySelector('.homeXPTrack i').style.width=(p?Math.min(100,p.required_xp?(p.level_xp||0)/p.required_xp*100:100):0)+'%'}}
 async transition(change){if(this.busy)return;this.busy=true;this.fade.hidden=false;this.fade.classList.remove('homeFadeBlack');await new Promise(r=>requestAnimationFrame(()=>{this.fade.classList.add('homeFadeBlack');setTimeout(r,230)}));try{await change()}finally{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));this.fade.classList.remove('homeFadeBlack');await new Promise(r=>setTimeout(r,230));this.fade.hidden=true;this.busy=false}}
 async open(){if(!this.debug.active||this.active||this.busy)return;this.sensor.request();await this.transition(async()=>{this.clearInputs();this.debug.root.hidden=true;this.active=true;this.root.hidden=false;document.body.classList.add('homeExperimentOpen');this.refresh();await this.initScene();this.root.classList.remove('homeChromeVisible');this.dockChat(true);this.dockBrand();this.setGround();const help=document.getElementById('homeMoreHelp');if(help)help.hidden=false;this.customizing=false;this.root.classList.remove('homeIsCustomizing');this.root.querySelector('.homeCustomization').hidden=true;this.gyroOrigin=null;this.smoother.reset();this.last=performance.now();this.finger=null;this.frame()});requestAnimationFrame(()=>requestAnimationFrame(()=>this.root.classList.add('homeChromeVisible')))}
 async play(){if(!this.active||this.busy||this.leaving)return;this.leaving=true;try{this.root.classList.remove('homeChromeVisible');if(this.root.animate&&!globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches)await this.root.animate([{opacity:1},{opacity:1}],{duration:320}).finished.catch(()=>{});await this.transition(()=>{this.customize(false);this.active=false;this.dockChat(false);this.dockBrand();this.restoreCanvas();const help=document.getElementById('homeMoreHelp');if(help)help.hidden=true;const more=document.getElementById('utilityMenu');if(more)more.hidden=true;this.root.hidden=true;document.body.classList.remove('homeExperimentOpen');globalThis.cancelAnimationFrame?.(this.raf);this.drag=null;this.clearInputs()})}finally{this.leaving=false}}
 openMenu(id){if(this.customizing||this.busy)return;if(id==='home-settings'){document.getElementById('brand')?.click();return}if(id==='inventoryBtn'){this.openInventory();return}const original=document.getElementById(id);if(original&&!original.disabled)original.click();else this.notify('This menu is not available for this account.')}
 customize(open){
  if(!this.active)return;
  this.customizing=open;
  this.root.classList.toggle('homeIsCustomizing',open);
  this.root.querySelector('.homeCustomClose').hidden=!open;
  this.drag=null;this.finger=null;
  if(open){
   this.draftShipPaint={...this.shipPaint};this.yaw=0;
   this.choose(this.color);this.chooseFace(this.face);this.selectCustomView('overview');
  }else{
   this.customView=null;this.customChoices.hidden=true;this.customPanel.hidden=true;
   this.root.classList.remove('homeCustomDetail');
   this.choose(this.color);applyCharacterFace(this.preview,this.face);applyShipPaint(this.world?.rig,this.shipPaint);
  }
 }
 choose(color){if(!CHARACTER_COLORS.includes(color))return;this.draft=color;if(this.preview)applyCharacterColor(this.preview,color);this.root.querySelectorAll('[data-color]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.color===color)))}
 saveColor(){try{localStorage.setItem(COLOR_KEY,this.draft);localStorage.setItem('tzg-character-face',this.draftFace||this.face);this.face=this.draftFace||this.face;applyCharacterFace(this.character,this.face);this.color=this.draft;applyCharacterColor(this.character,this.color);this.customize(false)}catch{this.root.querySelector('.homeNotice').textContent='Could not save on this device. Please try again.'}}
 async initScene(){const context=this.worldContext();if(this.world){this.mountCanvas();return}try{const {HomeWorld}=await import('./home-world.js?v=256');this.renderer=context.renderer;this.camera=new T.PerspectiveCamera(50,1,.05,300000);this.preview=new CapsuleCharacter();applyCharacterColor(this.preview,this.color);applyCharacterFace(this.preview,this.face);this.world=new HomeWorld(context,this.preview);this.scene=this.world.scene;await this.world.rig.ready;applyShipPaint(this.world.rig,this.shipPaint);this.mountCanvas();this.choose(this.color)}catch(error){this.renderer=null;this.notify('Home preview could not load: '+error.message)}}
 mountCanvas(){const canvas=this.renderer?.domElement||this.renderer?.canvas;if(!canvas)return;if(canvas.parentElement!==this.host){this.canvasOrigin={parent:canvas.parentElement,next:canvas.nextSibling};this.homePixelRatio=this.renderer.getPixelRatio?.();this.host.append(canvas);if(this.worldContext()?.mobile&&this.homePixelRatio)this.renderer.setPixelRatio?.(this.homePixelRatio*.78)}}
 restoreCanvas(){const canvas=this.renderer?.domElement||this.renderer?.canvas,o=this.canvasOrigin;if(canvas&&o?.parent)o.parent.insertBefore(canvas,o.next?.parentElement===o.parent?o.next:null);if(this.homePixelRatio)this.renderer.setPixelRatio?.(this.homePixelRatio);this.homePixelRatio=null;this.canvasOrigin=null;this.width=0;this.height=0;this.cameraReady=false}
 updateCamera(w,h,dt=0,now=performance.now()){
  const character=this.preview.group.position,ship=this.world.rig.ship.position;
  const view=this.customizing?this.customView:null;
  const position=this.nextPosition,target=this.nextTarget;
  let fov=50;
  if(view==='overview'){
   target.copy(character).lerp(ship,.5);target.y+=1;
   position.copy(target).addScaledVector(this.offset.set(-18,8,-21),Math.max(1,h/w*.8));
  }else if(view==='ship'){
   target.copy(ship);target.y+=.8;
   position.copy(target).add(this.offset.set(-9,5,-12));
  }else if(view==='character'){
   target.copy(character);target.y+=.8;
   position.copy(target).add(this.offset.set(0,.35,-3.8));
   fov=38;
  }else{
   const gyro=this.smoother.step(mixCameraInput({roll:this.gyro?.x||0,pitch:this.gyro?.y||0},this.finger),now);
   target.copy(character).add(this.offset.set(gyro.roll*3,1.5+gyro.pitch*2,0));
   position.copy(target).add(this.offset.set(0,.3,-this.distance));
  }
  const offset=this.offset;
  if(view==='ship'||view==='character'){
   const panelKey=w+':'+h+':'+view;
   if(this.cameraPanelKey!==panelKey){
    this.cameraPanelKey=panelKey;
    this.cameraPanelWidth=this.customPanel.offsetWidth||this.customPanel.getBoundingClientRect().width||Math.min(430,w*.45);
   }
   const reserved=Math.min(w*.75,this.cameraPanelWidth+24);
   const tangent=Math.tan(T.MathUtils.degToRad(fov/2));
   const available=1-reserved/w;
   const currentDistance=position.distanceTo(target);
   const distance=Math.max(currentDistance,(view==='character'?1.1:11)/(2*tangent*(w/h)*available));
   if(distance>currentDistance)position.sub(target).multiplyScalar(distance/currentDistance).add(target);
   offset.subVectors(target,position).cross(this.camera.up).normalize();
   offset.multiplyScalar(reserved/w*distance*tangent*w/h);
   target.add(offset);position.add(offset);
  }
  const blend=!this.cameraReady||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches?1:1-Math.exp(-dt*7);
  this.camera.position.lerp(position,blend);
  this.cameraTarget.lerp(target,blend);
  const nextFov=T.MathUtils.lerp(this.camera.fov,fov,blend),aspect=w/h;
  if(Math.abs(this.camera.fov-nextFov)>.01||this.camera.aspect!==aspect){
   this.camera.fov=nextFov;this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
  }
  this.camera.lookAt(this.cameraTarget);this.camera.updateMatrixWorld();this.cameraReady=true;
  if(view==='overview')this.positionModelButtons(w,h);
 }
 positionModelButtons(w,h){
  const positions=[this.world.rig.ship.position,this.preview.group.position];
  const point=this.markerPoint;
  const markers=positions.map((position,i)=>{
   point.copy(position);point.y+=i?.8:1.5;point.project(this.camera);
   return {x:(point.x+1)*w/2,y:(1-point.y)*h/2,visible:Math.abs(point.x)<1&&Math.abs(point.y)<1&&Math.abs(point.z)<1};
  });
  for(const [i,button] of this.modelButtons.entries()){
   const marker=markers[i],side=marker.x<markers[1-i].x?-1:1;
   button.hidden=!marker.visible;
   const x=Math.round(T.MathUtils.clamp(marker.x+side*74,58,w-58));
   const y=Math.round(T.MathUtils.clamp(marker.y,52,h-30));
   const transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;
   if(button.style.transform!==transform)button.style.transform=transform;
  }
 }

 drawCurrencies(){const node=this.root.querySelector('.homeBalance');if(!node.querySelector('[data-home-fp]'))node.innerHTML='<span><img src="icons/currency/fp.png" alt="FlightPoints"><b data-home-fp></b></span><span><img src="icons/currency/rc.png" alt="RocketCoins"><b data-home-rc></b></span>';node.querySelector('[data-home-fp]').textContent=compactCurrency(this.economy.fp);node.querySelector('[data-home-rc]').textContent=compactCurrency(this.economy.rc)}
 setGround(){this.world?.enter(this.backgroundBody())}
 frame(){
  if(!this.active)return;
  this.raf=requestAnimationFrame(()=>this.frame());
  if(!this.renderer||document.hidden||this.renderer.getContext?.()?.isContextLost?.())return;
  const now=performance.now(),context=this.worldContext();
  if(context.mobile&&this.lastDraw&&now-this.lastDraw<30)return;
  this.lastDraw=now;
  const dt=Math.min(.08,(now-this.last)/1000);this.last=now;
  if(!this.refreshed||now-this.refreshed>1000){this.refresh();this.refreshed=now}
  const w=this.host.clientWidth,h=this.host.clientHeight;
  if(w<1||h<1)return;
  if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.renderer.setSize(w,h)}
  this.world.syncSettings(context);
  this.updateCamera(w,h,dt,now);
  this.preview.group.rotation.y=this.yaw;
  this.preview.torso.position.y=Math.sin(now*.002)*.012;
  this.world.update(now*.001,dt,this.camera);
  context.effects.entryHeat=0;context.effects.mobile=context.mobile;
  context.effects.render(this.scene,this.camera,context.quality);
 }
}
