import * as T from './vendor/three.module.js';
export const PRICE_AU=1495978.707;
export function systemPriceAnchor(system){if(system==='Sol')return new T.Vector3();const known={Proxima:[5,0,0],'TRAPPIST-1':[36,12,8],Beyond:[150,60,-80],Blackholes:[220,-40,90]};if(known[system])return new T.Vector3(...known[system]).multiplyScalar(PRICE_AU);let hash=2166136261;for(const c of system||'unknown')hash=Math.imul(hash^c.charCodeAt(0),16777619)>>>0;const radius=system?.startsWith('Galaxy:')?1500+(hash%1000):20+hash%180,angle=(hash%6283)/1000;return new T.Vector3(Math.cos(angle),Math.sin(angle*.7)*.3,Math.sin(angle)).normalize().multiplyScalar(radius*PRICE_AU)}
export function warpDistance(target,system,position=new T.Vector3()){if(target.system===system)return Math.max(0,position.distanceTo(target.pos)-target.r);const from=systemPriceAnchor(system).add(position),to=systemPriceAnchor(target.system).add(target.pos);return Math.max(0,from.distanceTo(to)-target.r)}
export function interstellarCoins(system){return 5+Math.floor(5*Math.min(1,systemPriceAnchor(system).length()/(200*PRICE_AU)))}
export function warpQuote(target,system,position){if(target.id==='Earth')return {fp:0,rc:0};if(target.system!==system)return {fp:1000,rc:interstellarCoins(target.system)};return {fp:Math.round(50+250*Math.min(1,warpDistance(target,system,position)/(50*PRICE_AU))),rc:0}}
// System bearings are schematic game-map positions, not measured sky coordinates.
export const LY_UNITS=63241.077*PRICE_AU;
export function systemDisplayAnchor(system){const point=systemPriceAnchor(system);if(system==='Proxima')point.set(4.24*PRICE_AU,0,0);return point.multiplyScalar(63241.077)}
export function destinationOffset(target,system,position){return target.system===system?target.pos.clone().sub(position):systemDisplayAnchor(target.system).add(target.pos).sub(systemDisplayAnchor(system).add(position))}
export function destinationLightYears(target,system,position){return destinationOffset(target,system,position).length()/LY_UNITS}
