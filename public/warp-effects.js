import * as T from './vendor/three.module.js';
export function warpTunnelStrength(nav){if(nav?.kind!=='warp'||nav.sourceSystem===nav.b.system)return 0;const p=nav.progress||0;return T.MathUtils.smoothstep(p,.2,.26)*(1-T.MathUtils.smoothstep(p,.79,.85))}
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
float a=vUv.x*6.283185;float z=vUv.y;float travel=z*4.-time*2.4;
float twist=a+sin(travel*.28+a*2.)*.18;
vec3 direction=normalize(skyBasis*vec3(cos(twist),sin(twist),-1.-z*8.));
vec2 skyUV=vec2(atan(direction.z,direction.x)/6.283185+.5,asin(clamp(direction.y,-1.,1.))/3.141593+.5);
vec3 photo=texture2D(skyMap,skyUV).rgb;
// Only the current sky panorama, wrapped and softly glowing.
vec3 glow=texture2D(skyMap,skyUV+vec2(.003,0.)).rgb+texture2D(skyMap,skyUV-vec2(.003,0.)).rgb+texture2D(skyMap,skyUV+vec2(0.,.003)).rgb+texture2D(skyMap,skyUV-vec2(0.,.003)).rgb;
vec3 c=mix(vec3(.004,.008,.02),photo*1.65+glow*.22,hasSky);
gl_FragColor=vec4(c*(.3+.7*strength),1.);
#include <colorspace_fragment>
}`});this.geometry=new T.CylinderGeometry(72,72,TUNNEL_LENGTH,32,16,true);this.geometry.rotateX(Math.PI/2);this.sections=[];for(let i=-1;i<=2;i++){const mesh=new T.Mesh(this.geometry,this.material);mesh.position.z=-(i+.5)*TUNNEL_LENGTH;mesh.frustumCulled=false;this.group.add(mesh);this.sections.push(mesh)}this.mesh=this.sections[1];this.capGeometry=new T.PlaneGeometry(144,144);this.capMaterial=new T.ShaderMaterial({depthTest:true,depthWrite:true,toneMapped:false,uniforms:this.uniforms,vertexShader:`varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;uniform sampler2D skyMap;uniform float hasSky;uniform mat3 skyBasis;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
vec2 p=(vUv-.5)*2.;vec3 direction=normalize(skyBasis*vec3(p,-12.));vec2 uv=vec2(atan(direction.z,direction.x)/6.283185+.5,asin(clamp(direction.y,-1.,1.))/3.141593+.5);vec3 c=mix(vec3(.008,.018,.06),texture2D(skyMap,uv).rgb,hasSky);gl_FragColor=vec4(c*(.3+.7*strength),1.);
#include <colorspace_fragment>
}`});this.farCap=new T.Mesh(this.capGeometry,this.capMaterial);this.farCap.position.z=-TUNNEL_LENGTH*3;this.farCap.frustumCulled=false;this.group.add(this.farCap);this.interiorBackground=new T.Color('#02091b');this.hiddenRoots=[];this.transitPosition=new T.Vector3();this.basis=new T.Quaternion();this.forward=new T.Vector3();this.anchor=new T.Vector3();}
 // Transit space uses the same floating-origin convention as the main universe:
 // fixed world sections minus the moving ship position. Camera pose is never read.
 update(nav,flight,time,quality='High',mobile=false,skyMap=null){this.uniforms.skyMap.value=skyMap;this.uniforms.hasSky.value=skyMap?1:0;this.active=nav?.kind==='warp';const strength=warpTunnelStrength(nav);this.strength=strength;this.enclosed=strength>.001;this.group.visible=this.enclosed;this.uniforms.time.value=time;this.uniforms.strength.value=strength*(!mobile&&/Ultra/.test(quality)?1:.85);if(!this.active){this.currentNav=null;return strength}if(this.currentNav!==nav){this.currentNav=nav;this.basis.copy(nav.transitQ||flight.q);this.forward.set(0,0,-1).applyQuaternion(this.basis);this.anchor.copy(nav.start||flight.pos||new T.Vector3())}this.travel=Math.max(0,(nav.elapsed||0)-1)*TUNNEL_SPEED;this.sectionIndex=Math.floor(this.travel/TUNNEL_LENGTH);this.transitPosition.copy(this.anchor).addScaledVector(this.forward,this.travel);this.uniforms.skyBasis.value.setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(this.basis));this.group.quaternion.copy(this.basis);this.group.position.set(0,0,this.travel-this.sectionIndex*TUNNEL_LENGTH).applyQuaternion(this.basis);for(let i=0;i<this.sections.length;i++){this.sections[i].userData.worldSection=this.sectionIndex+i-1}return strength}
 renderInterior(scene,keep,draw){if(!this.enclosed)return draw();const background=scene.background,fog=scene.fog;this.hiddenRoots.length=0;for(const root of scene.children)if(root.visible&&!root.isLight&&root!==this.group&&!keep.includes(root)){root.visible=false;this.hiddenRoots.push(root)}scene.background=this.interiorBackground;scene.fog=null;try{return draw()}finally{for(const root of this.hiddenRoots)root.visible=true;this.hiddenRoots.length=0;scene.background=background;scene.fog=fog}}

}
