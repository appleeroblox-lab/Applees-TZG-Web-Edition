export function installRestartFade(doc=document){
 let recover=null;
 const start=action=>{
  if(recover)return false;
  const root=doc.createElement('div');
  root.id='restartFade';root.dataset.recoveryFade='';root.setAttribute('aria-hidden','true');
  root.style.cssText='position:fixed;inset:0;background:#000;opacity:0;z-index:2147483647;pointer-events:auto';
  doc.body.append(root);doc.body.classList.add('restartFading');
  let entered=false, timer, animation;
  function done(){
   clearTimeout(timer);animation?.cancel();root.remove();
   doc.body.classList.remove('restartFading');recover=null;
  }
  function enter(skipAnimation=false){
   if(entered){if(skipAnimation)done();return}
   entered=true;clearTimeout(timer);animation?.cancel();root.style.opacity='1';
   try{action()}catch(error){done();throw error}
   if(skipAnimation){done();return}
   animation=root.animate([{opacity:1},{opacity:0}],{duration:380,easing:'ease-out',fill:'forwards'});
   animation.onfinish=done;
   timer=setTimeout(done,630);
  }
  recover=()=>enter(true);
  if(!root.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){enter(true);return true}
  animation=root.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-in',fill:'forwards'});
  animation.onfinish=()=>enter();
  timer=setTimeout(enter,470);
  return true;
 };
 start.recover=()=>recover?.();
 return start;
}
