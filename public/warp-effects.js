import * as T from './vendor/three.module.js';
export function warpTunnelStrength(nav){return nav?.kind==='warp'&&nav.sourceSystem!==nav.b.system?1:0}
export function tunnelPoint(distance,total=16200,seed=0,out=new T.Vector3()){const u=T.MathUtils.clamp((distance/total-.2)/.6,0,1),envelope=Math.pow(Math.sin(Math.PI*u),4);return out.set(Math.sin(u*Math.PI*2+seed)*700*envelope,Math.sin(u*Math.PI+seed*1.7)*420*envelope,-distance)}
export function tunnelTangent(distance,total=16200,seed=0,out=new T.Vector3()){return out.copy(tunnelPoint(distance+1,total,seed)).sub(tunnelPoint(distance-1,total,seed)).normalize()}
export function warpWhiteFade(nav){if(!warpTunnelStrength(nav))return 0;const p=nav.progress||0;return Math.max(1-T.MathUtils.smoothstep(p,0,.06),T.MathUtils.smoothstep(p,.94,1))}
export const TUNNEL_LENGTH=460,TUNNEL_SPEED=1800;
export class WarpTunnel{
 constructor(scene){this.group=new T.Group();this.group.name='World transit corridor';this.group.visible=false;scene.add(this.group);scene.userData.warpTunnel=this;this.uniforms={time:{value:0},strength:{value:0},skyMap:{value:null},hasSky:{value:0},skyBasis:{value:new T.Matrix3()}};this.material=new T.ShaderMaterial({transparent:false,side:T.BackSide,depthTest:true,depthWrite:true,blending:T.NormalBlending,toneMapped:false,uniforms:this.uniforms,vertexShader:`varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;uniform sampler2D skyMap;uniform float hasSky;uniform mat3 skyBasis;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
// Equirectangular longitude wraps exactly once around the corridor; the
// longitudinal coordinate is continuous across recycled section boundaries.
vec2 skyUV=vec2(fract(vUv.x+time*.018),.5+.46*sin(vUv.y*.16-time*.38));
vec3 photo=texture2D(skyMap,skyUV).rgb;
vec3 glow=texture2D(skyMap,skyUV+vec2(.003,0.)).rgb+texture2D(skyMap,skyUV-vec2(.003,0.)).rgb+texture2D(skyMap,skyUV+vec2(0.,.003)).rgb+texture2D(skyMap,skyUV-vec2(0.,.003)).rgb;
vec3 c=mix(vec3(.06,.12,.23),vec3(.035,.065,.12)+photo*3.8+glow*.65,hasSky);
float rim=pow(.5+.5*cos(vUv.x*6.283185*8.+sin(vUv.y*.9-time)*.2),36.);c+=vec3(.65,.85,1.)*rim*1.6;
vec2 cell=vec2(vUv.x*180.,vUv.y*24.-time*18.);vec2 id=floor(cell);float seed=fract(sin(dot(id,vec2(127.1,311.7)))*43758.5453);vec2 spark=fract(cell)-.5;float star=exp(-spark.x*spark.x*160.-spark.y*spark.y*9.)*step(.965,seed);c+=vec3(1.7,2.2,2.8)*star;gl_FragColor=vec4(c*(.8+.2*strength),1.);
#include <colorspace_fragment>
}`});this.geometry=new T.CylinderGeometry(72,72,TUNNEL_LENGTH,32,16,true);this.geometry.rotateX(Math.PI/2);this.sections=[];for(let i=-1;i<=2;i++){const mesh=new T.Mesh(this.geometry.clone(),this.material);mesh.geometry.attributes.position.setUsage(T.DynamicDrawUsage);mesh.geometry.attributes.uv.setUsage(T.DynamicDrawUsage);mesh.position.z=-(i+.5)*TUNNEL_LENGTH;mesh.frustumCulled=false;this.group.add(mesh);this.sections.push(mesh)}this.mesh=this.sections[1];this.capGeometry=new T.PlaneGeometry(144,144);this.capMaterial=new T.ShaderMaterial({depthTest:true,depthWrite:true,toneMapped:false,uniforms:this.uniforms,vertexShader:`varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;uniform sampler2D skyMap;uniform float hasSky;uniform mat3 skyBasis;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
vec2 p=(vUv-.5)*2.;vec3 direction=normalize(skyBasis*vec3(p,-12.));vec2 uv=vec2(atan(direction.z,direction.x)/6.283185+.5,asin(clamp(direction.y,-1.,1.))/3.141593+.5);vec3 c=mix(vec3(.08,.15,.28),vec3(.04,.07,.13)+texture2D(skyMap,uv).rgb*3.8,hasSky);float radius=length(p);float rim=exp(-pow((radius-.78)*24.,2.));c+=vec3(1.,1.,1.)*rim*2.4;gl_FragColor=vec4(c*(.8+.2*strength),1.);
#include <colorspace_fragment>
}`});this.farCap=new T.Mesh(this.capGeometry,this.capMaterial);this.farCap.position.z=-TUNNEL_LENGTH*3;this.farCap.frustumCulled=false;this.group.add(this.farCap);// Fixed corridor cross-sections, recycled with the world sections, never camera billboards.
this.fogGeometry=new T.PlaneGeometry(144,144);this.fogMaterial=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,uniforms:{},vertexShader:`varying vec2 fogUV;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){fogUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 fogUV;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
vec2 p=(fogUV-.5)*2.;float r=length(p);float edge=1.-smoothstep(.88,1.,r);float cloud=.75+.25*sin(p.x*17.+sin(p.y*13.))*sin(p.y*11.);float haze=(.035+.28*smoothstep(.18,.85,r))*edge*cloud;gl_FragColor=vec4(vec3(.65,.85,1.2),haze);
}`});this.fogLayers=Array.from({length:4},()=>{const fog=new T.Mesh(this.fogGeometry,this.fogMaterial);fog.name='World-space luminous corridor fog';fog.frustumCulled=false;this.group.add(fog);return fog});
this.interiorBackground=new T.Color('#244671');this.hiddenRoots=[];this.transitPosition=new T.Vector3();this.basis=new T.Quaternion();this.forward=new T.Vector3();this.anchor=new T.Vector3();this.orientation=new T.Quaternion();this.localOrientation=new T.Quaternion();this.curveCenter=new T.Vector3();this.curveDirection=new T.Vector3();this.curveSeed=0;this.totalTravel=16200;}
 // Transit space uses the same floating-origin convention as the main universe:
 // fixed world sections minus the moving ship position. Camera pose is never read.
 update(nav,flight,time,quality='High',mobile=false,skyMap=null){this.uniforms.skyMap.value=skyMap;this.uniforms.hasSky.value=skyMap?1:0;this.active=nav?.kind==='warp';const strength=warpTunnelStrength(nav);this.strength=strength;this.enclosed=strength>.001;this.group.visible=this.enclosed;this.uniforms.time.value=time;this.uniforms.strength.value=strength*(!mobile&&/Ultra/.test(quality)?1:.85);if(!this.active){this.currentNav=null;return strength}
 if(this.currentNav!==nav){this.currentNav=nav;this.basis.copy(nav.transitQ||flight.q);this.forward.set(0,0,-1).applyQuaternion(this.basis);this.anchor.copy(nav.start||flight.pos||new T.Vector3());this.totalTravel=Math.max(1,(nav.duration||10)-1)*TUNNEL_SPEED;this.curveSeed=[...(nav.b.name||nav.b.system||'warp')].reduce((n,c)=>n+c.charCodeAt(0),0)*.17}
 this.travel=Math.max(0,(nav.elapsed||0)-1)*TUNNEL_SPEED;this.sectionIndex=Math.floor(this.travel/TUNNEL_LENGTH);tunnelPoint(this.travel,this.totalTravel,this.curveSeed,this.curveCenter);tunnelTangent(this.travel,this.totalTravel,this.curveSeed,this.curveDirection);this.localOrientation.setFromUnitVectors(new T.Vector3(0,0,-1),this.curveDirection);this.orientation.copy(this.basis).multiply(this.localOrientation);this.transitPosition.copy(this.curveCenter).applyQuaternion(this.basis).add(this.anchor);this.group.quaternion.copy(this.basis);this.group.position.set(0,0,0);this.uniforms.skyBasis.value.setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(this.basis));
 const origin=this.geometry.attributes.position,uv=this.geometry.attributes.uv,travelOffset=this.travel-this.sectionIndex*TUNNEL_LENGTH,frame=new T.Quaternion(),offset=new T.Vector3();
 for(let section=0;section<this.sections.length;section++){const mesh=this.sections[section],position=mesh.geometry.attributes.position,tex=mesh.geometry.attributes.uv;mesh.position.set(0,0,0);mesh.userData.worldSection=this.sectionIndex+section-1;let previous=Infinity,center=new T.Vector3();
 for(let i=0;i<origin.count;i++){const z=origin.getZ(i)-(section-.5)*TUNNEL_LENGTH+travelOffset,distance=this.travel-z;if(Math.abs(distance-previous)>.0001){tunnelPoint(distance,this.totalTravel,this.curveSeed,center);frame.setFromUnitVectors(new T.Vector3(0,0,-1),tunnelTangent(distance,this.totalTravel,this.curveSeed));previous=distance}offset.set(origin.getX(i),origin.getY(i),0).applyQuaternion(frame).add(center).sub(this.curveCenter);position.setXYZ(i,offset.x,offset.y,offset.z);tex.setXY(i,uv.getX(i),distance/TUNNEL_LENGTH)}position.needsUpdate=true;tex.needsUpdate=true;}
 for(let i=0;i<this.fogLayers.length;i++){const fog=this.fogLayers[i],distance=(this.sectionIndex+i)*TUNNEL_LENGTH;fog.userData.worldDistance=distance;tunnelPoint(distance,this.totalTravel,this.curveSeed,fog.position).sub(this.curveCenter);fog.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),tunnelTangent(distance,this.totalTravel,this.curveSeed))}
 const far=(this.sectionIndex+3)*TUNNEL_LENGTH;tunnelPoint(far,this.totalTravel,this.curveSeed,this.farCap.position).sub(this.curveCenter);this.farCap.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),tunnelTangent(far,this.totalTravel,this.curveSeed));return strength}
 renderInterior(scene,keep,draw){if(!this.enclosed)return draw();const background=scene.background,fog=scene.fog;this.hiddenRoots.length=0;for(const root of scene.children)if(root.visible&&!root.isLight&&root!==this.group&&!keep.includes(root)){root.visible=false;this.hiddenRoots.push(root)}scene.background=this.interiorBackground;scene.fog=null;try{return draw()}finally{for(const root of this.hiddenRoots)root.visible=true;this.hiddenRoots.length=0;scene.background=background;scene.fog=fog}}

}
