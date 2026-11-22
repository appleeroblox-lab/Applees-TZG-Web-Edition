import * as T from './vendor/three.module.js';

export const isPaintHex=value=>typeof value==='string'&&/^#[a-f0-9]{6}$/i.test(value);
export function paintGradient(value){
 if(!Array.isArray(value)||value.length<2||value.length>4)return null;
 if(value[0]?.position!==0||value.at(-1)?.position!==1)return null;
 return value.every((stop,i)=>isPaintHex(stop?.color)&&Number.isFinite(stop.position)&&
  (i===0||stop.position>value[i-1].position))?value:null;
}
export const paintColor=value=>paintGradient(value)?.[0].color||value;
export function gradientSampler(stops){
 const colors=stops.map(stop=>new T.Color(stop.color));
 return (position,out)=>{
  let upper=1;
  while(upper<stops.length-1&&position>stops[upper].position)upper++;
  const left=stops[upper-1].position,right=stops[upper].position;
  return out.lerpColors(colors[upper-1],colors[upper],T.MathUtils.clamp((position-left)/(right-left),0,1));
 };
}

const vertexPaint=new WeakMap();
export function applyPaintGradient(mesh,stops,axis='y'){
 const {geometry,material}=mesh;
 if(!geometry?.attributes.position)return;
 let state=vertexPaint.get(mesh);
 if(!stops){
  if(!state?.active)return;
  if(state.original)geometry.setAttribute('color',state.original);
  else geometry.deleteAttribute('color');
  if(state.emissiveGradient)state.emissiveGradient.value=0;
  material.vertexColors=state.originalEnabled;material.needsUpdate=true;state.active=false;
  return;
 }
 const vertices=geometry.attributes.position;
 if(!state){
  state={original:geometry.attributes.color,originalEnabled:material.vertexColors,
   colors:new T.Float32BufferAttribute(new Float32Array(vertices.count*3),3)};
  vertexPaint.set(mesh,state);
  if(material.emissive){
   const compile=material.onBeforeCompile,key=material.customProgramCacheKey();
   const enabled=state.emissiveGradient={value:0};
   material.onBeforeCompile=function(shader,renderer){
    compile.call(this,shader,renderer);
    shader.uniforms.paintEmissiveGradient=enabled;
    shader.fragmentShader='uniform float paintEmissiveGradient;\n'+shader.fragmentShader.replace('#include <lights_fragment_begin>',`
#ifdef USE_COLOR
totalEmissiveRadiance *= mix(vec3(1.0),vColor.rgb,paintEmissiveGradient);
#endif
#include <lights_fragment_begin>`);
   };
   material.customProgramCacheKey=()=>key+'-paint-gradient';
  }
 }
 if(!state.active){
  geometry.setAttribute('color',state.colors);
  if(state.emissiveGradient)state.emissiveGradient.value=1;
  material.vertexColors=true;material.needsUpdate=true;state.active=true;
 }
 if(!geometry.boundingBox)geometry.computeBoundingBox();
 const low=geometry.boundingBox.min[axis],span=geometry.boundingBox.max[axis]-low||1;
 const sample=gradientSampler(stops),color=new T.Color();
 for(let i=0;i<vertices.count;i++){
  const location=axis==='z'?vertices.getZ(i):vertices.getY(i);
  sample((location-low)/span,color);
  state.colors.setXYZ(i,color.r,color.g,color.b);
 }
 state.colors.needsUpdate=true;
}
