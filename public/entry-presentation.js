import {deviceGyro} from './device-gyro.js?v=207';
const animate=async(node,frames,options)=>{if(!node?.animate)return;try{await node.animate(frames,{duration:650,easing:'cubic-bezier(.2,.8,.2,1)',...options}).finished}catch{}};
export function installEntryPresentation(root){
 if(root.entryPresentation)return root.entryPresentation;
 const doc=root.ownerDocument,win=doc.defaultView||globalThis.window;
 const options=()=>[...root.querySelectorAll('.entryMethods button')],title=()=>root.querySelector('.entryWelcome h1');
 const reduced=()=>win?.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
 const welcome=()=>{if(reduced())return;for(const [i,node]of options().entries())animate(node,[{transform:'translateY(60px)',opacity:0},{transform:'translateY(0)',opacity:1}],{delay:i*90});animate(title(),[{transform:'scale(0)',opacity:0},{transform:'scale(1)',opacity:1}],{duration:800})};
 const leave=async()=>{if(reduced())return;const nodes=root.dataset.entry==='welcome'?options():[root.querySelector('.accountCard')];await Promise.all([...nodes.map(node=>animate(node,[{transform:'translateY(0)',opacity:1},{transform:'translateY(65px)',opacity:0}])),animate(title(),[{transform:'scale(1)'},{transform:'scale(0)'}])])};
 const revealLoading=()=>{const boot=doc.getElementById('boot');boot?.classList.remove('hidden','ready');if(reduced())return Promise.resolve();return Promise.all([animate(boot?.querySelector('.bootTitle'),[{transform:'translateY(60px)',opacity:0},{transform:'translateY(0)',opacity:1}]),animate(boot?.querySelector('.bootProgressRow'),[{transform:'scaleX(0)'},{transform:'scaleX(1)'}])])};
 // Cover the handoff before showing the loading UI; leave game-entry fades alone.
 const blackFade=async action=>{
  if(reduced()||!doc.createElement||!doc.body)return action();
  const shade=doc.createElement('div');shade.id='entryLoadingFade';shade.setAttribute('aria-hidden','true');shade.style.cssText='position:fixed;inset:0;background:#000;opacity:0;z-index:2147483647;pointer-events:auto';doc.body.append(shade);
  try{await animate(shade,[{opacity:0},{opacity:1}],{duration:260});shade.style.opacity='1';const result=action();await animate(shade,[{opacity:1},{opacity:0}],{duration:380});return await result}finally{shade.remove()}
 };
 const startLoading=async()=>{await leave();await blackFade(()=>{root.hidden=true;return revealLoading()})};
 let loading=false;
 const load=async(task,{guest=false}={})=>{if(loading)return;loading=true;const boot=doc.getElementById('boot'),bar=doc.getElementById('sourceProgress'),text=doc.getElementById('sourcePercent');let previousHidden=root.hidden;const launch=doc.getElementById('launchBtn'),wasDisabled=launch?.disabled;try{if(boot){doc.getElementById('bootStatus').textContent=guest?'Preparing guest flight…':'Signing in…';doc.getElementById('sourceDetail').textContent=guest?'Preparing your ship and world':'Loading your account and saved progress';doc.getElementById('launchBtn').disabled=true}const update=p=>{if(bar)bar.style.width=p+'%';if(text)text.textContent=(p===100?'Ready':'Preparing')+' · '+p+'%'};update(0);await startLoading();await task(update);update(100)}finally{boot?.classList.add('hidden');if(launch)launch.disabled=wasDisabled;root.hidden=previousHidden;loading=false}};
 if(win?.MutationObserver){let visible=false;const observer=new win.MutationObserver(()=>{const next=!root.hidden&&root.dataset.entry==='welcome';if(next&&!visible)welcome();visible=next});observer.observe(root,{attributes:true,attributeFilter:['hidden','data-entry']});}
 if(win?.requestAnimationFrame){import('./entry-backdrop.js?v=207').then(({installEntryBackdrop})=>installEntryBackdrop(root,deviceGyro(win))).catch(()=>{});const intro=doc.getElementById('startupIntro');if(intro&&win.MutationObserver){const watcher=new win.MutationObserver(()=>{if(!intro.isConnected){watcher.disconnect();if(!root.hidden)welcome()}});watcher.observe(doc.body,{childList:true})}else welcome()}
 return root.entryPresentation={welcome,leave,load,revealLoading,startLoading};
}

