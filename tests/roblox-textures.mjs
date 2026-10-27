import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import * as T from '../public/vendor/three.module.js';
import {bodies} from '../public/catalog.js?v=98';
import {robloxTextureAssets} from '../public/roblox-texture-assets.js';
import {bodySphereGeometry,drawBodyMap} from '../public/texture-geometry.js';
import {localMoonFamily,bodyLabelAllowed} from '../public/body-labels.js?v=98';
import {Flight} from '../public/flight.js?v=98';
import {SurfaceSession} from '../public/surface.js?v=98';
const ids=JSON.parse(fs.readFileSync(new URL('../assets/roblox/planet-asset-ids.json',import.meta.url))),expectedParents={Actaea:'Salacia','Ilmarë':'Varda',Vanth:'Orcus',Xiangliu:'Gonggong'};
assert.equal(robloxTextureAssets.length,46);assert.equal(new Set(bodies.map(b=>b.id)).size,bodies.length);
for(const row of robloxTextureAssets){const body=bodies.find(b=>b.name===row.name);assert(body,row.name);assert.equal(body.robloxAssetId,ids[row.suppliedName]);assert.equal(body.texture,row.texture);assert.equal(body.mapKind,'user-supplied-preview');assert(row.width>0&&row.height>0&&row.width<=420);const png=fs.readFileSync(new URL('../public/textures/'+row.texture,import.meta.url));assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');assert.equal(crypto.createHash('sha256').update(png).digest('hex'),row.sha256)}
for(const [name,parent]of Object.entries(expectedParents)){const moon=bodies.find(b=>b.name===name),host=bodies.find(b=>b.name===parent);assert.equal(moon.parent,parent);assert(moon.pos.distanceTo(host.pos)>moon.r+host.r);assert.equal(localMoonFamily(bodies,moon.pos,'Sol'),parent);assert(bodyLabelAllowed(moon,'Sol',parent))}
assert(bodies.find(b=>b.name==='Planet X').hypothetical);assert(bodies.find(b=>b.name==='Planet X').fictional);assert.equal(bodies.find(b=>b.name==='Planet X').solid,false);assert.equal(bodies.find(b=>b.name==='Planet X').type,'ICE GIANT');
for(const name of ['Proxima b','Proxima c','Proxima d'])assert.equal(bodies.find(b=>b.name===name).system,'Proxima');
const flight=new Flight(bodies),surface=new SurfaceSession(flight);for(const name of ['Salacia','Varda','Actaea','Ilmarë','Vanth','Xiangliu','Proxima b','Proxima d']){assert(surface.enter(bodies.find(b=>b.name===name),true));surface.step(1/60);assert(surface.pos.toArray().every(Number.isFinite));assert(surface.onGround)}
const moon=bodies.find(b=>b.name==='Moon'),g=bodySphereGeometry(moon),pos=g.attributes.position,uv=g.attributes.uv;assert.equal(moon.textureLayout,'cube-cross');assert(Array.from(pos.array).every(Number.isFinite));for(let i=0;i<pos.count;i++){assert(Math.abs(new T.Vector3().fromBufferAttribute(pos,i).length()-moon.r)<.001);const col=Math.floor(uv.getX(i)*4),row=Math.floor((1-uv.getY(i))*3);assert((row===1&&col>=0&&col<=3)||((row===0||row===2)&&col===1),'UV stays inside occupied cube-cross faces')}
const idx=g.index.array;for(let i=0;i<idx.length;i+=3){const a=new T.Vector3().fromBufferAttribute(pos,idx[i]),b=new T.Vector3().fromBufferAttribute(pos,idx[i+1]),c=new T.Vector3().fromBufferAttribute(pos,idx[i+2]);assert(b.sub(a).cross(c.sub(a)).dot(a)>0,'outward triangle winding')}
let args;drawBodyMap({drawImage(...a){args=a}},{width:420,height:316},moon,0,0,100,100);assert.equal(args.length,9,'Canvas/atlas crops an occupied Moon face');
console.log('PASS: all 46 exact asset mappings, PNG hashes and preview dimensions; solid destinations and gas worlds; moon parents/local labels; Proxima system; hypothetical flag; Moon cube-cross seam-safe UVs and outward triangles; fallback/atlas crop.');
