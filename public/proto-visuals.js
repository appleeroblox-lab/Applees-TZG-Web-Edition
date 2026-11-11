import * as T from './vendor/three.module.js';
import {WORMHOLE_RADIUS} from './proto-data.js?v=195';
const vertex=`varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`;
export class WormholeVisual{
 constructor(){this.group=new T.Group();this.group.name='Temporal wormhole';this.core=new T.Mesh(new T.SphereGeometry(WORMHOLE_RADIUS,40,24),new T.MeshBasicMaterial({color:0x000000,toneMapped:false,fog:false}));this.group.add(this.core);this.uniforms={sky:{value:null},hasSky:{value:0},time:{value:0},basis:{value:new T.Matrix3()}};
 this.ring=new T.Mesh(new T.PlaneGeometry(WORMHOLE_RADIUS*6,WORMHOLE_RADIUS*6),new T.ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,transparent:true,depthWrite:false,toneMapped:false,side:T.DoubleSide,fragmentShader:`varying vec2 vUv;uniform sampler2D sky;uniform float hasSky;uniform float time;uniform mat3 basis;

#include <common>
#include <logdepthbuf_pars_fragment>
 void main(){
#include <logdepthbuf_fragment>
vec2 p=(vUv-.5)*6.;float r=length(p);if(r<.98||r>2.9)discard;float a=atan(p.y,p.x);float bend=1.25/max(.13,r-0.8);vec2 warped=vec2(cos(a+bend*.18),sin(a+bend*.18))* (r-bend*.14);vec3 d=normalize(basis*vec3(warped,-1.6));vec2 uv=vec2(atan(d.z,d.x)/6.283185+.5,asin(clamp(d.y,-1.,1.))/3.141593+.5);vec3 photo=texture2D(sky,uv).rgb;float rim=exp(-pow((r-1.09)*16.,2.));float outer=exp(-pow((r-1.5)*3.,2.));vec3 color=photo*(1.6+outer*2.8)+vec3(.48,.66,1.)*rim*.85;float alpha=smoothstep(.98,1.03,r)*(1.-smoothstep(2.,2.9,r));gl_FragColor=vec4(mix(vec3(.08,.12,.22),color,hasSky),alpha);
 #include <colorspace_fragment>
 }`}));this.ring.renderOrder=6;this.group.add(this.ring);}
 update(camera,texture,time){this.ring.quaternion.copy(camera.quaternion);this.uniforms.sky.value=texture;this.uniforms.hasSky.value=texture?1:0;this.uniforms.time.value=time;this.uniforms.basis.value.setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(camera.quaternion));}
 dispose(){for(const mesh of [this.core,this.ring]){mesh.geometry.dispose();mesh.material.dispose()}this.group.removeFromParent()}
}
export function createProtoDust(){return new T.Mesh(new T.SphereGeometry(21000,32,20),new T.ShaderMaterial({side:T.BackSide,transparent:true,depthWrite:false,depthTest:false,toneMapped:false,uniforms:{strength:{value:1},offset:{value:new T.Vector3()}},vertexShader:'varying vec3 direction;void main(){direction=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`varying vec3 direction;uniform float strength;uniform vec3 offset;
 float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 void main(){vec3 d=normalize(direction);vec3 p=d*5.+offset;float n=noise(p)*.55+noise(p*2.1)*.28+noise(p*4.3)*.17;float band=exp(-pow((d.y+.1*sin(d.x*4.))/ .25,2.));float clouds=smoothstep(.3,.78,n)*band;vec3 tint=mix(vec3(.22,.12,.055),vec3(.68,.43,.15),n);gl_FragColor=vec4(tint,clouds*.48*strength);
 #include <colorspace_fragment>
 }`}));}
