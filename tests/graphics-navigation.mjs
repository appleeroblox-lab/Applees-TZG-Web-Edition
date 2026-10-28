import assert from 'node:assert/strict';
import * as T from '../public/vendor/three.module.js';
import {GRAPHICS_MODES,graphicsPolicy} from '../public/graphics-policy.js';
import {resolutionRatio} from '../public/performance.js';
import {warpQuote,destinationLightYears} from '../public/warp-pricing.js';
import {pickSpaceBody,labelProjection} from '../public/body-labels.js';
import {applyAtmosphericFog,AIRLESS_FOG_COLOR} from '../public/atmosphere-effects.js';
import {sceneryBudget} from '../public/surface-streaming.js';
import {parseDebugCommand} from '../public/debug-commands.js';
const policies=['High','Ultra','Ultra+'].map(graphicsPolicy);assert.equal(GRAPHICS_MODES.length,5);
for(let i=1;i<policies.length;i++)for(const field of ['clouds','scenery','sceneryDistance','stars','grass','mobileGrass','shadowSize','mobileShadowSize','sharpness'])assert(policies[i][field]>policies[i-1][field],field+' increases with Ultra tiers');
for(const mobile of [false,true]){let last=0;for(const quality of ['High','Ultra','Ultra+']){const ratio=resolutionRatio(1280,720,3,quality,mobile);assert(ratio>last);last=ratio;assert(sceneryBudget(quality,mobile).count>0)}}
assert.equal(parseDebugCommand('graphics ultra+').value,'ultra+');
const target={id:'Proxima b',system:'Proxima',r:60,pos:new T.Vector3(72000,0,0)},walletPosition=new T.Vector3();
const first=warpQuote(target,'Sol',walletPosition);assert.deepEqual(first,{fp:1000,rc:5});assert.deepEqual(warpQuote(target,'Sol',new T.Vector3(1e14,-5e12,0)),first,'return-trip coordinates do not discount intersystem travel');
assert.deepEqual(warpQuote({...target,id:'Earth',system:'Sol'},'Proxima',walletPosition),{fp:0,rc:0});
const prices=['Proxima','Beyond','Blackholes','Galaxy:Andromeda'].map(system=>warpQuote({...target,system},'Sol',walletPosition));assert(prices.every(p=>p.fp===1000&&p.rc>=5&&p.rc<=10));assert(prices[0].rc<prices[1].rc);assert.equal(prices.at(-1).rc,10);assert(Math.abs(destinationLightYears(target,'Sol',walletPosition)-4.24)<.00001);
const origin=new T.Vector3(500,20,30),visible={id:'shown',r:1,pos:origin.clone().add(new T.Vector3(0,0,-10)),mesh:{visible:true}},ghost={id:'hidden',r:1e6,pos:origin.clone(),mesh:{visible:false}};
const ray=new T.Ray(new T.Vector3(),new T.Vector3(0,0,-1));assert.equal(pickSpaceBody(ray,[ghost,visible],origin),visible);ray.direction.set(1,0,0);assert.equal(pickSpaceBody(ray,[ghost,visible],origin),null,'empty space does not lock hidden stale meshes');
const camera=new T.PerspectiveCamera(60,16/9,.025,18000);camera.updateMatrixWorld();assert(labelProjection(new T.Vector3(0,0,-100),camera,1280,720));assert.equal(labelProjection(new T.Vector3(0,0,100),camera,1280,720),null);assert.equal(labelProjection(new T.Vector3(1e12,0,-1),camera,1280,720),null,'offscreen destinations have no edge marker');
for(const name of ['Moon','Mercury','Pluto']){const scene=new T.Scene();scene.fog=new T.Fog('#000000',45,158);const material=new T.MeshStandardMaterial(),mesh=new T.Mesh(new T.BoxGeometry(),material);let originalRan=false;material.onBeforeCompile=shader=>{originalRan=true;shader.fragmentShader+='\n// custom terrain hook'};scene.add(mesh);const view={scene,session:{body:{name,solid:true},terrainFog:{near:40,far:150}}};applyAtmosphericFog(view);assert.equal(scene.fog.color.getHexString(),new T.Color(AIRLESS_FOG_COLOR).getHexString());const shader={vertexShader:'#include <fog_vertex>',fragmentShader:''};material.onBeforeCompile(shader);assert(originalRan);assert(shader.vertexShader.includes('length(mvPosition.xyz)'));assert(!shader.vertexShader.includes('- mvPosition.z'));const callback=material.onBeforeCompile;applyAtmosphericFog(view);assert.equal(material.onBeforeCompile,callback,'material shader is wrapped once');assert.equal(scene.fog.far,150)}
console.log('PASS graphics/navigation: five real quality tiers, scalable budgets, stable 1000 FP/5–10 RC cross-system prices, precise visible-body picking, onscreen-only labels, dark-gray radial fog and preserved material hooks.');
