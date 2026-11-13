// One sensor subscription shared by the entry camera and optional ship controls.
export class DeviceGyro{
 constructor(win=window){this.win=win;this.listeners=new Set();this.available=typeof win.DeviceOrientationEvent!=='undefined';this.permission='unknown';this.sample=null;this.onOrientation=e=>{if(!Number.isFinite(e.beta)||!Number.isFinite(e.gamma))return;this.available=true;this.permission='granted';this.sample={beta:e.beta,gamma:e.gamma,time:Date.now()};for(const fn of this.listeners)fn(this.sample)};win.addEventListener('deviceorientation',this.onOrientation);}
 subscribe(fn){this.listeners.add(fn);return()=>this.listeners.delete(fn)}
 async request(){if(!this.available)return false;try{const ask=this.win.DeviceOrientationEvent.requestPermission;if(typeof ask==='function'&&await ask.call(this.win.DeviceOrientationEvent)!=='granted'){this.permission='denied';return false}this.permission='granted';return true}catch{this.permission='denied';return false}}
 axes(origin,sample=this.sample){if(!origin||!sample||Date.now()-sample.time>750)return {pitch:0,roll:0};const angle=(this.win.screen?.orientation?.angle||0)*Math.PI/180,db=((sample.beta-origin.beta+540)%360)-180,dg=((sample.gamma-origin.gamma+540)%360)-180,clamp=v=>Math.max(-1,Math.min(1,v));return {pitch:clamp((db*Math.cos(angle)+dg*Math.sin(angle))/25),roll:clamp((dg*Math.cos(angle)-db*Math.sin(angle))/25)}}
}
let shared;export function deviceGyro(win=window){return shared||=new DeviceGyro(win)}
export function installGyroControls({doc=document,win=window,mobile=false,active=()=>true}={}){
 const sensor=deviceGyro(win),button=doc.getElementById('tiltEnable'),calibrate=doc.getElementById('tiltCalibrate');let enabled=false,origin=null,timer;
 const status=doc.createElement('p');status.id='gyroStatus';status.setAttribute('role','status');button?.after(status);
 const label=doc.createElement('label');label.className='check';const toggle=doc.createElement('input');toggle.type='checkbox';toggle.id='gyroControls';label.append(toggle,doc.createTextNode('Gyro Controls'));button?.replaceWith(label);
 const unsupported=()=>{enabled=false;toggle.checked=false;status.textContent='This device does not support Gyro Controls.'};
 if(!mobile||!sensor.available){toggle.disabled=true;unsupported()}
 toggle.onchange=async()=>{clearTimeout(timer);if(!toggle.checked){enabled=false;origin=null;status.textContent='Gyro Controls off.';return}if(!await sensor.request()){toggle.checked=false;status.textContent=sensor.available?'Motion permission was not granted. Enable motion access in your browser to use Gyro Controls.':'This device does not support Gyro Controls.';return}enabled=true;origin=sensor.sample;status.textContent='Hold your device comfortably to calibrate.';timer=setTimeout(()=>{if(!sensor.sample)unsupported()},1800)};
 calibrate&&(calibrate.onclick=()=>{origin=null;status.textContent='Hold your device comfortably · recalibrating.'});
 let wasActive=false;sensor.subscribe(sample=>{if(enabled&&!origin){origin=sample;status.textContent='Gyro Controls on. Tilt to steer your ship.'}});
 return {axes(){const on=enabled&&active()&&!doc.hidden;if(!on){wasActive=false;return {pitch:0,roll:0}}if(!wasActive){origin=sensor.sample;wasActive=true}return sensor.axes(origin)}};
}
