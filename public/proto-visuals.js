import * as T from './vendor/three.module.js';
import {WORMHOLE_RADIUS} from './proto-data.js?v=195';
const vertex=`varying vec2 vUv;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);
#include <logdepthbuf_vertex>
}`;
export class WormholeVisual{
 constructor(radius=WORMHOLE_RADIUS){this.group=new T.Group();this.group.name='Temporal wormhole';this.core=new T.Mesh(new T.SphereGeometry(radius,40,24),new T.MeshBasicMaterial({color:0x000000,toneMapped:false,fog:false}));this.group.add(this.core);this.uniforms={sky:{value:null},hasSky:{value:0},time:{value:0},basis:{value:new T.Matrix3()}};
 this.ring=new T.Mesh(new T.PlaneGeometry(radius*6,radius*6),new T.ShaderMaterial({uniforms:this.uniforms,vertexShader:vertex,transparent:true,depthTest:true,depthWrite:false,toneMapped:false,side:T.DoubleSide,fragmentShader:`varying vec2 vUv;uniform sampler2D sky;uniform float hasSky;uniform float time;uniform mat3 basis;

#include <common>
#include <logdepthbuf_pars_fragment>
 void main(){
#include <logdepthbuf_fragment>
vec2 p=(vUv-.5)*6.;float r=length(p);if(r<.98||r>2.9)discard;float a=atan(p.y,p.x);float bend=1.25/max(.13,r-0.8);vec2 warped=vec2(cos(a+bend*.18),sin(a+bend*.18))* (r-bend*.14);vec3 d=normalize(basis*vec3(warped,-1.6));vec2 uv=vec2(atan(d.z,d.x)/6.283185+.5,asin(clamp(d.y,-1.,1.))/3.141593+.5);vec3 photo=texture2D(sky,uv).rgb;float rim=exp(-pow((r-1.09)*16.,2.));float outer=exp(-pow((r-1.5)*3.,2.));vec3 color=photo*(1.6+outer*2.8)+vec3(.48,.66,1.)*rim*.85;float alpha=smoothstep(.98,1.03,r)*(1.-smoothstep(2.,2.9,r));gl_FragColor=vec4(mix(vec3(.08,.12,.22),color,hasSky),alpha);
 #include <colorspace_fragment>
 }`}));this.ring.renderOrder=1000;this.group.add(this.ring);}
 update(camera,texture,time){this.ring.quaternion.copy(camera.quaternion);this.uniforms.sky.value=texture;this.uniforms.hasSky.value=texture?1:0;this.uniforms.time.value=time;this.uniforms.basis.value.setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(camera.quaternion));}
 dispose(){for(const mesh of [this.core,this.ring]){mesh.geometry.dispose();mesh.material.dispose()}this.group.removeFromParent()}
}
let dustTexture;
export function createProtoDust({radius=45000000,count=144}={}){
 if(!dustTexture){const size=64,data=new Uint8Array(size*size*4);for(let y=0;y<size;y++)for(let x=0;x<size;x++){const px=(x+.5)/size*2-1,py=(y+.5)/size*2-1,r=px*px+py*py,i=(y*size+x)*4,n=.65+.35*Math.sin(x*.21+Math.sin(y*.34))*Math.cos(y*.19);data[i]=data[i+1]=data[i+2]=255;data[i+3]=Math.round(Math.pow(Math.max(0,1-r),2)*n*100);}dustTexture=new T.DataTexture(data,size,size,T.RGBAFormat);dustTexture.needsUpdate=true;dustTexture.magFilter=T.LinearFilter;dustTexture.minFilter=T.LinearFilter;}
 const group=new T.Group();group.name='Proto world-space dust clouds';group.userData.radius=radius;
 for(let i=0;i<count;i++){const a=i*2.399963,r=radius*(.08+.92*Math.sqrt((i+.5)/count)),cloud=new T.Sprite(new T.SpriteMaterial({map:dustTexture,color:i%3===0?0x9d793e:0x705236,transparent:true,opacity:.32+(i%5)*.04,depthTest:true,depthWrite:false,toneMapped:false,fog:false}));cloud.position.set(Math.cos(a)*r,Math.sin(i*1.73)*radius*.035,Math.sin(a)*r);const size=radius*(.12+(i%7)*.022);cloud.scale.set(size,size*(.4+(i%3)*.2),1);cloud.material.rotation=i*.73;cloud.userData.worldCloud=true;group.add(cloud);}return group;
}
