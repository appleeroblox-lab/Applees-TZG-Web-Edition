import {performance} from 'node:perf_hooks';
import * as T from '../public/vendor/three.module.js';
import {SurfaceStream} from '../public/surface-streaming.js';

const viewBased=process.argv.includes('--view');
const mobile=!process.argv.includes('--desktop');
const scene=new T.Scene();
const stream=new SurfaceStream({scene,session:{body:{id:'Earth',name:'Earth',solid:true,type:'PLANET'}}});
const camera=new T.PerspectiveCamera(55,16/9,.1,6000), matrix=new T.Matrix4(), frustum=new T.Frustum();
const pos=new T.Vector3(), samples=[];
for(let frame=0;frame<360;frame++){
 const start=performance.now(), angle=frame*Math.PI/90;
 pos.set(frame<240?frame*.24:58+(frame-240)*8,frame<240?3:3+(frame-240)*.75,frame*.15);
 camera.position.copy(pos).add(new T.Vector3(0,1.5,0));
 const downward=frame%120>60;
 camera.lookAt(pos.x+Math.sin(angle)*10,pos.y-(downward?23:2),pos.z-Math.cos(angle)*10);
 camera.updateMatrixWorld();
 stream.update(pos,'High',{mobile,...viewBased&&{camera,dt:1/60}});
 scene.updateMatrixWorld();
 frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
 let draws=0, triangles=0, geometryBytes=0;
 const buffers=new Set();
 scene.traverse(mesh=>{
  if(!mesh.geometry)return;
  for(const attribute of [...Object.values(mesh.geometry.attributes),mesh.geometry.index]){
   if(attribute?.array)buffers.add(attribute.array.buffer);
  }
 });
 for(const buffer of buffers)geometryBytes+=buffer.byteLength;
 scene.traverseVisible(mesh=>{
  if(!mesh.isMesh||!mesh.geometry.attributes.position.count||mesh.frustumCulled&&!frustum.intersectsObject(mesh))return;
  draws++;triangles+=Math.min(mesh.geometry.drawRange.count,mesh.geometry.index?.count??mesh.geometry.attributes.position.count)/3;
 });
 if(frame>=30)samples.push({ms:performance.now()-start,draws,triangles,geometryBytes,visibleChunks:[...stream.chunks.values()].filter(g=>g.visible&&frustum.intersectsObject(g.children[0])).length});
}
const quantile=(name,p)=>samples.map(row=>row[name]).sort((a,b)=>a-b)[Math.floor((samples.length-1)*p)];
const average=name=>Number((samples.reduce((sum,row)=>sum+row[name],0)/samples.length).toFixed(2));
global.gc?.();
console.log(JSON.stringify({
 mode:viewBased?'view':'baseline',profile:mobile?'mobile':'desktop',
 averageCpuFrameMs:average('ms'),p95CpuFrameMs:Number(quantile('ms',.95).toFixed(2)),
 averageDraws:average('draws'),averageTriangles:average('triangles'),averageVisibleChunks:average('visibleChunks'),
 averageGeometryBytes:average('geometryBytes'),heapUsedBytes:process.memoryUsage().heapUsed
}));
