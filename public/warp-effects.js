import * as T from './vendor/three.module.js';
export function warpTunnelStrength(nav){if(nav?.kind!=='warp'||nav.sourceSystem===nav.b.system)return 0;const p=nav.progress||0;return T.MathUtils.smoothstep(p,.2,.26)*(1-T.MathUtils.smoothstep(p,.79,.85))}
export const TUNNEL_LENGTH=460,TUNNEL_SPEED=1800;
export class WarpTunnel{
 constructor(scene){this.group=new T.Group();this.group.name='World transit corridor';this.group.visible=false;scene.add(this.group);scene.userData.warpTunnel=this;this.uniforms={time:{value:0},strength:{value:0}};this.material=new T.ShaderMaterial({transparent:true,side:T.BackSide,depthTest:true,depthWrite:false,blending:T.AdditiveBlending,toneMapped:false,uniforms:this.uniforms,vertexShader:`varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
float a=vUv.x*6.283185;float fold=sin(a*7.+vUv.y*10.+time*.6);float rib=pow(.5+.5*cos(vUv.y*62.83185),24.);float seam=pow(.5+.5*sin(a*16.+fold*.15),32.);float halo=pow(.5+.5*cos(vUv.y*62.83185),5.)*.24;float edge=max(rib,seam);vec3 blue=mix(vec3(.06,.3,.9),vec3(.3,.08,.65),.5+.5*sin(a*3.+vUv.y*6.));vec3 c=mix(blue,vec3(.86,.97,1.),clamp(edge+halo,0.,1.));gl_FragColor=vec4(c,(.15+edge*.75+halo)*strength);
#include <colorspace_fragment>
}`});this.geometry=new T.CylinderGeometry(72,72,TUNNEL_LENGTH,32,16,true);this.geometry.rotateX(Math.PI/2);this.sections=[];for(let i=-1;i<=2;i++){const mesh=new T.Mesh(this.geometry,this.material);mesh.position.z=-(i+.5)*TUNNEL_LENGTH;mesh.frustumCulled=false;this.group.add(mesh);this.sections.push(mesh)}this.mesh=this.sections[1];this.transitPosition=new T.Vector3();this.basis=new T.Quaternion();this.forward=new T.Vector3();this.anchor=new T.Vector3();}
 // Transit space uses the same floating-origin convention as the main universe:
 // fixed world sections minus the moving ship position. Camera pose is never read.
 update(nav,flight,time,quality='High',mobile=false){this.active=nav?.kind==='warp';const strength=warpTunnelStrength(nav);this.strength=strength;this.group.visible=strength>.001;this.uniforms.time.value=time;this.uniforms.strength.value=strength*(!mobile&&/Ultra/.test(quality)?1:.85);if(!this.active){this.currentNav=null;return strength}if(this.currentNav!==nav){this.currentNav=nav;this.basis.copy(nav.transitQ||flight.q);this.forward.set(0,0,-1).applyQuaternion(this.basis);this.anchor.copy(nav.start||flight.pos||new T.Vector3())}this.travel=Math.max(0,(nav.elapsed||0)-1)*TUNNEL_SPEED;this.sectionIndex=Math.floor(this.travel/TUNNEL_LENGTH);this.transitPosition.copy(this.anchor).addScaledVector(this.forward,this.travel);this.group.quaternion.copy(this.basis);this.group.position.set(0,0,this.travel-this.sectionIndex*TUNNEL_LENGTH).applyQuaternion(this.basis);for(let i=0;i<this.sections.length;i++){this.sections[i].userData.worldSection=this.sectionIndex+i-1}return strength}
}
