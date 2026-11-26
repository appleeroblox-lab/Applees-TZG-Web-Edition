import assert from 'node:assert/strict';import fs from 'node:fs';import {parseHTML} from 'linkedom';import {installGameUI} from '../public/install-game.js';
const html=fs.readFileSync('public/index.html','utf8'),manifest=JSON.parse(fs.readFileSync('public/source-manifest.json','utf8')),imports=JSON.parse(html.match(/id="releaseModuleMap">(.*?)<\/script>/s)[1]).imports;assert.equal(imports['./install-game.js?v=187'],'./install-game.js?v='+manifest.fileVersions['install-game.js']);
for(const [ua,expected]of [['iPhone','Safari'],['Mozilla Android; wv)','browser first'],['Desktop','browser menu']]){
 const {document,window}=parseHTML('<html><body><button id="installGame"></button></body></html>');
 const win={navigator:{userAgent:ua,userActivation:{isActive:true}},matchMedia:()=>({matches:false}),addEventListener:window.addEventListener.bind(window),removeEventListener:window.removeEventListener.bind(window)};const ui=installGameUI(win,document);
 window.dispatchEvent(new window.Event('tzg-signed-in'));document.dispatchEvent(new window.Event('click'));assert(!document.getElementById('installHelpDialog'),'no automatic instruction popup');
 await document.getElementById('installGame').onclick();const dialog=document.getElementById('installHelpDialog');assert(dialog.hasAttribute('open'));assert(dialog.textContent.includes(expected));dialog.querySelector('button').click();assert(!dialog.hasAttribute('open'));ui.dispose();
}
console.log('PASS explicit iPhone, embedded-browser and desktop install guidance without automatic popups');

const {document,window}=parseHTML('<html><body><button id="installGame">Install Game</button><button id="play">Play</button></body></html>');
const win={navigator:{userActivation:{isActive:true}},matchMedia:()=>({matches:false}),addEventListener:window.addEventListener.bind(window),removeEventListener:window.removeEventListener.bind(window),dispatchEvent:window.dispatchEvent.bind(window)};
const ui=installGameUI(win,document);
let prompts=0;
const offer=new window.Event('beforeinstallprompt',{cancelable:true});
offer.prompt=async()=>{prompts++};
offer.userChoice=Promise.resolve({outcome:'accepted'});
window.dispatchEvent(offer);
window.dispatchEvent(new window.Event('tzg-signed-in'));
window.dispatchEvent(new window.Event('tzg-ready'));
document.getElementById('play').click();
assert(offer.defaultPrevented);
assert.equal(prompts,0,'browser install offer stays deferred through sign-in, boot and gameplay clicks');
await document.getElementById('installGame').onclick();
assert.equal(prompts,1,'the explicit install button can still launch the browser prompt');
ui.dispose();
