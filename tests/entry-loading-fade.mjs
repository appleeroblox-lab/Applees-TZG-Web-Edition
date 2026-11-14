import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {accountGate} from '../public/account-gate.js';
import {installEntryPresentation} from '../public/entry-presentation.js';
const {document,window}=parseHTML('<html><body><div id="boot" class="hidden"><h1 class="bootTitle"></h1><div class="bootProgressRow"></div><p id="bootStatus"></p><p id="sourceDetail"></p><div id="sourceProgress"></div><b id="sourcePercent"></b><button id="launchBtn"></button></div></body></html>');
const root=accountGate(document),boot=document.getElementById('boot');root.hidden=false;root.dataset.entry='form';
window.matchMedia=()=>({matches:false});const events=[];
window.Element.prototype.animate=function(frames,options){
 if(this.id==='entryLoadingFade'){
  events.push(options.duration);
  if(options.duration===260){assert(!root.hidden);assert(boot.classList.contains('hidden'),'loading stays hidden until the black cover');}
  else{assert(root.hidden);assert(!boot.classList.contains('hidden'));assert.equal(this.style.opacity,'1');}
 }
 return {finished:Promise.resolve()};
};
const presentation=installEntryPresentation(root);await presentation.load(async update=>{assert(root.hidden);assert(!boot.classList.contains('hidden'));assert(!document.getElementById('entryLoadingFade'));update(75)});
assert.deepEqual(events,[260,380]);assert(boot.classList.contains('hidden'));assert(!root.hidden);
events.length=0;await assert.rejects(presentation.load(async()=>{throw Error('Offline')}),/Offline/);assert(!root.hidden);assert(boot.classList.contains('hidden'));assert(!document.getElementById('entryLoadingFade'));
console.log('PASS fade to black before revealing loading, fade-out handoff, task timing and offline cleanup without a stuck overlay.');
