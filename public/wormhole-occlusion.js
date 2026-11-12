import * as T from './vendor/three.module.js';
const original=new WeakMap();
// Cockpit cameras see the inside faces of opaque hull panels. Keep real glass clear.
export function cockpitHullDepth(ship,enabled){ship.traverse(object=>{if(!object.isMesh)return;for(const material of Array.isArray(object.material)?object.material:[object.material]){if(!material||material.transparent&&material.opacity<.99||!material.depthWrite)continue;if(!original.has(material))original.set(material,material.side);const side=enabled?T.DoubleSide:original.get(material);if(material.side!==side){material.side=side;material.needsUpdate=true;}}});}
