import * as T from './vendor/three.module.js';
export function warpTunnelStrength(nav){return nav?.kind==='warp'&&nav.sourceSystem!==nav.b.system?1:0}
export function tunnelPoint(distance,total=16200,seed=0,out=new T.Vector3()){const u=T.MathUtils.clamp((distance/total-.2)/.6,0,1),envelope=Math.pow(Math.sin(Math.PI*u),4);return out.set(Math.sin(u*Math.PI*2+seed)*700*envelope,Math.sin(u*Math.PI+seed*1.7)*420*envelope,-distance)}
export function tunnelTangent(distance,total=16200,seed=0,out=new T.Vector3()){return out.copy(tunnelPoint(distance+1,total,seed)).sub(tunnelPoint(distance-1,total,seed)).normalize()}
export function warpWhiteFade(nav){if(!warpTunnelStrength(nav))return 0;const p=nav.progress||0;return Math.max(1-T.MathUtils.smoothstep(p,0,.06),T.MathUtils.smoothstep(p,.94,1))}
export const TUNNEL_LENGTH=460,TUNNEL_SPEED=1800;
export const TEMPORAL_SPEED=9600,TEMPORAL_SECTION_LENGTH=920,TEMPORAL_SECTIONS=20;
// Four continuous heading changes, with straight approaches between the bends.
export function temporalPoint(distance,total=144000,out=new T.Vector3()){if(distance<=0)return out.set(0,0,-distance);let x=0,z=0,heading=0,cursor=0;const arc=total*.14;for(const [fraction,angle]of [[.12,Math.PI*2/3],[.32,-Math.PI*7/9],[.52,Math.PI*13/18],[.72,Math.PI*2/3]]){const start=total*fraction,straight=Math.max(0,Math.min(distance,start)-cursor);x+=Math.sin(heading)*straight;z-=Math.cos(heading)*straight;if(distance<=start)return out.set(x,0,z);const length=Math.min(arc,distance-start),k=angle/arc,next=heading+k*length;x+=(Math.cos(heading)-Math.cos(next))/k;z-=(Math.sin(next)-Math.sin(heading))/k;if(distance<=start+arc)return out.set(x,0,z);heading+=angle;cursor=start+arc;}const last=distance-cursor;return out.set(x+Math.sin(heading)*last,0,z-Math.cos(heading)*last);}
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
this.interiorBackground=new T.Color('#244671');this.hiddenRoots=[];this.transitPosition=new T.Vector3();this.basis=new T.Quaternion();this.forward=new T.Vector3();this.anchor=new T.Vector3();this.orientation=new T.Quaternion();this.localOrientation=new T.Quaternion();this.curveCenter=new T.Vector3();this.curveDirection=new T.Vector3();this.curveSeed=0;this.totalTravel=16200;this.curvature=1;this.temporalTurn=false;this.sectionLength=TUNNEL_LENGTH;this.speed=TUNNEL_SPEED;this.radius=72;}
 configureTemporal(temporal){this.sectionLength=temporal?TEMPORAL_SECTION_LENGTH:TUNNEL_LENGTH;this.speed=temporal?TEMPORAL_SPEED:TUNNEL_SPEED;this.radius=temporal?160:72;const count=temporal?TEMPORAL_SECTIONS:4;while(this.sections.length<count){const mesh=new T.Mesh(this.geometry.clone(),this.material);mesh.geometry.attributes.position.setUsage(T.DynamicDrawUsage);mesh.geometry.attributes.uv.setUsage(T.DynamicDrawUsage);mesh.frustumCulled=false;this.group.add(mesh);this.sections.push(mesh);}while(this.sections.length>count){const mesh=this.sections.pop();this.group.remove(mesh);mesh.geometry.dispose();}this.farCap.scale.setScalar(this.radius/72);for(const fog of this.fogLayers)fog.scale.setScalar(this.radius/72);}

 // Transit space uses the same floating-origin convention as the main universe:
 // fixed world sections minus the moving ship position. Camera pose is never read.
 update(nav,flight,time,quality='High',mobile=false,skyMap=null){this.uniforms.skyMap.value=skyMap;this.uniforms.hasSky.value=skyMap?1:0;this.active=nav?.kind==='warp';const strength=warpTunnelStrength(nav);this.strength=strength;this.enclosed=strength>.001;this.group.visible=this.enclosed;this.uniforms.time.value=time;this.uniforms.strength.value=strength*(!mobile&&/Ultra/.test(quality)?1:.85);if(!this.active){this.currentNav=null;return strength}
 if(this.currentNav!==nav){this.currentNav=nav;this.temporalTurn=!!nav.temporal;this.configureTemporal(this.temporalTurn);this.curvature=1;this.basis.copy(nav.transitQ||flight.q);this.forward.set(0,0,-1).applyQuaternion(this.basis);this.anchor.copy(nav.start||flight.pos||new T.Vector3());this.totalTravel=Math.max(1,(nav.duration||10)-1)*this.speed;this.curveSeed=[...(nav.b.name||nav.b.system||'warp')].reduce((n,c)=>n+c.charCodeAt(0),0)*.17}
 this.travel=Math.max(0,(nav.elapsed||0)-1)*this.speed;this.sectionIndex=Math.floor(this.travel/this.sectionLength);this.point(this.travel,this.curveCenter);this.tangent(this.travel,this.curveDirection);this.localOrientation.setFromUnitVectors(new T.Vector3(0,0,-1),this.curveDirection);this.orientation.copy(this.basis).multiply(this.localOrientation);this.transitPosition.copy(this.curveCenter).applyQuaternion(this.basis).add(this.anchor);this.group.quaternion.copy(this.basis);this.group.position.set(0,0,0);this.uniforms.skyBasis.value.setFromMatrix4(new T.Matrix4().makeRotationFromQuaternion(this.basis));
 const origin=this.geometry.attributes.position,uv=this.geometry.attributes.uv,travelOffset=this.travel-this.sectionIndex*this.sectionLength,frame=new T.Quaternion(),offset=new T.Vector3();
 for(let section=0;section<this.sections.length;section++){const mesh=this.sections[section],position=mesh.geometry.attributes.position,tex=mesh.geometry.attributes.uv;mesh.position.set(0,0,0);mesh.userData.worldSection=this.sectionIndex+section-1;let previous=Infinity,center=new T.Vector3();
 for(let i=0;i<origin.count;i++){const z=origin.getZ(i)*this.sectionLength/TUNNEL_LENGTH-(section-.5)*this.sectionLength+travelOffset,distance=this.travel-z;if(Math.abs(distance-previous)>.0001){this.point(distance,center);frame.setFromUnitVectors(new T.Vector3(0,0,-1),this.tangent(distance));previous=distance}offset.set(origin.getX(i)*this.radius/72,origin.getY(i)*this.radius/72,0).applyQuaternion(frame).add(center).sub(this.curveCenter);position.setXYZ(i,offset.x,offset.y,offset.z);tex.setXY(i,uv.getX(i),distance/this.sectionLength)}position.needsUpdate=true;tex.needsUpdate=true;}
 for(let i=0;i<this.fogLayers.length;i++){const fog=this.fogLayers[i],distance=(this.sectionIndex+i*(this.temporalTurn?4:1))*this.sectionLength;fog.userData.worldDistance=distance;this.point(distance,fog.position).sub(this.curveCenter);fog.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),this.tangent(distance))}
 const far=(this.sectionIndex+this.sections.length-1)*this.sectionLength;this.point(far,this.farCap.position).sub(this.curveCenter);this.farCap.quaternion.setFromUnitVectors(new T.Vector3(0,0,-1),this.tangent(far));return strength}
 point(distance,out=new T.Vector3()){if(this.temporalTurn)return temporalPoint(distance,this.totalTravel,out);tunnelPoint(distance,this.totalTravel,this.curveSeed,out);out.x*=this.curvature;out.y*=this.curvature;return out;}
 tangent(distance,out=new T.Vector3()){return out.copy(this.point(distance+1)).sub(this.point(distance-1)).normalize();}
 renderInterior(scene,keep,draw){if(!this.enclosed)return draw();const background=scene.background,fog=scene.fog;this.hiddenRoots.length=0;for(const root of scene.children)if(root.visible&&!root.isLight&&root!==this.group&&!keep.includes(root)){root.visible=false;this.hiddenRoots.push(root)}scene.background=this.interiorBackground;scene.fog=null;try{return draw()}finally{for(const root of this.hiddenRoots)root.visible=true;this.hiddenRoots.length=0;scene.background=background;scene.fog=fog}}

}

function warpDrift(time, point) {
 return point.set(Math.sin(time * 1.45) * .8, Math.sin(time * 2.1) * .42, Math.sin(time * 1.8) * 1.15);
}

// Keep the wake local to the ship so floating-origin changes cannot break it.
export class WarpShipMotion {
 constructor(ship) {
  this.ship = ship;
  this.offset = new T.Vector3();
  this.head = new T.Vector3();
  this.sample = new T.Vector3();
  this.inverseRoll = new T.Quaternion();
  this.rollAxis = new T.Vector3(0, 0, 1);
  this.geometry = new T.BufferGeometry();
  this.positions = new T.BufferAttribute(new Float32Array(2 * 17 * 3), 3).setUsage(T.DynamicDrawUsage);
  const colors = [];
  const indices = [];
  for (let wing = 0; wing < 2; wing++) {
   for (let sample = 0; sample <= 16; sample++) {
    colors.push(.66, .88, 1, .85 * (1 - sample / 16) ** 1.65);
    if (sample < 16) indices.push(wing * 17 + sample, wing * 17 + sample + 1);
   }
  }
  this.geometry.setAttribute('position', this.positions);
  this.geometry.setAttribute('color', new T.Float32BufferAttribute(colors, 4));
  this.geometry.setIndex(indices);
  this.material = new T.LineBasicMaterial({
   vertexColors: true, transparent: true, depthWrite: false,
   blending: T.AdditiveBlending, toneMapped: false,
  });
  this.trails = new T.LineSegments(this.geometry, this.material);
  this.trails.name = 'Warp wingtip trails';
  this.trails.frustumCulled = false;
  this.trails.visible = false;
  ship.add(this.trails);
  this.ribbonGeometry=new T.BufferGeometry();
  this.ribbonPositions=new T.Float32BufferAttribute(new Float32Array(34*2*3),3).setUsage(T.DynamicDrawUsage);
  this.ribbonColors=new T.Float32BufferAttribute(colors.flatMap((_,i)=>i%4===0?[...colors.slice(i,i+4),...colors.slice(i,i+4)]:[]),4);
  const faces=[];
  for(let wing=0;wing<2;wing++)for(let sample=0;sample<16;sample++){
   const start=(wing*17+sample)*2;
   faces.push(start,start+1,start+2,start+1,start+3,start+2);
  }
  this.ribbonGeometry.setAttribute('position',this.ribbonPositions);
  this.ribbonGeometry.setAttribute('color',this.ribbonColors);
  this.ribbonGeometry.setIndex(faces);
  this.ribbonMaterial=new T.MeshBasicMaterial({
   vertexColors:true,transparent:true,depthWrite:false,side:T.DoubleSide,
   blending:T.AdditiveBlending,toneMapped:false,opacity:.7,
  });
  const ribbon=new T.Mesh(this.ribbonGeometry,this.ribbonMaterial);
  ribbon.frustumCulled=false;
  this.trails.add(ribbon);
 }

 setColor(color){
  const custom=typeof color==='string'&&/^#[a-f0-9]{6}$/i.test(color);
  const attribute=this.geometry.attributes.color;
  if(this.material.userData.trailColor===(custom?color:null))return;
  this.material.userData.trailColor=custom?color:null;
  this.material.color.set(custom?color:0xffffff);
  this.ribbonMaterial.color.copy(this.material.color);
  for(let i=0;i<attribute.count;i++){
   attribute.setXYZ(i,custom?1:.66,custom?1:.88,1);
   this.ribbonColors.setXYZ(i*2,attribute.getX(i),attribute.getY(i),1);
   this.ribbonColors.setXYZ(i*2+1,attribute.getX(i),attribute.getY(i),1);
  }
  attribute.needsUpdate=true;this.ribbonColors.needsUpdate=true;
 }

 preview(tips){
  for(let wing=0;wing<2;wing++){
   const point=tips[wing];
   for(let i=0;i<=16;i++){
    this.positions.setXYZ(wing*17+i,point.x,point.y,point.z+i*.55);
   }
  }
  this.updateRibbon();
  this.trails.visible=true;
 }

 update(time, roll, tips, visible) {
  warpDrift(time, this.head);
  this.offset.copy(this.head).applyQuaternion(this.ship.quaternion);
  this.ship.position.add(this.offset);
  this.ship.rotateZ(roll);
  this.trails.visible = visible;
  if (!visible) return;
  this.inverseRoll.setFromAxisAngle(this.rollAxis, -roll);
  for (let wing = 0; wing < 2; wing++) {
   for (let i = 0; i <= 16; i++) {
    const age = i / 16;
    warpDrift(time - age * .72, this.sample).sub(this.head);
    this.sample.z += age * 34;
    this.sample.applyQuaternion(this.inverseRoll).add(tips[wing]);
    this.positions.setXYZ(wing * 17 + i, this.sample.x, this.sample.y, this.sample.z);
   }
  }
  this.updateRibbon();
 }

 updateRibbon(){
  this.positions.needsUpdate=true;
  for(let i=0;i<this.positions.count;i++){
   const x=this.positions.getX(i),y=this.positions.getY(i),z=this.positions.getZ(i);
   const width=.24*(1-(i%17)/16);
   this.ribbonPositions.setXYZ(i*2,x-width,y,z);
   this.ribbonPositions.setXYZ(i*2+1,x+width,y,z);
  }
  this.ribbonPositions.needsUpdate=true;
 }

 dispose() {
  this.trails.removeFromParent();
  this.ribbonGeometry.dispose();
  this.ribbonMaterial.dispose();
  this.geometry.dispose();
  this.material.dispose();
 }
}
