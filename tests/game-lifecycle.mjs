import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {gameLifecycle,afterPaint} from '../public/game-lifecycle.js';
import {installGameEntryFade,ENTRY_FADE_MS} from '../public/game-entry-fade.js';
import {installRestartFade} from '../public/restart-fade.js';

const {window:win,document:doc}=parseHTML('<html><body><button>Play</button><dialog open>Inventory</dialog></body></html>');
let now=0, next=0;
const frames=new Map(), timers=new Map(), intervals=new Map();
Object.assign(win,{
 performance:{now:()=>now},
 requestAnimationFrame:fn=>{frames.set(++next,fn);return next},
 cancelAnimationFrame:id=>frames.delete(id),
 setTimeout:(fn,ms)=>{timers.set(++next,{fn,ms});return next},
 clearTimeout:id=>timers.delete(id),
 setInterval:fn=>{intervals.set(++next,fn);return next},
 clearInterval:id=>intervals.delete(id),
 getComputedStyle:node=>node.style
});
const event=(target,type,properties={})=>target.dispatchEvent(Object.assign(new win.Event(type,{bubbles:true}),properties));
const lifecycle=gameLifecycle(win,doc);
assert.equal(lifecycle,gameLifecycle(win,doc));
const actions=[];
lifecycle.subscribe((active,event)=>actions.push([active,event]));
const state={position:30, account:{id:'member'}, inventory:[1,2,3], warp:{elapsed:0}};
const snapshots={...state};
const tick=()=>{for(const [id,fn]of [...frames])if(frames.delete(id))fn(now+=16)};
let draws=0, resets=0, releases=0;
const surface=doc.querySelector('button');
surface.hasPointerCapture=()=>true;
surface.releasePointerCapture=()=>releases++;
for(const scene of ['sign-in','loading','homepage','flight','on-foot','warp','open menu']){
 const loop=lifecycle.frameLoop(scene,()=>{draws++},()=>{resets++});
 loop.start();
 for(let run=0;run<3;run++){
  const initial=draws;
  tick();
  assert.equal(draws,initial+1,scene);
  event(surface,'gotpointercapture',{pointerId:run});
  const stale=[...frames.values()][0];
  event(win,'blur');
  doc.hidden=true;event(doc,'visibilitychange');
  event(win,'pagehide',{persisted:true});event(doc,'freeze');
  stale(now+=30000);
  assert.equal(frames.size,0,scene);
  event(win,'focus');
  assert.equal(frames.size,0,'focus cannot start a hidden document');
  doc.hidden=false;event(doc,'visibilitychange');
  event(doc,'resume');event(win,'pageshow',{persisted:true});event(win,'focus');
  assert.equal(frames.size,1,scene);
  assert.equal(intervals.size,1,'only one watchdog');
  stale(now);
  assert.equal(draws,initial+1,'a stale callback cannot render after recovery');
  tick();
  assert.equal(draws,initial+2);
 }
 loop.dispose();
}
assert.equal(releases,21);
assert.equal(resets,28);
assert.equal(actions.filter(([active])=>!active).length,21);
assert.deepEqual(state,snapshots);
assert(doc.querySelector('dialog').hasAttribute('open'),'legitimate modal remains open');

const loop=lifecycle.frameLoop('stall',()=>{draws++},()=>{resets++});loop.start();
const dropped=[...frames.values()][0];frames.clear();
now+=6000;[...intervals.values()][0]();
assert.equal(lifecycle.diagnostics().loopRestarts,1);
assert.equal(frames.size,1);
const before=draws;dropped(now);assert.equal(draws,before);
tick();assert.equal(draws,before+1);

const blocker=doc.createElement('div');blocker.id='transparent';blocker.dataset.recoveryFade='';
blocker.style.opacity='0';blocker.style.pointerEvents='auto';doc.body.append(blocker);
event(win,'blur');event(win,'focus');
assert.equal(blocker.style.pointerEvents,'none');
event(surface,'webglcontextlost');event(surface,'webglcontextrestored');
assert(lifecycle.diagnostics().recent.some(item=>item.event==='WebGL context restored'));
loop.dispose();

let resolveLoad;
const loading=lifecycle.withActiveTimeout(new Promise(resolve=>{resolveLoad=resolve}),1000,'failed');
now+=200;
event(win,'blur');
assert.equal(timers.size,0,'background time does not consume the startup budget');
now+=30000;
event(win,'focus');
assert.equal([...timers.values()][0].ms,800,'return only charges time spent foregrounded');
resolveLoad('loaded');
assert.equal(await loading,'loaded');
assert.equal(timers.size,0);

const paint=afterPaint(win);
const pending=[...timers.values()][0];
pending.fn();await paint;
assert.equal(frames.size,0,'an unavailable compositor cannot keep the paint promise pending');

const fade=installGameEntryFade({doc,win,requestFrame:win.requestAnimationFrame,setTimer:win.setTimeout,clearTimer:win.clearTimeout});
event(win,'tzg-ready');
assert(doc.getElementById('gameEntryFade'));
[...timers.values()].find(timer=>timer.ms===ENTRY_FADE_MS+300).fn();
assert(!doc.getElementById('gameEntryFade'),'a dropped reveal callback cannot leave the entry shield in place');
fade.dispose();

let resetsCompleted=0;
win.Element.prototype.animate=()=>({cancel(){}});
const restart=installRestartFade(doc);
restart(()=>resetsCompleted++);
assert(doc.getElementById('restartFade'));
restart.recover();restart.recover();
assert.equal(resetsCompleted,1,'an existing restart action completes only once');
assert(!doc.body.classList.contains('restartFading'));
console.log('PASS repeated lifecycle interruptions, stale/dropped frames, transparent shields, graphics events and blocked transition recovery.');
