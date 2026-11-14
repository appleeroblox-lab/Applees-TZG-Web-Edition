export const INTRO_HOLD_MS=1000,INTRO_FADE_MS=650;
// The sign-in flow is created behind the fade, only after the studio video ends.
export function playStartupIntro({doc=document,beforeReveal=()=>{},setTimer=setTimeout,clearTimer=clearTimeout,landscape=null}={}){
 const root=doc.getElementById('startupIntro'),video=doc.getElementById('startupIntroVideo'),tap=doc.getElementById('startupIntroPlay');
 if(!root||!video){root?.remove();beforeReveal();return Promise.resolve()}
 // Keep the intro inline with sound; browsers that block audible autoplay require a tap.
 video.controls=false;video.muted=false;video.defaultMuted=false;video.playsInline=true;video.disablePictureInPicture=true;video.disableRemotePlayback=true;
 video.removeAttribute('controls');video.removeAttribute('muted');
 for(const [name,value] of Object.entries({'playsinline':'','webkit-playsinline':'','x5-playsinline':'','x5-video-player-type':'h5','x5-video-player-fullscreen':'false','controlslist':'nodownload nofullscreen noremoteplayback','disablepictureinpicture':'','disableremoteplayback':''}))video.setAttribute(name,value);
 return new Promise((resolve,reject)=>{
  let finishing=false,handedOff=false,watchdog=null;const timers=new Set(),listeners=[];
  const later=(fn,ms)=>{const id=setTimer(()=>{timers.delete(id);fn()},ms);timers.add(id);return id};
  const listen=(node,name,fn)=>{node?.addEventListener(name,fn);listeners.push(()=>node?.removeEventListener(name,fn))};
  const cancelWatch=()=>{if(watchdog!==null){clearTimer(watchdog);timers.delete(watchdog);watchdog=null}};
  const cleanup=()=>{for(const id of timers)clearTimer(id);timers.clear();for(const off of listeners)off();video.pause?.();video.removeAttribute('src');video.load?.();root.remove()};
  const reveal=()=>{if(handedOff)return;handedOff=true;try{beforeReveal()}catch(error){cleanup();reject(error);return}root.style.opacity='0';later(()=>{cleanup();resolve()},INTRO_FADE_MS)};
  const finish=(hold=0)=>{if(finishing)return;finishing=true;cancelWatch();if(tap)tap.hidden=true;later(reveal,hold)};
  const watch=()=>{cancelWatch();if(!finishing)watchdog=later(()=>{if(doc.hidden)watch();else finish()},20000)};
  const showTap=()=>{cancelWatch();if(!finishing&&tap)tap.hidden=false};
  const play=()=>{try{return Promise.resolve(video.play())}catch(error){return Promise.reject(error)}};
  const playInline=()=>{if(finishing||video.ended||landscape&&!landscape.isLandscape())return;video.muted=false;if(tap)tap.hidden=true;watch();play().catch(error=>{if(error?.name==='NotAllowedError')showTap();else finish()})};
  listen(video,'ended',()=>finish(INTRO_HOLD_MS));listen(video,'error',()=>finish());
  listen(video,'playing',cancelWatch);listen(video,'timeupdate',cancelWatch);listen(video,'waiting',watch);listen(video,'stalled',watch);
  listen(root,'click',playInline);listen(root,'keydown',event=>{if(event.key==='Enter'||event.key===' '){event.preventDefault();playInline()}});
  const autoplay=()=>{if(finishing||landscape&&!landscape.isLandscape())return;watch();play().catch(error=>{if(finishing)return;if(error?.name!=='NotAllowedError'){finish();return}showTap()})};if(landscape)listeners.push(landscape.onChange(wide=>{if(finishing)return;if(wide)autoplay();else{cancelWatch();video.pause?.()}}));autoplay();
 });
}
