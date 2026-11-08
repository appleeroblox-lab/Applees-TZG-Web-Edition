export function installRestartFade(doc=document){
 let running=false;
 return action=>{if(running)return false;running=true;const root=doc.createElement('div');root.id='restartFade';root.setAttribute('aria-hidden','true');root.style.cssText='position:fixed;inset:0;background:#000;opacity:0;z-index:2147483647;pointer-events:auto';doc.body.append(root);doc.body.classList.add('restartFading');
 const done=()=>{root.remove();doc.body.classList.remove('restartFading');running=false};
 if(!root.animate||globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches){try{action()}finally{done()}return true}
 const enter=root.animate([{opacity:0},{opacity:1}],{duration:220,easing:'ease-in',fill:'forwards'});
 enter.onfinish=()=>{root.style.opacity='1';enter.cancel();try{action()}catch(error){done();throw error}const leave=root.animate([{opacity:1},{opacity:0}],{duration:380,easing:'ease-out',fill:'forwards'});leave.onfinish=done};return true;
 };
}
