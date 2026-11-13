// One sensor subscription shared by the entry camera and optional ship controls.
export class DeviceGyro{
 constructor(win=window){this.win=win;this.listeners=new Set();this.available=typeof win.DeviceOrientationEvent!=='undefined';this.permission='unknown';this.sample=null;this.onOrientation=e=>{if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;this.available=true;this.permission='granted';this.sample={alpha:Number.isFinite(e.alpha)?e.alpha:0,beta:e.beta,gamma:e.gamma,time:Date.now()};for(const fn of this.listeners)fn(this.sample)};win.addEventListener('deviceorientation',this.onOrientation);}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 async request(){if(!this.available)return false;try{const ask=this.win.DeviceOrientationEvent.requestPermission;if(typeof ask==='function'&&await ask.call(this.win.DeviceOrientationEvent)!=='granted'){this.permission='denied';return false}this.permission='granted';return true}catch{this.permission='denied';return false}}
 axes(origin,sample=this.sample){
  if(!origin||!sample||Date.now()-sample.time>750)return {pitch:0,roll:0};
  // Compare full device attitudes in the calibrated device frame. Rotating
  // beta/gamma angles after projection mixes pitch and roll in landscape.
  const attitude=s=>{const r=Math.PI/360,a=(s.alpha||0)*r,b=s.beta*r,g=s.gamma*r;
   const ca=Math.cos(a),sa=Math.sin(a),cb=Math.cos(b),sb=Math.sin(b),cg=Math.cos(g),sg=Math.sin(g);
   return {x:ca*sb*cg-sa*cb*sg,y:ca*cb*sg+sa*sb*cg,z:sa*cb*cg+ca*sb*sg,w:ca*cb*cg-sa*sb*sg};};
  const a=attitude(origin),b=attitude(sample);
  let x=a.w*b.x-a.x*b.w-a.y*b.z+a.z*b.y,y=a.w*b.y+a.x*b.z-a.y*b.w-a.z*b.x,z=a.w*b.z-a.x*b.y+a.y*b.x-a.z*b.w,w=a.w*b.w+a.x*b.x+a.y*b.y+a.z*b.z;
  if(w<0){x=-x;y=-y;z=-z;w=-w}
  const length=Math.hypot(x,y,z),scale=length>1e-8?2*Math.atan2(length,w)/length*180/Math.PI:0;
  const angle=(this.win.screen?.orientation?.angle??this.win.orientation??0)*Math.PI/180,clamp=v=>Math.max(-1,Math.min(1,v))||0;
  return {pitch:clamp((x*Math.cos(angle)+y*Math.sin(angle))*scale/25),roll:clamp((y*Math.cos(angle)-x*Math.sin(angle))*scale/25)};
 }

}
export class GyroSmoother{
 constructor(){this.reset()}
 reset(){this.value={pitch:0,roll:0};this.target={pitch:0,roll:0};this.time=null}
 step(target,time=globalThis.performance?.now?.()??Date.now()){
  const dt=this.time===null?1/60:Math.max(0,Math.min((time-this.time)/1000,.05));this.time=time;
  // Filter sensor noise first, then ease steering each animation frame. Keeping
  // both stages running between sensor events avoids staircase motion.
  const inputBlend=1-Math.exp(-18*dt),blend=1-Math.exp(-12*dt),limit=2.5*dt;
  for(const key of ['pitch','roll']){
   const raw=Number.isFinite(target[key])?Math.max(-1,Math.min(1,target[key])):0;
   const desired=Math.abs(raw)<=.02?0:Math.sign(raw)*(Math.abs(raw)-.02)/.98;
   this.target[key]+=(desired-this.target[key])*inputBlend;
   const difference=(this.target[key]-this.value[key])*blend;
   this.value[key]+=Math.max(-limit,Math.min(limit,difference));
  }
  return {...this.value};
 }
}
let shared;export function deviceGyro(win=window){return shared||=new DeviceGyro(win)}
export function installGyroControls({doc=document,win=window,mobile=false,active=()=>true}={}){
 const sensor=deviceGyro(win),button=doc.getElementById('tiltEnable'),calibrate=doc.getElementById('tiltCalibrate');let enabled=false,origin=null,timer;const smoother=new GyroSmoother();
 const status=doc.createElement('p');status.id='gyroStatus';status.setAttribute('role','status');button?.after(status);
 const label=doc.createElement('label');label.className='check';label.id='gyroControlsRow';const toggle=doc.createElement('input');toggle.type='checkbox';toggle.id='gyroControls';toggle.checked=false;label.append(toggle,doc.createTextNode('Gyro Controls'));button?.replaceWith(label);const controls=[...doc.querySelectorAll('.settingsSection')].find(section=>section.dataset.pages==='controls'||section.querySelector('h3')?.textContent.trim()==='Controls');if(controls){controls.append(label,status);if(calibrate)controls.append(calibrate)}const shift=doc.getElementById('onFootShiftLock')?.closest('label');if(shift)shift.after(label,status,...(calibrate?[calibrate]:[]));
 const unsupported=()=>{enabled=false;toggle.checked=false;status.textContent='This device does not support Gyro Controls.'};
 if(!mobile||!sensor.available){toggle.disabled=true;unsupported()}
 toggle.onchange=async()=>{clearTimeout(timer);if(!toggle.checked){enabled=false;origin=null;smoother.reset();status.textContent='Gyro Controls off.';return}if(!await sensor.request()){toggle.checked=false;status.textContent=sensor.available?'Motion permission was not granted. Enable motion access in your browser to use Gyro Controls.':'This device does not support Gyro Controls.';return}enabled=true;origin=sensor.sample;status.textContent='Hold your device comfortably to calibrate.';timer=setTimeout(()=>{if(!sensor.sample)unsupported()},1800)};
 calibrate&&(calibrate.onclick=()=>{origin=null;previous=null;motion={pitch:0,roll:0};smoother.reset();status.textContent='Hold your device comfortably · recalibrating.'});
 let wasActive=false,previous=null,motion={pitch:0,roll:0};
 sensor.subscribe(sample=>{
  if(!enabled)return;
  if(!origin){origin=sample;smoother.reset();previous=null;status.textContent='Gyro Controls on. Move your device to steer your ship.'}
  motion={pitch:0,roll:0};
  const dt=previous?(sample.time-previous.time)/1000:0;
  if(wasActive&&dt>0&&dt<.2){
   const delta=sensor.axes(previous,sample);
   for(const key of ['pitch','roll']){const rate=delta[key]*.35/dt;motion[key]=Math.abs(rate)<.035?0:Math.max(-1,Math.min(1,rate));}
  }
  previous=sample;
 });
 const reorient=()=>{origin=null;previous=null;motion={pitch:0,roll:0};smoother.reset();wasActive=false};
 win.addEventListener('orientationchange',reorient);win.screen?.orientation?.addEventListener?.('change',reorient);
 return {axes(){const on=enabled&&active()&&!doc.hidden;if(!on){wasActive=false;previous=null;motion={pitch:0,roll:0};smoother.reset();return {pitch:0,yaw:0}}if(!wasActive){origin=sensor.sample;previous=sensor.sample;motion={pitch:0,roll:0};wasActive=true}const value=smoother.step(sensor.sample&&Date.now()-sensor.sample.time<150?motion:{pitch:0,roll:0});return {pitch:-value.pitch||0,yaw:-value.roll||0}}};
}

