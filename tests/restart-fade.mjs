import assert from 'node:assert/strict';
import {parseHTML} from 'linkedom';
import {installRestartFade} from '../public/restart-fade.js';
const {document}=parseHTML('<html><body></body></html>');
const create=document.createElement.bind(document),animations=[];document.createElement=tag=>{const node=create(tag);node.animate=(frames,options)=>{const a={frames,options,cancel(){}};animations.push(a);return a};return node};
let resets=0;const restart=installRestartFade(document);assert(restart(()=>resets++));assert(!restart(()=>resets++));assert.equal(resets,0,'wait until black before reset');assert(document.body.classList.contains('restartFading'));assert.equal(animations[0].frames[1].opacity,1);animations[0].onfinish();assert.equal(resets,1);assert.equal(animations[1].frames[0].opacity,1);assert.equal(animations[1].frames[1].opacity,0);animations[1].onfinish();assert(!document.getElementById('restartFade'));assert(!document.body.classList.contains('restartFading'));assert(restart(()=>resets++));console.log('PASS reset at opaque black, duplicate contact guard, fade-out and gameplay unblock');
