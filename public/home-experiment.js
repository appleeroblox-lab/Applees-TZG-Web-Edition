import {chatDialog} from './chat-dialog.js?v=282';
import {setSystemLock} from './system-unlock-ui.js';
import {applyPaintGradient,isPaintHex,paintColor,paintGradient} from './paint-gradient.js';
import {dragPanel} from './panel-drag.js';
import * as T from './vendor/three.module.js';
import {CapsuleCharacter} from './capsule-character.js';
import {deviceGyro,GyroSmoother,mixCameraInput} from './device-gyro.js';
import {setAvatar} from './social-ui.js';
import {storedGuestName} from './guest-profile.js';
import {geometryFromRanges} from './paint-geometry.js';

export const CHARACTER_COLORS=['#f7f4ff','#b8c4d4','#424b60','#171c2b','#ff6464','#ff984c','#ffd95b','#c5ed68','#50cb91','#46d9d1','#57b9ff','#6378ed','#a080ed','#e188e6','#f6abc6','#b78a65'];
export const CHARACTER_FACES=['Neutral','Happy','Surprised','Sleepy','Wink','Serious'];
export function applyCharacterFace(character,face){if(CHARACTER_FACES.includes(face))character?.setFace?.(face)}
export function compactCurrency(value){const n=Math.max(0,Number(value)||0);for(const [size,suffix]of [[1e9,'b'],[1e6,'m'],[1e3,'k']])if(n>=size)return String(Number((n/size).toFixed(2)))+suffix;return String(Math.floor(n))}
const COLOR_KEY='tzg-character-color';
const isHexColor=isPaintHex;
const isPaint=value=>isHexColor(value)||!!paintGradient(value);
export function savedCharacterColor(){try{const value=localStorage.getItem(COLOR_KEY);return isHexColor(value)?value.toLowerCase():CHARACTER_COLORS[0]}catch{return CHARACTER_COLORS[0]}}
const CHARACTER_PAINT_KEY='tzg-character-parts';
const characterParts=[
 ['leftLeg','Left Leg'],['leftHand','Left Hand'],['rightLeg','Right Leg'],['rightHand','Right Hand'],
 ['head','Head'],['torso','Torso'],
];
function readCharacterPaint(){
 try{
  const source=JSON.parse(localStorage.getItem(CHARACTER_PAINT_KEY)||'{}');
  return Object.fromEntries(characterParts.filter(([key])=>isPaint(source?.[key])).map(([key])=>[key,source[key]]));
 }catch{return {}}
}
export function applyCharacterColor(character,color,paint={}){
 if(!character||!isHexColor(color))return;
 for(const [key,mesh] of Object.entries({torso:character.body,...character.paintParts})){
  const value=paint[key],gradient=paintGradient(value);
  mesh.material.color.set(gradient?'#ffffff':value||color);
  applyPaintGradient(mesh,gradient);
 }
}

const SHIP_PAINT_KEY='tzg-ship-paint';
const originalPaint=new WeakMap();
const readyPaintGroups=new WeakMap();
const EXHAUST_DEFAULT='#9feaff';
const TRAIL_DEFAULT='#ebf8ff';
const shipColourGroups=[
 ['redParts','Red Parts'],['whiteParts','White Parts'],['blueParts','Blue Parts'],['darkParts','Dark Parts'],
];
function originalShipColour(mesh,region){
 if(mesh.name.includes('signal red'))return 'redParts';
 if(region==='lights')return null;
 if(mesh.name.includes('pearl painted'))return 'whiteParts';
 if(mesh.name.startsWith('Canopy • blue'))return 'blueParts';
 if(mesh.name.startsWith('Carbon •')||mesh.name.startsWith('Seat •'))return 'darkParts';
 return null;
}
const shipCategories=[
 ...shipColourGroups,
 ['body','Body'],['wings','Wings'],['cockpit','Cockpit'],['cockpitWindow','Window'],['tail','Tail'],
 ['accents','Accents'],['lights','Lights'],['exhaust','Engine Fire'],['trails','Trails'],
];
function materialRegion(name,mesh){
 if(mesh.userData.neonPart||/^Wing_Navigation_Light/.test(name))return 'lights';
 if(/^Wing_/.test(name))return 'wings';
 if(/^Tail_/.test(name))return 'tail';
 if(/^(Windshield|Side_Glass|Canopy_Glass)/.test(name))return 'cockpitWindow';
 if(/^(Canopy_|Windshield|Side_Glass|Cabin_|Dashboard|Display|Seat_|Armrest|Headrest|Joystick|Rudder|Switch_Shelf)/.test(name))return 'cockpit';
 if(/Red|Band|Collar|Rim/.test(name)||mesh.name.startsWith('Carbon'))return 'accents';
 return 'body';
}
function splitShipPaintRegions(rig){
 if(!rig?.model||rig.model.userData.paintRegionsReady)return;
 rig.model.userData.paintRegionsReady=true;
 const sources=[];
 rig.model.traverse(mesh=>{if(mesh.isMesh&&mesh.material?.color?.isColor)sources.push(mesh)});
 for(const mesh of sources){
  const regions=new Map();
  for(const part of mesh.userData.sourceParts||[]){
   const region=materialRegion(part.name,mesh);
   if(!regions.has(region))regions.set(region,[]);
   regions.get(region).push(part);
  }
  if(regions.size<=1||mesh.geometry.index){
   mesh.userData.paintRegion=regions.keys().next().value||materialRegion(mesh.name,mesh);
   continue;
  }
  for(const [region,ranges] of regions){
   const material=mesh.material.clone();
   const before=mesh.material.onBeforeCompile,key=mesh.material.customProgramCacheKey();
   material.onBeforeCompile=function(shader,renderer){before.call(this,shader,renderer)};
   material.customProgramCacheKey=()=>key;
   const part=new T.Mesh(geometryFromRanges(mesh.geometry,ranges),material);
   part.name=mesh.name;
   part.position.copy(mesh.position);part.quaternion.copy(mesh.quaternion);part.scale.copy(mesh.scale);
   part.castShadow=mesh.castShadow;part.receiveShadow=mesh.receiveShadow;
   part.visible=mesh.visible;part.layers.mask=mesh.layers.mask;part.renderOrder=mesh.renderOrder;
   part.userData={...mesh.userData};
   part.userData.paintRegion=region;
   if(region==='lights'&&!part.userData.neonPart){
    material.map=null;
    material.color.set(0xff394f);
    material.emissive.copy(material.color);
    material.emissiveIntensity=2;
    material.userData.fallbackColor='#ff394f';
    part.userData.neonPart=true;
   }
   let start=0;
   part.userData.sourceParts=ranges.map(range=>{const mapped={...range,start};start+=range.count;return mapped});
   mesh.parent.add(part);
  }
  mesh.removeFromParent();
  mesh.geometry.dispose();
  mesh.material.dispose();
 }
}

function readShipPaint(){
 try{
  const data=JSON.parse(localStorage.getItem(SHIP_PAINT_KEY)||'{}');
  return data&&typeof data==='object'?data:{};
 }catch{return {}}
}
function shipPaintGroups(rig){
 if(readyPaintGroups.has(rig))return readyPaintGroups.get(rig);
 splitShipPaintRegions(rig);
 const groups=new Map();
 rig?.model?.traverse(mesh=>{
  const material=mesh.material,region=mesh.userData.paintRegion;
  if(!mesh.isMesh||!region||!material?.color?.isColor)return;
  if(!originalPaint.has(material))originalPaint.set(material,{
   color:material.color.clone(),map:material.map,emissive:material.emissive?.clone(),
   fallback:material.userData.fallbackColor,
  });
  const original=originalPaint.get(material);
  const base=original.fallback||'#'+original.color.getHexString();
  const colourGroup=originalShipColour(mesh,region);
  for(const key of [region,colourGroup]){
   if(!key)continue;
   if(!groups.has(key))groups.set(key,{base,meshes:[]});
   groups.get(key).meshes.push(mesh);
  }
 });
 if(rig?.model?.userData.blender)readyPaintGroups.set(rig,groups);
 return groups;
}
function tintPaintTexture(material,original,key,tint){
 if(!original.map&&!material.emissiveMap)return;
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
   ).replace('#include <emissivemap_fragment>',T.ShaderChunk.emissivemap_fragment.replace(
    'totalEmissiveRadiance *= emissiveColor.rgb;',`
     float peak=max(emissiveColor.r,max(emissiveColor.g,emissiveColor.b));
     totalEmissiveRadiance *= mix(emissiveColor.rgb,vec3(peak),tzgShipPaint);`
   ));
  };
  material.customProgramCacheKey=()=>cacheKey+'-ship-paint-'+key;
  material.needsUpdate=true;
 }
 if(original.paintAmount)original.paintAmount.value=tint?1:0;
}
export function applyShipPaint(rig,paint,selectedRegion){
 const overrides=Object.keys(paint).reverse();
 for(const [region,{meshes}] of shipPaintGroups(rig)){
  if(shipColourGroups.some(([key])=>key===region))continue;
  for(const mesh of meshes){
   const {material}=mesh,colourGroup=originalShipColour(mesh,region);
   if(selectedRegion&&region!==selectedRegion&&colourGroup!==selectedRegion)continue;
   const original=originalPaint.get(material);
   const base=original.fallback||'#'+original.color.getHexString();
   const override=overrides.find(key=>key===region||key===colourGroup);
   const candidate=paint[override??base];
   const gradient=paintGradient(candidate),tint=gradient?'#ffffff':isHexColor(candidate)?candidate:null;
   applyPaintGradient(mesh,gradient,'z');
   material.color.set(tint||original.color);
   if(original.emissive&&material.emissiveIntensity>0)material.emissive.set(tint||original.emissive);
   tintPaintTexture(material,original,base,tint);
   if(tint||original.fallback)material.userData.fallbackColor=gradient?.[0].color||tint||original.fallback;
   else delete material.userData.fallbackColor;
  }
 }
 if(selectedRegion&&selectedRegion!=='exhaust')return;
 const exhaustGradient=paintGradient(paint.exhaust);
 if(rig?.exhaust)rig.exhaust.userData.paintGradient=exhaustGradient;
 if(rig?.exhaust)rig.exhaust.userData.paintColor=isPaint(paint.exhaust)?paintColor(paint.exhaust):null;
 for(const item of [...(rig?.flames||[]),...(rig?.engines||[])]){
  const material=item.material;
  if(!material?.color)continue;
  if(!originalPaint.has(material))originalPaint.set(material,{color:material.color.clone()});
  const gradient=item.isMesh?exhaustGradient:null;
  material.color.set(gradient?'#ffffff':isPaint(paint.exhaust)?paintColor(paint.exhaust):originalPaint.get(material).color);
  applyPaintGradient(item,gradient,'z');
 }

}

export class HomeExperiment{
 constructor({character,shipRig,setTrailColor=()=>{},trailTips,account=()=>null,accountCustomization=false,economy,backgroundBody=()=>null,worldContext=()=>null,openInventory,closeMenus=()=>{},applyExposure=()=>{},clearInputs=()=>{},notify=()=>{},onPlay=()=>{}}){
  Object.assign(this,{character,shipRig,setTrailColor,trailTips,account,accountCustomization,economy,backgroundBody,worldContext,openInventory,closeMenus,applyExposure,clearInputs,notify,onPlay});this.active=false;this.busy=false;this.customizing=false;this.yaw=0;this.orbit=0;this.pitch=.12;this.distance=5.8;this.smoother=new GyroSmoother();this.cameraTarget=new T.Vector3();this.nextPosition=new T.Vector3();this.nextTarget=new T.Vector3();this.offset=new T.Vector3();this.markerPoint=new T.Vector3();this.ownedCustomizations=new Set();this.shipPaint=accountCustomization?{}:readShipPaint();shipRig?.ready.then(()=>applyShipPaint(shipRig,this.shipPaint));this.setTrailColor(this.shipPaint.trails);this.face=accountCustomization?'Neutral':localStorage.getItem('tzg-character-face')||'Neutral';applyCharacterFace(character,this.face);this.color=accountCustomization?CHARACTER_COLORS[0]:savedCharacterColor();this.characterPaint=accountCustomization?{}:readCharacterPaint();applyCharacterColor(character,this.color,this.characterPaint);
  const sheet=document.createElement('link');sheet.rel='stylesheet';sheet.href='./home-experiment.css?v=282';document.head.append(sheet);
  this.root=document.createElement('section');this.root.id='homeExperiment';this.root.hidden=true;this.root.setAttribute('aria-label','Home Page');
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
  this.host.addEventListener('pointerdown',e=>{
   if(this.busy||this.drag||e.button>0)return;
   const ship=this.customizing&&this.customView==='ship';
   if(ship?!this.hitsShip(e.clientX,e.clientY):this.customizing&&this.customView!=='character'||!this.hitsCharacter(e.clientX,e.clientY))return;
   this.drag={id:e.pointerId,x:e.clientX,y:e.clientY,ship};
   this.host.setPointerCapture?.(e.pointerId);
  });
  this.host.addEventListener('pointermove',e=>{
   if(this.drag?.id!==e.pointerId)return;
   if(this.drag.ship){
    this.shipOrbitYaw+=(e.clientX-this.drag.x)*.012;
    this.shipOrbitPitch=T.MathUtils.clamp(this.shipOrbitPitch+(e.clientY-this.drag.y)*.007,-.2,1.25);
   }else this.yaw+=(e.clientX-this.drag.x)*.012;
   this.drag.x=e.clientX;
   this.drag.y=e.clientY;
  });
  const end=e=>{if(this.drag?.id===e.pointerId)this.drag=null};
  for(const type of ['pointerup','pointercancel','lostpointercapture'])this.host.addEventListener(type,end);
  this.sensor=deviceGyro();this.unsubscribe=this.sensor.subscribe(sample=>{if(!this.active)return;if(!this.gyroOrigin)this.gyroOrigin=sample;const axes=this.sensor.axes(this.gyroOrigin,sample);this.gyro={x:T.MathUtils.clamp(axes.roll,-.08,.08),y:T.MathUtils.clamp(axes.pitch,-.06,.06)}});
  this.onKey=e=>{if(!this.active||e.target.closest?.('#debugWindow,#debugAuthorization,.customizationPurchase,#newUpdateDialog'))return;if(e.code==='Escape'&&this.picker&&!this.picker.hidden){e.preventDefault();e.stopImmediatePropagation();this.closePicker();return}if(e.target.closest?.('input,textarea,select'))return;if(e.code==='Escape'&&this.gradientEditor&&!this.gradientEditor.hidden){e.preventDefault();this.closeGradientEditor();return}if(e.code==='Escape'&&this.customizing){e.preventDefault();this.customize(false)}if(!e.target.closest?.('dialog,[role="dialog"],#friendsPanel,#globalChat'))e.stopImmediatePropagation()};window.addEventListener('keydown',this.onKey,true);this.upgradeLayout();this.installCustomization();this.installShipCustomization();this.installColorPicker();this.refresh();
  if(this.accountCustomization){
   window.addEventListener('tzg-signed-in',()=>this.loadCustomization().catch(()=>{}));
   for(const event of ['tzg-guest-start','tzg-signed-out'])window.addEventListener(event,()=>this.clearAccountCustomization());
   this.loadCustomization().catch(()=>{});
  }
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
 hitsShip(x,y){
  const ship=this.world?.rig.ship;
  if(!this.camera||!ship)return false;
  const rect=this.host.getBoundingClientRect();
  if(!rect.width||!rect.height)return false;
  this.characterRay??=new T.Raycaster();
  this.characterPointer??=new T.Vector2();
  this.characterPointer.set((x-rect.left)/rect.width*2-1,1-(y-rect.top)/rect.height*2);
  this.characterRay.setFromCamera(this.characterPointer,this.camera);
  this.shipHitBounds??=new T.Box3();
  return this.characterRay.ray.intersectsBox(this.shipHitBounds.setFromObject(this.world.rig.model));
 }
 upgradeLayout(){
  this.root.querySelector('.homeNews')?.remove();this.root.querySelector('[data-home="home-settings"]')?.remove();const map=this.root.querySelector('.homeQuick [data-home="helpBtn"]');if(map){map.dataset.home='mapBtn';map.textContent='Universe Map';map.onclick=()=>this.openMenu('mapBtn')}
  const titleActions=document.createElement('div');titleActions.className='homeTitleActions';this.root.querySelector('.homeBrand').before(titleActions);titleActions.append(this.root.querySelector('.homeBrand'));this.root.querySelector('#homeGameTitle')?.remove();this.brand=document.getElementById('brand');this.brandOrigin=this.brand?{parent:this.brand.parentElement,next:this.brand.nextSibling}:null;const mapDialog=document.getElementById('mapDialog');if(typeof MutationObserver==='function'&&mapDialog){this.brandObserver=new MutationObserver(()=>this.dockBrand());this.brandObserver.observe(mapDialog,{attributes:true,attributeFilter:['open']});if(this.brandOrigin)this.brandObserver.observe(this.brandOrigin.parent,{childList:true})}
  const card=this.root.querySelector('.homeIdentity'),avatar=document.createElement('img');avatar.className='homeAvatar';avatar.alt='Profile image';card.prepend(avatar);const progress=document.createElement('div');progress.className='homeProgress';progress.innerHTML='<span class="homeLevel"></span><div class="homeXPTrack"><i></i></div><small class="homeXPText"></small>';card.append(progress);
  const help=document.createElement('button');help.type='button';help.id='homeMoreHelp';help.textContent='Help';help.hidden=true;help.onclick=()=>document.getElementById('helpBtn')?.click();document.getElementById('utilityMenu')?.append(help);
  this.chatDock=document.createElement('section');this.chatDock.className='homeChatDock';this.chatDock.setAttribute('aria-label','Home Global Chat');this.root.append(this.chatDock);
  this.root.querySelector('.homeQuick [data-home="mapBtn"]')?.remove();const mapButton=this.root.querySelector('.homeBottom [data-home="mapBtn"]');if(mapButton)mapButton.classList.add('homeMapButton');this.root.querySelector('.homeBottom [data-home="chatToggle"]')?.remove();
  this.host.addEventListener('wheel',e=>{
   if(!this.active)return;
   if(this.world?.flightPreview){e.preventDefault();this.zoomPreview(Math.exp(e.deltaY*.0018));}
   else if(!this.customizing){e.preventDefault();this.distance=T.MathUtils.clamp(this.distance+e.deltaY*.008,4,16);}
  },{passive:false});
  const touches=new Map();
  this.host.addEventListener('pointerdown',e=>{
   if(e.pointerType!=='touch'||!this.world?.flightPreview)return;
   touches.set(e.pointerId,new T.Vector2(e.clientX,e.clientY));
   this.host.setPointerCapture?.(e.pointerId);
   if(touches.size===2)this.drag=null;
  },true);
  this.host.addEventListener('pointermove',e=>{
   const point=touches.get(e.pointerId);
   if(!point)return;
   const other=[...touches.entries()].find(([id])=>id!==e.pointerId)?.[1];
   const before=other?point.distanceTo(other):0;
   point.set(e.clientX,e.clientY);
   const after=other?point.distanceTo(other):0;
   if(before>0&&after>0)this.zoomPreview(before/after);
  });
  for(const type of ['pointerup','pointercancel','lostpointercapture'])this.host.addEventListener(type,e=>touches.delete(e.pointerId));
 }
 dockBrand(){if(!this.brand||!this.brandOrigin)return;const map=document.getElementById('mapDialog');if(map?.open||map?.hasAttribute('open'))return;const parent=this.active?this.root.querySelector('.homeBrand'):this.brandOrigin.parent;if(this.brand.parentElement!==parent)parent.insertBefore(this.brand,this.active?null:this.brandOrigin.next?.parentElement===parent?this.brandOrigin.next:null)}
 zoomPreview(factor){this.previewZoom=T.MathUtils.clamp((this.previewZoom??1)*factor,.55,2.2)}
 dockChat(on){const toggle=document.getElementById('chatToggle');if(!toggle)return;if(on){this.chatOrigin={parent:toggle.parentElement,next:toggle.nextSibling};this.root.querySelector('.homeTitleActions').append(toggle)}else if(this.chatOrigin){const o=this.chatOrigin;o.parent.insertBefore(toggle,o.next?.parentElement===o.parent?o.next:null);this.chatOrigin=null}}
 installCustomization(){
  const panel=this.root.querySelector('.homeCustomization');
  this.customPanel=panel;
  this.customActions=panel.querySelector('.homeCustomActions');
  this.customHint=panel.querySelector('.homeCustomHint');
  this.customHeading=panel.querySelector('h2');
  const close=panel.querySelector('.homeCustomClose');this.root.append(close);close.hidden=true;
  this.partDescription=panel.querySelector('p');
  this.partDescription.className='homePartDescription';
  this.characterColors=panel.querySelector('.homeColors');
  this.characterFaces=document.createElement('div');this.characterFaces.className='homeFaces';
  this.characterFaces.hidden=true;
  this.characterColors.after(this.characterFaces);
  CHARACTER_FACES.forEach((face,i)=>{
   const button=document.createElement('button');button.type='button';button.dataset.face=face;
   button.textContent=['• •  ─','⌒ ⌒  ◡','• •  O','─ ─  ─','• ─  ◡','• •  ━'][i];
   button.setAttribute('aria-label',face);button.title=face;this.bindCustomizationLock(button,face==='Neutral'?null:'face:'+face,face+' Face',250,'FP',()=>this.chooseFace(face));
   this.characterFaces.append(button);
  });

  this.partsPanel=document.createElement('aside');
  this.partsPanel.className='homeParts';this.partsPanel.hidden=true;
  this.partsPanel.innerHTML='<h2></h2><nav class="homePartList" aria-label="Customizable parts"></nav>';
  this.partList=this.partsPanel.querySelector('nav');
  this.root.append(this.partsPanel);
  const back=document.createElement('button');
  back.type='button';back.className='homeCustomBack';back.textContent='← Models';
  back.onclick=()=>this.selectCustomView('overview');
  this.partsPanel.append(back);
 }
 installShipCustomization(){
  this.paintControls=document.createElement('div');
  this.paintControls.className='homeShipPaint';this.paintControls.hidden=true;
  this.shipColors=document.createElement('div');this.shipColors.className='homePaintColors';
  this.shipCustom=document.createElement('button');
  this.shipCustom.type='button';this.shipCustom.className='homeCustomColor';this.shipCustom.textContent='Custom Colour';
  this.bindCustomizationLock(this.shipCustom,'ship:custom','Ship Custom Colours',200,'RC',()=>this.openPicker(paintColor(this.shipColor()),color=>this.chooseShipColor(color)));
  this.paintControls.append(this.shipColors,this.shipCustom);
  this.shipGradient=this.installGradientButton(this.shipCustom,()=>this.shipColor(),value=>this.chooseShipColor(value));this.customActions.before(this.paintControls);
  this.customChoices=document.createElement('nav');
  this.customChoices.className='homeCustomChoices';this.customChoices.hidden=true;
  this.customChoices.setAttribute('aria-label','Customize a model');
  this.customChoices.innerHTML='<button type="button" data-model="ship">Ship</button><button type="button" data-model="character">Character</button>';
  this.root.append(this.customChoices);
  this.modelButtons=[...this.customChoices.querySelectorAll('button')];
  for(const button of this.modelButtons)button.onclick=()=>this.selectCustomView(button.dataset.model);
 }
 setCustomPanelsVisible(visible){
  const sides=[[this.partsPanel,-1],[this.customPanel,1]];
  this.panelAnimations??=new Map();
  for(const [panel,side] of sides){
   const previous=this.panelAnimations.get(panel);
   if(!previous&&panel.hidden===!visible)continue;
   const current=previous?getComputedStyle(panel).translate:null;
   previous?.cancel();
   this.panelAnimations.delete(panel);
   panel.inert=!visible;
   if(!panel.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){
    panel.hidden=!visible;
    continue;
   }
   const edge=(side*110)+'%';
   panel.hidden=false;
   const animation=panel.animate(
    [{translate:current||(visible?edge:'0px')},{translate:visible?'0px':edge}],
    {duration:visible?135:190,easing:visible?'ease-out':'ease-in',fill:'forwards'}
   );
   this.panelAnimations.set(panel,animation);
   animation.onfinish=()=>{
    if(this.panelAnimations.get(panel)!==animation)return;
    this.panelAnimations.delete(panel);
    panel.hidden=!visible;
    animation.cancel();
   };
  }
 }
 selectCustomView(view){
  this.customView=view;this.cameraPanelKey=null;this.drag=null;
  const overview=view==='overview',ship=view==='ship';
  this.customChoices.hidden=!overview;
  if(overview&&this.camera&&this.world)this.updateCamera(this.host.clientWidth||globalThis.innerWidth||844,this.host.clientHeight||globalThis.innerHeight||390,0);
  this.closePicker();
  this.setCustomPanelsVisible(!overview);
  this.root.classList.toggle('homeCustomDetail',!overview);
  this.customHeading.textContent=ship?'Ship Customization':'Character Customization';
  this.partsPanel.querySelector('h2').textContent=ship?'Ship Parts':'Character Parts';
  this.paintControls.hidden=!ship;
  this.customHint.textContent=ship?'Drag the ship to orbit':'Drag the character to rotate';
  this.clearShipOutline();
  if(!ship)this.showShipEffectPreview(null);
  if(overview)return;
  this.partList.replaceChildren();
  const parts=ship?shipCategories:[...characterParts,['faces','Faces']];
  for(const [key,label] of parts){
   const button=document.createElement('button');button.type='button';button.dataset.part=key;
   if(key==='faces')button.dataset.category='faces';
   button.textContent=label;
   button.onclick=()=>ship?this.selectShipRegion(key):this.selectCharacterPart(key);
   this.partList.append(button);
  }
  if(ship)this.selectShipRegion('body');
  else this.selectCharacterPart('torso');
 }

 installColorPicker(){
  this.characterCustom=document.createElement('button');
  this.characterCustom.type='button';this.characterCustom.className='homeCustomColor';
  this.characterCustom.textContent='Custom Colour';
  this.characterColors.after(this.characterCustom);
  this.bindCustomizationLock(this.characterCustom,'character:custom','Character Custom Colours',200,'RC',()=>this.openPicker(paintColor(this.draft),color=>this.choose(color)));
  this.characterGradient=this.installGradientButton(this.characterCustom,()=>this.draft,value=>this.choose(value));
  this.picker=document.createElement('section');
  this.picker.className='homeColorPicker';this.picker.hidden=true;
  this.picker.innerHTML='<div class="homePickerTop"><strong>Custom Colour</strong><span class="homePickerSwatch" aria-hidden="true"></span><button type="button">Done</button></div><div class="homePickerSurfaces"><div class="homeHueWheel" tabindex="0" aria-label="Hue wheel"><i></i></div><div class="homeColorPlane" tabindex="0" aria-label="Saturation and brightness"><i></i></div></div><label>Hex <input type="text" maxlength="7" spellcheck="false" autocomplete="off" aria-label="Hex color"></label>';
  dragPanel(this.picker.querySelector('.homePickerTop'),this.picker,{margin:8});
  this.picker.setAttribute('role','dialog');
  this.picker.setAttribute('aria-label','Custom Colour');
  this.picker.setAttribute('aria-modal','true');
  this.pickerShade=document.createElement('div');
  this.pickerShade.className='homePickerShade';this.pickerShade.hidden=true;
  this.pickerShade.append(this.picker);
  this.root.append(this.pickerShade);
  this.pickerSwatch=this.picker.querySelector('.homePickerSwatch');
  this.pickerHex=this.picker.querySelector('input[type=text]');
  const wheel=this.picker.querySelector('.homeHueWheel'),plane=this.picker.querySelector('.homeColorPlane');
  const color=new T.Color(),hueColor=new T.Color(),hsl={h:0,s:0,l:0};
  let hue=0,saturation=0,value=1;
  const drawPicker=(hex)=>{
   const angle=hue*2*Math.PI;
   wheel.style.setProperty('--hue-x',50+Math.cos(angle)*38+'%');
   wheel.style.setProperty('--hue-y',50+Math.sin(angle)*38+'%');
   const base=hueColor.setHSL(hue,1,.5,T.SRGBColorSpace).getHexString();
   plane.style.setProperty('--picker-hue','#'+base);
   plane.style.setProperty('--color-x',saturation*100+'%');
   plane.style.setProperty('--color-y',(1-value)*100+'%');
   this.pickerHex.value=hex;this.pickerSwatch.style.background=hex;
  };
  const preview=()=>{
   const light=value*(1-saturation/2);
   const spread=light===0||light===1?0:(value-light)/Math.min(light,1-light);
   const hex='#'+color.setHSL(hue,spread,light,T.SRGBColorSpace).getHexString();
   drawPicker(hex);this.pickColor?.(hex);
  };
  this.syncPicker=hex=>{
   color.set(hex).getHSL(hsl,T.SRGBColorSpace);
   hue=hsl.h;
   value=hsl.l+hsl.s*Math.min(hsl.l,1-hsl.l);
   saturation=value===0?0:2*(1-hsl.l/value);
   drawPicker(hex);
  };
  const clamp=x=>T.MathUtils.clamp(x,0,1);
  const bind=(control,update,keyboard)=>{
   let held=null;
   const sample=e=>{
    const rect=control.getBoundingClientRect();
    if(rect.width&&rect.height){update((e.clientX-rect.left)/rect.width,(e.clientY-rect.top)/rect.height);preview();}
   };
   control.onpointerdown=e=>{if(e.button>0||held!==null)return;held=e.pointerId;control.setPointerCapture?.(held);sample(e);};
   control.onpointermove=e=>{if(e.pointerId===held)sample(e);};
   control.onpointerup=control.onpointercancel=control.onlostpointercapture=e=>{if(e.pointerId===held)held=null;};
   control.onkeydown=e=>{
    if(!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.key))return;
    e.preventDefault();keyboard(e.key);preview();
   };
  };
  bind(wheel,(x,y)=>{hue=(Math.atan2(y-.5,x-.5)/(2*Math.PI)+1)%1;},key=>{
   hue=(hue+(['ArrowRight','ArrowUp'].includes(key)?1:-1)/72+1)%1;
  });
  bind(plane,(x,y)=>{saturation=clamp(x);value=clamp(1-y);},key=>{
   if(key==='ArrowLeft'||key==='ArrowRight')saturation=clamp(saturation+(key==='ArrowRight'?.04:-.04));
   else value=clamp(value+(key==='ArrowUp'?.04:-.04));
  });
  this.pickerHex.oninput=()=>{
   const hex=this.pickerHex.value.trim().toLowerCase();
   if(isHexColor(hex)){this.syncPicker(hex);this.pickColor?.(hex);}
  };
  this.picker.querySelector('button').onclick=()=>this.closePicker();
  this.installGradientEditor();
  this.picker.onkeydown=e=>{
   if(e.key!=='Tab')return;
   const controls=[...this.picker.querySelectorAll('button,[tabindex],input')];
   const index=controls.indexOf(document.activeElement);
   e.preventDefault();controls[(index+(e.shiftKey?-1:1)+controls.length)%controls.length].focus();
  };
 }
 installGradientButton(after,value,apply){
  const button=document.createElement('button');
  button.type='button';button.className='homeCustomColor';button.textContent='Gradient Editor';
  after.after(button);
  const section=after===this.shipCustom?'ship':'character';
  this.bindCustomizationLock(button,section+':gradient',(section==='ship'?'Ship':'Character')+' Gradient Editor',500,'RC',()=>{
   const current=value(),color=paintColor(current)||CHARACTER_COLORS[0];
   this.gradientStops=(paintGradient(current)||[{position:0,color},{position:1,color}]).map(stop=>({...stop}));
   this.gradientStop=0;this.applyGradient=apply;this.gradientFocus=button;
   this.gradientEditor.hidden=false;this.pickerShade.hidden=false;
   for(const panel of [this.partsPanel,this.customPanel,this.host,this.root.querySelector('.homeCustomClose')])panel.inert=true;
   this.renderGradientEditor();this.gradientEditor.querySelector('button').focus({preventScroll:true});
  });
  return button;
 }
 installGradientEditor(){
  const editor=this.gradientEditor=document.createElement('section');
  editor.className='homeColorPicker homeGradientEditor';editor.hidden=true;
  editor.setAttribute('role','dialog');editor.setAttribute('aria-modal','true');
  editor.setAttribute('aria-label','Gradient Editor');
  editor.innerHTML='<div class="homePickerTop"><strong>Gradient Editor</strong><button type="button" data-gradient="done">Done</button></div><div class="homeGradientTrack"></div><label>Position <input type="number" min="0" max="100" step="1" aria-label="Stop position"><span>%</span></label><div class="homeGradientActions"><button type="button" data-gradient="colour">Stop Colour</button><button type="button" data-gradient="add">Add Stop</button><button type="button" data-gradient="remove">Remove</button></div>';
  this.pickerShade.prepend(editor);
  dragPanel(editor.querySelector('.homePickerTop'),editor,{margin:8});
  const get=key=>editor.querySelector('[data-gradient='+key+']');
  this.gradientTrack=editor.querySelector('.homeGradientTrack');
  this.gradientPosition=editor.querySelector('input');
  const apply=()=>{this.applyGradient(this.gradientStops.map(stop=>({...stop})));this.renderGradientEditor();};
  get('done').onclick=()=>{apply();this.closeGradientEditor();};
  get('colour').onclick=()=>{
   const stop=this.gradientStops[this.gradientStop];
   this.openPicker(stop.color,color=>{stop.color=color;apply();});
  };
  get('add').onclick=()=>{
   if(this.gradientStops.length>=4)return;
   let largest=0;
   for(let i=1;i<this.gradientStops.length-1;i++){
    if(this.gradientStops[i+1].position-this.gradientStops[i].position>this.gradientStops[largest+1].position-this.gradientStops[largest].position)largest=i;
   }
   const left=this.gradientStops[largest],right=this.gradientStops[largest+1];
   this.gradientStop=largest+1;
   this.gradientStops.splice(this.gradientStop,0,{position:(left.position+right.position)/2,color:left.color});
   apply();
  };
  get('remove').onclick=()=>{
   if(this.gradientPosition.disabled)return;
   this.gradientStops.splice(this.gradientStop,1);this.gradientStop--;
   apply();
  };
  const move=position=>{
   const index=this.gradientStop;
   if(this.gradientPosition.disabled||!Number.isFinite(position))return;
   const left=this.gradientStops[index-1].position,right=this.gradientStops[index+1].position;
   const gap=Math.min(.01,(right-left)/3);
   this.gradientStops[index].position=T.MathUtils.clamp(position,left+gap,right-gap);
   apply();
  };
  this.gradientPosition.onchange=()=>move(Number(this.gradientPosition.value)/100);
  const track=this.gradientTrack;
  let drag=null;
  track.onpointerdown=e=>{
   const key=e.target.closest('button[data-stop]');
   if(!key||e.button>0||drag)return;
   this.gradientStop=Number(key.dataset.stop);
   const rect=track.getBoundingClientRect();
   if(!rect.width)return;
   if(this.gradientStop===0||this.gradientStop===this.gradientStops.length-1)return;
   drag={id:e.pointerId,rect};
   track.setPointerCapture?.(e.pointerId);this.renderGradientEditor();
  };
  track.onpointermove=e=>{
   if(drag?.id===e.pointerId)move((e.clientX-drag.rect.left)/drag.rect.width);
  };
  track.onpointerup=track.onpointercancel=track.onlostpointercapture=e=>{if(drag?.id===e.pointerId)drag=null;};
  editor.onkeydown=e=>{
   if(e.key!=='Tab')return;
   const controls=[...editor.querySelectorAll('button,input')].filter(node=>!node.disabled);
   const index=controls.indexOf(document.activeElement);
   e.preventDefault();controls[(index+(e.shiftKey?-1:1)+controls.length)%controls.length].focus();
  };

 }
 renderGradientEditor(){
  const stops=this.gradientStops,index=this.gradientStop;
  this.gradientTrack.style.background='linear-gradient(90deg,'+stops.map(stop=>stop.color+' '+stop.position*100+'%').join(',')+')';
  this.gradientTrack.replaceChildren();
  for(const [i,stop] of stops.entries()){
   const key=document.createElement('button');key.type='button';
   key.dataset.stop=String(i);key.style.left=(stop.position*100)+'%';key.style.setProperty('background',stop.color,'important');
   key.setAttribute('aria-pressed',String(index===i));key.setAttribute('aria-label','Stop '+(i+1));
   key.onclick=()=>{this.gradientStop=i;this.renderGradientEditor();this.gradientTrack.children[i].focus();};
   this.gradientTrack.append(key);
  }
  const end=index===0||index===stops.length-1;
  this.gradientPosition.value=String(Math.round(stops[index].position*100));
  this.gradientPosition.disabled=end;
  this.gradientEditor.querySelector('[data-gradient=remove]').disabled=end;
  this.gradientEditor.querySelector('[data-gradient=add]').disabled=stops.length===4;
 }
 closeGradientEditor(){
  if(!this.gradientEditor||this.gradientEditor.hidden)return;
  this.gradientEditor.hidden=true;this.gradientEditor.style.translate='';this.pickerShade.hidden=true;
  for(const panel of [this.partsPanel,this.customPanel,this.host,this.root.querySelector('.homeCustomClose')])panel.inert=false;
  this.gradientFocus?.focus({preventScroll:true});
 }
 openPicker(color,choose){
  this.pickerFocus=document.activeElement;
  this.pickColor=choose;this.syncPicker(color);this.picker.hidden=false;this.pickerShade.hidden=false;
  for(const panel of [this.partsPanel,this.customPanel,this.host,this.root.querySelector('.homeCustomClose')])panel.inert=true;
  this.picker.querySelector('button').focus({preventScroll:true});
 }
 closePicker(){
  if(!this.picker||this.picker.hidden)return;
  this.picker.hidden=true;this.pickerShade.hidden=this.gradientEditor?.hidden!==false;this.pickColor=null;this.picker.style.translate='';
  for(const panel of [this.partsPanel,this.customPanel,this.host,this.root.querySelector('.homeCustomClose')])panel.inert=this.gradientEditor?.hidden===false;
  this.pickerFocus?.focus({preventScroll:true});this.pickerFocus=null;
 }
 selectCharacterPart(part){
  this.closePicker();this.characterPart=part;
  const faces=part==='faces';
  this.characterColors.hidden=faces;this.characterCustom.hidden=faces;this.characterGradient.hidden=faces;this.characterFaces.hidden=!faces;
  for(const button of this.partList.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.part===part));
  const label=faces?'Faces':characterParts.find(([key])=>key===part)?.[1]||'Torso';
  this.partDescription.textContent=faces?'Faces':label+' · Colours';
  this.draft=this.draftCharacterPaint[part]||this.color;
  this.syncCharacterSwatches();
 }
 syncCharacterSwatches(){
  for(const button of this.characterColors.querySelectorAll('[data-color]'))button.setAttribute('aria-pressed',String(button.dataset.color===this.draft));
 }
 prepareShipSections(){
  const rig=this.world.rig;
  this.paintGroups=shipPaintGroups(rig);
  this.shipSections=new Map();
  // Install paint uniforms before the first render so swatches only update uniforms.
  for(const {meshes} of this.paintGroups.values())for(const {material} of meshes){
   const original=originalPaint.get(material);
   if(original.paintAmount)continue;
   tintPaintTexture(material,original,original.fallback||'#'+original.color.getHexString(),true);
   tintPaintTexture(material,original,original.fallback||'#'+original.color.getHexString(),false);
  }
  const material=new T.LineBasicMaterial({color:0x9cddff,transparent:true,opacity:.8,depthWrite:false,toneMapped:false});
  const point=new T.Vector3(),transform=new T.Matrix4();
  rig.model.updateWorldMatrix(true,true);
  const inverse=rig.model.matrixWorld.clone().invert();
  const seat=new T.Box3();
  rig.model.traverse(mesh=>{
   const vertices=mesh.geometry?.attributes.position;
   if(!vertices)return;
   transform.multiplyMatrices(inverse,mesh.matrixWorld);
   for(const {name,start,count} of mesh.userData.sourceParts||[]){
    if(!/^Seat_(Base|Back|Cushion_Red)$/.test(name))continue;
    for(let i=start;i<start+count;i++){
     seat.expandByPoint(point.fromBufferAttribute(vertices,i).applyMatrix4(transform));
    }
   }
  });
  this.shipSeat=seat.isEmpty()?rig.subjectCenter:seat.getCenter(new T.Vector3());
  for(const [region,{meshes}] of this.paintGroups){
   const positions=[],bounds=new T.Box3();
   for(const mesh of meshes){
    transform.multiplyMatrices(inverse,mesh.matrixWorld);
    mesh.geometry.computeBoundingBox();
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(transform));
    const edges=new T.EdgesGeometry(mesh.geometry,45);
    const vertices=edges.attributes.position;
    for(let i=0;i<vertices.count;i++){
     point.fromBufferAttribute(vertices,i).applyMatrix4(transform);
     positions.push(point.x,point.y,point.z);
    }
    edges.dispose();
   }
   const geometry=new T.BufferGeometry().setAttribute('position',new T.Float32BufferAttribute(positions,3));
   const outline=new T.LineSegments(geometry,material);
   outline.visible=false;outline.renderOrder=4;
   rig.model.add(outline);
   this.shipSections.set(region,{center:bounds.getCenter(new T.Vector3()),outline});
  }
 }
 clearShipOutline(){
  if(this.shipSection)this.shipSection.outline.visible=false;
  this.shipSection=null;
 }
 selectShipRegion(region){
  this.closePicker();this.clearShipOutline();
  this.shipRegion=region;this.paintGroups??=shipPaintGroups(this.world?.rig);
  this.characterColors.hidden=true;this.characterCustom.hidden=true;this.characterGradient.hidden=true;this.characterFaces.hidden=true;
  for(const button of this.partList.querySelectorAll('button'))button.setAttribute('aria-pressed',String(button.dataset.part===region));
  this.partDescription.textContent=(shipCategories.find(([key])=>key===region)?.[1]||'Ship')+' · Colours';
  this.paintKey=this.paintGroups.has(region)||region==='exhaust'||region==='trails'?region:null;
  this.showShipEffectPreview(region);
  this.shipSection=this.shipSections?.get(region);
  if(this.shipSection)this.shipSection.outline.visible=true;
  const rear=region==='exhaust'||region==='trails'||region==='lights';
  this.shipOrbitYaw=rear?-2.55:-.65;this.shipOrbitPitch=region==='cockpit'?.55:.36;
  this.renderShipPaint();
 }
 shipColor(){
  const key=this.paintKey;
  return this.draftShipPaint[key]||(key==='trails'?TRAIL_DEFAULT:key==='exhaust'?EXHAUST_DEFAULT:this.paintGroups.get(key)?.base||CHARACTER_COLORS[0]);
 }
 renderShipPaint(){
  this.shipColors.replaceChildren();
  this.shipCustom.hidden=!this.paintKey;this.shipGradient.hidden=!this.paintKey;
  if(!this.paintKey){
   this.shipColors.textContent='This ship has no parts in this category.';
   return;
  }
  const swatches=document.createElement('div');swatches.className='homeColors';
  for(const [i,color] of CHARACTER_COLORS.entries()){
   const button=document.createElement('button');button.type='button';button.dataset.shipColor=color;
   button.style.setProperty('background',color,'important');
   button.setAttribute('aria-label','Color '+(i+1));
   button.setAttribute('aria-pressed',String(color===this.shipColor()));
   button.onclick=()=>this.chooseShipColor(color);swatches.append(button);
  }
  this.shipColors.append(swatches);
 }
 chooseShipColor(color){
  if(!isPaint(color)||!this.paintKey)return;
  delete this.draftShipPaint[this.paintKey];
  this.draftShipPaint[this.paintKey]=color;
  applyShipPaint(this.world?.rig,this.draftShipPaint,this.paintKey);
  this.world?.trailPreview?.setColor(this.draftShipPaint.trails);
  for(const button of this.shipColors.querySelectorAll('[data-ship-color]'))button.setAttribute('aria-pressed',String(button.dataset.shipColor===color));
 }
 showShipEffectPreview(region){
  if(!this.world?.flightPreview)this.previewZoom=1;
  this.world?.setFlightPreview(region==='trails'||region==='exhaust'?region:null);
  this.world?.trailPreview.setColor(this.draftShipPaint?.trails);
 }
 resetCustomization(){
  this.closePicker();
  if(this.customView==='ship'){
   if(!this.paintKey)return;
   delete this.draftShipPaint[this.paintKey];
   this.draftShipPaint[this.paintKey]=null;
   applyShipPaint(this.world?.rig,this.draftShipPaint);
   this.world?.trailPreview.setColor(this.draftShipPaint.trails);
   this.renderShipPaint();
  }else if(this.characterPart==='faces')this.chooseFace(CHARACTER_FACES[0]);
  else{
   delete this.draftCharacterPaint[this.characterPart];
   this.draft=this.color;
   applyCharacterColor(this.preview,this.color,this.draftCharacterPaint);
   this.syncCharacterSwatches();
  }
 }
 bindCustomizationLock(button,key,label,cost,currency,activate){
  if(!this.accountCustomization||!key){button.onclick=activate;return;}
  this.customizationButtons??=new Map();
  this.customizationButtons.set(button,{key,label});
  button.onclick=()=>this.ownedCustomizations.has(key)?activate():this.purchaseCustomization(key,label,cost,currency,activate);
  this.refreshCustomizationLocks();
 }
 refreshCustomizationLocks(){
  for(const [button,{key,label}] of this.customizationButtons||[]){
   const locked=!this.ownedCustomizations.has(key);
   setSystemLock(button,locked);
   button.setAttribute('aria-label',label+(locked?' · Locked':''));
  }
 }
 applyAccountCustomization(state){
  this.ownedCustomizations=new Set(state?.unlocks||[]);
  this.characterPaint=state?.character?.paint||{};
  this.face=state?.character?.face||'Neutral';
  this.shipPaint=Object.fromEntries((state?.shipOrder||Object.keys(state?.ship||{})).map(key=>[key,state.ship[key]]));
  applyCharacterFace(this.character,this.face);applyCharacterColor(this.character,this.color,this.characterPaint);
  applyCharacterFace(this.preview,this.face);applyCharacterColor(this.preview,this.color,this.characterPaint);
  applyShipPaint(this.shipRig,this.shipPaint);applyShipPaint(this.world?.rig,this.shipPaint);
  this.setTrailColor(this.shipPaint.trails);
  this.refreshCustomizationLocks();
 }
 clearAccountCustomization(){
  this.customizationOwner=null;
  if(this.customizing)this.customize(false);
  this.applyAccountCustomization(null);
 }
 async loadCustomization(){
  const account=this.account(),owner=account?.loadedId;
  if(!account?.ready||account.guest||!owner){this.clearAccountCustomization();return;}
  if(this.customizationOwner===owner)return;
  if(this.customizationLoad?.owner===owner)return this.customizationLoad.promise;
  this.clearAccountCustomization();
  const promise=account.rpc('tzg_customization_state').then(state=>{
   if(!account.ready||account.guest||account.loadedId!==owner)return;
   this.applyAccountCustomization(state);
   this.customizationOwner=owner;
  }).finally(()=>{if(this.customizationLoad?.promise===promise)this.customizationLoad=null;});
  this.customizationLoad={owner,promise};
  return promise;
 }
 customizationUnlockSummary(key,cost,currency,balance){
  const summary=document.createElement('div'),preview=document.createElement('div');
  summary.className='homeUnlockSummary';preview.className='homeUnlockPreview';
  const separator=key.indexOf(':');
  const section=key.slice(0,separator),feature=key.slice(separator+1);
  if(section==='face'){
   preview.textContent=feature;
  }else{
   const gradient=feature==='gradient';
   preview.classList.add(gradient?'homeUnlockGradient':'homeUnlockColours');
   preview.textContent=gradient?'Blend colours across your parts':'Choose any colour for your parts';
  }
  const amounts=document.createElement('dl');
  const rows=[['Price',cost],['Your balance',balance]];
  if(balance>=cost)rows.push(['After purchase',balance-cost]);
  for(const [label,value] of rows){
   const term=document.createElement('dt'),amount=document.createElement('dd');
   term.textContent=label;amount.textContent=value.toLocaleString()+' '+currency;
   amounts.append(term,amount);
  }
  summary.append(preview,amounts);
  if(balance<cost){
   const warning=document.createElement('p');
   warning.className='homeConfirmWarning';
   warning.textContent='You need '+(cost-balance).toLocaleString()+' more '+currency+'.';
   summary.append(warning);
  }
  return summary;
 }
 async purchaseCustomization(key,label,cost,currency,activate){
  if(this.purchaseOpen||this.customizationSaving)return;
  const account=this.account(),owner=account?.loadedId;
  if(!account?.ready||account.guest||!owner)return;
  const balance=this.economy[currency.toLowerCase()];
  this.purchaseOpen=true;
  try{
   const bought=await chatDialog({title:'Unlock '+label,className:'customizationPurchase customizationUnlock',
    content:this.customizationUnlockSummary(key,cost,currency,balance),
    submit:'Unlock',submitDisabled:balance<cost,
    onSubmit:async()=>{
     if(!account.ready||account.guest||account.loadedId!==owner)throw Error('Sign in again to continue.');
     const result=await account.cloud.serverMutation('tzg_customization_unlock',{p_kind:key},(state,before)=>{
      this.economy.fp+=state.fp-before.fp;this.economy.rc+=state.rc-before.rc;
     });
     this.ownedCustomizations=new Set(result.unlocks);
     this.refreshCustomizationLocks();
     this.drawCurrencies();
    }});
   if(bought&&this.customizing&&account.loadedId===owner)activate();
  }finally{this.purchaseOpen=false;}
 }
 customizationPaint(section){
  const draft=section==='ship'?this.draftShipPaint:this.draftCharacterPaint;
  const normalize=paint=>Object.fromEntries(Object.entries(paint||{}).flatMap(([part,value])=>{
   const gradient=paintGradient(value);
   if(gradient)return [[part,gradient.map(({position,color})=>({position,color:color.toLowerCase()}))]];
   if(!isHexColor(value))return [];
   const color=value.toLowerCase();
   return section==='character'&&color===CHARACTER_COLORS[0]?[]:[[part,color]];
  }));
  const paint=normalize(draft);
  const saved=normalize(section==='ship'?this.shipPaint:this.characterPaint);
  const parts=new Set([...Object.keys(saved),...Object.keys(paint)]);
  const changes=[...parts].flatMap(part=>{
   if(JSON.stringify(saved[part])===JSON.stringify(paint[part]))return [];
   const cost=paint[part]===undefined?0:section==='character'?20:part==='trails'?200:part==='exhaust'?150:100;
   return [{part,before:saved[part],after:paint[part],cost}];
  });
  return {paint,changes,cost:changes.reduce((total,change)=>total+change.cost,0)};
 }
 paintConfirmation(section,changes,face,cost,insufficient){
  const summary=document.createElement('div');
  const list=document.createElement('ul');
  list.className='homePaintConfirmation';
  const names=new Map(section==='ship'?shipCategories:characterParts);
  const swatch=value=>{
   const node=document.createElement('span');
   node.className='homeConfirmSwatch';
   const gradient=paintGradient(value);
   const label=gradient?'Gradient '+gradient.map(stop=>stop.color).join(', '):value||'Original';
   node.title=label;
   node.setAttribute('aria-label',label);
   node.setAttribute('role','img');
   if(gradient)node.style.background='linear-gradient(90deg,'+gradient.map(stop=>stop.color+' '+stop.position*100+'%').join(',')+')';
   else if(value)node.style.backgroundColor=value;
   else node.textContent='Original';
   return node;
  };
  for(const {part,before,after,cost} of changes){
   const row=document.createElement('li'),label=document.createElement('strong'),preview=document.createElement('span'),price=document.createElement('span');
   label.textContent=names.get(part)||part;
   preview.className='homeConfirmPreview';
   preview.append(swatch(before),' → ',swatch(after));
   price.textContent=cost.toLocaleString()+' FP';
   row.append(label,preview,price);list.append(row);
  }
  if(section==='character'&&face!==this.face){
   const row=document.createElement('li');
   const label=document.createElement('strong'),preview=document.createElement('span'),price=document.createElement('span');
   label.textContent='Face';preview.textContent=this.face+' → '+face;price.textContent='0 FP';
   row.append(label,preview,price);
   list.append(row);
  }
  if(!list.children.length){
   const row=document.createElement('li');row.textContent='No changes';list.append(row);
  }
  const total=document.createElement('div'),amount=document.createElement('strong');
  total.className='homeConfirmTotal';amount.textContent=cost.toLocaleString()+' FP';
  total.append('Total cost',amount);summary.append(list,total);
  if(insufficient){
   const warning=document.createElement('p');warning.className='homeConfirmWarning';
   warning.textContent='You need '+(cost-this.economy.fp).toLocaleString()+' more FP.';summary.append(warning);
  }
  return summary;
 }
 async saveAccountCustomization(section){
  if(this.customizationSaving||this.purchaseOpen)return;
  const account=this.account(),owner=account?.loadedId;
  if(!account?.ready||account.guest||!owner||this.customizationOwner!==owner)return;
  const {paint,changes,cost}=this.customizationPaint(section);
  const face=section==='character'?this.draftFace:null;
  const pending=account.cloud.externalPending;
  const insufficient=!pending&&this.economy.fp<cost;
  const hasChanges=changes.length>0||(section==='character'&&face!==this.face);
  this.customizationSaving=true;
  const button=this.root.querySelector('.homeSave');button.disabled=true;
  try{
   const saved=await chatDialog({
    title:section==='ship'?'Review ship changes':'Review character changes',className:'customizationPurchase customizationConfirm',
    content:this.paintConfirmation(section,changes,face,cost,insufficient),submit:'Save changes',
    modal:false,submitDisabled:insufficient,
    onSubmit:async()=>{
     if(!account.ready||account.guest||account.loadedId!==owner)throw Error('Sign in again to continue.');
     const current=this.customizationPaint(section);
     if(JSON.stringify(current.paint)!==JSON.stringify(paint)||(section==='character'&&this.draftFace!==face))throw Error('Changes were edited. Cancel and reopen Save to review them.');
     if(!hasChanges&&!pending)return;
     const state=await account.cloud.serverMutation('tzg_customization_save_paid',{
      p_section:section,p_paint:paint,p_face:face,
      p_order:section==='ship'?Object.keys(paint):null,p_cost:cost
     },(wallet,before)=>{this.economy.fp+=wallet.fp-before.fp;});
     if(account.ready&&!account.guest&&account.loadedId===owner){
      this.applyAccountCustomization(state);this.drawCurrencies();
     }
    }
   });
   if(saved&&account.ready&&!account.guest&&account.loadedId===owner)this.customize(false);
  }finally{this.customizationSaving=false;button.disabled=false;}
 }
 saveCustomization(){
  if(this.accountCustomization)return this.saveAccountCustomization(this.customView==='ship'?'ship':'character');
  if(this.customView!=='ship'){this.saveColor();return}
  try{
   localStorage.setItem(SHIP_PAINT_KEY,JSON.stringify(this.draftShipPaint));
   this.shipPaint={...this.draftShipPaint};
   applyShipPaint(this.shipRig,this.shipPaint);
   this.setTrailColor(this.shipPaint.trails);
   this.customize(false);
  }catch{this.root.querySelector('.homeNotice').textContent='Could not save on this device. Please try again.'}
 }

 chooseFace(face){if(!CHARACTER_FACES.includes(face))return;this.draftFace=face;this.yaw=0;applyCharacterFace(this.preview,face);this.root.querySelectorAll('[data-face]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.face===face)))}

 refresh(){const a=this.account(),profile=a?.profile;this.root.querySelector('.homeName').textContent=profile?.display_name||(a?.guest?storedGuestName():'')||'Guest';this.root.querySelector('.homeId').textContent=a?.guest?'Guest':profile?.public_id?'TZG-Id_'+profile.public_id:'';this.drawCurrencies();const avatar=this.root.querySelector('.homeAvatar');if(avatar&&avatar.dataset.value!==String(profile?.avatar)){setAvatar(avatar,profile?.avatar);avatar.dataset.value=String(profile?.avatar)}const p=globalThis.tzgPlayerProgress||a?.pages?.dashboard?.progress;if(this.root.querySelector('.homeLevel')){this.root.querySelector('.homeLevel').textContent=a?.guest?'Guest explorer':p?'Level '+p.level:'Explorer';this.root.querySelector('.homeXPText').textContent=p?Number(p.level_xp||0).toLocaleString()+' / '+(p.required_xp??'MAX')+' XP':'';this.root.querySelector('.homeXPTrack i').style.width=(p?Math.min(100,p.required_xp?(p.level_xp||0)/p.required_xp*100:100):0)+'%'}}
 async transition(change){if(this.busy)return;this.busy=true;this.fade.hidden=false;this.fade.classList.remove('homeFadeBlack');await new Promise(r=>requestAnimationFrame(()=>{this.fade.classList.add('homeFadeBlack');setTimeout(r,230)}));try{await change()}finally{await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));this.fade.classList.remove('homeFadeBlack');await new Promise(r=>setTimeout(r,230));this.fade.hidden=true;this.busy=false}}
 async open({animate=true}={}){
  if(this.active||this.busy||this.leaving)return;
  this.sensor.request();
  const enter=async()=>{
   this.clearInputs();this.active=true;this.root.hidden=false;
   document.body.classList.add('homeExperimentOpen');
   this.refresh();await this.initScene();this.root.classList.remove('homeChromeVisible');
   this.dockChat(true);this.dockBrand();this.setGround();
   const help=document.getElementById('homeMoreHelp');if(help)help.hidden=false;
   this.customizing=false;this.root.classList.remove('homeIsCustomizing');
   this.root.querySelector('.homeCustomization').hidden=true;
   this.gyroOrigin=null;this.smoother.reset();this.last=performance.now();this.frame();
  };
  if(animate)await this.transition(enter);
  else{this.busy=true;try{await enter()}finally{this.busy=false}}
  requestAnimationFrame(()=>requestAnimationFrame(()=>this.root.classList.add('homeChromeVisible')));
 }
 async play(){
  if(!this.active||this.busy||this.leaving)return;
  this.leaving=true;
  this.root.classList.remove('homeChromeVisible');
  this.root.classList.add('homePlayLeaving');
  const chrome=this.root.querySelector('.homeChrome');
  chrome.inert=true;
  this.drag=null;
  this.clearInputs();
  const handoff=()=>{
   this.customize(false);this.active=false;this.dockChat(false);this.dockBrand();this.restoreCanvas();
   for(const id of ['homeMoreHelp','utilityMenu']){
    const element=document.getElementById(id);if(element)element.hidden=true;
   }
   this.root.hidden=true;document.body.classList.remove('homeExperimentOpen');
   globalThis.cancelAnimationFrame?.(this.raf);this.clearInputs();this.onPlay?.();
  };
  let overlay;
  try{
   if(!this.root.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){handoff();return;}
   overlay=document.createElement('div');overlay.className='homePlayTransition';overlay.setAttribute('aria-hidden','true');
   overlay.innerHTML='<div class="homePlayStage"><div class="homePlayFrames"><div class="homePlayFrameTop"></div><div class="homePlayFrameBottom"></div></div><div class="homePlayTitles"><strong>The Zero Gravity</strong><span>Web Edition</span></div></div><div class="homePlayFlash"></div><div class="homePlayCover"></div>';
   document.body.append(overlay);
   const stage=overlay.querySelector('.homePlayStage');
   const frames=overlay.querySelector('.homePlayFrames');
   const flash=overlay.querySelector('.homePlayFlash');
   const cover=overlay.querySelector('.homePlayCover');
   const [title,edition]=overlay.querySelectorAll('.homePlayTitles > *');
   const [top,bottom]=frames.children;
   const animate=(element,keyframes,duration,easing='cubic-bezier(.22,.61,.36,1)')=>
    element.animate(keyframes,{duration,easing,fill:'both'}).finished.catch(()=>{});
   if(this.cameraReady&&this.camera){
    const offset=this.camera.getWorldDirection(new T.Vector3()).negate();
    offset.y=0;
    if(offset.lengthSq()<1e-6)offset.set(0,0,1);
    offset.normalize().multiplyScalar(3.5*Math.cos(Math.PI/6));offset.y=3.5*Math.sin(Math.PI/6);
    this.playCamera={start:performance.now(),origin:this.camera.position.clone(),offset};
   }
   await Promise.all([
    animate(title,[{transform:'translateX(-110vw)'},{transform:'translateX(0)'}],460),
    animate(edition,[{transform:'translateX(110vw)'},{transform:'translateX(0)'}],460)
   ]);
   await Promise.all([
    animate(top,[{transform:'translateY(-101%)'},{transform:'translateY(0)'}],300,'cubic-bezier(.42,0,.65,1)'),
    animate(bottom,[{transform:'translateY(101%)'},{transform:'translateY(0)'}],300,'cubic-bezier(.42,0,.65,1)')
   ]);
   await Promise.all([
    animate(flash,[{opacity:.95},{opacity:0}],180),
    animate(stage,[{transform:'translate(0)'},{transform:'translate(4px,-2px)'},{transform:'translate(-3px,2px)'},{transform:'translate(2px,0)'},{transform:'translate(0)'}],180,'linear')
   ]);
   await animate(frames,[{transform:'scale(1)'},{transform:'scale(1.12)'}],220);
   await animate(cover,[{opacity:1,transform:'scale(.8)'},{opacity:1,transform:'scale(1.01)'}],440);
   stage.hidden=true;
   handoff();
   if(!document.hidden)await new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve)));
   await animate(cover,[{opacity:1,transform:'scale(1.01)'},{opacity:0,transform:'scale(1.01)'}],360);
  }finally{
   if(this.active)handoff();
   overlay?.remove();this.playCamera=null;chrome.inert=false;
   this.root.classList.remove('homePlayLeaving');this.leaving=false;
  }
 }
 openMenu(id){if(this.customizing||this.busy)return;if(id==='home-settings'){document.getElementById('brand')?.click();return}if(id==='inventoryBtn'){this.openInventory();return}const original=document.getElementById(id);if(original&&!original.disabled)original.click();else this.notify('This menu is not available for this account.')}
 customize(open){
  if(!this.active)return;
  if(open&&this.account()?.guest){
   this.root.querySelector('.homeNotice').textContent='Sign in to customize your character and ship.';
   return;
  }
  if(open&&this.accountCustomization){
   const account=this.account();
   if(!account?.ready||account.guest){
    this.root.querySelector('.homeNotice').textContent='Sign in to customize your character and ship.';
    return;
   }
   if(this.customizationOwner!==account.loadedId){
    if(this.customizationLoading)return;
    this.customizationLoading=true;
    this.loadCustomization().then(()=>{
     if(this.active&&this.customizationOwner&&this.customizationOwner===account.loadedId)this.customize(true);
    }).catch(error=>{this.root.querySelector('.homeNotice').textContent=error.message||'Could not load customization.';})
     .finally(()=>{this.customizationLoading=false;});
    return;
   }
  }
  this.root.querySelector('.homeNotice').textContent='';
  this.customizing=open;
  this.root.classList.toggle('homeIsCustomizing',open);
  this.root.querySelector('.homeCustomClose').hidden=!open;
  this.drag=null;
  if(open){
   this.closeMenus();
   this.draftShipPaint={...this.shipPaint};this.draftCharacterPaint={...this.characterPaint};this.yaw=0;
   this.draft=this.color;this.chooseFace(this.face);this.selectCustomView('overview');
  }else{
   this.customView=null;this.closePicker();this.closeGradientEditor();this.clearShipOutline();this.showShipEffectPreview(null);this.customChoices.hidden=true;this.setCustomPanelsVisible(false);
   this.root.classList.remove('homeCustomDetail');
   this.draft=this.color;applyCharacterColor(this.preview,this.color,this.characterPaint);applyCharacterFace(this.preview,this.face);applyShipPaint(this.world?.rig,this.shipPaint);
  }
 }
 choose(color){
  if(!isPaint(color)||!this.characterPart||this.characterPart==='faces')return;
  this.draft=typeof color==='string'?color.toLowerCase():color;
  this.draftCharacterPaint[this.characterPart]=this.draft;
  applyCharacterColor(this.preview,this.color,this.draftCharacterPaint);
  this.syncCharacterSwatches();
 }
 saveColor(){
  try{
   localStorage.setItem(CHARACTER_PAINT_KEY,JSON.stringify(this.draftCharacterPaint));
   localStorage.setItem('tzg-character-face',this.draftFace||this.face);
   this.characterPaint={...this.draftCharacterPaint};
   this.face=this.draftFace||this.face;
   applyCharacterFace(this.character,this.face);applyCharacterColor(this.character,this.color,this.characterPaint);
   this.customize(false);
  }catch{this.root.querySelector('.homeNotice').textContent='Could not save on this device. Please try again.'}
 }
 async initScene(){const context=this.worldContext();if(this.world){this.mountCanvas();return}try{const {HomeWorld}=await import('./home-world.js?v=259');this.renderer=context.renderer;this.camera=new T.PerspectiveCamera(50,1,.05,300000);this.preview=new CapsuleCharacter();applyCharacterColor(this.preview,this.color,this.characterPaint);applyCharacterFace(this.preview,this.face);this.world=new HomeWorld(context,this.preview);this.scene=this.world.scene;await this.world.rig.ready;applyShipPaint(this.world.rig,this.shipPaint);this.prepareShipSections();this.world.prepareShipDetails();this.mountCanvas()}catch(error){this.renderer=null;this.notify('Home preview could not load: '+error.message)}}
 mountCanvas(){const canvas=this.renderer?.domElement||this.renderer?.canvas;if(!canvas)return;if(canvas.parentElement!==this.host){this.canvasOrigin={parent:canvas.parentElement,next:canvas.nextSibling};this.homePixelRatio=this.renderer.getPixelRatio?.();this.host.append(canvas);if(this.worldContext()?.mobile&&this.homePixelRatio)this.renderer.setPixelRatio?.(this.homePixelRatio*.78)}}
 restoreCanvas(){const canvas=this.renderer?.domElement||this.renderer?.canvas,o=this.canvasOrigin;if(canvas&&o?.parent)o.parent.insertBefore(canvas,o.next?.parentElement===o.parent?o.next:null);if(this.homePixelRatio)this.renderer.setPixelRatio?.(this.homePixelRatio);this.homePixelRatio=null;this.canvasOrigin=null;this.width=0;this.height=0;this.cameraReady=false}
 updateCamera(w,h,dt=0,now=performance.now()){
  if(this.playCamera){
   const {start,origin,offset}=this.playCamera;
   const seconds=Math.max(0,(now-start)/1000);
   const travel=seconds+.18*Math.expm1(-seconds/.18);
   this.camera.position.copy(origin).addScaledVector(offset,travel);
   this.camera.updateMatrixWorld();
   return;
  }
  const character=this.preview.group.position,ship=this.world.rig.ship.position;
  const view=this.customizing?this.customView:null;
  const position=this.nextPosition,target=this.nextTarget;
  const flyingPreview=view==='ship'&&!!this.world.flightPreview;
  let fov=50;
  if(view==='overview'){
   target.copy(character).lerp(ship,.5);target.y+=1;
   position.copy(target).addScaledVector(this.offset.set(-18,8,-21),Math.max(1,h/w*.8));
  }else if(view==='ship'){
   this.world.rig.model.localToWorld(target.copy(this.shipSeat||this.world.rig.subjectCenter));
   const focused=this.shipRegion==='cockpit';
   const distance=(focused?9.5:14)*(flyingPreview?(this.previewZoom??1):1);
   const elevation=this.shipOrbitPitch??.36;
   const angle=this.shipOrbitYaw??-.65;
   const flat=distance*Math.cos(elevation);
   position.copy(target).add(this.offset.set(flat*Math.sin(angle),distance*Math.sin(elevation),-flat*Math.cos(angle)));
  }else if(view==='character'){
   const selected=this.preview.paintParts?.[this.characterPart==='faces'?'head':this.characterPart];
   if(selected){
    if(!selected.geometry.boundingBox)selected.geometry.computeBoundingBox();
    selected.geometry.boundingBox.getCenter(target);selected.localToWorld(target);
   }else target.copy(character).add(this.offset.set(0,.8,0));
   position.copy(target).add(this.offset.set(0,.38,-3.6));
   fov=38;
  }else if(this.centerMenu&&this.world.centers?.visible){
   const index=this.centerMenu.id==='inventoryDialog'?0:1;
   target.copy(this.world.centers.children[index].position).add(this.offset.set(0,3,0));
   this.offset.set(0,2.2,18).applyQuaternion(this.world.centers.children[index].quaternion);
   position.copy(target).add(this.offset);
  }else{
   const finger=this.drag?{
    x:T.MathUtils.clamp((this.drag.x/w-.5)*.16,-.08,.08),
    y:T.MathUtils.clamp((.5-this.drag.y/h)*.12,-.06,.06),
   }:null;
   const gyro=this.smoother.step(mixCameraInput({roll:this.gyro?.x||0,pitch:this.gyro?.y||0},finger),now);
   target.copy(character).add(this.offset.set(gyro.roll*3,1.5+gyro.pitch*2,0));
   position.copy(target).add(this.offset.set(0,.3,-this.distance));
  }
  let centerOffset=0;
  if(view==='ship'||view==='character'){
   const panelKey=w+':'+h+':'+view;
   if(this.cameraPanelKey!==panelKey){
    this.cameraPanelKey=panelKey;
    this.cameraPanelWidth=this.customPanel.offsetWidth||this.customPanel.getBoundingClientRect().width||(w<=480?w*.31:Math.min(180,w*.26));
    this.cameraPartsWidth=this.partsPanel.offsetWidth||this.partsPanel.getBoundingClientRect().width||Math.min(200,w*.22);
   }
   const left=this.cameraPartsWidth+8,right=this.cameraPanelWidth+8;
   centerOffset=flyingPreview?0:(left-right)/2;
   const panelSpace=flyingPreview?2*Math.max(left,right):left+right;
   const available=Math.max(.2,1-panelSpace/w);
   const tangent=Math.tan(T.MathUtils.degToRad(fov/2));
   const currentDistance=position.distanceTo(target);
   const width=view==='character'?1.0:this.shipRegion==='cockpit'?6:11;
   const distance=flyingPreview?currentDistance:Math.max(currentDistance,width/(2*tangent*(w/h)*available));
   if(distance>currentDistance)position.sub(target).multiplyScalar(distance/currentDistance).add(target);
  }
  const menu=this.centerMenu?.id??null;
  const snap=flyingPreview||!this.cameraReady||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  if(this.cameraMenu!==menu){
   if(!snap&&!view){
    this.menuTween={time:0,position:this.camera.position.clone(),target:this.cameraTarget.clone()};
   }
   this.cameraMenu=menu;
  }
  if(view||snap)this.menuTween=null;
  const tween=this.menuTween;
  if(tween){
   tween.time+=dt;
   const progress=Math.min(1,tween.time/.85);
   const ease=progress*progress*(3-2*progress);
   position.lerpVectors(tween.position,position,ease);
   target.lerpVectors(tween.target,target,ease);
   if(progress===1)this.menuTween=null;
  }
  const blend=snap||tween?1:1-Math.exp(-dt*7);
  this.cameraMoving=this.camera.position.distanceToSquared(position)>.001||this.cameraTarget.distanceToSquared(target)>.001;
  this.camera.position.lerp(position,blend);
  this.cameraTarget.lerp(target,blend);
  const nextFov=T.MathUtils.lerp(this.camera.fov,fov,blend),aspect=w/h;
  if(Math.abs(this.camera.fov-nextFov)>.01||this.camera.aspect!==aspect){
   this.camera.fov=nextFov;this.camera.aspect=aspect;this.camera.updateProjectionMatrix();
  }
  const offset=T.MathUtils.lerp(this.cameraCenterOffset||0,centerOffset,blend);
  const nextOffset=Math.abs(offset-centerOffset)<.05?centerOffset:offset;
  if(nextOffset!==this.cameraCenterOffset||this.cameraViewWidth!==w||this.cameraViewHeight!==h){
   this.cameraCenterOffset=nextOffset;this.cameraViewWidth=w;this.cameraViewHeight=h;
   this.camera.setViewOffset(w,h,-nextOffset,0,w,h);
  }
  this.camera.lookAt(this.cameraTarget);this.camera.updateMatrixWorld();this.cameraReady=true;
  if(view==='overview')this.positionModelButtons(w,h);
 }
 positionModelButtons(w,h){
  const positions=[this.world.rig.ship.position,this.preview.group.position];
  const point=this.markerPoint;
  const markers=positions.map((position,i)=>{
   point.copy(position);point.y+=i?.8:1.5;point.project(this.camera);
   return {x:(point.x+1)*w/2,y:(1-point.y)*h/2};
  });
  for(const [i,button] of this.modelButtons.entries()){
   const marker=markers[i],side=marker.x<markers[1-i].x?-1:1;
   button.hidden=false;
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
  if(context.mobile&&!this.menuTween&&this.lastDraw&&now-this.lastDraw<30)return;
  this.lastDraw=now;
  const dt=Math.min(.08,(now-this.last)/1000);this.last=now;
  if(!this.refreshed||now-this.refreshed>1000){this.refresh();this.refreshed=now}
  const w=this.host.clientWidth,h=this.host.clientHeight;
  if(w<1||h<1)return;
  if(this.width!==w||this.height!==h){this.width=w;this.height=h;this.renderer.setSize(w,h)}
  this.world.syncSettings(context);
  const background=this.backgroundBody();
  if(background&&this.world.session.body!==background)this.world.enter(background);
  this.centerMenu=!this.customizing&&this.world.centers?.visible?document.querySelector('#inventoryDialog[open],#dailyRewards[open]'):null;
  this.world.animateFlightPreview(dt);
  this.preview.group.rotation.y=this.yaw;
  this.updateCamera(w,h,dt,now);
  if(this.world.flightPreview)this.world.trailPreview.updateRibbon(this.camera);
  if(!this.drag)this.preview.torso.position.y=Math.sin(now*.002)*.012;
  this.world.update(now*.001,dt,this.camera,{interacting:!!this.drag||this.cameraMoving});
  context.effects.entryHeat=0;context.effects.mobile=context.mobile;
  const scene=this.world.flightPreview?this.world.spaceScene:this.scene;
  this.applyExposure(this.world.flightPreview?context.spaceExposure??1.5:1.2);
  context.effects.render(scene,this.camera,context.quality);
 }
}
