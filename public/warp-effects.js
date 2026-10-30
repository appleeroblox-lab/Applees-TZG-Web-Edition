import * as T from './vendor/three.module.js';
export function warpTunnelStrength(nav){if(nav?.kind!=='warp'||nav.sourceSystem===nav.b.system)return 0;const p=nav.progress||0;return T.MathUtils.smoothstep(p,.2,.26)*(1-T.MathUtils.smoothstep(p,.79,.85))}
export const TUNNEL_LENGTH=460,TUNNEL_SPEED=1800;
export class WarpTunnel{
 constructor(scene){this.group=new T.Group();this.group.name='World transit corridor';this.group.visible=false;scene.add(this.group);scene.userData.warpTunnel=this;this.uniforms={time:{value:0},strength:{value:0}};this.material=new T.ShaderMaterial({transparent:false,side:T.BackSide,depthTest:true,depthWrite:true,blending:T.NormalBlending,toneMapped:false,uniforms:this.uniforms,vertexShader:`varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
float a=vUv.x*6.283185;float z=vUv.y;float twist=a+z*7.+sin(z*9.-time*.4)*.32;float clouds=.5+.5*sin(twist*4.+sin(twist*9.+z*15.)*1.1-time*.65);float filaments=pow(.5+.5*sin(twist*13.+z*37.-time*4.),15.);float streak=pow(.5+.5*cos(a*83.+sin(a*17.)*2.),34.)*pow(.5+.5*sin(z*8.-time*9.+a*13.),7.);float haze=pow(.5+.5*sin(twist*5.+z*22.-time*.8),3.);vec3 c=vec3(.006,.015,.065)+mix(vec3(.015,.2,.75),vec3(.19,.025,.55),.5+.5*sin(twist*3.))*(.2+clouds*.5+haze*.35);c+=vec3(.18,.65,1.)*filaments*.8;c=mix(c,vec3(.87,.98,1.),clamp(filaments*.6+streak*.95,0.,1.));gl_FragColor=vec4(c*(.3+.7*strength),1.);
#include <colorspace_fragment>
}`});this.geometry=new T.CylinderGeometry(72,72,TUNNEL_LENGTH,32,16,true);this.geometry.rotateX(Math.PI/2);this.sections=[];for(let i=-1;i<=2;i++){const mesh=new T.Mesh(this.geometry,this.material);mesh.position.z=-(i+.5)*TUNNEL_LENGTH;mesh.frustumCulled=false;this.group.add(mesh);this.sections.push(mesh)}this.mesh=this.sections[1];this.capGeometry=new T.CircleGeometry(72,48);this.capMaterial=new T.ShaderMaterial({depthTest:true,depthWrite:true,toneMapped:false,uniforms:this.uniforms,vertexShader:`varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
vec2 p=(vUv-.5)*2.;float r=length(p);float a=atan(p.y,p.x+.00001);float curl=pow(.5+.5*sin(a*7.-log(r+.015)*9.+time*.8),8.);float center=exp(-r*r*150.);vec3 c=vec3(.008,.025,.12)+mix(vec3(.05,.35,.85),vec3(.3,.08,.65),.5+.5*sin(a*3.-r*15.))*curl*.65;c+=vec3(.7,.95,1.)*center;gl_FragColor=vec4(c*(.3+.7*strength),1.);
#include <colorspace_fragment>
}`});this.farCap=new T.Mesh(this.capGeometry,this.capMaterial);this.farCap.position.z=-TUNNEL_LENGTH*3;this.farCap.frustumCulled=false;this.group.add(this.farCap);this.interiorBackground=new T.Color('#02091b');this.hiddenRoots=[];this.transitPosition=new T.Vector3();this.basis=new T.Quaternion();this.forward=new T.Vector3();this.anchor=new T.Vector3();}
 // Transit space uses the same floating-origin convention as the main universe:
 // fixed world sections minus the moving ship position. Camera pose is never read.
 update(nav,flight,time,quality='High',mobile=false){this.active=nav?.kind==='warp';const strength=warpTunnelStrength(nav);this.strength=strength;this.enclosed=strength>.001;this.group.visible=this.enclosed;this.uniforms.time.value=time;this.uniforms.strength.value=strength*(!mobile&&/Ultra/.test(quality)?1:.85);if(!this.active){this.currentNav=null;return strength}if(this.currentNav!==nav){this.currentNav=nav;this.basis.copy(nav.transitQ||flight.q);this.forward.set(0,0,-1).applyQuaternion(this.basis);this.anchor.copy(nav.start||flight.pos||new T.Vector3())}this.travel=Math.max(0,(nav.elapsed||0)-1)*TUNNEL_SPEED;this.sectionIndex=Math.floor(this.travel/TUNNEL_LENGTH);this.transitPosition.copy(this.anchor).addScaledVector(this.forward,this.travel);this.group.quaternion.copy(this.basis);this.group.position.set(0,0,this.travel-this.sectionIndex*TUNNEL_LENGTH).applyQuaternion(this.basis);for(let i=0;i<this.sections.length;i++){this.sections[i].userData.worldSection=this.sectionIndex+i-1}return strength}
 renderInterior(scene,keep,draw){if(!this.enclosed)return draw();const background=scene.background,fog=scene.fog;this.hiddenRoots.length=0;for(const root of scene.children)if(root.visible&&!root.isLight&&root!==this.group&&!keep.includes(root)){root.visible=false;this.hiddenRoots.push(root)}scene.background=this.interiorBackground;scene.fog=null;try{return draw()}finally{for(const root of this.hiddenRoots)root.visible=true;this.hiddenRoots.length=0;scene.background=background;scene.fog=fog}}

}
