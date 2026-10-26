import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findGifs,downloadGif,gifGallery} from '../public/gif-gallery.js';
import {prepareGif,safeChatImage} from '../public/chat-media.js';
const blocked=async()=>{throw new TypeError('Failed to fetch')};
const local=await findGifs('',{fetcher:blocked});
assert.equal(local.length,24);
for(const item of local){
 const expected=fs.readFileSync(new URL(item.url));
 assert.deepEqual(Buffer.from(item.preview.split(',')[1],'base64'),expected);
 const file=await downloadGif(item,{fetcher:blocked});
 assert.deepEqual(Buffer.from(await file.arrayBuffer()),expected);
 assert(safeChatImage(await prepareGif(file)));
}
assert.equal((await findGifs('',{online:true,fetcher:async()=>({ok:true,json:async()=>({results:[]})})})).length,24);
console.log('PASS: all 24 GIFs preview and select with fetch blocked, preserving exact animation bytes and valid chat payloads; empty online results return local GIFs.');
