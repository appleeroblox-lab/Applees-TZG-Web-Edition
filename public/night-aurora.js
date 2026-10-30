import * as T from './vendor/three.module.js';
export class NightAurora{
 constructor(scene,seed=Math.random()){this.group=new T.Group();this.group.name='Flowing night aurora curtains';this.group.visible=false;scene.add(this.group);const palettes=[['#35ed9a','#37d4e5','#ba64ef'],['#56e59b','#70baff','#ef83b8'],['#43e7bd','#688fed','#d66bba'],['#72e579','#3bbacb','#e97689']],palette=palettes[Math.floor(seed*palettes.length)%palettes.length];this.material=new T.ShaderMaterial({transparent:true,depthWrite:false,depthTest:true,side:T.DoubleSide,blending:T.AdditiveBlending,toneMapped:false,fog:false,uniforms:{time:{value:0},strength:{value:0},phase:{value:seed*6.28},colorA:{value:new T.Color(palette[0])},colorB:{value:new T.Color(palette[1])},colorC:{value:new T.Color(palette[2])}},vertexShader:`varying vec2 vUv;uniform float time;
#include <common>
#include <logdepthbuf_pars_vertex>
void main(){vUv=uv;vec3 p=position;p.y+=sin(p.x*.0018+time*.22)*55.+sin(p.z*.0024-time*.15)*30.;p.z+=sin(p.x*.003+time*.1)*80.*uv.y;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);
#include <logdepthbuf_vertex>
}`,fragmentShader:`varying vec2 vUv;uniform float time;uniform float strength;uniform float phase;uniform vec3 colorA;uniform vec3 colorB;uniform vec3 colorC;
#include <common>
#include <logdepthbuf_pars_fragment>
void main(){
#include <logdepthbuf_fragment>
float folds=.5+.5*sin(vUv.x*145.+sin(vUv.x*23.+time*.19)*5.+time*.16);float rays=pow(folds,3.);float vertical=pow(1.-vUv.y,1.45)*smoothstep(0.,.12,vUv.y);float edge=smoothstep(0.,.12,vUv.x)*smoothstep(0.,.12,1.-vUv.x);float drift=.5+.5*sin(vUv.x*8.+time*.035+phase);vec3 lower=mix(colorA,colorB,drift*.7);vec3 c=mix(lower,colorC,smoothstep(.2,1.,vUv.y)*(.55+drift*.45));float alpha=vertical*(.22+rays*.78)*edge*strength*.72;gl_FragColor=vec4(c,alpha);
#include <colorspace_fragment>
}`});for(let layer=0;layer<3;layer++){const g=new T.BufferGeometry(),positions=[],uv=[],index=[],segments=96,angle=layer*.9-.7;for(let i=0;i<=segments;i++){const t=i/segments,x=(t-.5)*40000,z=-5000+layer*3200+Math.sin(t*7+layer*2)*1800+Math.sin(t*17+layer)*450;for(let j=0;j<2;j++){positions.push(x*Math.cos(angle)-z*Math.sin(angle),3650+layer*65+j*(360+layer*35),x*Math.sin(angle)+z*Math.cos(angle));uv.push(t,j)}if(i<segments){const n=i*2;index.push(n,n+1,n+2,n+1,n+3,n+2)}}g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);g.computeBoundingSphere();const m=new T.Mesh(g,this.material);m.frustumCulled=false;m.renderOrder=3;this.group.add(m)}}
 update(time,session,state){const strength=state?(.16+.84*Math.max(0,Math.min(1,(state.night-.2)/.8)))*(1-state.cloud*.65):0;this.group.visible=session.body?.name==='Earth'&&strength>.015;this.material.uniforms.time.value=time;this.material.uniforms.strength.value=strength}
}
