import assert from 'node:assert/strict';
import fs from 'node:fs';
import * as T from '../public/vendor/three.module.js';
import {modelFromData} from '../public/models.js?v=100';
import {Flight} from '../public/flight.js?v=100';
import {SurfaceSession} from '../public/surface.js?v=100';
import {Crew} from '../public/crew.js?v=100';
import {bodies,earth} from '../public/catalog.js?v=100';
const data=JSON.parse(fs.readFileSync(new URL('../public/models/player-ship.json',import.meta.url)));
const model=modelFromData(data),box=new T.Box3().setFromObject(model),size=box.getSize(new T.Vector3());
assert.equal(data.source,'TZG_Player_Ship.blend');assert(data.meshes.length<=16,'mobile material batching');
assert(Math.abs(size.x-7.4)<.01);assert(Math.abs(size.z-8.648)<.01);assert(Math.abs(box.min.y+1.39)<.01,'hull rests at existing ground contact height');
const parts=data.meshes.flatMap(m=>m.sourceParts.map(p=>p.name));
for(const part of ['Hull_Main_Faceted','Wing_L','Wing_R','Windshield','Seat_Back','Joystick_Grip','Engine_Glow_Core_L','Engine_Glow_Core_R','Display_Screen_0','Display_Screen_1','Display_Screen_2'])assert(parts.includes(part),part+' preserved');
for(const mesh of model.children){const {position,normal,uv}=mesh.geometry.attributes;assert.equal(position.count,normal.count);assert.equal(position.count,uv.count);assert(Array.from(position.array).every(Number.isFinite));assert(Array.from(normal.array).every(Number.isFinite))}
for(const m of data.meshes)for(const key of ['map','emissiveMap'])if(m[key])assert(fs.existsSync(new URL('../public/'+m[key],import.meta.url)));
const glass=model.children.find(m=>m.name.includes('tinted glass'));assert(glass.material.transparent);assert(!glass.material.depthWrite);assert.equal(glass.material.side,T.DoubleSide);
assert(model.children.find(m=>m.name.includes('engine cyan')).material.emissiveIntensity>1);
const pos=new T.Vector3().fromArray(data.cockpit);assert(box.containsPoint(pos));assert(pos.z>-.9&&pos.z<.2,'pilot eye lies behind dashboard and ahead of seat');
for(const socket of data.engineSockets){assert(socket[2]>4.14);assert(Math.abs(socket[0])===.7)}
const f=new Flight(bodies),surface=new SurfaceSession(f),crew=new Crew(surface);surface.enter(earth,true);surface.step(1/60);surface.shipRig={collision:{halfHull:1.4,nose:-4.5,tail:4.2,halfWing:3.7,wingFront:-.72,wingBack:2.35}};crew.leave();assert(!crew.blocked(crew.pos.x,crew.pos.z),'exit is outside wider hull');assert(crew.canBoard);assert(crew.blocked(3,1),'wing blocks walking through ship');assert(!crew.blocked(0,-4),'upright hull no longer extends horizontally toward nose');assert(!crew.blocked(4.2,1),'walk past wingtip');
console.log('PASS: uploaded ship source, all named cockpit/hull/engine parts, bounded draw calls, geometry/UVs/textures, emissive lights/glass, ground alignment, twin nozzles, pilot eye and wider-ship exit/collision/boarding.');

model.rotation.x=Math.PI/2;model.position.y=4.23;const uprightBox=new T.Box3().setFromObject(model);assert(uprightBox.min.y>=0&&uprightBox.min.y<.1,'upright engine tail clears ground without floating');assert(new T.Vector3(0,0,-1).applyQuaternion(model.quaternion).y>.999,'parked nose points up');

for(const mesh of model.children){const {position,normal}=mesh.geometry.attributes;const a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3();let visibleFaces=0;for(let i=0;i<position.count;i+=3){a.fromBufferAttribute(position,i);b.fromBufferAttribute(position,i+1);c.fromBufferAttribute(position,i+2);const area=b.sub(a).cross(c.sub(a)).length();if(area<1e-8)continue;visibleFaces++;for(let j=i;j<i+3;j++)assert(Math.hypot(normal.getX(j),normal.getY(j),normal.getZ(j))>.99,mesh.name+' has unit normals on nondegenerate faces')}assert(visibleFaces>0)}console.log('PASS: imported ship geometry repairs zero-length normals for GPU lighting.');
