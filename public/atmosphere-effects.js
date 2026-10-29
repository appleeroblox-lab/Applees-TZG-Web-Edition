import {airColor,atmosphereFogRange} from './spherical-atmosphere.js?v=115';
import {hasAtmosphere} from './atmospheric-flight.js?v=113';
import {transitionState} from './atmospheric-flight.js?v=113';
import {proximaAtmosphere} from './proxima-atmospheres.js';
import * as T from './vendor/three.module.js';
export function cloudProfile(body){const profile=proximaAtmosphere(body);if(profile)return {wind:7,height:260,opacity:.3,color:profile.cloud,width:130};return {Earth:{wind:7,height:260,opacity:.3,color:'#e8f1f6',width:130},Venus:{wind:14,height:210,opacity:.62,color:'#d9c195',width:190},Titan:{wind:5,height:180,opacity:.45,color:'#d9b879',width:160},Mars:{wind:9,height:300,opacity:.16,color:'#e3c8bb',width:140}}[body?.name]||null}
export function cloudPosition(body,index,time){const profile=cloudProfile(body);if(!profile)return new T.Vector3();const wrap=n=>((n+800)%1600+1600)%1600-800;return new T.Vector3(wrap(Math.sin(index*7.71)*790+time*profile.wind),profile.height+Math.sin(index*2.31+time*.018)*22,wrap(Math.cos(index*5.73)*790+time*profile.wind*.23))}
export const AIRLESS_FOG_COLOR='#25272b';
export function installRadialFog(view){view.radialFogMaterials??=new WeakSet();view.scene.traverse(object=>{for(const material of (Array.isArray(object.material)?object.material:[object.material])){if(!material||material.fog===false||view.radialFogMaterials.has(material))continue;view.radialFogMaterials.add(material);const original=material.onBeforeCompile,key=material.customProgramCacheKey();material.onBeforeCompile=function(shader,renderer){original.call(this,shader,renderer);shader.vertexShader=shader.vertexShader.replace('#include <fog_vertex>','#ifdef USE_FOG\n vFogDepth = length(mvPosition.xyz);\n#endif')};material.customProgramCacheKey=()=>key+'-radial-fog';material.needsUpdate=true}})}
export function applyAtmosphericFog(view){if(!view.session.body?.solid||!view.scene.fog)return;installRadialFog(view);const body=view.session.body,bounds=view.session.terrainFog||{near:45,far:158};if(!hasAtmosphere(body)){view.scene.fog.near=bounds.near;view.scene.fog.far=bounds.far;view.scene.fog.color.set(AIRLESS_FOG_COLOR);return}const env=view.session.earthEnvironment,profile=cloudProfile(body),range=atmosphereFogRange(view.session.altitude||0,Math.min(env?.fogNear??bounds.near,bounds.near),Math.min(env?.fogFar??bounds.far,bounds.far));view.scene.fog.near=range.near;view.scene.fog.far=range.far;if(env)view.scene.fog.color.copy(env.horizon);else view.scene.fog.color.copy(airColor(body))}
export function aboveClouds(body,height){const p=cloudProfile(body);return p?T.MathUtils.smoothstep(height,p.height+45,p.height+240):0}


export function setAtmosphereStars(view,map){const u=view.skyDome?.material.uniforms;if(u?.stars){u.stars.value=map;u.hasStars.value=1}}

export function upperSkyState(body,height,escapeHeight){const profile=cloudProfile(body);if(!profile)return {progress:0,edge:.66,full:.95};const progress=transitionState(height).space;const blend=transitionState(height).planet;return {progress,edge:T.MathUtils.lerp(T.MathUtils.lerp(.66,.04,progress),-1,blend),full:T.MathUtils.lerp(T.MathUtils.lerp(.95,.35,progress),-.99,blend)}}
