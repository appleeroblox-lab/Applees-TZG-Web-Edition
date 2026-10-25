import {proximaAtmosphere} from './proxima-atmospheres.js';
import {bodySphereGeometry} from './texture-geometry.js';
import {createBlackHole} from './black-hole-effects.js';
import {starShineColor} from './star-colors.js';
import * as T from './vendor/three.module.js';
import {loadBlenderModel} from './models.js?v=74';
export function random(seed=1){return()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296}}
function planetTexture(b){
 const rand=random([...b.name].reduce((s,c)=>s+c.charCodeAt(0)*97,99)),c=document.createElement('canvas');c.width=1024;c.height=512;const ctx=c.getContext('2d');ctx.fillStyle=b.color;ctx.fillRect(0,0,1024,512);
 if(b.name==='Earth'){
  const img=ctx.createImageData(1024,512);
  const centers=[[-2.2,.65,.8,.6],[-1.35,-.5,.38,.9],[.25,.25,.48,.8],[1.2,.75,1.1,.48],[2.3,-.55,.4,.25],[.15,1.1,.3,.25]];
  for(let y=0;y<512;y++)for(let x=0;x<1024;x++){const lon=x/1024*Math.PI*2-Math.PI,lat=Math.PI/2-y/512*Math.PI;
   let field=0;for(const [cx,cy,rx,ry] of centers){let dx=Math.atan2(Math.sin(lon-cx),Math.cos(lon-cx));field=Math.max(field,Math.exp(-((dx/rx)**2+((lat-cy)/ry)**2)*1.8))}
   const noise=Math.sin(lon*18+Math.cos(lat*21))*Math.sin(lat*17+lon*5)*.06+Math.sin(lon*47+lat*31)*.018;
   let col;if(Math.abs(lat)>1.35+Math.sin(lon*5)*.04)col=[218,234,237];else if(field+noise>.3){const desert=Math.max(0,1-Math.abs(lat-.28)*3)*Math.max(0,Math.cos(lon));col=desert>.45?[153,133,86]:[47+field*30,92+field*27,65+field*10]}else{const coast=field>.23?1:0;col=coast?[27,111,137]:[14,52+field*70,95+field*85]}
   let i=(y*1024+x)*4;img.data[i]=col[0];img.data[i+1]=col[1];img.data[i+2]=col[2];img.data[i+3]=255;
  }ctx.putImageData(img,0,0);
 }else if(!b.solid){for(let y=0;y<512;y++){ctx.globalAlpha=.08+rand()*.12;ctx.fillStyle=Math.sin(y*.1)>.1?'#ffedca':'#312633';ctx.fillRect(0,y,1024,2)}if(b.name==='Jupiter'){ctx.globalAlpha=.55;ctx.fillStyle='#a96649';ctx.beginPath();ctx.ellipse(650,330,60,22,-.07,0,7);ctx.fill()}}
 else{for(let i=0;i<2200;i++){const x=rand()*1024,y=rand()*512,r=.6+rand()**3*30;ctx.globalAlpha=.06+rand()*.17;ctx.fillStyle=i%2?'#fff5d8':'#272326';ctx.beginPath();ctx.ellipse(x,y,r,r*.62,0,0,7);ctx.fill();if(i%3===0){ctx.strokeStyle='#f3e4cd';ctx.lineWidth=1;ctx.beginPath();ctx.ellipse(x-1,y-1,r,r*.62,0,Math.PI,Math.PI*1.8);ctx.stroke()}}}
 ctx.globalAlpha=1;const small=document.createElement('canvas');small.width=512;small.height=256;small.getContext('2d').drawImage(c,0,0,512,256);const map=new T.CanvasTexture(small);map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;return map;
}
function glowMap(){const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d'),g=x.createRadialGradient(64,64,0,64,64,64);g.addColorStop(0,'#ffffff');g.addColorStop(.15,'#ffffffcc');g.addColorStop(.35,'#ffffff33');g.addColorStop(1,'#ffffff00');x.fillStyle=g;x.fillRect(0,0,128,128);return new T.CanvasTexture(c)}
export const glow=glowMap();
export function makeWorld(b){
 if(b.type==='STAR'){const color=starShineColor(b),mesh=new T.Mesh(new T.SphereGeometry(b.r,40,24),new T.MeshBasicMaterial({color,toneMapped:false}));mesh.userData.body=b;mesh.userData.neonStar=true;const halo=new T.Sprite(new T.SpriteMaterial({map:glow,color,transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false}));halo.scale.setScalar(b.r*9);mesh.add(halo);return mesh}
 if(b.type==='GALAXY')return makeGalaxy(b);
 if(b.type==='BLACK HOLE')return createBlackHole(b);
 if(b.type==='NEBULA'||b.type==='STAR CLUSTER')return makeNebula(b);
 const geometry=bodySphereGeometry(b);

 const mesh=new T.Mesh(geometry,new T.MeshStandardMaterial({color:b.color,roughness:b.name==='Earth'?.63:.95,metalness:0,emissive:b.type==='STAR'?b.color:0,emissiveIntensity:b.type==='STAR'?3.5:0}));mesh.userData.body=b;
 if(b.solid&&!b.texture){const c=document.createElement('canvas');c.width=512;c.height=256;const x=c.getContext('2d');let seed=0;for(const ch of b.name)seed=(seed*31+ch.charCodeAt(0))>>>0;const rng=random(seed);x.fillStyle=b.color;x.fillRect(0,0,512,256);if(b.type.includes('DWARF')){for(let i=0;i<850;i++){const px=rng()*512,py=rng()*256;x.fillStyle=i%3?'#ffe7ce14':'#31222b22';x.beginPath();x.ellipse(px,py,3+rng()*38,1+rng()*12,rng()*3,0,7);x.fill()}}else{for(let i=0;i<360;i++){x.fillStyle=`rgba(25,28,32,${.03+rng()*.15})`;x.beginPath();x.ellipse(rng()*512,rng()*256,1+rng()*12,1+rng()*6,rng()*3,0,7);x.fill()}}const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;mesh.material.map=map;mesh.material.color.set(0xffffff)}

 if(b.type==='STAR'){const halo=new T.Sprite(new T.SpriteMaterial({map:glow,color:starShineColor(b),transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false}));halo.scale.setScalar(b.r*9);mesh.add(halo)}
 if(['Earth','Venus','Proxima b','Proxima d','Titan'].includes(b.name)){
  const atmo=new T.Mesh(new T.SphereGeometry(b.r*1.025,56,32),new T.ShaderMaterial({uniforms:{tint:{value:new T.Color(proximaAtmosphere(b)?.rim||(b.name==='Earth'?0x489fff:0xe5b789))},sunsetTint:{value:proximaAtmosphere(b)?new T.Color(proximaAtmosphere(b).air[1]):new T.Color(1,.36,.12)}},vertexShader:'#include <common>\n#include <logdepthbuf_pars_vertex>\nvarying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;\n#include <logdepthbuf_vertex>\n}',fragmentShader:'#include <logdepthbuf_pars_fragment>\nuniform vec3 tint;uniform vec3 sunsetTint;varying vec3 n;varying vec3 v;void main(){\n#include <logdepthbuf_fragment>\nfloat rim=pow(1.0-abs(dot(normalize(n),normalize(v))),3.5);float sun=max(.05,dot(normalize(n),normalize(vec3(-.7,.3,1.0))));vec3 sunset=mix(sunsetTint,tint,smoothstep(.05,.45,sun));gl_FragColor=vec4(sunset,rim*(.1+sun*.65));}',transparent:true,side:T.BackSide,blending:T.AdditiveBlending,depthWrite:false}));mesh.add(atmo)
 }
 if(['Earth','Proxima b','Proxima d'].includes(b.name)){const c=document.createElement('canvas');c.width=1024;c.height=512;const x=c.getContext('2d'),rand=random(241);for(let i=0;i<2200;i++){x.fillStyle=`rgba(255,255,255,${rand()*.17})`;x.beginPath();x.ellipse(rand()*1024,rand()*512,4+rand()*35,1+rand()*4,-.3,0,7);x.fill()}b.clouds=new T.Mesh(new T.SphereGeometry(b.r*1.006,64,40),new T.MeshStandardMaterial({map:new T.CanvasTexture(c),transparent:true,opacity:.75,depthWrite:false}));mesh.add(b.clouds)}
 if(b.rings){const rand=random(84);for(let i=0;i<10;i++){const r=new T.Mesh(new T.RingGeometry(b.r*(1.28+i*.095),b.r*(1.35+i*.095),180),new T.MeshStandardMaterial({color:new T.Color().setHSL(.11,.17,.45+rand()*.25),side:T.DoubleSide,transparent:true,opacity:.35+rand()*.35}));r.rotation.x=-Math.PI/2.3;mesh.add(r)}}return mesh;
}
export function makeShip(){
 const ship=new T.Group(),model=new T.Group(),gear=new T.Group(),exhaust=new T.Group();ship.add(model,gear,exhaust);
 const hull=new T.Mesh(new T.BoxGeometry(2.3,1.2,7.4),new T.MeshStandardMaterial({color:0xe9f1f7,roughness:.45}));hull.position.set(0,-.7,-.8);model.add(hull);
 const wing=new T.Mesh(new T.BoxGeometry(7.4,.2,2.5),new T.MeshStandardMaterial({color:0xcd2541}));wing.position.set(0,-.76,.9);model.add(wing);
 const ready=loadBlenderModel(model,'player-ship');
 const flames=[],engines=[],verticalFlames=[];
 for(const x of [-.7,.7]){
  const flame=new T.Mesh(new T.ConeGeometry(.29,2.8,20).rotateX(Math.PI/2).translate(0,0,1.4),new T.MeshBasicMaterial({color:0x9feaff,transparent:true,opacity:.65,blending:T.AdditiveBlending,depthWrite:false}));flame.position.set(x,-.58,4.17);flame.visible=false;exhaust.add(flame);flames.push(flame);
  const halo=new T.Sprite(new T.SpriteMaterial({map:glow,color:0x9ee7ff,transparent:true,blending:T.AdditiveBlending,depthWrite:false}));halo.position.copy(flame.position);halo.scale.setScalar(1.1);halo.visible=false;exhaust.add(halo);engines.push(halo);
 }
 ship.userData.model='TZG Player Ship · uploaded Blender model';
 return {ship,model,gear,flames,engines,verticalFlames,exhaust,ready,subjectCenter:new T.Vector3(0,.2775,-.176),contactHeight:4.23,cockpitPosition:new T.Vector3(0,.29,-.12),collision:{halfHull:1.4,nose:-4.5,tail:4.2,halfWing:3.7,wingFront:-.72,wingBack:2.35}};
}
export function makeStars(){const rand=random(317),g=new T.BufferGeometry(),p=[],colors=[];for(let i=0;i<220;i++){const v=new T.Vector3(rand()-.5,rand()-.5,rand()-.5).normalize().multiplyScalar(18000);p.push(...v.toArray());const c=new T.Color().setHSL(.58+rand()*.08,.12,.7+rand()*.3);colors.push(c.r,c.g,c.b)}g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));return new T.Points(g,new T.PointsMaterial({map:glow,size:7,sizeAttenuation:false,vertexColors:true,transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false}))}

function makeNebula(b){
 const root=new T.Mesh(new T.SphereGeometry(b.r,12,8),new T.MeshBasicMaterial({color:0x8d79b7,transparent:true,opacity:.015,depthWrite:false}));root.userData.body=b;
 const rand=random([...b.name].reduce((s,c)=>s+c.charCodeAt(0),10));
 if(b.type==='NEBULA')for(let i=0;i<18;i++){const sprite=new T.Sprite(new T.SpriteMaterial({map:glow,color:new T.Color().setHSL(.64+rand()*.34,.5,.52),transparent:true,opacity:.1,blending:T.AdditiveBlending,depthWrite:false}));sprite.position.set((rand()-.5)*b.r*4,(rand()-.5)*b.r*2,(rand()-.5)*b.r*2);sprite.scale.set(b.r*(2+rand()*3),b.r*(1+rand()*2),1);root.add(sprite)}
 const g=new T.BufferGeometry(),points=[];for(let i=0;i<(b.type==='NEBULA'?400:1800);i++){const v=new T.Vector3(rand()-.5,rand()-.5,rand()-.5).normalize().multiplyScalar(rand()**1.8*b.r*2);points.push(...v.toArray())}g.setAttribute('position',new T.Float32BufferAttribute(points,3));root.add(new T.Points(g,new T.PointsMaterial({color:0xd1e3ff,size:1.6,sizeAttenuation:false,transparent:true,opacity:.8,depthWrite:false})));return root;
}

function makeGalaxy(b){const group=new T.Group(),points=[],colors=[],rand=random(b.name.length*89);for(let i=0;i<6000;i++){const r=Math.pow(rand(),.7)*b.r,a=i%3*Math.PI*2/3+r/b.r*7+rand()*.5;points.push(Math.cos(a)*r,(rand()-.5)*b.r*.05,Math.sin(a)*r*.6);const c=new T.Color().setHSL(.59+rand()*.08,.2,.5+rand()*.5);colors.push(c.r,c.g,c.b)}const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points,3));g.setAttribute('color',new T.Float32BufferAttribute(colors,3));group.add(new T.Points(g,new T.PointsMaterial({vertexColors:true,size:20,map:glow,transparent:true,opacity:.8,blending:T.AdditiveBlending,depthWrite:false})));group.material=new T.MeshBasicMaterial({color:b.color});group.userData.body=b;return group}
