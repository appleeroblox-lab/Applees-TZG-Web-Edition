import assert from 'node:assert/strict';
import {installTouchButtons} from '../public/touch-buttons.js';

// Model browser capture before the target handler; linkedom omits this ordering.
const listeners=new Map(),doc={hidden:false,addEventListener(type,fn){const list=listeners.get(type)||[];list.push(fn);listeners.set(type,list)}},win={addEventListener(){}};
function emit(type,target,extra={}){
 const event={type,target,detail:0,clientX:80,clientY:120,...extra,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true}};
 for(const fn of listeners.get(type)||[]){fn(event);if(event.stopped)break}
 if(type==='click'&&!event.stopped&&!target.disabled)target.onclick?.();
 return event;
}
function button(name,onclick){return {id:'',textContent:name,disabled:false,isConnected:true,onclick,getAttribute(){return name},closest(selector){return selector==='button'?this:null},click(){emit('click',this)}}}
function pointer(type,target,id,extra={}){return emit(type,target,{pointerId:id,pointerType:'touch',isPrimary:false,...extra})}
function tap(target,id){pointer('pointerdown',target,id);pointer('pointerup',target,id)}
installTouchButtons(doc,win);
let equipped=null,current,actions=0;
function render(name='Pickaxe'){
 if(current)current.isConnected=false;
 current=button('Equip '+name,()=>{actions++;equipped=equipped===name?null:name;render(name)});
}
render();
for(const [index,name]of ['Pickaxe','Pickaxe','Shovel','Torch','Shovel'].entries()){
 render(name);const before=actions,expected=equipped===name?null:name,id=index+1;
 tap(current,id);assert.equal(equipped,expected);assert.equal(actions,before+1);
 // Modern touch click, including zero-detail clicks, can target the replacement.
 const duplicate=emit('click',current,{pointerType:'touch',pointerId:id,detail:index%2});
 assert(duplicate.defaultPrevented);assert.equal(actions,before+1);assert.equal(equipped,expected);
 // Legacy compatibility MouseEvent has neither pointerType nor pointerId.
 assert(emit('click',current,{detail:1}).defaultPrevented);assert.equal(actions,before+1);
}
const before=actions;
emit('click',current,{pointerType:'mouse',detail:1});assert.equal(actions,before+1,'real mouse clicks remain native');
emit('click',current,{detail:0});assert.equal(actions,before+2,'keyboard clicks remain native');
emit('click',current,{pointerType:'pen',detail:1});assert.equal(actions,before+3,'pen activation remains native');
for(const cancel of ['pointercancel','lostpointercapture']){const n=actions;pointer('pointerdown',current,20);pointer(cancel,current,20);pointer('pointerup',current,20);assert.equal(actions,n)}
let n=actions;pointer('pointerdown',current,21);pointer('pointermove',current,21,{clientY:160});pointer('pointerup',current,21,{clientY:160});assert.equal(actions,n,'scrolling does not equip');
pointer('pointerdown',current,22);current.disabled=true;pointer('pointerup',current,22);assert.equal(actions,n,'disabled buttons do not activate');current.disabled=false;
pointer('pointerdown',current,23);current.isConnected=false;pointer('pointerup',current,23);assert.equal(actions,n,'removed buttons do not activate');current.isConnected=true;
let a=0,b=0;const left=button('A',()=>a++),right=button('B',()=>b++);
pointer('pointerdown',left,31);pointer('pointerdown',right,32);pointer('pointerup',right,32);pointer('pointerup',left,31);assert.deepEqual([a,b],[1,1],'independent simultaneous taps');
const hold=button('Thrust',()=>{throw Error('held control received synthetic click')});hold.onpointerdown=()=>{};tap(hold,40);
// A rerender may retarget the compatibility click to an ancestor with no button.
const parent={closest(){return null}};assert(emit('click',parent,{pointerType:'touch',pointerId:32,detail:1}).defaultPrevented);
console.log('PASS: repeated equip/unequip and tool switching with rebuilt buttons, modern/legacy duplicate clicks, mouse/keyboard/pen, scroll/cancel/disabled/removal guards and concurrent taps.');
