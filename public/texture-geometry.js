import * as T from './vendor/three.module.js';
// Roblox cube-cross atlases need face-local UVs, rather than latitude/longitude UVs.
export function bodySphereGeometry(body,radius=body.r,segments=24,sphereWidth=96,sphereHeight=64){
 if(body.textureLayout!=='cube-cross')return new T.SphereGeometry(radius,sphereWidth,sphereHeight);
 const faces=[[[1,0,0],[0,0,-1],[0,1,0],2,1],[[-1,0,0],[0,0,1],[0,1,0],0,1],[[0,1,0],[1,0,0],[0,0,-1],1,0],[[0,-1,0],[1,0,0],[0,0,1],1,2],[[0,0,1],[1,0,0],[0,1,0],1,1],[[0,0,-1],[-1,0,0],[0,1,0],3,1]],positions=[],normals=[],uvs=[],indices=[];
 for(const [n,u,v,col,row]of faces){const base=positions.length/3;for(let y=0;y<=segments;y++)for(let x=0;x<=segments;x++){const s=x/segments*2-1,t=y/segments*2-1,p=new T.Vector3(...n).addScaledVector(new T.Vector3(...u),s).addScaledVector(new T.Vector3(...v),t).normalize();normals.push(...p.toArray());positions.push(...p.multiplyScalar(radius).toArray());uvs.push((col+.01+.98*x/segments)/4,1-(row+.01+.98*(1-y/segments))/3)}for(let y=0;y<segments;y++)for(let x=0;x<segments;x++){const a=base+y*(segments+1)+x;indices.push(a,a+1,a+segments+1,a+1,a+segments+2,a+segments+1)}}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);return geometry;
}
export function drawBodyMap(ctx,image,body,x,y,w,h){if(body.textureLayout==='cube-cross')ctx.drawImage(image,image.width/4,image.height/3,image.width/4,image.height/3,x,y,w,h);else ctx.drawImage(image,x,y,w,h)}
