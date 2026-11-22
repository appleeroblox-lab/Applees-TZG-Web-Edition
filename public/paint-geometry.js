import * as T from './vendor/three.module.js';

// Copy contiguous triangle runs without dropping normals, UVs or vertex colors.
export function geometryFromRanges(geometry,ranges){
 const result=new T.BufferGeometry();
 const vertices=ranges.reduce((count,range)=>count+range.count,0);
 for(const [name,attribute] of Object.entries(geometry.attributes)){
  const {array,itemSize,normalized}=attribute;
  const output=new array.constructor(vertices*itemSize);
  let offset=0;
  for(const {start,count} of ranges){
   output.set(array.subarray(start*itemSize,(start+count)*itemSize),offset);
   offset+=count*itemSize;
  }
  result.setAttribute(name,new T.BufferAttribute(output,itemSize,normalized));
 }
 return result;
}
