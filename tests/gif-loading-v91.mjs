import assert from 'node:assert/strict';
import fs from 'node:fs';
import {findGifs,downloadGif,animatedGif,allowedGifUrl} from '../public/gif-gallery.js';
let requests=0;const blocked=async()=>{requests++;throw new TypeError('Failed to fetch')};
const items=await findGifs('',{fetcher:blocked});assert.equal(requests,0);assert.equal(items.length,24);
for(const item of items){assert(allowedGifUrl(item.url));const bytes=fs.readFileSync(new URL(item.url));assert(animatedGif(bytes));assert(bytes.length<1048576);const file=await downloadGif(item,{fetcher:async()=>new Response(bytes,{headers:{'content-type':'image/gif'}})});assert.equal(file.type,'image/gif')}
assert.equal((await findGifs('hello')).length,1);assert.equal((await findGifs('laugh')).length,1);
assert.equal((await findGifs('',{seen:items.map(x=>x.url)})).length,0);
const fallback=await findGifs('',{online:true,fetcher:blocked});assert.equal(fallback.length,24);assert.equal(requests,3);
assert(!allowedGifUrl(new URL('./gifs/../game.js?v=101',import.meta.url).href));assert(!allowedGifUrl('https://evil.test/gifs/wave.gif'));
console.log('PASS: all 24 same-host GIFs load, animate and become upload files; blocked external provider falls back; default uses zero external requests.');
