import {texturePalette} from './texture-palettes.js?v=118';
import * as T from './vendor/three.module.js';
// Gameplay atmosphere choices; fictional/exoplanet palettes are artistic, not measurements.
const named={
 Earth:{air:['#2768b5','#b8dcf2','#526c48'],rim:'#489fff',cloud:'#e8f1f6',wind:18,height:260,opacity:.3,width:130},
 Venus:{air:['#704824','#e7c183','#69513a'],rim:'#dca65e',cloud:'#d9c195',wind:24,height:210,opacity:.62,width:190},
 Mars:{air:['#77584f','#d9ae8f','#8d5940'],rim:'#da8c64',cloud:'#e3c8bb',wind:20,height:300,opacity:.16,width:140},
 Titan:{air:['#75562a','#d5a85e','#705738'],rim:'#d5a052',cloud:'#d9b879',wind:14,height:180,opacity:.45,width:160},
 Io:{air:['#625834','#c9b875','#8f7840'],rim:'#c4b777',cloud:'#d8ca97',wind:16,height:230,opacity:.1,width:120},
 'Proxima b':{air:['#957133','#ead19b','#526c48'],rim:'#ddb367',cloud:'#fff0cf',wind:18,height:260,opacity:.3,width:130},
 'Proxima d':{air:['#73594b','#c8aa8d','#526c48'],rim:'#b38968',cloud:'#e3cfba',wind:18,height:260,opacity:.3,width:130},
 'TRAPPIST-1 e':{air:['#36545c','#a0c7c6','#526d64'],rim:'#73b6b6',cloud:'#d0e1df',wind:20,height:280,opacity:.3,width:150},
 'TRAPPIST-1 f':{air:['#4b455c','#b5abc9','#727280'],rim:'#9c8abb',cloud:'#ded9e8',wind:18,height:240,opacity:.35,width:150},
 'TRAPPIST-1 g':{air:['#535c64','#b4c9d4','#77818a'],rim:'#9bc3d4',cloud:'#e0e9ec',wind:22,height:260,opacity:.4,width:160}
};
const generated=new WeakMap(),matched=new WeakMap();
export function atmosphereProfile(body){if(!body)return null;if(named[body.name]){const original=named[body.name],art=texturePalette(body);if(body.name==='Earth'||!art)return original;if(!matched.has(body)){const base=new T.Color(art.ground),horizon=base.clone().lerp(new T.Color('#edf0eb'),.64);matched.set(body,{...original,air:[base.clone().multiplyScalar(.45).getStyle(),horizon.getStyle(),art.ground],rim:base.clone().lerp(new T.Color('#ffffff'),.3).getStyle(),cloud:horizon.getStyle()})}return matched.get(body)}if(!body.solid||!(body.fictional||body.hasAtmosphere))return null;if(!generated.has(body)){const base=new T.Color(texturePalette(body)?.ground||body.color||'#849bb0'),top=base.clone().multiplyScalar(.42),horizon=base.clone().lerp(new T.Color('#e4dfd6'),.58);generated.set(body,{air:[top.getStyle(),horizon.getStyle(),base.getStyle()],rim:base.clone().lerp(new T.Color('#ffffff'),.25).getStyle(),cloud:horizon.getStyle(),wind:18,height:260,opacity:.3,width:150})}return generated.get(body)}
