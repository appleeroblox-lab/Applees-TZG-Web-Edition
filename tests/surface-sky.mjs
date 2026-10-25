import assert from 'node:assert/strict';
import fs from 'node:fs';
import {bodies} from '../public/catalog.js';
import {Flight} from '../public/flight.js';
import {SurfaceSession} from '../public/surface.js';
import {surfaceSkyLayout} from '../public/surface-sky.js';
const f=new Flight(bodies),s=new SurfaceSession(f);
for(const name of ['Io','Europa','Titan','Moon']){
 const body=bodies.find(b=>b.name===name);s.enter(body,true);
 const layout=surfaceSkyLayout(s,bodies),parent=layout.find(x=>x.body.name===body.parent);
 assert(parent,name+' has its parent in the sky');assert(parent.direction.y>.1,'near-side pad places parent above horizon');assert(parent.direction.z<0,'parent is in front of default camera');assert(parent.radius>10);
 assert(layout.every(x=>x.body!==body&&x.body.system===body.system));
 assert(!layout.some(x=>x.body.type==='MOON'&&x.body.parent!==body.parent),'unrelated moon systems excluded');
}
s.enter(bodies.find(b=>b.name==='Io'),true);const sky=surfaceSkyLayout(s,bodies);for(const name of ['Jupiter','Europa','Ganymede','Callisto'])assert(sky.some(x=>x.body.name===name));
const sources=JSON.parse(fs.readFileSync(new URL('../public/textures/MOON_SOURCES.json',import.meta.url)));
assert.equal(Object.keys(sources).length,18);
for(const [name,row]of Object.entries(sources)){const b=bodies.find(b=>b.name===name);assert(b.texture===row.file||(b.robloxAssetId&&b.texture?.startsWith('roblox/')));assert.notEqual(b.texture,'moon.jpg');const image=fs.readFileSync(new URL('../public/textures/'+row.file,import.meta.url));assert(image.length>10000);assert.equal(image.readUInt16BE(0),0xffd8)}
for(const b of bodies.filter(b=>b.system==='Sol'&&b.type==='MOON'&&b.name!=='Moon'))assert.notEqual(b.texture,'moon.jpg');
console.log('PASS: parent planets above moon pads, sibling sky bodies, unrelated-system exclusion, 18 distinct bundled JPEG maps, no lunar texture reused on other Sol moons.');
