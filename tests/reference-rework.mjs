import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {bodies,earth} from '../public/catalog.js?v=98';
import {Economy,REACH,TRADER} from '../public/economy.js?v=98';
import {Flight,V} from '../public/flight.js?v=98';
import {SurfaceSession} from '../public/surface.js?v=98';
import {Crew} from '../public/crew.js?v=98';
import {modelFromData} from '../public/models.js?v=98';
assert.equal(REACH,6);const wallet=new Economy(bodies),node=wallet.nodes(earth)[0];
assert(node.radius<.6,'resources have compact colliders');assert(wallet.hit(node.id,earth,node.pos.clone().add(V(5.9,0,0)),true).ok,'6m mining reach');wallet.tick(1);assert(!wallet.hit(node.id,earth,node.pos.clone().add(V(6.1,0,0)),true).ok,'beyond reach denied');
const f=new Flight(bodies),s=new SurfaceSession(f),c=new Crew(s);s.enter(earth,true);assert(c.blocked(0,0));assert(!c.blocked(3,0),'narrow rocket collider leaves space to walk');assert(c.blocked(TRADER.x,TRADER.z));assert(!c.blocked(TRADER.x+7,TRADER.z),'station collision matches walls');
for(const name of ['rocket','pickaxe','mineral','trading-hall']){const data=JSON.parse(fs.readFileSync(new URL('../public/models/'+name+'.json',import.meta.url)));assert(data.generator.startsWith('Blender'));const model=modelFromData(data);let vertices=0;model.traverse(o=>{if(o.isMesh){const p=o.geometry.attributes.position,n=o.geometry.attributes.normal;assert.equal(p.count,n.count);assert(Array.from(p.array).every(Number.isFinite));vertices+=p.count}});assert(vertices>50);const box=new T.Box3().setFromObject(model);assert(box.getSize(new T.Vector3()).length()>0)}
const html=fs.readFileSync(new URL('../public/index.html',import.meta.url),'utf8');assert(html.includes('reference-ui.css'));assert(html.includes('id="flightPad"'));assert(html.includes('id="flightGauge"'));const css=fs.readFileSync(new URL('../public/reference-ui.css',import.meta.url),'utf8');assert(css.includes('#lookStick'));assert(css.includes('font-size:14px'));
console.log('PASS: 6m reach boundary, compact resource/rocket/station collisions, finite Blender model exports, new reference HUD controls.');
