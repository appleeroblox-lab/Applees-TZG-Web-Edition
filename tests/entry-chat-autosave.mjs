import {PlayerActivity} from '../public/player-activity.js';
import assert from 'node:assert/strict';import fs from 'node:fs';import {parseHTML} from 'linkedom';import {PlayerRewards} from '../public/player-journey.js';import {installFlightAutosave} from '../public/flight-autosave.js';
const {window,document}=parseHTML('<body><button id="chatToggle"></button><dialog id="settingsDialog"></dialog></body>');Object.assign(globalThis,{window,document});const rewards=new PlayerRewards({account:{ready:true,guest:false},applyReward(){}});rewards.load=async()=>{};rewards.draw=()=>{};await rewards.open();assert(rewards.root.hasAttribute('open'));await rewards.open();assert(!rewards.root.hasAttribute('open'),'second click closes Daily Rewards');let resolve;rewards.load=()=>new Promise(r=>resolve=r);const opening=rewards.open();await rewards.open();resolve();await opening;assert(!rewards.root.hasAttribute('open'),'second click cancels an in-flight open');
let callback,interval,saves=0,ready=false;const dispose=installFlightAutosave({doc:document,win:window,save(){saves++},ready:()=>ready,setTimer(fn,ms){callback=fn;interval=ms;return 1},clearTimer(){}});assert.equal(interval,5000);callback();assert.equal(saves,0);ready=true;callback();assert.equal(saves,1);document.hidden=true;document.dispatchEvent(new window.Event('visibilitychange'));assert.equal(saves,2);window.dispatchEvent(new window.Event('pagehide'));assert.equal(saves,3);dispose();window.dispatchEvent(new window.Event('blur'));assert.equal(saves,3);
const html=fs.readFileSync('public/index.html','utf8');assert(html.indexOf('body:not(.gameplayReady)')<html.indexOf('href="style.css'),'gameplay concealment is available before external styles');const chat=fs.readFileSync('public/social-ui.js','utf8');assert(chat.includes('<strong>Global Chat</strong><span id="chatOnlinePlayers"'));assert(chat.includes('Onlines: —'));
console.log('PASS Daily Rewards toggle/race, five-second lifecycle autosaves and early loading/header layout guards');

document.hidden=false;for(const id of ['chatOnlinePlayers','debugOnlinePlayers']){const node=document.createElement('span');node.id=id;document.body.append(node)}let online=50;const activity=Object.create(PlayerActivity.prototype);activity.activeClient={async rpc(name){assert.equal(name,'tzg_online_players');return{data:online}}};await activity.refreshOnlineCount();assert.equal(document.getElementById('chatOnlinePlayers').textContent,'Onlines: 50');online=1250;await activity.refreshOnlineCount();assert.equal(document.getElementById('debugOnlinePlayers').textContent,'Onlines: 1.25k');
const releasedHTML=fs.readFileSync('public/index.html','utf8'),manifest=JSON.parse(fs.readFileSync('public/source-manifest.json','utf8')),releaseImports=JSON.parse(releasedHTML.match(/id="releaseModuleMap">(.*?)<\/script>/s)[1]).imports;assert.equal(releaseImports['./game.js'],'./game.js?v='+manifest.fileVersions['game.js'],'game import resolves to the released file version');

for(const guest of [false,true]){
 const calls=[];
 const client={async rpc(name,args){calls.push([name,args]);return {data:name==='tzg_online_players'?12:null}}};
 const presence=new PlayerActivity(guest?{guest,guestAccess:{client}}:{guest,client});
 presence.start();
 await new Promise(resolve=>setImmediate(resolve));
 assert.equal(document.getElementById('chatOnlinePlayers').textContent,'Onlines: 12');
 assert.deepEqual(calls.map(([name])=>name),['tzg_activity','tzg_online_players'],'Home presence starts before Play');
 window.dispatchEvent(new window.Event('tzg-signed-out'));
 assert.equal(presence.session,null);
 assert.equal(calls.at(-1)[1].p_end,true);
}
