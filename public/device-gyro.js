// One sensor subscription shared by the entry camera and optional ship controls.
export class DeviceGyro{
 constructor(win=window){this.win=win;this.listeners=new Set();this.available=typeof win.DeviceOrientationEvent!=='undefined';this.permission='unknown';this.sample=null;this.onOrientation=e=>{if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;this.available=true;this.permission='granted';this.sample={beta:e.beta,gamma:e.gamma,time:Date.now()};for(const fn of this.listeners)fn(this.sample)};win.addEventListener('deviceorientation',this.onOrientation);}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 async request(){if(!this.available)return false;try{const ask=this.win.DeviceOrientationEvent.requestPermission;if(typeof ask==='function'&&await ask.call(this.win.DeviceOrientationEvent)!=='granted'){this.permission='denied';return false}this.permission='granted';return true}catch{this.permission='denied';return false}}
 axes(origin,sample=this.sample){if(!origin||!sample||Date.now()-sample.time>750)return {pitch:0,roll:0};
 // Gravity direction is invariant under equivalent beta/gamma Euler representations.
 // A fast move across +/-180 degrees must never become a full opposite input.
 const gravity=s=>{const b=s.beta*Math.PI/180,g=s.gamma*Math.PI/180;return {x:-Math.cos(b)*Math.sin(g),y:Math.sin(b),z:Math.cos(b)*Math.cos(g)}};
 const base=gravity(origin),next=gravity(sample),wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
 const pitch=Math.hypot(next.y,next.z)<.08?0:wrap(Math.atan2(next.y,next.z)-Math.atan2(base.y,base.z))*180/Math.PI;
 const roll=(Math.asin(-next.x)-Math.asin(-base.x))*180/Math.PI;
 const angle=(this.win.screen?.orientation?.angle||0)*Math.PI/180,clamp=v=>Math.max(-1,Math.min(1,v));return {pitch:clamp((pitch*Math.cos(angle)+roll*Math.sin(angle))/25),roll:clamp((roll*Math.cos(angle)-pitch*Math.sin(angle))/25)}}

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
 calibrate&&(calibrate.onclick=()=>{origin=null;smoother.reset();status.textContent='Hold your device comfortably · recalibrating.'});
 let wasActive=false;sensor.subscribe(sample=>{if(enabled&&!origin){origin=sample;status.textContent='Gyro Controls on. Tilt to steer your ship.'}});
 return {axes(){const on=enabled&&active()&&!doc.hidden;if(!on){wasActive=false;smoother.reset();return {pitch:0,roll:0}}if(!wasActive){origin=sensor.sample;wasActive=true}return smoother.step(sensor.axes(origin))}};
}
