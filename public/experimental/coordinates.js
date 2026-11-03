import * as T from '../vendor/three.module.js';
const V=(x=0,y=0,z=0)=>new T.Vector3(x,y,z);
export const PLANET_RADIUS=2000;
export function cubeDirection(face,u,v){
 const p=[V(1,v,-u),V(-1,v,u),V(u,1,-v),V(u,-1,v),V(u,v,1),V(-u,v,-1)][face];
 return p.normalize();
}
export function cubeCoordinates(direction){
 const n=direction.clone().normalize(),a=[Math.abs(n.x),Math.abs(n.y),Math.abs(n.z)];
 let face,u,v;if(a[0]>=a[1]&&a[0]>=a[2]){face=n.x>=0?0:1;u=(face===0?-n.z:n.z)/a[0];v=n.y/a[0]}
 else if(a[1]>=a[2]){face=n.y>=0?2:3;u=n.x/a[1];v=(face===2?-n.z:n.z)/a[1]}
 else{face=n.z>=0?4:5;u=(face===4?n.x:-n.x)/a[2];v=n.y/a[2]}
 return {face,u:T.MathUtils.clamp(u,-1,1),v:T.MathUtils.clamp(v,-1,1)};
}
export function tangentFrame(up,forward=V(0,0,-1)){
 const n=up.clone().normalize(),f=forward.clone().addScaledVector(n,-forward.dot(n));
 if(f.lengthSq()<1e-10){f.copy(Math.abs(n.y)<.9?V(0,1,0):V(1,0,0));f.addScaledVector(n,-f.dot(n))}
 f.normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(f.clone().cross(n).normalize(),n,f.negate()));
}
// Parallel transport the previous local frame. No north/east re-creation at poles.
export class PlanetFrame{
 constructor(){this.up=V(0,1,0);this.q=tangentFrame(this.up)}
 reset(up,forward){this.up.copy(up).normalize();this.q.copy(tangentFrame(this.up,forward));return this.q}
 update(up){const n=up.clone().normalize();this.q.premultiply(new T.Quaternion().setFromUnitVectors(this.up,n)).normalize();this.up.copy(n);return this.q}
}
export function cellAt(direction,level,resolution){
 const {face,u,v}=cubeCoordinates(direction),tiles=2**level,grid=tiles*resolution;
 const sx=T.MathUtils.clamp((u+1)*.5*grid,0,grid-1e-8),sy=T.MathUtils.clamp((v+1)*.5*grid,0,grid-1e-8),i=Math.floor(sx),j=Math.floor(sy),a=sx-i,b=sy-j;
 return {face,u,v,i,j,a,b,grid,x:Math.floor(i/resolution),y:Math.floor(j/resolution)};
}
// Ray/triangle intersection in planet coordinates. Also returns the actual face normal.
export function triangleSurface(direction,p0,p1,p2){
 const n=direction.clone().normalize(),normal=p1.clone().sub(p0).cross(p2.clone().sub(p0)).normalize();
 if(normal.dot(n)<0)normal.negate();const radius=normal.dot(p0)/normal.dot(n);
 return {radius,normal,point:n.multiplyScalar(radius)};
}
export function sampleCell(direction,cell,vertex){
 const {i,j,a,b}=cell;let p0,p1,p2;
 if(a+b<=1){p0=vertex(i,j);p1=vertex(i,j+1);p2=vertex(i+1,j)}
 else{p0=vertex(i+1,j);p1=vertex(i,j+1);p2=vertex(i+1,j+1)}
 return triangleSurface(direction,p0,p1,p2);
}
