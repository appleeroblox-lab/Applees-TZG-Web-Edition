export const POOL_SEGMENTS=16;
export function poolShape(x,z,radius,angle=0){const normals=Array.from({length:POOL_SEGMENTS},(_,i)=>{const a=angle+(i+.5)*Math.PI*2/POOL_SEGMENTS;return [Math.cos(a),Math.sin(a)]});return {x,z,radius,angle,normals,apothem:Math.cos(Math.PI/POOL_SEGMENTS)}}
// Matches the actual inscribed polygon, with a small WORLD-space shore inset.
export function clampPoolPoint(x,z,shape,out){const radius=Math.max(.001,shape.radius),dx=(x-shape.x)/radius,dz=(z-shape.z)/(radius*.75),inset=Math.min(.025/radius,.12),limit=shape.apothem-inset;let scale=1;for(const [nx,nz] of shape.normals){const dot=dx*nx+dz*nz;if(dot>limit)scale=Math.min(scale,limit/dot)}out.x=shape.x+dx*scale*radius;out.z=shape.z+dz*scale*radius*.75;return out}
export function insidePool(x,z,shape,margin=0){const dx=(x-shape.x)/shape.radius,dz=(z-shape.z)/(shape.radius*.75);return shape.normals.every(([nx,nz])=>dx*nx+dz*nz<=shape.apothem+margin/shape.radius)}

export function poolClearance(x,z,shape){const dx=(x-shape.x)/shape.radius,dz=(z-shape.z)/(shape.radius*.75);let distance=Infinity;for(const [nx,nz] of shape.normals)distance=Math.min(distance,(shape.apothem-dx*nx-dz*nz)*shape.radius*.75);return distance}
