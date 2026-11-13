import * as T from './vendor/three.module.js';
export const ENTRY_MAX_ANGLE=.045;
// Bound every corner ray at all extreme camera angles; the decal always covers
// the frustum, including portrait, ultrawide and orientation changes.
export function entryPlaneSize(camera,distance=5){
 let x=0,y=0;const saved=camera.rotation.clone();camera.position.set(0,0,distance);
 for(const pitch of [-ENTRY_MAX_ANGLE,ENTRY_MAX_ANGLE])for(const yaw of [-ENTRY_MAX_ANGLE,ENTRY_MAX_ANGLE]){camera.rotation.set(pitch,yaw,0,'YXZ');camera.updateMatrixWorld();for(const u of [-1,1])for(const v of [-1,1]){const ray=new T.Vector3(u,v,.5).unproject(camera).sub(camera.position).normalize(),t=-distance/ray.z;x=Math.max(x,Math.abs(ray.x*t));y=Math.max(y,Math.abs(ray.y*t))}}
 camera.rotation.copy(saved);camera.updateMatrixWorld();return {width:x*2*1.12,height:y*2*1.12};
}
export function installEntryBackdrop(root,sensor){
 if(root.querySelector('.entryBackdrop'))return;const doc=root.ownerDocument,win=doc.defaultView;
 let renderer;try{renderer=new T.WebGLRenderer({alpha:false,antialias:false,powerPreference:'low-power'})}catch{return}
 const canvas=renderer.domElement;canvas.className='entryBackdrop';canvas.setAttribute('aria-hidden','true');root.prepend(canvas);renderer.setPixelRatio(Math.min(win.devicePixelRatio||1,1.5));renderer.outputColorSpace=T.SRGBColorSpace;
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(45,1,.1,20),geometry=new T.PlaneGeometry(1,1),material=new T.MeshBasicMaterial({color:0xffffff}),plane=new T.Mesh(geometry,material);scene.add(plane);camera.position.z=5;
 let target={x:0,y:0},current={x:0,y:0},drag=null,origin=null,texture=null,last=0,frame,disposed=false,active=false;
 const mobile=win.matchMedia?.('(pointer: coarse)').matches;
 const resize=()=>{const w=win.innerWidth,h=win.innerHeight;camera.aspect=w/h;camera.updateProjectionMatrix();const size=entryPlaneSize(camera);plane.scale.set(size.width,size.height,1);renderer.setSize(w,h,false);if(texture){const imageAspect=texture.image.width/texture.image.height,planeAspect=size.width/size.height;texture.repeat.set(Math.min(1,planeAspect/imageAspect),Math.min(1,imageAspect/planeAspect));texture.offset.set((1-texture.repeat.x)/2,(1-texture.repeat.y)/2);texture.needsUpdate=true}};
 new T.TextureLoader().load('images/entry/background.png',value=>{if(disposed){value.dispose();return}texture=value;texture.colorSpace=T.SRGBColorSpace;material.map=texture;material.needsUpdate=true;resize();canvas.classList.add('ready')});resize();
 const allowed=e=>!e.target.closest?.('button,input,select,textarea,a,dialog,.accountCard,.entryRules');
 const down=e=>{if(!mobile||!allowed(e))return;drag={id:e.pointerId,x:e.clientX,y:e.clientY,start:{...target}};root.setPointerCapture?.(e.pointerId);sensor.request()};
 const move=e=>{if(!mobile){target.x=Math.max(-1,Math.min(1,e.clientX/win.innerWidth*2-1));target.y=Math.max(-1,Math.min(1,e.clientY/win.innerHeight*2-1))}else if(drag?.id===e.pointerId&&(!sensor.sample||sensor.permission!=='granted')){target.x=Math.max(-1,Math.min(1,drag.start.x+(e.clientX-drag.x)/160));target.y=Math.max(-1,Math.min(1,drag.start.y+(e.clientY-drag.y)/160))}};
 const up=()=>drag=null;root.addEventListener('pointerdown',down);root.addEventListener('pointermove',move);root.addEventListener('pointerup',up);root.addEventListener('pointercancel',up);
 // Permission requests must be in a user gesture on iOS; entry camera permission
 // does not enable ship steering. Drag remains available until valid samples.
 const request=()=>{if(mobile&&!root.hidden)sensor.request()};root.addEventListener('click',request);
 const unsubscribe=sensor.subscribe(sample=>{if(root.hidden||!mobile)return;if(!origin)origin=sample;const axes=sensor.axes(origin,sample);target={x:axes.roll,y:axes.pitch}});
 const render=time=>{frame=win.requestAnimationFrame(render);if(root.hidden||doc.hidden){active=false;last=time;return}if(!active){active=true;origin=sensor.sample}const dt=Math.min((time-last)/1000,.05)||.016;last=time;const ease=1-Math.exp(-18*dt);current.x+=(target.x-current.x)*ease;current.y+=(target.y-current.y)*ease;camera.rotation.set(-current.y*ENTRY_MAX_ANGLE,-current.x*ENTRY_MAX_ANGLE,0,'YXZ');renderer.render(scene,camera)};frame=win.requestAnimationFrame(render);
 win.addEventListener('resize',resize);win.addEventListener('orientationchange',resize);win.addEventListener('pagehide',e=>{if(e.persisted)return;disposed=true;win.cancelAnimationFrame(frame);unsubscribe();win.removeEventListener('resize',resize);win.removeEventListener('orientationchange',resize);geometry.dispose();material.dispose();texture?.dispose();renderer.dispose()},{once:true});
}
