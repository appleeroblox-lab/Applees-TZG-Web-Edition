import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import fs from 'node:fs';
import {playStartupIntro,INTRO_HOLD_MS,INTRO_FADE_MS} from '../public/startup-intro.js';
const html=fs.readFileSync('public/index.html','utf8');
function fixture(play=()=>Promise.resolve(),landscape=null){
 const {document,window}=parseHTML(html),root=document.getElementById('startupIntro'),video=document.getElementById('startupIntroVideo');let now=0,next=0,revealed=0,paused=0;const timers=new Map();
 video.play=play;video.pause=()=>paused++;video.load=()=>{};
 const done=playStartupIntro({doc:document,landscape,beforeReveal:()=>revealed++,setTimer(fn,ms){const id=++next;timers.set(id,{fn,at:now+ms});return id},clearTimer(id){timers.delete(id)}});
 const tick=ms=>{const end=now+ms;for(;;){const entry=[...timers].sort((a,b)=>a[1].at-b[1].at)[0];if(!entry||entry[1].at>end)break;now=entry[1].at;timers.delete(entry[0]);entry[1].fn()}now=end};
 return {document,window,root,video,done,tick,timers,get revealed(){return revealed},get paused(){return paused}};
}
const f=fixture();assert(f.root);assert.equal(f.video.controls,false);assert.equal(f.video.muted,false);assert.equal(f.video.defaultMuted,false);assert.equal(f.video.playsInline,true);assert.equal(f.video.disableRemotePlayback,true);assert.equal(f.video.disablePictureInPicture,true);assert.equal(f.video.getAttribute('x5-video-player-type'),'h5');assert.equal(f.video.getAttribute('x5-video-player-fullscreen'),'false');assert(f.video.hasAttribute('webkit-playsinline'));assert(!f.video.hasAttribute('controls'));assert.equal(f.revealed,0,'sign-in cannot start before the video');f.video.dispatchEvent(new f.window.Event('playing'));f.video.dispatchEvent(new f.window.Event('ended'));f.tick(INTRO_HOLD_MS-1);assert.equal(f.revealed,0);f.tick(1);assert.equal(f.revealed,1,'sign-in starts behind the fade exactly one second after playback ends');assert.equal(f.root.style.opacity,'0');assert(f.root.isConnected);f.tick(INTRO_FADE_MS);await f.done;assert(!f.root.isConnected);assert.equal(f.paused,1);assert.equal(f.timers.size,0);assert(!f.video.hasAttribute('src'),'release the finished video resource');
const failed=fixture();failed.video.dispatchEvent(new failed.window.Event('error'));failed.tick(INTRO_FADE_MS);await failed.done;assert.equal(failed.revealed,1,'media failure cannot block sign-in');
const tap=fixture(()=>Promise.reject(Object.assign(Error('blocked'),{name:'NotAllowedError'})));for(let i=0;i<6;i++)await Promise.resolve();assert(!tap.document.getElementById('startupIntroPlay').hidden);assert.equal(tap.revealed,0);tap.video.play=()=>Promise.resolve();tap.root.dispatchEvent(new tap.window.Event('click'));assert.equal(tap.video.muted,false,'tap starts the inline intro with sound');tap.video.dispatchEvent(new tap.window.Event('ended'));tap.tick(INTRO_HOLD_MS+INTRO_FADE_MS);await tap.done;
assert(html.indexOf('id="startupIntro"')<html.indexOf('id="boot"'),'black video overlay exists before the existing boot UI');assert.match(html,/object-fit:contain/);assert.match(fs.readFileSync('public/boot-loader.js','utf8'),/beforeReveal:\(\)=>\{authentication=authenticateFirst\(\)\}/);
console.log('PASS intro playback gate, one-second hold, fade/reveal, video cleanup, audible inline playback, tap-to-play and media-error fallback.');

const {document:missingVideo}=parseHTML('<html><body><section id="startupIntro"></section></body></html>');let missingReveal=0;await playStartupIntro({doc:missingVideo,beforeReveal:()=>missingReveal++});assert.equal(missingReveal,1);assert(!missingVideo.getElementById('startupIntro'));

let wide=true,orientationListener,playCount=0;const rotating=fixture(()=>{playCount++;return Promise.resolve()},{isLandscape:()=>wide,onChange(fn){orientationListener=fn;return ()=>orientationListener=null}});rotating.video.currentTime=4.5;wide=false;orientationListener(false);assert.equal(rotating.paused,1,'pause the intro while portrait is covered');wide=true;orientationListener(true);assert.equal(playCount,2);assert.equal(rotating.video.currentTime,4.5,'resume the same video position after rotation');rotating.video.dispatchEvent(new rotating.window.Event('ended'));rotating.tick(INTRO_HOLD_MS+INTRO_FADE_MS);await rotating.done;assert.equal(orientationListener,null);

const imports=JSON.parse(html.match(/<script[^>]*id="releaseModuleMap"[^>]*>(.*?)<\/script>/s)[1]).imports;assert.equal(imports['./startup-intro.js?v=153'],'./startup-intro.js?v=217','boot loader uses the patched inline playback module');
