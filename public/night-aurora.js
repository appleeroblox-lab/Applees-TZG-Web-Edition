import * as T from './vendor/three.module.js';
export class NightAurora{
 constructor(scene){this.group=new T.Group();this.group.name='Animated night aurora';this.group.visible=false;scene.add(this.group);this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,fog:false,uniforms:{time:{value:0},strength:{value:0}},vertexShader:`varying vec2 vUv;uniform float time;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.0018+time*.22)*90.+sin(p.z*.0024-time*.15)*45.;p.z+=sin(p.x*.003+time*.1)*65.*uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
float folds=.52+.48*sin(vUv.x*115.+sin(vUv.x*21.+time*.22)*4.+time*.12);float rays=pow(folds,2.5);float vertical=pow(1.-vUv.y,1.8)*smoothstep(0.,.08,vUv.y);float edge=smoothstep(0.,.08,vUv.x)*smoothstep(0.,.08,1.-vUv.x);vec3 c=mix(vec3(.12,.95,.64),vec3(.54,.22,.93),smoothstep(.12,.9,vUv.y));float alpha=vertical*(.22+rays*.78)*edge*strength*.7;gl_FragColor=vec4(c,alpha);
#include <colorspace_fragment>
}`});for(let layer=0;layer<2;layer++){const g=new T.BufferGeometry(),positions=[],uv=[],index=[],segments=96;for(let i=0;i<=segments;i++){const a=-2.4+i/segments*4.8,r=1900+layer*700;for(let j=0;j<2;j++){positions.push(Math.sin(a)*r,650+layer*170+j*580,Math.cos(a)*r-2500);uv.push(i/segments,j)}if(i<segments){const n=i*2;index.push(n,n+1,n+2,n+1,n+3,n+2)}}g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);const m=new T.Mesh(g,this.material);m.frustumCulled=false;m.renderOrder=3;this.group.add(m)}}
 update(time,session,state){const strength=state?Math.max(0,Math.min(1,(state.night-.35)/.65))*(1-state.cloud*.8)*Math.max(0,1-session.altitude/2200):0;this.group.visible=session.body?.name==='Earth'&&strength>.015;this.material.uniforms.time.value=time;this.material.uniforms.strength.value=strength}
}
