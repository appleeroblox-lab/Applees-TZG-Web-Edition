import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {CLIENT_VERSION,semanticVersion,installRuntimeVersions,installUpdateCheck} from '../public/runtime-versions.js';
import {HomeExperiment} from '../public/home-experiment.js';
import {mixCameraInput} from '../public/device-gyro.js';
import {TerrainClouds} from '../public/terrain-clouds.js';
import * as T from '../public/vendor/three.module.js';
const playCamera=new T.PerspectiveCamera();
playCamera.rotation.set(.2,.4,0);
const initialRotation=playCamera.quaternion.clone();
const move={camera:playCamera,playCamera:{start:100,origin:new T.Vector3(1,2,3),offset:new T.Vector3(0,3.5,7*Math.cos(Math.PI/6))}};
HomeExperiment.prototype.updateCamera.call(move,844,390,0,900);
const firstPosition=playCamera.position.clone();
assert(firstPosition.y>2,'camera starts pulling away during the title');
HomeExperiment.prototype.updateCamera.call(move,844,390,0,1700);
const secondPosition=playCamera.position.clone();
HomeExperiment.prototype.updateCamera.call(move,844,390,0,2500);
assert(secondPosition.y>firstPosition.y&&playCamera.position.y>secondPosition.y,
 'camera keeps moving even beyond the nominal transition duration');
assert(playCamera.quaternion.equals(initialRotation),'Play camera translates without rotation');
const ship=new T.Vector3(5,1,6);
const trade=new T.Group(),craft=new T.Group();
trade.position.set(-25,0,15);
craft.position.set(30,0,22);craft.rotation.y=Math.PI;
const spaceMenuCamera={
 camera:new T.PerspectiveCamera(),cameraTarget:new T.Vector3(),cameraReady:true,
 world:{rig:{ship:{position:ship}},centers:{visible:true,children:[trade,craft]}},
 preview:{group:{position:new T.Vector3()}},
 nextPosition:new T.Vector3(),nextTarget:new T.Vector3(),offset:new T.Vector3(),
 cameraMenu:null,centerMenu:{id:'inventoryDialog'}
};
const updateMenuCamera=dt=>HomeExperiment.prototype.updateCamera.call(spaceMenuCamera,844,390,dt);
updateMenuCamera(.425);
assert(spaceMenuCamera.camera.position.equals(new T.Vector3(-12.5,2.6,16.5)),'inventory tweens toward the front of Trade Center');
updateMenuCamera(.425);
assert(spaceMenuCamera.camera.position.equals(new T.Vector3(-25,5.2,33)));
spaceMenuCamera.centerMenu={id:'dailyRewards'};
updateMenuCamera(.85);
assert(spaceMenuCamera.camera.position.distanceTo(new T.Vector3(30,5.2,4))<1e-8,'daily rewards views Crafting Center from its front');
assert.equal(semanticVersion(242),'v0.0.242');assert.equal(semanticVersion('0.1.2'),'v0.1.2');assert.equal(semanticVersion('bad'),null);
const {document}=parseHTML('<html><body><div class="entryRelease"></div></body></html>');let requests=0;
const tracker=installRuntimeVersions(document,async url=>{requests++;assert(url.endsWith('/rpc/tzg_backend_version'));return {ok:true,json:async()=>({version:'v0.0.1'})}});await tracker.ready;
assert(document.querySelector('.entryRelease').textContent.includes('Client Version: '+CLIENT_VERSION));assert(document.querySelector('.entryRelease').textContent.includes('Backend Version: v0.0.1'));
let published=CLIENT_VERSION,tick,refreshed=false;
const update=installUpdateCheck({doc:document,playerName:()=> 'Applee',refreshGame:()=>{refreshed=true},schedule:(check,ms)=>{
 assert.equal(ms,5000);tick=check;
},fetcher:async url=>url.endsWith('.txt')?{ok:true,text:async()=>published+'\n- Camera fix'}:{ok:true,json:async()=>({clientVersion:published})}});
await tick();
assert.equal(document.querySelector('#newUpdateDialog'),null);
published='v9.9.9';await update.check();
const prompt=document.querySelector('#newUpdateDialog');
assert.match(prompt.querySelector('[data-message]').textContent,/Applee.*v9\.9\.9/);
const cancel=new document.defaultView.Event('cancel',{cancelable:true});prompt.dispatchEvent(cancel);assert(cancel.defaultPrevented);
await prompt.querySelector('[data-list]').onclick();
assert.equal(prompt.querySelector('[data-notes]').textContent,'Camera fix');
assert(prompt.querySelector('[data-refresh]').closest('section').hidden);
prompt.querySelector('[data-back]').onclick();
assert(!prompt.querySelector('[data-refresh]').closest('section').hidden);
await prompt.querySelector('[data-refresh]').onclick();assert(refreshed);
const playDoc=parseHTML('<html><body><div id="lobby"><div class="homeChrome"></div></div></body></html>').document;
const previousDocument=globalThis.document;
globalThis.document=playDoc;
Object.defineProperty(playDoc,'hidden',{value:true});
const steps=[];let lobby;
playDoc.defaultView.HTMLElement.prototype.animate=function(keyframes,options){
 if(this.className==='homePlayFrameTop')assert(lobby.playCamera,'the camera is still moving during frame entry');
 if(this.textContent==='The Zero Gravity')assert(lobby.playCamera,'camera starts with the title on Play');
 steps.push([this.className||this.textContent,options.duration,keyframes]);
 return {finished:Promise.resolve()};
};
try{
 lobby={root:playDoc.getElementById('lobby'),active:true,cameraReady:true,camera:new T.PerspectiveCamera(),updateCamera:HomeExperiment.prototype.updateCamera,clearInputs(){},customize(){},dockChat(){},
  dockBrand(){},restoreCanvas(){
   assert(playDoc.querySelector('.homePlayStage').hidden,'old layers are hidden only after the cover arrives');
   steps.push(['gameplay']);
  }};
 await HomeExperiment.prototype.play.call(lobby);
 const unlock=HomeExperiment.prototype.customizationUnlockSummary('face:-_-',250,'FP',100);
 assert.equal(unlock.querySelector('.homeUnlockPreview').textContent,'-_-');
 assert.match(unlock.querySelector('.homeConfirmWarning').textContent,/150 more FP/);
 const gradient=HomeExperiment.prototype.customizationUnlockSummary('ship:gradient',500,'RC',800);
 assert.equal(gradient.querySelector('dd:last-child').textContent,'300 RC');
 const review=HomeExperiment.prototype.paintConfirmation.call({face:'-_-',economy:{fp:10}},'character',[
  {part:'head',before:undefined,after:'#ffffff',cost:20}
 ],'•_•',20,true);
 assert.match(review.querySelector('li').textContent,/Original.*20 FP/);
 assert.equal(review.querySelector('.homeConfirmTotal strong').textContent,'20 FP');
 assert.match(review.querySelector('.homeConfirmWarning').textContent,/10 more FP/);
 assert.deepEqual(steps.slice(0,4).map(([name,duration])=>[name,duration]),[
  ['The Zero Gravity',460],['Web Edition',460],['homePlayFrameTop',300],['homePlayFrameBottom',300]
 ]);
 assert.equal(steps.find(([name])=>name==='homePlayFlash')[2][0].opacity,.95);
 assert.deepEqual(steps.slice(-4).map(([name])=>name),['homePlayFrames','homePlayCover','gameplay','homePlayCover']);
 assert(!lobby.active&&!playDoc.querySelector('.homePlayTransition'));
}finally{
 delete playDoc.defaultView.HTMLElement.prototype.animate;
 if(previousDocument===undefined)delete globalThis.document;
 else globalThis.document=previousDocument;
}
const label=document.createElement('small');label.id='runtimeVersions';document.body.append(label);installRuntimeVersions(document);assert.equal(requests,1,'reuse the backend result instead of polling each frame');assert(label.textContent.includes('v0.0.1'));
const offline=parseHTML('<html><body><div class="entryRelease"></div></body></html>').document;await installRuntimeVersions(offline,async()=>{throw Error('offline')}).ready;assert(offline.querySelector('.entryRelease').textContent.endsWith('Backend Version: —'),'never invent a backend version from the client build');
assert.deepEqual(mixCameraInput({roll:.2,pitch:.3},{x:.4,y:-.1}),{roll:.6000000000000001,pitch:.19999999999999998});assert.deepEqual(mixCameraInput({roll:1,pitch:-1},{x:1,y:-1}),{roll:1,pitch:-1});assert.deepEqual(mixCameraInput(null,null),{roll:0,pitch:0});
let keyReads=0;class Chunks extends Map{keys(){keyReads++;return super.keys()}}const chunks=new Chunks();for(let x=-2;x<=2;x++)for(let z=-2;z<=2;z++)chunks.set(x+','+z,{});
const clouds=new TerrainClouds(Array.from({length:4},()=>new T.Mesh(new T.SphereGeometry(),new T.MeshBasicMaterial())),{body:{id:'Earth',name:'Earth'},altitude:0});
for(let i=0;i<60;i++)clouds.sync(chunks,new T.Vector3(1,0,1),i/60,4);assert.equal(keyReads,1,'reuse cloud ownership throughout stationary frames');clouds.sync(chunks,new T.Vector3(100,0,1),2,4);assert.equal(keyReads,2,'refresh ownership after travelling');
console.log('PASS independent versions, offline reporting, cached metadata, sensor/finger blending and retained cloud ownership across 60 frames');

const preview=new T.Group();
preview.add(new T.Mesh(new T.SphereGeometry(.7,16,12),new T.MeshBasicMaterial()));
const camera=new T.PerspectiveCamera(50,2,.1,100);
camera.position.z=5;
const home=Object.assign(Object.create(HomeExperiment.prototype),{
 active:true,camera,preview:{group:preview},host:{getBoundingClientRect:()=>({left:10,top:20,width:400,height:200})}
});
assert.equal(home.hitsCharacter(210,120),true,'a drag may start on the projected character');
assert.equal(home.hitsCharacter(360,120),false,'the background cannot start character rotation');
