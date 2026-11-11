import * as T from './vendor/three.module.js';
// atan/fract sky UVs jump at the longitude seam. Implicit mip derivatives there
// sample the darkest coarse mip as a line; wrap and filter at base resolution.
export function configureSkyTexture(map){
 map.wrapS=T.RepeatWrapping;map.wrapT=T.ClampToEdgeWrapping;
 map.generateMipmaps=false;map.minFilter=T.LinearFilter;map.magFilter=T.LinearFilter;
 map.needsUpdate=true;return map;
}
