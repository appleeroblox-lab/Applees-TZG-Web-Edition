import {proximaAtmosphere} from './proxima-atmospheres.js';
import * as T from './vendor/three.module.js';
export function cloudProfile(body){const profile=proximaAtmosphere(body);if(profile)return {wind:7,height:260,opacity:.3,color:profile.cloud,width:130};return {Earth:{wind:7,height:260,opacity:.3,color:'#e8f1f6',width:130},Venus:{wind:14,height:210,opacity:.62,color:'#d9c195',width:190},Titan:{wind:5,height:180,opacity:.45,color:'#d9b879',width:160},Mars:{wind:9,height:300,opacity:.16,color:'#e3c8bb',width:140}}[body?.name]||null}
export function cloudPosition(body,index,time,origin=new T.Vector3()){const profile=cloudProfile(body);if(!profile)return new T.Vector3();const wrap=n=>((n+800)%1600+1600)%1600-800;return new T.Vector3(origin.x+wrap(Math.sin(index*7.71)*790+time*profile.wind),profile.height+Math.sin(index*2.31+time*.018)*22,origin.z+wrap(Math.cos(index*5.73)*790+time*profile.wind*.23))}
export function applyAtmosphericFog(view){if(!view.session.body?.solid||view.session.body.name==='Earth'||!view.scene.fog)return;const bounds=view.session.terrainFog||{near:45,far:158};view.scene.fog.near=bounds.near;view.scene.fog.far=bounds.far}
export function aboveClouds(body,height){const p=cloudProfile(body);return p?T.MathUtils.smoothstep(height,p.height+45,p.height+240):0}


export function setAtmosphereStars(view,map){const u=view.skyDome?.material.uniforms;if(u?.stars){u.stars.value=map;u.hasStars.value=1}}

export function upperSkyState(body,height,escapeHeight){const profile=cloudProfile(body);if(!profile)return {progress:0,edge:.66,full:.95};const progress=T.MathUtils.smoothstep(height,profile.height+20,Math.max(profile.height+80,(escapeHeight||profile.height+500)-15));return {progress,edge:T.MathUtils.lerp(.66,.2,progress),full:T.MathUtils.lerp(.95,.63,progress)}}
