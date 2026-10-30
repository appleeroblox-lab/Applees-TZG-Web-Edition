import * as T from './vendor/three.module.js';
// One world-space plume, oriented away from the ground-facing heat shield.
export class ReentryPlume {
 constructor(rig){
  this.rig=rig;this.group=new T.Group();this.group.name='Ground-facing reentry flare';this.group.visible=false;rig.ship.add(this.group);rig.ship.userData.reentryPlume=this;this.rotation=new T.Quaternion();this.up=new T.Vector3(0,1,0);this.inverse=new T.Quaternion();this.radius=3;
  const positions=[],uv=[],indices=[],rays=32,steps=10;
  for(let i=0;i<rays;i++)for(let j=0;j<=steps;j++)for(let edge=0;edge<2;edge++){positions.push(i,j/steps,edge);uv.push(edge,j/steps);if(j<steps){const k=(i*(steps+1)+j)*2;if(edge===0)indices.push(k,k+1,k+2,k+1,k+3,k+2)}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(positions,3));geo.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geo.setIndex(indices);
  this.uniforms={heat:{value:0},time:{value:0}};
  this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,uniforms:this.uniforms,vertexShader:`
#include <common>
#include <logdepthbuf_pars_vertex>
uniform float heat;uniform float time;varying vec2 plumeUV;varying float ray;
void main(){plumeUV=uv;ray=position.x;float t=position.y;float a=(ray+(position.z-.5)*.85)/32.*6.283185;float phase=ray*2.399;float plumeLength=(1.5+heat*5.5)*(.72+.28*sin(phase)*sin(phase));float radius=.2+pow(t,.48)*(.7+heat*.65);a+=sin(time*8.-t*15.+phase)*t*.09;radius+=sin(t*19.-time*16.+phase)*t*.08;vec3 p=vec3(cos(a)*radius,-1.05+t*plumeLength,sin(a)*radius);gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`
#include <logdepthbuf_pars_fragment>
uniform float heat;uniform float time;varying vec2 plumeUV;varying float ray;
void main(){
#include <logdepthbuf_fragment>
float t=plumeUV.y;float edge=pow(max(0.,sin(plumeUV.x*3.141593)),.65);float waves=.55+.45*sin(t*37.-time*26.+ray*2.399);float fade=pow(1.-t,1.6)*smoothstep(0.,.055,t);vec3 pink=mix(vec3(1.,.1,.43),vec3(1.,.48,.82),waves);vec3 color=mix(pink,vec3(1.,.94,1.),pow(1.-t,5.)*heat);gl_FragColor=vec4(color*(.65+heat*1.9),edge*fade*heat*(.3+.7*waves));
}`});
  this.flare=new T.Mesh(geo,this.material);this.flare.frustumCulled=false;this.group.add(this.flare);
  const map=globalThis.document?.createElementNS?new T.TextureLoader().load('./textures/reentry-shine.png',()=>{}):null;
  if(map)map.colorSpace=T.SRGBColorSpace;
  this.shine=new T.Sprite(new T.SpriteMaterial({map,color:0xffbedf,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false,fog:false}));this.shine.name='Single horizontal reentry shine';this.group.add(this.shine);this.shine.position.y=-1.05;
 }
 fit(){const box=new T.Box3().setFromObject(this.rig.model);if(!box.isEmpty()){const size=box.getSize(new T.Vector3());this.radius=T.MathUtils.clamp(Math.max(size.x,size.z)*.36,1,8)}}
 update(heat,time,groundDown,quality='Medium',mobile=false){this.uniforms.heat.value=heat;this.uniforms.time.value=time;this.group.visible=heat>.002;if(!this.group.visible)return;this.rig.ship.getWorldQuaternion(this.inverse).invert();this.up.copy(groundDown).negate().normalize().applyQuaternion(this.inverse);this.group.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),this.up);this.group.scale.setScalar(this.radius);this.shine.scale.set(2+heat*7,(2+heat*7)/3,1);this.shine.material.opacity=Math.min(1,heat*1.2);this.shine.material.color.setRGB(1,.48+heat*.47,.7+heat*.3);this.flare.geometry.setDrawRange(0,(mobile||quality==='Low'?16:32)*10*6);}
}
